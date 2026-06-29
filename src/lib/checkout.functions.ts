import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CartItemSchema = z.object({
  lineId: z.string(),
  kind: z.enum(["product", "combo", "byob"]),
  refId: z.string().uuid(),
  name: z.string(),
  imageUrl: z.string().nullable().optional(),
  unitPrice: z.number().int().nonnegative(),
  regularPrice: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  size: z.string().nullable().optional(),
  selections: z
    .array(z.object({ productId: z.string().uuid(), name: z.string() }))
    .optional(),
});

const CheckoutSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(6).max(20),
    address: z.string().trim().min(5).max(500),
    email: z.string().trim().email().max(255).optional().or(z.literal("")),
  }),
  deliveryZoneId: z.string().uuid(),
  paymentMethod: z.string().min(1).max(60),
  items: z.array(CartItemSchema).min(1),
  referralCode: z.string().trim().max(40).optional().or(z.literal("")),
  couponCode: z.string().trim().max(40).optional().or(z.literal("")),
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VE-${ts}-${rand}`;
}

// Normalize Bangladeshi phone numbers to canonical +8801XXXXXXXXX form so
// "01712345678", "8801712345678", "+880 1712-345678" all match the same customer.
export function normalizePhone(input: string): string {
  if (!input) return "";
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("880")) {
    // already has country code
  } else if (digits.startsWith("0")) {
    digits = "880" + digits.slice(1);
  } else if (digits.length === 10 && digits.startsWith("1")) {
    digits = "880" + digits;
  }
  return "+" + digits;
}

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CheckoutSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load zone for fee + free shipping
    const { data: zone, error: zoneErr } = await supabaseAdmin
      .from("delivery_zones")
      .select("id,zone_name,fee_amount,free_shipping_threshold,is_active")
      .eq("id", data.deliveryZoneId)
      .maybeSingle();
    if (zoneErr || !zone || !zone.is_active) throw new Error("Invalid delivery zone");

    // Validate stock availability for every product line in the cart
    const productIds = Array.from(
      new Set(data.items.filter((i) => i.kind === "product").map((i) => i.refId)),
    );
    if (productIds.length > 0) {
      const { data: stockRows, error: stockErr } = await supabaseAdmin
        .from("products")
        .select("id,name,in_stock,is_active")
        .in("id", productIds);
      if (stockErr) throw new Error("Could not verify stock");
      const byId = new Map((stockRows ?? []).map((p) => [p.id, p]));
      const unavailable: string[] = [];
      for (const item of data.items) {
        if (item.kind !== "product") continue;
        const p = byId.get(item.refId);
        if (!p || !p.is_active || !p.in_stock) {
          unavailable.push(`${p?.name ?? item.name}${item.size ? ` (${item.size})` : ""}`);
        }
        if (item.quantity < 1 || item.quantity > 99) {
          throw new Error(`Invalid quantity for ${item.name}`);
        }
      }
      if (unavailable.length > 0) {
        throw new Error(`Out of stock: ${unavailable.join(", ")}`);
      }
    }


    const subtotal = data.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const freeThreshold = zone.free_shipping_threshold ?? 0;
    const shippingFee =
      freeThreshold > 0 && subtotal >= freeThreshold ? 0 : zone.fee_amount;

    // Referral: simple flat discount if code matches an active row
    let discount = 0;
    const refCode = (data.referralCode ?? "").trim();
    if (refCode) {
      const { data: ref } = await supabaseAdmin
        .from("referral_codes")
        .select("code,discount_amount,is_active")
        .eq("code", refCode)
        .eq("is_active", true)
        .maybeSingle();
      if (ref) discount += Math.min(ref.discount_amount ?? 0, subtotal);
    }

    // Coupon: percent or flat discount, with min order, max cap, expiry, usage limit
    const couponCode = (data.couponCode ?? "").trim();
    let couponApplied: string | null = null;
    if (couponCode) {
      const { data: cp } = await supabaseAdmin
        .from("coupons")
        .select("code,discount_type,discount_value,min_order_amount,max_discount,expires_at,usage_limit,used_count,is_active")
        .eq("code", couponCode)
        .eq("is_active", true)
        .maybeSingle();
      if (!cp) throw new Error("Invalid coupon code");
      if (cp.expires_at && new Date(cp.expires_at) < new Date()) throw new Error("Coupon expired");
      if (cp.usage_limit != null && cp.used_count >= cp.usage_limit) throw new Error("Coupon usage limit reached");
      if (subtotal < (cp.min_order_amount ?? 0)) {
        throw new Error(`Coupon requires minimum order of ${cp.min_order_amount}`);
      }
      let cd = cp.discount_type === "percent"
        ? Math.floor((subtotal * cp.discount_value) / 100)
        : cp.discount_value;
      if (cp.max_discount != null) cd = Math.min(cd, cp.max_discount);
      discount += Math.min(cd, Math.max(0, subtotal - discount));
      couponApplied = cp.code;
    }

    discount = Math.min(discount, subtotal);
    const total = Math.max(0, subtotal + shippingFee - discount);

    // Upsert customer by normalized phone (handles "017...", "8801...", "+880 17...", etc.)
    const normalizedPhone = normalizePhone(data.customer.phone);
    const customerPayload = { ...data.customer, phone: normalizedPhone };

    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    let customerId = existing?.id;
    if (customerId) {
      await supabaseAdmin
        .from("customers")
        .update({
          name: data.customer.name,
          address: data.customer.address,
          email: data.customer.email || null,
          phone: normalizedPhone,
        })
        .eq("id", customerId);
    } else {
      const { data: created, error: cErr } = await supabaseAdmin
        .from("customers")
        .insert({
          phone: normalizedPhone,
          name: data.customer.name,
          address: data.customer.address,
          email: data.customer.email || null,
        })
        .select("id")
        .single();
      if (cErr || !created) throw new Error("Failed to save customer");
      customerId = created.id;
    }

    const orderNumber = generateOrderNumber();

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        customer_json: customerPayload,
        items_json: data.items,
        subtotal,
        shipping_fee: shippingFee,
        discount,
        total,
        delivery_zone_id: zone.id,
        payment_method: data.paymentMethod,
        payment_status: "Pending",
        order_status: "Pending",
        referral_used: refCode || null,
        coupon_used: couponApplied,
      })
      .select("id,order_number,total")
      .single();
    if (oErr || !order) throw new Error("Failed to place order");

    // Record referral usage (best-effort)
    if (refCode && discount > 0) {
      await supabaseAdmin
        .from("referral_usage")
        .insert({ referral_code: refCode, order_id: order.id });
    }

    // Increment coupon used_count (best-effort)
    if (couponApplied) {
      await supabaseAdmin.rpc as never; // noop placeholder
      const { data: cur } = await supabaseAdmin
        .from("coupons").select("used_count").eq("code", couponApplied).maybeSingle();
      if (cur) {
        await supabaseAdmin
          .from("coupons")
          .update({ used_count: (cur.used_count ?? 0) + 1 })
          .eq("code", couponApplied);
      }
    }

    return {
      id: order.id,
      orderNumber: order.order_number,
      total: order.total,
      subtotal,
      shippingFee,
      discount,
    };
  });
