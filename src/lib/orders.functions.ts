import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOrderById = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id,order_number,total,subtotal,shipping_fee,discount,payment_method,customer_json,items_json,user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return order;
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
      query: z.string().trim().min(3).max(255),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.query.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q);
    const digits = normalizePhone(q);
    const isPhone = !isEmail && digits.length >= 6;

    const select =
      "id,order_number,customer_json,order_status,payment_status,courier_status,tracking_code,consignment_id,total,amount_paid,payment_method,created_at,updated_at";

    let rows: Array<Record<string, unknown>> = [];

    // Try order_number match first (exact) when not clearly email/phone.
    if (!isEmail) {
      const { data: byNum, error } = await supabaseAdmin
        .from("orders")
        .select(select)
        .eq("order_number", q)
        .limit(1);
      if (error) throw new Error(error.message);
      if (byNum && byNum.length) rows = byNum as Array<Record<string, unknown>>;
    }

    if (rows.length === 0 && isEmail) {
      const { data: byEmail, error } = await supabaseAdmin
        .from("orders")
        .select(select)
        .filter("customer_json->>email", "eq", q.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      rows = (byEmail ?? []) as Array<Record<string, unknown>>;
    }

    if (rows.length === 0 && isPhone) {
      // Match on last 9+ digits of phone to tolerate country-code differences.
      const tail = digits.slice(-Math.min(digits.length, 10));
      const { data: byPhone, error } = await supabaseAdmin
        .from("orders")
        .select(select)
        .filter("customer_json->>phone", "ilike", `%${tail}%`)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      rows = (byPhone ?? []) as Array<Record<string, unknown>>;
    }

    if (rows.length === 0) {
      return { ok: false as const, error: "No orders found for that order number, email, or phone." };
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



