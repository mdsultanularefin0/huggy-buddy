import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const pageSchema = z.object({
  slug: z.string().min(1).max(120).regex(slugRe),
  title: z.string().trim().min(1).max(200),
  meta_description: z.string().trim().max(300).nullable().optional(),
  content: z.string().max(1_000_000),
});

const faqItem = z.object({
  q: z.string().max(500),
  a: z.string().max(5000),
});

const faqsSchema = z.object({
  faqs_title: z.string().trim().max(200),
  faqs: z.array(faqItem).max(100),
});

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const { assertAdmin: check } = await import("@/lib/admin-guard.server");
  return check(context.userId, context.supabase);
}

export const saveSitePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pageSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
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
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_pages").delete().eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveFaqs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => faqsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { sanitizePlainText } = await import("./sanitize.server");
    const cleanTitle = sanitizePlainText(data.faqs_title) || "Frequently Asked Questions";
    const cleanFaqs = data.faqs
      .map((f) => ({ q: sanitizePlainText(f.q), a: sanitizePlainText(f.a) }))
      .filter((f) => f.q && f.a);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: selErr } = await supabaseAdmin
      .from("site_settings")
      .select("id")
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!existing?.id) throw new Error("Site settings row missing");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .update({ faqs_title: cleanTitle, faqs_json: cleanFaqs })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { faqs_title: cleanTitle, faqs_json: cleanFaqs };
  });
