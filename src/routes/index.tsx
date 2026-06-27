import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { brandingQueryOptions } from "@/lib/branding-query";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";

type Whisper = { quote: string; name: string; tag?: string };
type Faq = { q: string; a: string };
type Note = { title: string; gradient: string; link?: string };


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

const featuredProductsQuery = queryOptions({
  queryKey: ["public", "products", "featured"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, slug, name, regular_price, sale_price, sizes_json, image_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(4);
    if (error) throw error;
    return data ?? [];
  },
});

const heroSettingsQuery = queryOptions({
  queryKey: ["public", "site_settings", "hero"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
});


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veloura Essence — Premium Luxury Fragrances in Bangladesh" },
      {
        name: "description",
        content:
          "Shop Veloura Essence: high-concentration luxury perfumes with long-lasting silage. Signature scents, curated collections, and honest pricing in Bangladesh.",
      },
      { name: "keywords", content: "luxury perfume Bangladesh, premium fragrance, Veloura Essence, oud, floral perfume, woody perfume, attar" },
      { property: "og:title", content: "Veloura Essence — Premium Luxury Fragrances" },
      {
        property: "og:description",
        content:
          "Crafted scents, honest pricing, and an experience worthy of every occasion. Discover the Veloura signature collection.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Veloura Essence — Premium Luxury Fragrances" },
      {
        name: "twitter:description",
        content: "Crafted scents, honest pricing — discover Veloura Essence.",
      },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Store",
          name: "Veloura Essence",
          description:
            "Premium luxury fragrances handcrafted in Bangladesh — long-lasting, honestly priced.",
          url: "/",
          makesOffer: [
            { "@type": "Offer", itemOffered: { "@type": "Product", name: "Velvet Oud" } },
            { "@type": "Offer", itemOffered: { "@type": "Product", name: "Rose Nuit" } },
            { "@type": "Offer", itemOffered: { "@type": "Product", name: "Amber Reverie" } },
            { "@type": "Offer", itemOffered: { "@type": "Product", name: "Citrine Bloom" } },
          ],
        }),
      },
    ],

  }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(categoriesQuery),
    context.queryClient.ensureQueryData(heroSettingsQuery),
    context.queryClient.ensureQueryData(featuredProductsQuery),
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
  const { data: featuredProducts = [] } = useSuspenseQuery(featuredProductsQuery);
  const { data: branding } = useQuery(brandingQueryOptions);
  const footerLogo = branding?.site_logo_url ?? branding?.site_icon_url ?? null;


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
        <h1 className="sr-only">Veloura Essence — Premium Luxury Fragrances in Bangladesh</h1>
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

        {/* Signature Collection */}
        <section className="w-full py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 inline-block pb-2 border-b-2 border-[#a555f0]">
                Our Signature Collection
              </h2>
            </div>
            {featuredProducts.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
                {featuredProducts.map((p) => (
                  <ProductCard key={p.id} product={p as never} />
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 mt-10">New scents arriving soon.</p>
            )}
            <div className="text-center mt-10">
              <Link
                to="/products"
                className="inline-block px-8 py-3 rounded-xl border-2 border-[#52277a] text-[#52277a] hover:bg-[#52277a] hover:text-white transition-colors font-semibold"
              >
                View All Fragrances
              </Link>
            </div>
          </div>
        </section>

        {/* The Art of Veloura */}
        <section className="w-full py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative w-full h-[400px] lg:h-[500px] rounded-3xl overflow-hidden bg-gradient-to-br from-[#52277a]/20 via-gray-200 to-[#a555f0]/20 shadow-xl" />
            <div>
              <p className="uppercase tracking-widest text-[#a555f0] text-sm font-semibold">
                Luxury in Every Drop
              </p>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mt-2">
                The Art of Veloura
              </h2>
              <p className="text-gray-600 leading-relaxed mt-4">
                Crafted with high-concentration fragrance oils, each Veloura
                scent unfolds in deliberate layers — opening bright, settling
                into warmth, and lingering long after the day ends. We obsess
                over staying power and silage so you don't have to, delivering
                a true luxury experience at a price that respects you.
              </p>
              <button className="mt-6 px-8 py-3 rounded-xl border-2 border-[#52277a] text-[#52277a] hover:bg-[#52277a] hover:text-white transition-colors font-semibold">
                Discover Our Story
              </button>
            </div>
          </div>
        </section>

        {/* Discover by Scent Profile */}
        <section className="w-full py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold text-gray-900">
                Discover Your Signature Note
              </h2>
              <p className="text-gray-600 mt-3">
                Find the fragrance family that speaks to you — from sunlit
                florals to deep, lingering woods.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
              {[
                { title: "Fresh & Floral", gradient: "from-pink-300 to-purple-300" },
                { title: "Deep & Woody", gradient: "from-amber-700 to-stone-800" },
                { title: "Sweet & Oriental", gradient: "from-orange-400 to-[#52277a]" },
              ].map((c) => (
                <div
                  key={c.title}
                  className={`relative h-80 rounded-2xl overflow-hidden group cursor-pointer bg-gradient-to-br ${c.gradient}`}
                >
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-4">
                    <h3 className="text-2xl font-bold tracking-wide">{c.title}</h3>
                    <button className="mt-4 px-5 py-2 rounded-lg border border-white/70 text-sm font-semibold opacity-90 group-hover:opacity-100 group-hover:bg-white group-hover:text-[#52277a] transition">
                      Shop Category
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Customer Whispers */}
        <section className="w-full py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900">Customer Whispers</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-10">
              {[
                {
                  quote:
                    "It lasts all day and gets me compliments every single time. Absolute favorite.",
                  name: "Ayesha R.",
                  tag: "Verified Buyer · Summer Combo",
                },
                {
                  quote:
                    "Smells expensive in the best way. I've already reordered twice.",
                  name: "Tanvir H.",
                  tag: "Verified Buyer · Velvet Oud",
                },
                {
                  quote:
                    "The packaging, the scent, the staying power — every detail feels premium.",
                  name: "Nadia K.",
                  tag: "Verified Buyer · Rose Nuit",
                },
              ].map((t) => (
                <div key={t.name} className="p-8 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="text-[#fbc02d] text-lg mb-4">★★★★★</div>
                  <p className="text-gray-600 italic mb-6">"{t.quote}"</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{t.name}</span>
                    <span className="text-xs px-3 py-1 rounded-full bg-[#52277a]/10 text-[#52277a] font-medium">
                      {t.tag}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Frequently Asked Questions */}
        <section className="w-full py-16 bg-gray-50" aria-labelledby="faq-heading">
          <div className="max-w-3xl mx-auto px-4">
            <div className="text-center mb-10">
              <h2 id="faq-heading" className="text-3xl font-bold text-gray-900 inline-block pb-2 border-b-2 border-[#a555f0]">
                Frequently Asked Questions
              </h2>
              <p className="text-gray-600 mt-4">
                Everything you need to know about Veloura Essence fragrances, shipping, and care.
              </p>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {HOMEPAGE_FAQS.map((f, i) => (
                <AccordionItem key={f.q} value={`faq-${i}`} className="border-b border-gray-200">
                  <AccordionTrigger className="text-left text-gray-900 font-semibold hover:text-[#52277a]">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 leading-relaxed">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
