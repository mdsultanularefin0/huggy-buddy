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

const ValidateCouponSchema = z.object({
  code: z.string().trim().min(1).max(40),
  subtotal: z.number().int().nonnegative(),
});

export const validateCoupon = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ValidateCouponSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cp, error } = await supabaseAdmin
      .from("coupons")
      .select("code,discount_type,discount_value,min_order_amount,max_discount,expires_at,usage_limit,used_count,is_active")
      .ilike("code", data.code)
      .maybeSingle();
    if (error) throw new Error("Could not validate coupon");
    if (!cp || !cp.is_active) throw new Error("Invalid coupon code");
    if (cp.expires_at && new Date(cp.expires_at) < new Date()) throw new Error("This coupon has expired");
    if (cp.usage_limit != null && cp.used_count >= cp.usage_limit) throw new Error("This coupon has reached its usage limit");
    if (data.subtotal < (cp.min_order_amount ?? 0)) {
      throw new Error(`Add more to reach the minimum order of ${cp.min_order_amount} for this coupon`);
    }
    let discount = cp.discount_type === "percent"
      ? Math.floor((data.subtotal * cp.discount_value) / 100)
      : cp.discount_value;
    if (cp.max_discount != null) discount = Math.min(discount, cp.max_discount);
    discount = Math.min(discount, data.subtotal);
    return { code: cp.code, discount, discountType: cp.discount_type, discountValue: cp.discount_value };
  });

const ValidateReferralSchema = z.object({
  code: z.string().trim().min(1).max(40),
  subtotal: z.number().int().nonnegative(),
});

export const validateReferral = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ValidateReferralSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ref, error } = await supabaseAdmin
      .from("referral_codes")
      .select("code,discount_amount,is_active")
      .ilike("code", data.code)
      .maybeSingle();
    if (error) throw new Error("Could not validate referral code");
    if (!ref || !ref.is_active) throw new Error("Invalid referral code");
    const refDiscount = Math.max(0, ref.discount_amount ?? 0);
    if (refDiscount <= 0) throw new Error("Referral code has no discount");
    return { code: ref.code, discount: Math.min(refDiscount, data.subtotal) };
  });

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

    // Atomically decrement stock for every product line. Aggregate quantities
    // per product id so multiple lines of the same product share one decrement.
    const qtyByProduct = new Map<string, number>();
    for (const item of data.items) {
      if (item.kind !== "product") continue;
      if (item.quantity < 1 || item.quantity > 99) {
        throw new Error(`Invalid quantity for ${item.name}`);
      }
      qtyByProduct.set(item.refId, (qtyByProduct.get(item.refId) ?? 0) + item.quantity);
    }
    const decremented: Array<{ id: string; qty: number }> = [];
    for (const [pid, qty] of qtyByProduct) {
      const { data: ok, error: decErr } = await supabaseAdmin.rpc(
        "decrement_product_stock",
        { p_id: pid, p_qty: qty },
      );
      if (decErr || ok !== true) {
        // Roll back any prior decrements before failing.
        for (const d of decremented) {
          const { data: cur } = await supabaseAdmin
            .from("products").select("stock_quantity").eq("id", d.id).maybeSingle();
          if (cur) {
            await supabaseAdmin
              .from("products")
              .update({ stock_quantity: (cur.stock_quantity ?? 0) + d.qty, in_stock: true })
              .eq("id", d.id);
          }
        }
        const { data: p } = await supabaseAdmin
          .from("products").select("name").eq("id", pid).maybeSingle();
        throw new Error(`Out of stock: ${p?.name ?? "item"}`);
      }
      decremented.push({ id: pid, qty });
    }


    const subtotal = data.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const freeThreshold = zone.free_shipping_threshold ?? 0;
    const shippingFee =
      freeThreshold > 0 && subtotal >= freeThreshold ? 0 : zone.fee_amount;

    // Referral: flat discount when code matches an active row. Invalid/inactive
    // codes are rejected so the customer sees the same total the server applies.
    let discount = 0;
    let referralApplied: string | null = null;
    const refCode = (data.referralCode ?? "").trim();
    if (refCode) {
      const { data: ref, error: refErr } = await supabaseAdmin
        .from("referral_codes")
        .select("code,discount_amount,is_active")
        .ilike("code", refCode)
        .maybeSingle();
      if (refErr) throw new Error("Could not validate referral code");
      if (!ref || !ref.is_active) throw new Error("Invalid referral code");
      const refDiscount = Math.max(0, ref.discount_amount ?? 0);
      if (refDiscount <= 0) throw new Error("Referral code has no discount");
      discount += Math.min(refDiscount, subtotal);
      referralApplied = ref.code;
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
        referral_used: referralApplied,
        coupon_used: couponApplied,
      })
      .select("id,order_number,total")
      .single();
    if (oErr || !order) throw new Error("Failed to place order");

    // Record referral usage (best-effort)
    if (referralApplied) {
      await supabaseAdmin
        .from("referral_usage")
        .insert({ referral_code: referralApplied, order_id: order.id });
    }

    // Atomic increment of coupon usage — prevents concurrent checkouts from
    // exceeding usage_limit. If it fails (limit reached in a race), we still
    // keep the order but null out coupon_used to reflect reality.
    if (couponApplied) {
      const { data: incOk } = await supabaseAdmin.rpc(
        "increment_coupon_usage",
        { p_code: couponApplied },
      );
      if (incOk !== true) {
        await supabaseAdmin.from("orders").update({ coupon_used: null }).eq("id", order.id);
      }
    }

    // Best-effort: send order confirmation + admin notification via SMTP.
    try {
      const { sendMail } = await import("@/lib/email.functions");
      const { supabaseAdmin: sa } = await import("@/integrations/supabase/client.server");
      const { data: enc } = await sa
        .from("integration_credentials")
        .select("encrypted_data, iv, auth_tag").eq("provider", "smtp").maybeSingle();
      if (enc) {
        const itemLines = data.items.map(
          (i) => `<tr><td>${i.name}${i.size ? ` (${i.size})` : ""} × ${i.quantity}</td><td style="text-align:right">৳ ${i.unitPrice * i.quantity}</td></tr>`,
        ).join("");
        const html = `
          <h2>Thank you for your order!</h2>
          <p>Order <strong>#${orderNumber}</strong> received.</p>
          <table style="width:100%;border-collapse:collapse">${itemLines}
            <tr><td>Subtotal</td><td style="text-align:right">৳ ${subtotal}</td></tr>
            <tr><td>Shipping</td><td style="text-align:right">৳ ${shippingFee}</td></tr>
            ${discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-৳ ${discount}</td></tr>` : ""}
            <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>৳ ${total}</strong></td></tr>
          </table>
          <p>We'll notify you when it ships.</p>`;
        if (data.customer.email) {
          void sendMail({
            to: data.customer.email,
            subject: `Order #${orderNumber} — Veloura Essence`,
            html, kind: "order_confirmation",
          });
        }
        try {
          const { decryptJson } = await import("@/lib/integration-crypto.server");
          const c = decryptJson<{ admin_email?: string; from_email: string }>(enc);
          const adminTo = c.admin_email || c.from_email;
          void sendMail({
            to: adminTo,
            subject: `New order #${orderNumber} — ৳ ${total}`,
            html: `<h3>New order</h3>
              <p><strong>${data.customer.name}</strong> (${normalizedPhone}${data.customer.email ? `, ${data.customer.email}` : ""})</p>
              <p>Zone: ${zone.zone_name} · ${data.paymentMethod}</p>` + html,
            kind: "order_admin_notify",
          });
        } catch { /* ignore */ }
      }
    } catch { /* SMTP missing or send failed — order still succeeds */ }

    return {
      id: order.id,
      orderNumber: order.order_number,
      total: order.total,
      subtotal,
      shippingFee,
      discount,
    };
  });
