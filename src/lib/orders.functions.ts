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


export const lookupOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      orderNumber: z.string().trim().min(1).max(64),
      email: z.string().trim().email().max(255),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id,order_number,customer_json,order_status,payment_status,courier_status,tracking_code,consignment_id,total,amount_paid,payment_method,created_at,updated_at")
      .eq("order_number", data.orderNumber.trim())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return { ok: false as const, error: "No order found with that number." };
    const email = (order.customer_json as { email?: string } | null)?.email?.toLowerCase().trim();
    if (!email || email !== data.email.toLowerCase().trim()) {
      return { ok: false as const, error: "Order number and email do not match." };
    }
    const c = (order.customer_json ?? {}) as { name?: string; email?: string; phone?: string; address?: string; city?: string };
    return {
      ok: true as const,
      id: order.id as string,
      order: {
        id: order.id as string,
        order_number: order.order_number as string,
        order_status: order.order_status as string | null,
        payment_status: order.payment_status as string | null,
        courier_status: order.courier_status as string | null,
        tracking_code: order.tracking_code as string | null,
        consignment_id: order.consignment_id as number | null,
        total: order.total as number,
        amount_paid: (order.amount_paid as number | null) ?? 0,
        payment_method: order.payment_method as string | null,
        created_at: order.created_at as string,
        updated_at: order.updated_at as string,
        customer: { name: c.name ?? null, email: c.email ?? null, phone: c.phone ?? null, address: c.address ?? null, city: c.city ?? null },
      },
    };
  });


