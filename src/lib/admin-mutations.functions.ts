import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orderUpdateSchema = z.object({
  id: z.string().uuid(),
  patch: z
    .object({
      order_status: z.enum(["Pending", "Processing", "Shipped", "Completed", "Cancelled", "Returned"]).optional(),
      payment_status: z.enum(["Pending", "Paid", "Failed", "Refunded"]).optional(),
      tracking_code: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    })
    .refine((p) => Object.keys(p).length > 0, "No fields to update"),
});

export const updateOrderAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => orderUpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const fields = Object.keys(data.patch);
    console.log(`[admin.orders.update] user=${userId} order=${data.id} fields=${fields.join(",")}`, data.patch);

    const { data: roleOk, error: roleErr } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (roleErr || !roleOk) {
      console.warn(`[admin.orders.update] forbidden user=${userId} reason=${roleErr?.message ?? "not admin"}`);
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("orders")
      .update(data.patch)
      .eq("id", data.id)
      .select("id, order_status, payment_status")
      .single();

    if (error) {
      console.error(`[admin.orders.update] FAILED user=${userId} order=${data.id} error=${error.message}`, { patch: data.patch });
      throw new Error(error.message);
    }
    console.log(`[admin.orders.update] OK user=${userId} order=${data.id}`, row);
    return row;
  });

const customerUpdateSchema = z.object({
  id: z.string().uuid(),
  patch: z.object({
    name: z.string().nullable().optional(),
    risk_level: z.enum(["normal", "high"]).optional(),
    notes: z.string().nullable().optional(),
  }),
});

export const updateCustomerAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => customerUpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const fields = Object.keys(data.patch);
    console.log(`[admin.customers.update] user=${userId} customer=${data.id} fields=${fields.join(",")}`, data.patch);

    const { data: roleOk, error: roleErr } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (roleErr || !roleOk) {
      console.warn(`[admin.customers.update] forbidden user=${userId} reason=${roleErr?.message ?? "not admin"}`);
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("customers")
      .update(data.patch)
      .eq("id", data.id)
      .select("id, risk_level")
      .single();

    if (error) {
      console.error(`[admin.customers.update] FAILED user=${userId} customer=${data.id} error=${error.message}`, { patch: data.patch });
      throw new Error(error.message);
    }
    console.log(`[admin.customers.update] OK user=${userId} customer=${data.id}`, row);
    return row;
  });
