import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";

const categoriesQuery = queryOptions({
  queryKey: ["public", "categories"],
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

const heroSettingsQuery = queryOptions({
  queryKey: ["public", "site_settings", "hero"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select(
        "hero_image, hero_overlay_image, marquee_text, homepage_category_ids, flash_timer_title, flash_timer_enabled, flash_timer_auto_reset, flash_timer_duration_days, timer_reset_date",
      )
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

function useCountdown(targetMs: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!targetMs) return { days: "00", hours: "00", mins: "00", secs: "00" };
  const diff = Math.max(0, targetMs - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { days: pad(days), hours: pad(hours), mins: pad(mins), secs: pad(secs) };
}

function Landing() {
  const { data: allCategories = [] } = useSuspenseQuery(categoriesQuery);
  const { data: hero } = useSuspenseQuery(heroSettingsQuery);

  const selectedIds = (hero?.homepage_category_ids ?? []) as string[];
  const categories = selectedIds.length
    ? selectedIds
        .map((id) => allCategories.find((c) => c.id === id))
        .filter((c): c is (typeof allCategories)[number] => Boolean(c))
    : allCategories.slice(0, 4);

  const slots = Array.from({ length: 4 }, (_, i) => categories[i]);
  const mobileSlots = Array.from({ length: 3 }, (_, i) => categories[i]);
  const heroImage = hero?.hero_image ?? null;
  const heroOverlay = hero?.hero_overlay_image ?? null;

  const marqueeText = (hero?.marquee_text ?? "Free shipping over ₹999 · New arrivals every week · Premium fragrances handcrafted").trim();
  const marqueeItems = Array.from({ length: 8 }, () => marqueeText);

  // Flash timer target
  const timerEnabled = hero?.flash_timer_enabled ?? true;
  const autoReset = hero?.flash_timer_auto_reset ?? false;
  const durationDays = hero?.flash_timer_duration_days ?? 7;
  const resetDateStr = hero?.timer_reset_date ?? null;
  let targetMs: number | null = null;
  if (timerEnabled && resetDateStr) {
    const base = new Date(resetDateStr).getTime();
    const nowMs = Date.now();
    if (base > nowMs) {
      targetMs = base;
    } else if (autoReset && durationDays > 0) {
      const periodMs = durationDays * 86_400_000;
      const elapsed = nowMs - base;
      const cycles = Math.floor(elapsed / periodMs) + 1;
      targetMs = base + cycles * periodMs;
    }
  }
  const countdown = useCountdown(targetMs);
  const flashTitle = hero?.flash_timer_title ?? "Flash Sale! Up to 200Tk Off!";

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

  const renderCategoryCards = (items: typeof slots, gridClass: string) => (
    <div className={`grid ${gridClass} gap-3 sm:gap-4 w-full sm:max-w-[640px] md:max-w-[860px] lg:max-w-[720px] mx-auto`}>

      {items.map((cat, i) => {
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
  const categoryCards = renderCategoryCards(slots, "grid-cols-2 sm:grid-cols-4");
  const mobileCategoryCards = renderCategoryCards(mobileSlots, "grid-cols-3");

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

  const flashTimer = timerEnabled ? (
    <div className="w-full max-w-[340px] sm:max-w-[440px] md:max-w-[560px] mx-auto bg-white rounded-xl shadow-xl overflow-hidden">
      <div className="bg-[#fbc02d] py-1.5 px-2 lg:py-2 lg:px-3 text-center border-b border-black/5">
        <h3 className="text-[10px] lg:text-[13px] font-black text-gray-900 uppercase tracking-wide">
          {flashTitle}
        </h3>
      </div>
      <div className="grid grid-cols-4 py-2 px-1 lg:py-4 lg:px-2">
        {[
          { label: "Days", value: countdown.days },
          { label: "Hours", value: countdown.hours },
          { label: "Mins", value: countdown.mins },
          { label: "Secs", value: countdown.secs, accent: true },
        ].map((b, i, arr) => (
          <div
            key={b.label}
            className={`flex flex-col items-center ${i < arr.length - 1 ? "border-r border-gray-100" : ""}`}
          >
            <span className={`text-base lg:text-3xl font-black leading-none ${b.accent ? "text-[#E11D48]" : "text-gray-900"}`}>
              {b.value}
            </span>
            <span className="text-[8px] lg:text-[10px] font-semibold text-gray-400 uppercase mt-1 lg:mt-1.5 tracking-wider">
              {b.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

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
          <div className="grid grid-cols-[1fr_2fr] gap-4 w-full max-w-[1600px] mx-auto pt-8 items-start px-6 lg:pl-12 xl:pl-20 2xl:pl-32">
            {heroImageBlock}
            {categoryCards}
          </div>
          {marquee}
          <div className="w-full bg-gradient-to-r from-[#52277a] to-[#a555f0] py-6 relative z-10">
            <div className="grid grid-cols-[1fr_2fr] gap-4 w-full max-w-[1600px] mx-auto px-6 items-center">
              <div aria-hidden />
              <div className="relative w-full lg:max-w-[720px] mx-auto">
                {flashTimer}
                <div className="hidden xl:block absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[calc(100%+1rem)]">
                  {orderNowButton}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile / Tablet layout */}
        <div className="lg:hidden">
          <div className="grid grid-cols-[1fr_1fr] gap-4 w-full pt-8 items-start pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] sm:pl-[max(1.5rem,var(--safe-left))] sm:pr-[max(1.5rem,var(--safe-right))]">
            {heroImageBlock}
            <div className="sm:mt-10 md:mt-20">{flashTimer}</div>
          </div>
          {marquee}
          <div className="w-full bg-gradient-to-r from-[#52277a] to-[#a555f0] pt-[calc(4rem+var(--safe-bottom))] sm:pt-[calc(6rem+var(--safe-bottom))] pb-6 flex items-end relative z-10">
            <div className="w-full max-w-7xl mx-auto pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] sm:pl-[max(1.5rem,var(--safe-left))] sm:pr-[max(1.5rem,var(--safe-right))]">
              {mobileCategoryCards}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
