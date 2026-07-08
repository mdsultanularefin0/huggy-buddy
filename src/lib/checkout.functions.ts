import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { evaluateCoupon } from "./coupon-eval";
import { evaluateReferral } from "./referral-eval";

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
  variantId: z.string().uuid().nullable().optional(),
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
  paymentDetails: z.object({
    senderNumber: z.string().trim().min(6).max(20),
    trxId: z.string().trim().min(4).max(60),
  }).optional(),
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
      .ilike("code", data.code.trim())
      .maybeSingle();
    if (error) throw new Error("Could not validate coupon");
    const result = evaluateCoupon(cp, data.subtotal);
    if (!result.ok) throw new Error(result.message);
    return {
      code: result.code,
      discount: result.discount,
      discountType: result.discountType,
      discountValue: result.discountValue,
    };
  });

const ValidateReferralSchema = z.object({
  code: z.string().trim().min(1).max(40),
  subtotal: z.number().int().nonnegative(),
  buyerPhone: z.string().trim().max(20).optional(),
});

export const validateReferral = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ValidateReferralSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ref, error } = await supabaseAdmin
      .from("referral_codes")
      .select("code,discount_amount,discount_type,is_active")
      .ilike("code", data.code.trim())
      .maybeSingle();
    if (error) throw new Error("Could not validate referral code");

    // Look up prior redemptions by the buyer's normalized phone so a customer
    // can't stack the same referral across multiple orders.
    let previouslyUsedCodes: string[] = [];
    if (data.buyerPhone) {
      const phone = normalizePhone(data.buyerPhone);
      if (phone) {
        const { data: prior } = await supabaseAdmin
          .from("orders")
          .select("referral_used")
          .eq("customer_json->>phone", phone)
          .not("referral_used", "is", null);
        previouslyUsedCodes = (prior ?? [])
          .map((r) => (r as { referral_used: string | null }).referral_used)
          .filter((c): c is string => !!c);
      }
    }

    const result = evaluateReferral(ref, data.subtotal, { previouslyUsedCodes });
    if (!result.ok) throw new Error(result.message);
    return { code: result.code, discount: result.discount, discountType: result.discountType };
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

    // -------- Idempotency guard (ad-hoc throttle) --------
    // Prevent duplicate orders when a client bypasses the UI guard (double
    // submit, retry, network glitch). If the same phone submitted an order
    // with the exact same items + client subtotal in the last 30 seconds,
    // return that order instead of creating a new one.
    const dedupePhone = normalizePhone(data.customer.phone);
    const dedupeSig = data.items
      .map((i) => `${i.kind}:${i.refId}:${i.variantId ?? ""}:${i.unitPrice}:${i.quantity}`)
      .sort()
      .join("|");
    const dedupeSubtotal = data.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const windowStart = new Date(Date.now() - 30_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, subtotal, shipping_fee, discount, items_json, created_at, customer_json")
      .gte("created_at", windowStart)
      .eq("subtotal", dedupeSubtotal)
      .order("created_at", { ascending: false })
      .limit(10);
    const dup = (recent ?? []).find((r) => {
      const items = Array.isArray(r.items_json) ? (r.items_json as typeof data.items) : [];
      const sig = items
        .map((i) => `${i.kind}:${i.refId}:${i.variantId ?? ""}:${i.unitPrice}:${i.quantity}`)
        .sort()
        .join("|");
      const phone = normalizePhone(((r.customer_json as { phone?: string } | null)?.phone) ?? "");
      return sig === dedupeSig && phone === dedupePhone;
    });
    if (dup) {
      const { signInvoiceId } = await import("@/lib/invoice-sign.server");
      return {
        id: dup.id,
        orderNumber: dup.order_number,
        total: dup.total,
        subtotal: dup.subtotal,
        shippingFee: dup.shipping_fee,
        discount: dup.discount,
        invoiceToken: signInvoiceId(dup.id),
        metaEventId: dup.id as string,
        deduped: true as const,
      };
    }



    // Load zone for fee + free shipping
    const { data: zone, error: zoneErr } = await supabaseAdmin
      .from("delivery_zones")
      .select("id,zone_name,fee_amount,free_shipping_threshold,is_active")
      .eq("id", data.deliveryZoneId)
      .maybeSingle();
    if (zoneErr || !zone || !zone.is_active) throw new Error("Invalid delivery zone");

    // Atomically decrement stock. Items with a variantId decrement that
    // specific product_variants row; items without one fall back to the
    // parent product stock (legacy products without variants).
    const qtyByVariant = new Map<string, { qty: number; name: string }>();
    const qtyByProduct = new Map<string, number>();
    for (const item of data.items) {
      if (item.kind !== "product") continue;
      if (item.quantity < 1 || item.quantity > 99) {
        throw new Error(`Invalid quantity for ${item.name}`);
      }
      if (item.variantId) {
        const cur = qtyByVariant.get(item.variantId);
        qtyByVariant.set(item.variantId, {
          qty: (cur?.qty ?? 0) + item.quantity,
          name: `${item.name}${item.size ? ` (${item.size})` : ""}`,
        });
      } else {
        qtyByProduct.set(item.refId, (qtyByProduct.get(item.refId) ?? 0) + item.quantity);
      }
    }

    const decrementedVariants: Array<{ id: string; qty: number }> = [];
    const decrementedProducts: Array<{ id: string; qty: number }> = [];

    async function rollback() {
      for (const d of decrementedVariants) {
        const { data: cur } = await (supabaseAdmin as any)
          .from("product_variants").select("stock_quantity").eq("id", d.id).maybeSingle();
        if (cur) {
          await (supabaseAdmin as any)
            .from("product_variants")
            .update({ stock_quantity: (cur.stock_quantity ?? 0) + d.qty })
            .eq("id", d.id);
        }
      }
      for (const d of decrementedProducts) {
        const { data: cur } = await supabaseAdmin
          .from("products").select("stock_quantity").eq("id", d.id).maybeSingle();
        if (cur) {
          await supabaseAdmin
            .from("products")
            .update({ stock_quantity: (cur.stock_quantity ?? 0) + d.qty, in_stock: true })
            .eq("id", d.id);
        }
      }
    }

    // Resolve parent product for each variant so the product-level in_stock
    // toggle can override variant-level stock/quantity entirely.
    const variantIds = Array.from(qtyByVariant.keys());
    const variantParent = new Map<string, string>();
    if (variantIds.length) {
      const { data: vrows } = await (supabaseAdmin as any)
        .from("product_variants")
        .select("id,product_id")
        .in("id", variantIds);
      for (const r of (vrows ?? []) as Array<{ id: string; product_id: string }>) {
        variantParent.set(r.id, r.product_id);
      }
    }
    const parentIds = Array.from(
      new Set([...qtyByProduct.keys(), ...variantParent.values()]),
    );
    const parentInStock = new Map<string, boolean>();
    if (parentIds.length) {
      const { data: prows } = await supabaseAdmin
        .from("products").select("id,in_stock,name").in("id", parentIds);
      for (const r of (prows ?? []) as Array<{ id: string; in_stock: boolean; name: string }>) {
        parentInStock.set(r.id, r.in_stock);
      }
    }

    for (const [vid, { qty, name }] of qtyByVariant) {
      const pid = variantParent.get(vid);
      if (!pid || parentInStock.get(pid) === false) {
        await rollback();
        throw new Error(`Out of stock: ${name}`);
      }
      // Product toggle ON: variants follow their own in_stock/quantity rules.
      // Product toggle OFF: blocked above.
      const { data: ok, error: decErr } = await supabaseAdmin.rpc(
        "decrement_variant_stock" as never,
        { v_id: vid, v_qty: qty } as never,
      );
      if (decErr || ok !== true) {
        await rollback();
        throw new Error(`Out of stock: ${name}`);
      }
      decrementedVariants.push({ id: vid, qty });
    }
    for (const [pid, qty] of qtyByProduct) {
      if (parentInStock.get(pid) === false) {
        await rollback();
        const { data: p } = await supabaseAdmin
          .from("products").select("name").eq("id", pid).maybeSingle();
        throw new Error(`Out of stock: ${p?.name ?? "item"}`);
      }
      const { data: ok, error: decErr } = await supabaseAdmin.rpc(
        "decrement_product_stock",
        { p_id: pid, p_qty: qty },
      );
      if (decErr || ok !== true) {
        await rollback();
        const { data: p } = await supabaseAdmin
          .from("products").select("name").eq("id", pid).maybeSingle();
        throw new Error(`Out of stock: ${p?.name ?? "item"}`);
      }
      decrementedProducts.push({ id: pid, qty });
    }


    const subtotal = data.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const freeThreshold = zone.free_shipping_threshold ?? 0;
    const shippingFee =
      freeThreshold > 0 && subtotal >= freeThreshold ? 0 : zone.fee_amount;

    // Referral: percent or flat discount when code matches an active row.
    // Invalid/inactive/self/reused codes are rejected so the customer sees
    // the same total the server applies.
    let discount = 0;
    let referralApplied: string | null = null;
    const refCode = (data.referralCode ?? "").trim();
    if (refCode) {
      const { data: ref, error: refErr } = await supabaseAdmin
        .from("referral_codes")
        .select("code,discount_amount,discount_type,is_active")
        .ilike("code", refCode)
        .maybeSingle();
      if (refErr) throw new Error("Could not validate referral code");

      // Prior redemptions by this buyer's normalized phone (prevents reuse).
      const buyerPhone = normalizePhone(data.customer.phone);
      let previouslyUsedCodes: string[] = [];
      if (buyerPhone) {
        const { data: prior } = await supabaseAdmin
          .from("orders")
          .select("referral_used")
          .eq("customer_json->>phone", buyerPhone)
          .not("referral_used", "is", null);
        previouslyUsedCodes = (prior ?? [])
          .map((r) => (r as { referral_used: string | null }).referral_used)
          .filter((c): c is string => !!c);
      }

      const result = evaluateReferral(ref, subtotal, { previouslyUsedCodes });
      if (!result.ok) throw new Error(result.message);
      discount += Math.min(result.discount, subtotal);
      referralApplied = result.code;
    }

    // Coupon: percent or flat discount, with min order, max cap, expiry, usage limit
    const couponCode = (data.couponCode ?? "").trim();
    let couponApplied: string | null = null;
    if (couponCode) {
      const { data: cp } = await supabaseAdmin
        .from("coupons")
        .select("code,discount_type,discount_value,min_order_amount,max_discount,expires_at,usage_limit,used_count,is_active")
        .ilike("code", couponCode)
        .maybeSingle();
      const result = evaluateCoupon(cp, subtotal);
      if (!result.ok) throw new Error(result.message);
      const cd = Math.min(result.discount, Math.max(0, subtotal - discount));
      if (cd > 0) {
        discount += cd;
        couponApplied = result.code;
      }
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
        payment_details: data.paymentDetails ?? null,
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
        const {
          DEFAULT_ORDER_EMAIL_SUBJECT,
          DEFAULT_ORDER_EMAIL_BODY,
          renderOrderEmail,
        } = await import("@/lib/order-email-template");
        const { data: settings } = await sa
          .from("site_settings")
          .select("shop_name, shop_tagline, shop_email, order_email_subject, order_email_body")
          .limit(1)
          .maybeSingle();
        const itemLines = data.items.map(
          (i) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee">${i.name}${i.size ? ` (${i.size})` : ""} × ${i.quantity}</td><td style="padding:8px 12px;text-align:right;border-bottom:1px solid #eee">৳ ${i.unitPrice * i.quantity}</td></tr>`,
        ).join("");
        const addr = data.customer.address || "—";
        const vars = {
          order_number: orderNumber,
          order_date: new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }),
          customer_name: data.customer.name || "there",

          items: itemLines,
          subtotal, shipping: shippingFee, discount, total,
          discount_row: discount > 0
            ? `<tr><td style="padding:8px 12px;color:#666">Discount</td><td style="padding:8px 12px;text-align:right;color:#c0392b">-৳ ${discount}</td></tr>`
            : "",
          payment_method: data.paymentMethod,
          shipping_address: addr,
          shop_name: settings?.shop_name || "Veloura Essence",
          shop_tagline: settings?.shop_tagline || "",
          shop_email: settings?.shop_email || "",
        };
        const subjectTpl = settings?.order_email_subject || DEFAULT_ORDER_EMAIL_SUBJECT;
        const bodyTpl = settings?.order_email_body || DEFAULT_ORDER_EMAIL_BODY;
        const subject = renderOrderEmail(subjectTpl, vars);
        const html = renderOrderEmail(bodyTpl, vars);
        if (data.customer.email) {
          void sendMail({
            to: data.customer.email,
            subject,
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


    // Meta CAPI Purchase (best-effort). event_id = order.id lets the browser
    // pixel dedupe when it fires the same event with { eventID: order.id }.
    try {
      const { sendMetaCapiEvent } = await import("@/lib/meta-pixel.functions");
      const [firstName, ...rest] = (data.customer.name ?? "").trim().split(/\s+/);
      void sendMetaCapiEvent({
        event_name: "Purchase",
        event_id: order.id,
        action_source: "website",
        user_data: {
          email: data.customer.email || undefined,
          phone: normalizedPhone,
          first_name: firstName || undefined,
          last_name: rest.join(" ") || undefined,
          country: "bd",
        },
        custom_data: {
          currency: "BDT",
          value: total,
          content_type: "product",
          content_ids: data.items.map((i) => i.refId),
          contents: data.items.map((i) => ({ id: i.refId, quantity: i.quantity, item_price: i.unitPrice })),
          num_items: data.items.reduce((n, i) => n + i.quantity, 0),
          order_id: order.order_number,
        },
      });
    } catch { /* CAPI not configured — ignore */ }

    const { signInvoiceId } = await import("@/lib/invoice-sign.server");
    const invoiceToken = signInvoiceId(order.id);

    return {
      id: order.id,
      orderNumber: order.order_number,
      total: order.total,
      subtotal,
      shippingFee,
      discount,
      invoiceToken,
      metaEventId: order.id as string,
    };
  });

