import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOrderById = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id,order_number,total,subtotal,shipping_fee,discount,payment_method,payment_status,order_status,customer_json,items_json,user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return null;

    // Determine viewer: owner or admin sees full PII; everyone else gets a
    // sanitized view safe for the public thank-you page.
    let isPrivileged = false;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest();
      const authHeader = req?.headers.get("authorization") ?? req?.headers.get("Authorization");
      const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (bearer && bearer.split(".").length === 3) {
        const { createClient } = await import("@supabase/supabase-js");
        const authClient = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        const { data: claimsRes } = await authClient.auth.getClaims(bearer);
        const uid = claimsRes?.claims?.sub as string | undefined;
        if (uid) {
          if (order.user_id && uid === order.user_id) {
            isPrivileged = true;
          } else {
            const { data: role } = await supabaseAdmin
              .from("user_roles").select("id")
              .eq("user_id", uid).eq("role", "admin").maybeSingle();
            if (role) isPrivileged = true;
          }
        }
      }
    } catch { /* fall through as non-privileged */ }

    if (isPrivileged) return order;

    // Public/sanitized view: strip PII and only expose non-sensitive fields.
    const items = Array.isArray(order.items_json)
      ? (order.items_json as Array<Record<string, unknown>>).map((i) => ({
          name: String(i.name ?? ""),
          quantity: Number(i.quantity ?? 0),
          unitPrice: Number(i.unitPrice ?? 0),
          size: (i.size as string | null | undefined) ?? null,
          kind: (i.kind as string | null | undefined) ?? null,
          selections: Array.isArray(i.selections)
            ? (i.selections as Array<Record<string, unknown>>).map((s) => ({
                productId: String(s.productId ?? ""),
                name: String(s.name ?? ""),
              }))
            : null,
        }))
      : [];
    return {
      id: order.id,
      order_number: order.order_number,
      total: order.total,
      subtotal: order.subtotal,
      shipping_fee: order.shipping_fee,
      discount: order.discount,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      order_status: order.order_status,
      items_json: items,
      customer_json: null,
      user_id: null,
    };
  });

export const claimGuestOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id,user_id,customer_json")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return { ok: false as const, error: "Order not found." };
    if (order.user_id) return { ok: false as const, error: "This order is already linked to an account." };
    const orderEmail = (order.customer_json as { email?: string } | null)?.email?.toLowerCase().trim();
    const userEmail = (context.claims as { email?: string } | null)?.email?.toLowerCase().trim();
    if (!orderEmail || !userEmail || orderEmail !== userEmail) {
      return { ok: false as const, error: "Order email does not match your account email." };
    }
    const { error: upErr } = await supabaseAdmin
      .from("orders")
      .update({ user_id: context.userId })
      .eq("id", data.orderId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true as const };
  });


export type TrackedOrder = {
  id: string;
  order_number: string;
  order_status: string | null;
  payment_status: string | null;
  courier_status: string | null;
  tracking_code: string | null;
  consignment_id: number | null;
  total: number;
  amount_paid: number;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
  };
};

function normalizePhone(v: string) {
  return v.replace(/[^\d]/g, "");
}

export const lookupOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      orderNumber: z.string().trim().min(3).max(64),
      contact: z.string().trim().min(3).max(255),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const orderNumber = data.orderNumber.trim();
    const contact = data.contact.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
    const digits = normalizePhone(contact);
    const isPhone = !isEmail && digits.length >= 6;

    if (!isEmail && !isPhone) {
      return { ok: false as const, error: "Enter a valid email or phone number." };
    }

    const select =
      "id,order_number,customer_json,order_status,payment_status,courier_status,tracking_code,consignment_id,total,amount_paid,payment_method,created_at,updated_at";

    const { data: byNum, error } = await supabaseAdmin
      .from("orders")
      .select(select)
      .eq("order_number", orderNumber)
      .limit(1);
    if (error) throw new Error(error.message);
    const rows = (byNum ?? []) as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      return { ok: false as const, error: "No order found with that order number." };
    }

    // Verify contact matches the order's customer info.
    const row = rows[0];
    const c = (row.customer_json ?? {}) as { email?: string; phone?: string };
    const emailMatch = isEmail && (c.email ?? "").toLowerCase().trim() === contact.toLowerCase();
    const phoneMatch =
      isPhone && normalizePhone(c.phone ?? "").endsWith(digits.slice(-Math.min(digits.length, 10)));
    if (!emailMatch && !phoneMatch) {
      return { ok: false as const, error: "Email or phone does not match this order." };
    }



    const orders: TrackedOrder[] = rows.map((o) => {
      const c = (o.customer_json ?? {}) as {
        name?: string; email?: string; phone?: string; address?: string; city?: string;
      };
      return {
        id: o.id as string,
        order_number: o.order_number as string,
        order_status: (o.order_status as string | null) ?? null,
        payment_status: (o.payment_status as string | null) ?? null,
        courier_status: (o.courier_status as string | null) ?? null,
        tracking_code: (o.tracking_code as string | null) ?? null,
        consignment_id: (o.consignment_id as number | null) ?? null,
        total: (o.total as number) ?? 0,
        amount_paid: (o.amount_paid as number | null) ?? 0,
        payment_method: (o.payment_method as string | null) ?? null,
        created_at: o.created_at as string,
        updated_at: o.updated_at as string,
        customer: {
          name: c.name ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          address: c.address ?? null,
          city: c.city ?? null,
        },
      };
    });

    return { ok: true as const, id: orders[0].id, order: orders[0], orders };
  });



