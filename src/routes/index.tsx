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
      .select("hero_image, hero_3d_overlay_image, marquee_text")
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
  const heroOverlay = hero?.hero_3d_overlay_image ?? null;
  const marqueeText = (hero?.marquee_text ?? "Free shipping over ₹999 · New arrivals every week · Premium fragrances handcrafted").trim();
  const marqueeItems = Array.from({ length: 8 }, () => marqueeText);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4 w-full pt-8 items-start px-6">
          <div className="relative w-full h-[400px] md:h-[500px] lg:h-[600px] transform translate-y-12 lg:translate-y-20">
            {heroImage && (
              <img
                src={heroImage}
                alt="Model"
                className="absolute bottom-0 left-0 w-full h-full object-contain object-bottom z-0"
              />
            )}
            {heroOverlay && (
              <img
                src={heroOverlay}
                alt="Product Overlay"
                className="absolute bottom-0 left-0 w-full h-full object-contain object-bottom z-20 pointer-events-none"
              />
            )}
          </div>



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

        <div className="w-full bg-[#a555f0] py-3 relative z-10 overflow-hidden shadow-lg text-white -mt-32 sm:-mt-40 lg:-mt-48">
          <div className="marquee-track text-xs sm:text-sm font-medium tracking-wide">

            {marqueeItems.map((t, i) => (
              <span key={i} className="px-8 inline-flex items-center gap-8">
                {t}
                <span className="opacity-60">✦</span>
              </span>
            ))}
          </div>
        </div>

        <div className="w-full bg-gradient-to-r from-[#52277a] to-[#a555f0] py-4 lg:py-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-7xl mx-auto px-4 items-center">
            <div className="flex justify-end pr-8">
              <button
                type="button"
                className="bg-[#52277a]/60 backdrop-blur-sm border-2 border-[#a555f0] shadow-[0_0_15px_rgba(165,85,240,0.5)] rounded-xl px-8 py-3 text-white font-bold text-lg hover:bg-[#52277a]/80 transition"
              >
                Order Now
              </button>
            </div>

            <div className="w-full max-w-md mx-auto lg:mx-0 bg-white rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-[#fbc02d] w-full py-3 text-center">
                <span className="text-white font-bold text-lg md:text-xl">Flash Sale! Up to 200Tk Off!</span>
              </div>
              <div className="bg-white w-full py-4 px-6 flex justify-between text-center">
                {[
                  { label: "Days", value: "00" },
                  { label: "Hours", value: "00" },
                  { label: "Minutes", value: "00" },
                  { label: "Seconds", value: "00" },
                ].map((b) => (
                  <div key={b.label}>
                    <div className="text-3xl md:text-4xl font-bold text-[#52277a]">{b.value}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-widest mt-1">{b.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
