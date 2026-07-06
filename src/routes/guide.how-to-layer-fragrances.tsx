import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard, type ProductCardData } from "@/components/product-card";

const PATH = "/guide/how-to-layer-fragrances";
const TITLE = "How to Layer Fragrances — A Complete Guide | Veloura Essence";
const DESCRIPTION =
  "Learn how to layer perfumes like a pro: pairing notes, applying in the right order, and building a signature scent that lasts all day.";

const guideProductsQuery = queryOptions({
  queryKey: ["guide", "layering", "products"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products")
      .select("slug,name,image_url,regular_price,sale_price,sizes_json,badge,in_stock")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(4);
    if (error) throw error;
    return (data ?? []) as ProductCardData[];
  },
});

export const Route = createFileRoute("/guide/how-to-layer-fragrances")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: PATH },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: PATH }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "How to Layer Fragrances — A Complete Guide",
          description: DESCRIPTION,
          author: { "@type": "Organization", name: "Veloura Essence" },
          publisher: {
            "@type": "Organization",
            name: "Veloura Essence",
            logo: { "@type": "ImageObject", url: "https://heart-hug-light.lovable.app/favicon.png" },
          },
          mainEntityOfPage: `https://heart-hug-light.lovable.app${PATH}`,
        }),
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(guideProductsQuery),
  component: LayeringGuidePage,
});

function LayeringGuidePage() {
  const { data: products } = useSuspenseQuery(guideProductsQuery);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-12 md:py-16">
          <header className="mb-10 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Fragrance Guide</p>
            <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              How to Layer Fragrances
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Combine scents like a perfumer — build a signature that lasts longer, smells richer, and is uniquely yours.
            </p>
          </header>

          <section className="prose prose-lg max-w-none dark:prose-invert">
            <h2>What is fragrance layering?</h2>
            <p>
              Fragrance layering is the art of wearing two or more scents at once so they interact on your skin.
              Done right, layering deepens silage, extends longevity, and creates a scent no one else is wearing.
            </p>

            <h2>The three-step method</h2>
            <h3>1. Start with a scented base</h3>
            <p>
              Prep skin with an unscented moisturiser or a lightly scented body lotion. Hydrated skin holds fragrance
              much longer than dry skin — this alone can add 2–3 hours of wear.
            </p>

            <h3>2. Apply the heavier scent first</h3>
            <p>
              Spray the richer, deeper perfume (oud, amber, musk, vanilla) directly on pulse points — wrists, neck,
              behind the ears. Heavier molecules anchor the composition.
            </p>

            <h3>3. Top with a lighter scent</h3>
            <p>
              Follow with a fresh or floral perfume (citrus, tea, jasmine, rose). Spray from 15–20 cm away so it
              settles as a veil over the base instead of drowning it.
            </p>

            <h2>Notes that pair well together</h2>
            <ul>
              <li><strong>Oud + Rose</strong> — a classic Middle Eastern pairing, warm and romantic.</li>
              <li><strong>Vanilla + Citrus</strong> — sweet meets bright; great for daytime wear.</li>
              <li><strong>Musk + Jasmine</strong> — soft, sensual, and long-lasting.</li>
              <li><strong>Sandalwood + Bergamot</strong> — creamy, calming, easy to wear at the office.</li>
              <li><strong>Amber + Sea salt</strong> — modern and unusual; perfect for evenings.</li>
            </ul>

            <h2>Common layering mistakes</h2>
            <ul>
              <li>Combining two heavy oriental perfumes — the result is muddy, not deep.</li>
              <li>Spraying both fragrances on the same spot at full strength.</li>
              <li>Ignoring the season — heavier layers overwhelm in hot Bangladesh summers.</li>
            </ul>

            <h2>Build your own combo</h2>
            <p>
              Not sure where to start? Our <Link to="/products" className="text-primary underline">Build-Your-Own-Box</Link>{" "}
              feature lets you hand-pick two or three complementary scents and try them together.
            </p>
          </section>

          {products.length > 0 && (
            <section className="mt-14">
              <h2 className="text-2xl font-bold text-foreground mb-6">Perfumes made for layering</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {products.map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>
            </section>
          )}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
