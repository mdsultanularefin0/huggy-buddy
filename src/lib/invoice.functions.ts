import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET_ENV = () =>
  process.env.INTEGRATION_ENCRYPTION_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "invoice-fallback-secret";

export function signInvoiceId(orderId: string): string {
  return createHmac("sha256", SECRET_ENV()).update(orderId).digest("hex").slice(0, 32);
}

function verifyToken(orderId: string, token: string | undefined | null): boolean {
  if (!token) return false;
  try {
    const expected = signInvoiceId(orderId);
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const inputSchema = z.object({
  id: z.string().uuid(),
  token: z.string().max(128).optional().nullable(),
});

export const getInvoiceOrder = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
    if (verifyToken(order.id, data.token ?? null)) {
      allowed = true;
    }

    // 2) Authenticated user: owner or admin.
    if (!allowed) {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const authHeader = getRequestHeader("authorization");
      const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (bearer) {
        const { data: userRes } = await supabaseAdmin.auth.getUser(bearer);
        const uid = userRes?.user?.id;
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

export const getInvoiceToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    // Public helper so guest thank-you page can build a share/print link.
    return { token: signInvoiceId(data.id) };
  });
