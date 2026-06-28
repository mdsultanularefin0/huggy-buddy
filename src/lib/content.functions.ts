import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const pageSchema = z.object({
  slug: z.string().min(1).max(120).regex(slugRe),
  title: z.string().trim().min(1).max(200),
  meta_description: z.string().trim().max(300).nullable().optional(),
  content: z.string().max(200_000),
});

const faqItem = z.object({
  q: z.string().max(500),
  a: z.string().max(5000),
});

const faqsSchema = z.object({
  faqs_title: z.string().trim().max(200),
  faqs: z.array(faqItem).max(100),
});

async function assertAdmin(supabase: { rpc: (n: string, a: unknown) => Promise<{ data: unknown; error: { message: string } | null }> }, userId: string) {
  const { data: ok, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !ok) throw new Error("Forbidden");
}

export const saveSitePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pageSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { sanitizeRichHtml, sanitizePlainText } = await import("./sanitize.server");
    const payload = {
      slug: data.slug,
      title: sanitizePlainText(data.title) || data.slug,
      meta_description: data.meta_description ? sanitizePlainText(data.meta_description) || null : null,
      content: sanitizeRichHtml(data.content),
    };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_pages")
      .upsert(payload, { onConflict: "slug" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSitePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(120).regex(slugRe) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_pages").delete().eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveFaqs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => faqsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { sanitizePlainText } = await import("./sanitize.server");
    const cleanTitle = sanitizePlainText(data.faqs_title) || "Frequently Asked Questions";
    const cleanFaqs = data.faqs
      .map((f) => ({ q: sanitizePlainText(f.q), a: sanitizePlainText(f.a) }))
      .filter((f) => f.q && f.a);
    return { faqs_title: cleanTitle, faqs_json: cleanFaqs };
  });
