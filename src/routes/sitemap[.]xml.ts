import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// Absolute URL base for sitemap entries. Configure via SITE_URL env var.
const BASE_URL = process.env.SITE_URL || "https://velouraessencebd.com";

interface Entry {
  path: string;
  changefreq?: "daily" | "weekly" | "monthly";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const staticEntries: Entry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/products", changefreq: "daily", priority: "0.9" },
          { path: "/about", changefreq: "monthly", priority: "0.5" },
          { path: "/contact", changefreq: "monthly", priority: "0.5" },
          { path: "/faq", changefreq: "monthly", priority: "0.5" },
          { path: "/shipping", changefreq: "monthly", priority: "0.4" },
          { path: "/privacy", changefreq: "yearly" as never, priority: "0.3" },
          { path: "/terms", changefreq: "yearly" as never, priority: "0.3" },
          { path: "/reviews", changefreq: "weekly", priority: "0.6" },
          { path: "/guide/how-to-layer-fragrances", changefreq: "monthly", priority: "0.7" },
        ];

        const entries: Entry[] = [...staticEntries];
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const [{ data: products }, { data: categories }, { data: combos }] = await Promise.all([
            supabaseAdmin.from("products").select("slug").eq("is_active", true),
            supabaseAdmin.from("categories").select("slug"),
            supabaseAdmin.from("combos").select("id").eq("is_active", true),
          ]);
          for (const p of products ?? []) if (p.slug) entries.push({ path: `/product/${p.slug}`, changefreq: "weekly", priority: "0.8" });
          for (const c of categories ?? []) if (c.slug) entries.push({ path: `/category/${c.slug}`, changefreq: "weekly", priority: "0.7" });
          for (const c of combos ?? []) if (c.id) entries.push({ path: `/combo/${c.id}`, changefreq: "weekly", priority: "0.7" });
        } catch (e) {
          console.error("sitemap dynamic entries failed", e);
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ].filter(Boolean).join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
