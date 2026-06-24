import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";

const categoriesQuery = queryOptions({
  queryKey: ["public", "categories"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, image_url, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(4);
    if (error) throw error;
    return data;
  },
});

const heroSettingsQuery = queryOptions({
  queryKey: ["public", "site_settings", "hero"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("hero_image, marquee_text")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veloura Essence" },
      { name: "description", content: "Veloura Essence — premium fragrances." },
    ],
  }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(categoriesQuery),
    context.queryClient.ensureQueryData(heroSettingsQuery),
  ]),
  component: Landing,
  errorComponent: ({ error }) => <div className="p-8 text-center text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-center">Not found.</div>,
});

function Landing() {
  const { data: categories = [] } = useSuspenseQuery(categoriesQuery);
  const { data: hero } = useSuspenseQuery(heroSettingsQuery);
  const slots = Array.from({ length: 4 }, (_, i) => categories[i]);
  const heroImage = hero?.hero_image ?? null;
  const marqueeText = (hero?.marquee_text ?? "Free shipping over ₹999 · New arrivals every week · Premium fragrances handcrafted").trim();
  const marqueeItems = Array.from({ length: 8 }, () => marqueeText);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4 w-full pt-8 items-start px-6">
          <div
            className="relative w-full max-w-[280px] mx-auto lg:mx-0 aspect-[3/4] rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-purple-100 to-purple-50 bg-cover bg-center"
            style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
          />


          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full lg:max-w-[720px] mx-auto">

            {slots.map((cat, i) => {
              const cardClass =
                "relative w-full aspect-square rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-purple-200 to-purple-100 bg-cover bg-center";
              const style = cat?.image_url
                ? { backgroundImage: `url(${cat.image_url})` }
                : undefined;
              const banner = (
                <div className="absolute bottom-0 left-0 w-full bg-[#52277a]/70 backdrop-blur-sm py-1.5 px-1 text-center text-white text-xs md:text-sm font-medium tracking-wide">
                  {cat?.name ?? "Coming soon"}
                </div>
              );
              if (!cat) {
                return (
                  <div key={i} className={cardClass}>
                    {banner}
                  </div>
                );
              }
              return (
                <Link
                  key={cat.id}
                  to="/category/$slug"
                  params={{ slug: cat.slug }}
                  className={cardClass}
                  style={style}
                >
                  {banner}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="relative z-20 w-full -mt-32 sm:-mt-40 lg:-mt-48 bg-gradient-to-r from-[#52277a] to-[#a555f0] text-white py-1.5 overflow-hidden shadow-lg">
          <div className="marquee-track text-xs sm:text-sm font-medium tracking-wide">

            {marqueeItems.map((t, i) => (
              <span key={i} className="px-8 inline-flex items-center gap-8">
                {t}
                <span className="opacity-60">✦</span>
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
