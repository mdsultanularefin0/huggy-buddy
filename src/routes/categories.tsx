import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Reveal } from "@/components/reveal";
import { pageMeta } from "@/lib/seo-meta";


const allCategoriesQuery = queryOptions({
  queryKey: ["public", "categories", "all-page"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, image_url, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/categories")({
  head: () => pageMeta({
    path: "/categories",
    title: "Shop by Category — Veloura Essence",
    description: "Browse every fragrance category at Veloura Essence — floral, oud, fresh, and more.",
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(allCategoriesQuery),

  component: CategoriesPage,
  errorComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-gray-600">
      Something went wrong loading categories.
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-gray-600">Not found</div>
  ),
});

function CategoriesPage() {
  const { data: categories } = useSuspenseQuery(allCategoriesQuery);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="w-full">
        <section className="w-full py-10 sm:py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto">
              <p className="uppercase tracking-widest text-[#a555f0] text-sm font-semibold">Collections</p>
              <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mt-2">Shop by Category</h1>
              <p className="text-gray-600 mt-3">
                Explore our curated fragrance families and find your signature.
              </p>
            </div>

            {categories.length === 0 ? (
              <div className="text-center text-gray-500 mt-16">No categories yet.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 mt-12">
                {categories.map((c, i) => (
                  <Reveal key={c.id} delay={i * 80}>
                    <Link
                      to="/category/$slug"
                      params={{ slug: c.slug }}
                      className="group relative block aspect-[4/5] rounded-2xl overflow-hidden bg-[#f5edff] shadow-sm hover:shadow-xl transition-all duration-500"
                    >
                      {c.image_url ? (
                        <img
                          src={c.image_url}
                          alt={c.name}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#52277a]/20 to-[#a555f0]/20" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-4 text-center">
                        <h2 className="text-white font-semibold text-base sm:text-lg tracking-wide">
                          {c.name}
                        </h2>
                        <span className="mt-2 inline-block text-[10px] tracking-[0.2em] uppercase text-white/90 border-b border-white/60 pb-0.5 opacity-0 group-hover:opacity-100 transition">
                          Shop now
                        </span>
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
