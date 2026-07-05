import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  id: z.string().uuid(),
  token: z.string().max(128).optional().nullable(),
});

export const getInvoiceOrder = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyInvoiceToken } = await import("@/lib/invoice-sign.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id,order_number,created_at,total,subtotal,shipping_fee,discount,payment_method,payment_status,order_status,tracking_code,referral_used,customer_json,items_json,user_id"
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");

    // Access control
    let allowed = false;

    // 1) HMAC token (works for guest links from emails and thank-you page).
    if (verifyInvoiceToken(order.id, data.token ?? null)) {
      allowed = true;
    }

    // 2) Authenticated user: owner or admin.
    if (!allowed) {
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
            allowed = true;
          } else {
            const { data: role } = await supabaseAdmin
              .from("user_roles")
              .select("id")
              .eq("user_id", uid)
              .eq("role", "admin")
              .maybeSingle();
            if (role) allowed = true;
          }
        }
      }
    }

    if (!allowed) throw new Error("Not authorized to view this invoice");

    const { data: settings } = await supabaseAdmin
      .from("site_settings")
      .select(
        "shop_name, shop_tagline, shop_email, shop_phone, shop_address, site_logo_url"
      )
      .limit(1)
      .maybeSingle();

    return { order, branding: settings ?? null };
  });

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getInvoiceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id,user_id,customer_json")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");

    let allowed = false;
    if (order.user_id && order.user_id === context.userId) allowed = true;
    if (!allowed) {
      const { data: role } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle();
      if (role) allowed = true;
    }
    if (!allowed) {
      const orderEmail = (order.customer_json as { email?: string } | null)?.email?.toLowerCase().trim();
      const userEmail = (context.claims as { email?: string } | null)?.email?.toLowerCase().trim();
      if (orderEmail && userEmail && orderEmail === userEmail) allowed = true;
    }
    if (!allowed) throw new Error("Not authorized to generate invoice token");

    const { signInvoiceId } = await import("@/lib/invoice-sign.server");
    return { token: signInvoiceId(data.id) };
  });
