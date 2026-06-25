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
      .select("hero_image, hero_overlay_image, marquee_text")
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
  const heroOverlay = hero?.hero_overlay_image ?? null;

  const marqueeText = (hero?.marquee_text ?? "Free shipping over ₹999 · New arrivals every week · Premium fragrances handcrafted").trim();
  const marqueeItems = Array.from({ length: 8 }, () => marqueeText);

  const heroImageBlock = (
    <div className="relative w-full max-w-[280px] mx-auto lg:mx-0 aspect-[3/4]">
      <div
        className="absolute inset-0 z-0 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-purple-100 to-purple-50 bg-cover bg-center"
        style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
      />
      <div
        className="absolute inset-0 z-30 rounded-2xl overflow-hidden bg-cover bg-center pointer-events-none"
        style={heroOverlay ? { backgroundImage: `url(${heroOverlay})` } : undefined}
      />
    </div>
  );

  const categoryCards = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full lg:max-w-[720px] mx-auto">
      {slots.map((cat, i) => {
        const cardClass =
          "relative w-full aspect-square rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-purple-200 to-purple-100 bg-cover bg-center";
        const style = cat?.image_url ? { backgroundImage: `url(${cat.image_url})` } : undefined;
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
          <Link key={cat.id} to="/category/$slug" params={{ slug: cat.slug }} className={cardClass} style={style}>
            {banner}
          </Link>
        );
      })}
    </div>
  );

  const orderNowButton = (
    <div className="flex justify-center lg:justify-start">
      <button
        type="button"
        className="bg-[#52277a]/60 backdrop-blur-sm border-2 border-[#a555f0] shadow-[0_0_15px_rgba(165,85,240,0.5)] rounded-xl px-4 py-2 text-sm lg:px-8 lg:py-3 lg:text-lg text-white font-bold hover:bg-[#52277a]/80 transition"
      >
        Order Now
      </button>
    </div>
  );

  const flashTimer = (
    <div className="w-full max-w-md mx-auto bg-white rounded-xl lg:rounded-2xl overflow-hidden shadow-2xl">
      <div className="bg-[#fbc02d] w-full py-1.5 lg:py-3 text-center px-2">
        <span className="text-white font-bold text-xs sm:text-sm lg:text-xl">Flash Sale! Up to 200Tk Off!</span>
      </div>
      <div className="bg-white w-full py-2 px-2 lg:py-4 lg:px-6 flex justify-between text-center">
        {[
          { label: "Days", value: "00" },
          { label: "Hours", value: "00" },
          { label: "Minutes", value: "00" },
          { label: "Seconds", value: "00" },
        ].map((b) => (
          <div key={b.label}>
            <div className="text-base sm:text-xl lg:text-4xl font-bold text-[#52277a]">{b.value}</div>
            <div className="text-[9px] sm:text-[10px] lg:text-xs text-gray-500 uppercase tracking-widest mt-0.5 lg:mt-1">{b.label}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const marquee = (
    <div className="relative z-20 w-full -mt-32 sm:-mt-40 lg:-mt-48 bg-gradient-to-r from-[#a555f0] to-[#52277a] text-white py-1.5 overflow-hidden shadow-lg">
      <div className="marquee-track text-xs sm:text-sm font-medium tracking-wide">
        {marqueeItems.map((t, i) => (
          <span key={i} className="px-8 inline-flex items-center gap-8">
            {t}
            <span className="opacity-60">✦</span>
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="w-full">
        {/* Desktop layout */}
        <div className="hidden lg:block">
          <div className="grid grid-cols-[1fr_2fr] gap-4 w-full pt-8 items-start px-6">
            {heroImageBlock}
            {categoryCards}
          </div>
          {marquee}
          <div className="w-full bg-gradient-to-r from-[#52277a] to-[#a555f0] py-6 relative z-10">
            <div className="grid grid-cols-[1fr_2fr] gap-4 w-full px-6 items-center">
              <div aria-hidden />
              <div className="relative w-full">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10">{orderNowButton}</div>
                <div className="w-full lg:max-w-[720px] mx-auto">{flashTimer}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile / Tablet layout */}
        <div className="lg:hidden">
          <div className="grid grid-cols-[1fr_1fr] gap-4 w-full pt-8 items-start px-4 sm:px-6">
            {heroImageBlock}
            {flashTimer}
          </div>
          {marquee}
          <div className="w-full bg-gradient-to-r from-[#52277a] to-[#a555f0] py-6 relative z-10">
            <div className="grid grid-cols-3 gap-4 w-full max-w-7xl mx-auto px-4 sm:px-6">
              <div aria-hidden />
              <div className="col-span-2 flex flex-col gap-6">
                {orderNowButton}
                {categoryCards}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
