import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getOrderById = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id,order_number,total,subtotal,shipping_fee,discount,payment_method,customer_json,items_json")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return order;
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
      .select("id,customer_json")
      .eq("order_number", data.orderNumber.trim())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return { ok: false as const, error: "No order found with that number." };
    const email = (order.customer_json as { email?: string } | null)?.email?.toLowerCase().trim();
    if (!email || email !== data.email.toLowerCase().trim()) {
      return { ok: false as const, error: "Order number and email do not match." };
    }
    return { ok: true as const, id: order.id as string };
  });

