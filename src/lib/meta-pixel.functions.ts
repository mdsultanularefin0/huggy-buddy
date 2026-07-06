import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const PROVIDER = "meta_pixel";

export type MetaPixelCreds = {
  pixel_id: string;
  access_token: string;
  test_event_code?: string;
};

async function assertAdmin(userId: string, supabase: unknown) {
  const { assertAdmin: check } = await import("@/lib/admin-guard.server");
  return check(userId, supabase);
}

// -------- Status (masked) --------
export const getMetaPixelStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("integration_credentials")
      .select("provider, updated_at, encrypted_data, iv, auth_tag")
      .eq("provider", PROVIDER)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { configured: false, updated_at: null, pixel_id: null, test_event_code: null };
    const { decryptJson } = await import("@/lib/integration-crypto.server");
    const creds = decryptJson<MetaPixelCreds>(data);
    return {
      configured: true,
      updated_at: data.updated_at,
      pixel_id: creds.pixel_id,
      test_event_code: creds.test_event_code ?? null,
    };
  });

// -------- Save --------
const saveSchema = z.object({
  pixel_id: z.string().trim().regex(/^\d{6,20}$/, "Pixel ID should be a numeric string"),
  access_token: z.string().trim().min(20).max(500),
  test_event_code: z.string().trim().max(50).optional().or(z.literal("")),
});

export const saveMetaPixelCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase);
    const creds: MetaPixelCreds = {
      pixel_id: data.pixel_id,
      access_token: data.access_token,
      test_event_code: data.test_event_code || undefined,
    };
    const { encryptJson } = await import("@/lib/integration-crypto.server");
    const enc = encryptJson(creds);
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

// -------- Delete --------
export const deleteMetaPixelCredentials = createServerFn({ method: "POST" })
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

// -------- Public: pixel_id only (safe to expose to browser) --------
export const getPublicMetaPixelId = createServerFn({ method: "GET" })
  .handler(async () => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // read via admin (creds table is admin-only); expose ONLY pixel_id.
    void supabase;
    const { data } = await supabaseAdmin
      .from("integration_credentials")
      .select("encrypted_data, iv, auth_tag")
      .eq("provider", PROVIDER)
      .maybeSingle();
    if (!data) return { pixel_id: null as string | null };
    const { decryptJson } = await import("@/lib/integration-crypto.server");
    try {
      const creds = decryptJson<MetaPixelCreds>(data);
      return { pixel_id: creds.pixel_id };
    } catch {
      return { pixel_id: null };
    }
  });

// -------- CAPI helper (server-only) --------
async function loadCreds(): Promise<MetaPixelCreds | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("integration_credentials")
    .select("encrypted_data, iv, auth_tag")
    .eq("provider", PROVIDER)
    .maybeSingle();
  if (!data) return null;
  const { decryptJson } = await import("@/lib/integration-crypto.server");
  return decryptJson<MetaPixelCreds>(data);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sendMetaCapiEvent(opts: {
  event_name: string;
  event_id?: string;
  event_source_url?: string;
  action_source?: "website" | "email" | "app";
  user_data?: {
    email?: string; phone?: string; first_name?: string; last_name?: string;
    city?: string; country?: string; client_ip?: string; client_user_agent?: string; fbp?: string; fbc?: string;
  };
  custom_data?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string; response?: unknown }> {
  const creds = await loadCreds();
  if (!creds) return { ok: false, error: "Meta Pixel not configured" };
  const u = opts.user_data ?? {};
  const user_data: Record<string, unknown> = {};
  if (u.email) user_data.em = [await sha256Hex(u.email)];
  if (u.phone) user_data.ph = [await sha256Hex(u.phone.replace(/\D/g, ""))];
  if (u.first_name) user_data.fn = [await sha256Hex(u.first_name)];
  if (u.last_name) user_data.ln = [await sha256Hex(u.last_name)];
  if (u.city) user_data.ct = [await sha256Hex(u.city)];
  if (u.country) user_data.country = [await sha256Hex(u.country)];
  if (u.client_ip) user_data.client_ip_address = u.client_ip;
  if (u.client_user_agent) user_data.client_user_agent = u.client_user_agent;
  if (u.fbp) user_data.fbp = u.fbp;
  if (u.fbc) user_data.fbc = u.fbc;

  const payload = {
    data: [{
      event_name: opts.event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: opts.event_id,
      event_source_url: opts.event_source_url,
      action_source: opts.action_source ?? "website",
      user_data,
      custom_data: opts.custom_data ?? {},
    }],
    ...(creds.test_event_code ? { test_event_code: creds.test_event_code } : {}),
  };

  try {
    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(creds.pixel_id)}/events?access_token=${encodeURIComponent(creds.access_token)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`, response: body };
    return { ok: true, response: body };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// -------- Test connection (send TestEvent) --------
export const testMetaPixelConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase);
    const r = await sendMetaCapiEvent({
      event_name: "TestEvent",
      event_id: `test-${Date.now()}`,
      action_source: "website",
      custom_data: { source: "admin_test" },
    });
    if (!r.ok) throw new Error(r.error ?? "CAPI test failed");
    return { ok: true, response: r.response };
  });

// -------- Public wrapper: send an event from the browser (PageView etc.) --------
const trackSchema = z.object({
  event_name: z.string().min(1).max(50),
  event_id: z.string().max(100).optional(),
  event_source_url: z.string().url().max(500).optional(),
  custom_data: z.record(z.string(), z.unknown()).optional(),
});
export const trackMetaEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => trackSchema.parse(d))
  .handler(async ({ data }) => {
    const r = await sendMetaCapiEvent({
      event_name: data.event_name,
      event_id: data.event_id,
      event_source_url: data.event_source_url,
      action_source: "website",
      custom_data: data.custom_data,
    });
    return r;
  });
