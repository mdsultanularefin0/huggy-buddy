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

    const shipping = (order as { shipping_address?: Record<string, unknown> }).shipping_address ?? {};
    const payload = {
      invoice: (order as { order_number?: string }).order_number ?? data.order_id.slice(0, 8),
      recipient_name: String(shipping.name ?? (order as { customer_name?: string }).customer_name ?? ""),
      recipient_phone: String(shipping.phone ?? (order as { customer_phone?: string }).customer_phone ?? ""),
      recipient_address: [shipping.address_line1, shipping.address_line2, shipping.city, shipping.district]
        .filter(Boolean).join(", "),
      cod_amount: Number((order as { total?: number }).total ?? 0),
      note: (order as { admin_notes?: string }).admin_notes ?? "",
    };

    const body = await steadfastFetch("/create_order", {
      method: "POST",
      body: JSON.stringify(payload),
    }) as { consignment?: { consignment_id?: number; tracking_code?: string } } | null;

    const tracking = body?.consignment?.tracking_code ?? null;
    if (tracking) {
      await supabaseAdmin
        .from("orders")
        .update({ tracking_code: tracking })
        .eq("id", data.order_id);
    }
    return { ok: true, consignment: body?.consignment ?? null };
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
