import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROVIDER = "steadfast";

type SteadfastCreds = {
  api_key: string;
  secret_key: string;
  base_url: string;
};

async function assertAdmin(userId: string, supabase: unknown) {
  const client = supabase as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => {
          eq: (c: string, v: string) => {
            maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
          };
        };
      };
    };
  };
  const { data, error } = await client
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Forbidden");
}

// -------- Get status (masked) --------
export const getSteadfastStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("integration_credentials")
      .select("provider, updated_at")
      .eq("provider", PROVIDER)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      configured: !!data,
      updated_at: data?.updated_at ?? null,
    };
  });

// -------- Save credentials --------
const saveSchema = z.object({
  api_key: z.string().min(1).max(500),
  secret_key: z.string().min(1).max(500),
  base_url: z.string().url().max(300).default("https://portal.packzy.com/api/v1"),
});

export const saveSteadfastCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { encryptJson } = await import("@/lib/integration-crypto.server");
    const enc = encryptJson(data satisfies SteadfastCreds);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("integration_credentials")
      .upsert({
        provider: PROVIDER,
        encrypted_data: enc.encrypted_data,
        iv: enc.iv,
        auth_tag: enc.auth_tag,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Delete credentials --------
export const deleteSteadfastCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("integration_credentials")
      .delete()
      .eq("provider", PROVIDER);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Load creds (server-only helper) --------
async function loadSteadfastCreds(): Promise<SteadfastCreds> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("integration_credentials")
    .select("encrypted_data, iv, auth_tag")
    .eq("provider", PROVIDER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Steadfast is not configured. Save credentials first.");
  const { decryptJson } = await import("@/lib/integration-crypto.server");
  return decryptJson<SteadfastCreds>(data);
}

async function steadfastFetch(path: string, init: RequestInit = {}) {
  const creds = await loadSteadfastCreds();
  const url = `${creds.base_url.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Api-Key": creds.api_key,
      "Secret-Key": creds.secret_key,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = typeof body === "object" && body && "message" in body
      ? String((body as { message: unknown }).message)
      : `Steadfast API error (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

// -------- Test connection (get_balance) --------
export const testSteadfastConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const body = await steadfastFetch("/get_balance", { method: "GET" }) as
      { status?: number; current_balance?: number; message?: string } | null;
    return {
      ok: true,
      balance: body?.current_balance ?? null,
      message: body?.message ?? "Connected",
    };
  });

// -------- Create shipment for an order --------
const createShipmentSchema = z.object({ order_id: z.string().uuid() });

export const createSteadfastShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createShipmentSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", data.order_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");

    const c = ((order as { customer_json?: Record<string, unknown> }).customer_json ?? {}) as {
      name?: string; phone?: string; email?: string; alt_phone?: string;
      address?: string; area?: string; district?: string;
    };
    const address = [c.address, c.area, c.district].filter(Boolean).join(", ").slice(0, 250);
    const payload: Record<string, unknown> = {
      invoice: (order as { order_number?: string }).order_number ?? data.order_id.slice(0, 8),
      recipient_name: (c.name ?? "").slice(0, 100),
      recipient_phone: c.phone ?? "",
      recipient_address: address,
      cod_amount: Number((order as { total?: number }).total ?? 0),
      note: (order as { notes?: string }).notes ?? "",
    };
    if (c.alt_phone) payload.alternative_phone = c.alt_phone;
    if (c.email) payload.recipient_email = c.email;

    const body = await steadfastFetch("/create_order", {
      method: "POST",
      body: JSON.stringify(payload),
    }) as { consignment?: { consignment_id?: number; tracking_code?: string; status?: string } } | null;

    const tracking = body?.consignment?.tracking_code ?? null;
    const consignmentId = body?.consignment?.consignment_id ?? null;
    const courierStatus = body?.consignment?.status ?? null;
    if (tracking || consignmentId || courierStatus) {
      const patch: Record<string, unknown> = {};
      if (tracking) patch.tracking_code = tracking;
      if (consignmentId) patch.consignment_id = consignmentId;
      if (courierStatus) patch.courier_status = courierStatus;
      await supabaseAdmin.from("orders").update(patch).eq("id", data.order_id);
    }
    return { ok: true, consignment: body?.consignment ?? null };
  });


// -------- Bulk create shipments --------
const bulkCreateSchema = z.object({
  order_ids: z.array(z.string().uuid()).min(1).max(500),
});

export const bulkCreateSteadfastShipments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => bulkCreateSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, customer_json, total, notes")
      .in("id", data.order_ids);
    if (error) throw new Error(error.message);
    if (!orders?.length) throw new Error("No orders found");

    const items = orders.map((o) => {
      const c = ((o as { customer_json?: Record<string, unknown> }).customer_json ?? {}) as {
        name?: string; phone?: string; email?: string; alt_phone?: string;
        address?: string; area?: string; district?: string;
      };
      return {
        invoice: o.order_number ?? o.id.slice(0, 8),
        recipient_name: (c.name ?? "").slice(0, 100),
        recipient_phone: c.phone ?? "",
        recipient_address: [c.address, c.area, c.district].filter(Boolean).join(", ").slice(0, 250),
        cod_amount: Number(o.total ?? 0),
        note: o.notes ?? "",
      };
    });

    const body = await steadfastFetch("/create_order/bulk-order", {
      method: "POST",
      body: JSON.stringify({ data: JSON.stringify(items) }),
    }) as { data?: Array<{ invoice: string; tracking_code?: string; status?: string; consignment_id?: number }> } | Array<{ invoice: string; tracking_code?: string; status?: string; consignment_id?: number }> | null;

    const results = Array.isArray(body) ? body : body?.data ?? [];
    // Write tracking codes back by matching invoice → order_number
    const byInvoice = new Map(orders.map((o) => [o.order_number ?? o.id.slice(0, 8), o.id] as const));
    await Promise.all(
      results
        .filter((r) => r.status === "success")
        .map((r) => {
          const id = byInvoice.get(r.invoice);
          if (!id) return Promise.resolve();
          const patch: { tracking_code?: string; consignment_id?: number; courier_status?: string } = {};
          if (r.tracking_code) patch.tracking_code = r.tracking_code;
          if (r.consignment_id) patch.consignment_id = r.consignment_id;
          if (r.status) patch.courier_status = r.status;
          if (Object.keys(patch).length === 0) return Promise.resolve();
          return supabaseAdmin.from("orders").update(patch).eq("id", id);
        }),
    );
    return { ok: true, results };
  });


// -------- Delivery status lookups --------
const statusSchema = z.object({
  by: z.enum(["cid", "invoice", "tracking"]),
  value: z.string().min(1).max(120),
});

export const getSteadfastDeliveryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => statusSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const path =
      data.by === "cid" ? `/status_by_cid/${encodeURIComponent(data.value)}` :
      data.by === "invoice" ? `/status_by_invoice/${encodeURIComponent(data.value)}` :
      `/status_by_trackingcode/${encodeURIComponent(data.value)}`;
    const body = await steadfastFetch(path, { method: "GET" }) as
      { status?: number; delivery_status?: string; message?: string } | null;
    return { delivery_status: body?.delivery_status ?? null, message: body?.message ?? null };
  });

// -------- Current balance --------
export const getSteadfastBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const body = await steadfastFetch("/get_balance", { method: "GET" }) as
      { status?: number; current_balance?: number } | null;
    return { current_balance: body?.current_balance ?? 0 };
  });

// -------- Fraud check by phone --------
const fraudSchema = z.object({ phone: z.string().min(3).max(30) });

export const getSteadfastFraudCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => fraudSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const body = await steadfastFetch(`/fraud_check/${encodeURIComponent(data.phone)}`, { method: "GET" }) as
      Record<string, unknown> | null;
    const num = (k: string) => {
      const v = body?.[k];
      return typeof v === "number" ? v : typeof v === "string" ? Number(v) || 0 : 0;
    };
    return {
      total_parcels: num("Total_parcels") || num("total_parcels"),
      total_delivered: num("total delivered") || num("total_delivered"),
      total_cancelled: num("total cancelled") || num("total_cancelled"),
      total_fraud_reports: num("total_fraud_reports"),
    };
  });


// ===================== Media Server =====================
const MEDIA_PROVIDER = "media_server";

type MediaServerCreds = {
  base_url: string;
  api_key: string;
};

export const getMediaServerStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("integration_credentials")
      .select("provider, updated_at")
      .eq("provider", MEDIA_PROVIDER)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { configured: !!data, updated_at: data?.updated_at ?? null };
  });

const saveMediaSchema = z.object({
  base_url: z.string().url().max(300),
  api_key: z.string().min(1).max(500),
});

export const saveMediaServerCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveMediaSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { encryptJson } = await import("@/lib/integration-crypto.server");
    const enc = encryptJson(data satisfies MediaServerCreds);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("integration_credentials")
      .upsert({
        provider: MEDIA_PROVIDER,
        encrypted_data: enc.encrypted_data,
        iv: enc.iv,
        auth_tag: enc.auth_tag,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMediaServerCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("integration_credentials")
      .delete()
      .eq("provider", MEDIA_PROVIDER);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function loadMediaServerCreds(): Promise<MediaServerCreds> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("integration_credentials")
    .select("encrypted_data, iv, auth_tag")
    .eq("provider", MEDIA_PROVIDER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Media Server is not configured. Save credentials first.");
  const { decryptJson } = await import("@/lib/integration-crypto.server");
  return decryptJson<MediaServerCreds>(data);
}

export const testMediaServerConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const creds = await loadMediaServerCreds();
    const url = `${creds.base_url.replace(/\/$/, "")}/health`;
    const res = await fetch(url, { headers: { "x-api-key": creds.api_key } });
    if (!res.ok) throw new Error(`Media server responded ${res.status}`);
    const body = await res.json().catch(() => ({}));
    return { ok: true, health: body };
  });

// Return decrypted creds for admin browser use (uploads to media server).
export const getMediaServerConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const creds = await loadMediaServerCreds();
    return { base_url: creds.base_url.replace(/\/$/, ""), api_key: creds.api_key };
  });
