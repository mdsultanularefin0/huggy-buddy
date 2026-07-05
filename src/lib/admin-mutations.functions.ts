import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orderStatusSchema = z.enum(["Pending", "Processing", "Shipped", "Completed", "Cancelled", "Returned"]);

async function assertAdmin(userId: string, supabase: unknown) {
  const { assertAdmin: check } = await import("@/lib/admin-guard.server");
  return check(userId, supabase);
}

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
      order_status: orderStatusSchema.optional(),
      payment_status: z.enum(["Pending", "Paid", "Partially Paid", "Failed", "Refunded"]).optional(),
      tracking_code: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      amount_paid: z.number().min(0).optional(),
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

    try {
      await assertAdmin(userId, supabase);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "not admin";
      console.warn(`[admin.orders.update] forbidden user=${userId} reason=${msg}`);
      await writeAudit({ ...base, status: "forbidden", error: msg });
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch = { ...data.patch };
    if (typeof patch.amount_paid === "number") {
      const { data: cur, error: readErr } = await supabaseAdmin
        .from("orders").select("total").eq("id", data.id).single();
      if (readErr || !cur) throw new Error(readErr?.message ?? "Order not found");
      patch.amount_paid = Math.min(Math.max(0, patch.amount_paid), Number(cur.total));
    }

    const { data: row, error } = await supabaseAdmin
      .from("orders").update(patch).eq("id", data.id)
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

const adminOrdersListSchema = z.object({
  statusFilter: z.union([orderStatusSchema, z.literal("all")]).default("all"),
});

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => adminOrdersListSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.statusFilter !== "all") {
      query = query.eq("order_status", data.statusFilter);
    }

    const { data: orders, error } = await query;
    if (error) throw new Error(error.message);
    return orders ?? [];
  });

export const getAdminOrderCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return count ?? 0;
  });

export const getAdminOrderById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return order;
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

    try {
      await assertAdmin(userId, supabase);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "not admin";
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

export const getAdminDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const start30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const start60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const [
      ordersRecent,
      orders30,
      ordersPrev30,
      productsCount,
      combosCount,
      customersCount,
      lowStock,
    ] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, order_number, customer_json, total, order_status, payment_status, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      supabaseAdmin
        .from("orders")
        .select("id, total, order_status, payment_status, created_at")
        .gte("created_at", start30),
      supabaseAdmin
        .from("orders")
        .select("id, total")
        .gte("created_at", start60)
        .lt("created_at", start30),
      supabaseAdmin.from("products").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("combos").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("customers").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("products")
        .select("id, name, stock_quantity, image_url")
        .eq("is_active", true)
        .lte("stock_quantity", 5)
        .order("stock_quantity", { ascending: true })
        .limit(5),
    ]);

    const rows30 = orders30.data ?? [];
    const rowsPrev = ordersPrev30.data ?? [];

    const revenue30 = rows30
      .filter((o) => o.order_status !== "Cancelled" && o.order_status !== "Returned")
      .reduce((s, o) => s + Number(o.total ?? 0), 0);
    const revenuePrev = rowsPrev.reduce((s, o) => s + Number(o.total ?? 0), 0);

    const todayOrders = rows30.filter((o) => o.created_at >= startOfToday);
    const revenueToday = todayOrders.reduce((s, o) => s + Number(o.total ?? 0), 0);

    const pendingOrders = rows30.filter((o) => o.order_status === "Pending").length;
    const processingOrders = rows30.filter((o) => o.order_status === "Processing").length;
    const paidCount = rows30.filter((o) => o.payment_status === "Paid").length;

    // Revenue by day (last 14 days)
    const days: { date: string; revenue: number; orders: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, revenue: 0, orders: 0 });
    }
    for (const o of rows30) {
      const key = String(o.created_at).slice(0, 10);
      const d = days.find((x) => x.date === key);
      if (d && o.order_status !== "Cancelled" && o.order_status !== "Returned") {
        d.revenue += Number(o.total ?? 0);
        d.orders += 1;
      }
    }

    const statusBreakdown = ["Pending", "Processing", "Shipped", "Completed", "Cancelled", "Returned"].map((s) => ({
      status: s,
      count: rows30.filter((o) => o.order_status === s).length,
    }));

    return {
      revenue30,
      revenuePrev,
      revenueToday,
      orders30: rows30.length,
      ordersToday: todayOrders.length,
      pendingOrders,
      processingOrders,
      paidCount,
      productsCount: productsCount.count ?? 0,
      combosCount: combosCount.count ?? 0,
      customersCount: customersCount.count ?? 0,
      lowStock: lowStock.data ?? [],
      recentOrders: ordersRecent.data ?? [],
      days,
      statusBreakdown,
    };
  });

