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
      if (ref) discount = Math.min(ref.discount_amount ?? 0, subtotal);
    }

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
        customer_json: data.customer,
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

    return {
      id: order.id,
      orderNumber: order.order_number,
      total: order.total,
      subtotal,
      shippingFee,
      discount,
    };
  });
