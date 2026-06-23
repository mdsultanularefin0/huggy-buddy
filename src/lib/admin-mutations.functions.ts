import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AuditEntry = {
  actor_id: string | null;
  entity: "order" | "customer";
  entity_id: string;
  action: string;
  status: "ok" | "forbidden" | "error";
  fields: string[];
  payload: unknown;
  error?: string | null;
};

async function writeAudit(entry: AuditEntry) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_audit_logs").insert({
      actor_id: entry.actor_id,
      entity: entry.entity,
      entity_id: entry.entity_id,
      action: entry.action,
      status: entry.status,
      fields: entry.fields,
      payload: entry.payload as never,
      error: entry.error ?? null,
    });
  } catch (e) {
    console.error("[audit] failed to persist", e);
  }
}

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
    const base = { actor_id: userId, entity: "order" as const, entity_id: data.id, action: "update", fields, payload: data.patch };
    console.log(`[admin.orders.update] user=${userId} order=${data.id} fields=${fields.join(",")}`, data.patch);

    const { data: roleOk, error: roleErr } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (roleErr || !roleOk) {
      const msg = roleErr?.message ?? "not admin";
      console.warn(`[admin.orders.update] forbidden user=${userId} reason=${msg}`);
      await writeAudit({ ...base, status: "forbidden", error: msg });
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("orders").update(data.patch).eq("id", data.id)
      .select("id, order_status, payment_status").single();

    if (error) {
      console.error(`[admin.orders.update] FAILED user=${userId} order=${data.id} error=${error.message}`);
      await writeAudit({ ...base, status: "error", error: error.message });
      throw new Error(error.message);
    }
    console.log(`[admin.orders.update] OK user=${userId} order=${data.id}`, row);
    await writeAudit({ ...base, status: "ok" });
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
    const base = { actor_id: userId, entity: "customer" as const, entity_id: data.id, action: "update", fields, payload: data.patch };
    console.log(`[admin.customers.update] user=${userId} customer=${data.id} fields=${fields.join(",")}`, data.patch);

    const { data: roleOk, error: roleErr } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (roleErr || !roleOk) {
      const msg = roleErr?.message ?? "not admin";
      console.warn(`[admin.customers.update] forbidden user=${userId} reason=${msg}`);
      await writeAudit({ ...base, status: "forbidden", error: msg });
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("customers").update(data.patch).eq("id", data.id)
      .select("id, risk_level").single();

    if (error) {
      console.error(`[admin.customers.update] FAILED user=${userId} customer=${data.id} error=${error.message}`);
      await writeAudit({ ...base, status: "error", error: error.message });
      throw new Error(error.message);
    }
    console.log(`[admin.customers.update] OK user=${userId} customer=${data.id}`, row);
    await writeAudit({ ...base, status: "ok" });
    return row;
  });
