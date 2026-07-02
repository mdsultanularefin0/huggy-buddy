import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { brandingQueryOptions } from "@/lib/branding-query";
import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { supabase } from "@/integrations/supabase/client";

type Faq = { q: string; a: string };
type Note = { title: string; gradient: string; link?: string };
type Reel = { url: string; caption?: string; link?: string };
type CustomWhisper = { quote: string; name: string; tag?: string; rating?: number };

type WhisperCard = {
  key: string;
  rating: number;
  title: string | null;
  body: string;
  author: string;
  productSlug?: string;
  productName?: string;
  tag?: string;
};

type WhisperReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  author_name: string;
  created_at: string;
  products: { slug: string; name: string } | null;
};

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url);
}

function reelEmbedSrc(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    // YouTube Shorts / watch / youtu.be — playsinline + minimal chrome
    const ytParams = "?playsinline=1&rel=0&modestbranding=1";
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}${ytParams}` : null;
    }
    if (host.endsWith("youtube.com")) {
      const shortsMatch = u.pathname.match(/^\/shorts\/([^/]+)/);
      if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}${ytParams}`;
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}${ytParams}`;
      return null;
    }
    // TikTok video
    if (host.endsWith("tiktok.com")) {
      const m = u.pathname.match(/\/video\/(\d+)/);
      if (m) return `https://www.tiktok.com/embed/v2/${m[1]}`;
      return null;
    }
    // Instagram reel / post
    if (host.endsWith("instagram.com")) {
      const m = u.pathname.match(/\/(reel|p|tv)\/([^/]+)/);
      if (m) return `https://www.instagram.com/${m[1]}/${m[2]}/embed`;
      return null;
    }
    // Facebook video / reel / fb.watch
    if (host.endsWith("facebook.com") || host === "fb.watch" || host.endsWith("fb.watch")) {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=false`;
    }
    return null;
  } catch {
    return null;
  }
}

function LazyReelTile({ reel, index }: { reel: Reel; index: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const direct = isDirectVideo(reel.url);
  const src = direct ? null : reelEmbedSrc(reel.url);

  useEffect(() => {
    if (visible || !ref.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "400px 200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div
      ref={ref}
      className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-lg"
    >
      {visible ? (
        direct ? (
          <video
            src={reel.url}
            controls
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-cover bg-black"
          />
        ) : src ? (
          <iframe
            src={src}
            title={reel.caption || `Reel ${index + 1}`}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/70 text-xs px-3 text-center">
            Unsupported URL
          </div>
        )
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
        </div>
      )}
      {reel.caption ? (
        <div className="pointer-events-none absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs sm:text-sm px-3 py-2">
          {reel.caption}
        </div>
      ) : null}
    </div>
  );
}


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

const whisperReviewsQuery = queryOptions({
  queryKey: ["public", "reviews", "whispers"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("product_reviews")
      .select("id,rating,title,body,author_name,created_at,products(slug,name)")
      .gte("rating", 4)
      .order("created_at", { ascending: false })
      .limit(6);
    if (error) throw error;
    return (data ?? []) as unknown as WhisperReview[];
  },
});


const HERO_OG_IMAGE = "/__l5e/assets-v1/cdb47efc-0449-4721-ba5e-c16e886a1c8b/hero-main.png";

export const Route = createFileRoute("/")({
  head: ({ loaderData }) => {
    const origin = (loaderData as { origin?: string } | undefined)?.origin ?? "";
    const url = origin ? `${origin}/` : "/";
    const ogImage = `${origin}${HERO_OG_IMAGE}`;
    return {
      meta: [
        { title: "Veloura Essence | Premium Fragrances in Bangladesh" },
        {
          name: "description",
          content:
            "Shop Veloura Essence: high-concentration luxury perfumes with long-lasting silage. Signature scents, curated collections, and honest pricing in Bangladesh.",
        },
        { name: "keywords", content: "luxury perfume Bangladesh, premium fragrance, Veloura Essence, oud, floral perfume, woody perfume, attar" },
        { property: "og:title", content: "Veloura Essence | Premium Fragrances in Bangladesh" },
        {
          property: "og:description",
          content:
            "Crafted scents, honest pricing, and an experience worthy of every occasion. Discover the Veloura signature collection.",
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: ogImage },
        { property: "og:image:alt", content: "Veloura Essence luxury perfumes" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Veloura Essence | Premium Fragrances in Bangladesh" },
        {
          name: "twitter:description",
          content: "Crafted scents, honest pricing — discover Veloura Essence.",
        },
        { name: "twitter:image", content: ogImage },
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
            url: url,
            image: ogImage,
          }),
        },
      ],
    };
  },
  loader: async ({ context }) => {
    const { getRequestOrigin } = await import("@/lib/origin.functions");
    const [, , , origin] = await Promise.all([
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(heroSettingsQuery),
      context.queryClient.ensureQueryData(featuredProductsQuery),
      getRequestOrigin(),
    ]);
    return { origin };
  },
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

function CategoryCarousel({ categories }: { categories: Array<{ id: string; slug: string; name: string; image_url: string | null }> }) {
  const autoplayRef = useRef(Autoplay({ delay: 2500, stopOnInteraction: false, stopOnMouseEnter: true }));
  return (
    <Carousel
      opts={{ loop: true, align: "start", dragFree: false }}
      plugins={[autoplayRef.current]}
      className="w-full sm:max-w-[640px] md:max-w-[860px] lg:max-w-[720px] mx-auto"
    >
      <CarouselContent className="-ml-3 sm:-ml-4">
        {(categories.length < 8 ? [...categories, ...categories, ...categories] : categories).map((cat, i) => {
          const cardClass =
            "relative block w-full aspect-square rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-purple-200 to-purple-100 bg-cover bg-center";
          const style = cat.image_url ? { backgroundImage: `url(${cat.image_url})` } : undefined;
          return (
            <CarouselItem key={`${cat.id}-${i}`} className="pl-3 sm:pl-4 basis-1/3 lg:basis-1/4">
              <Link to="/category/$slug" params={{ slug: cat.slug }} className={cardClass} style={style}>
                <div className="absolute bottom-0 left-0 w-full bg-[#52277a]/70 backdrop-blur-sm py-1.5 px-1 text-center text-white text-xs md:text-sm font-medium tracking-wide">
                  {cat.name}
                </div>
              </Link>
            </CarouselItem>
          );
        })}
      </CarouselContent>
    </Carousel>
  );
}

function Landing() {
  const { data: allCategories = [] } = useSuspenseQuery(categoriesQuery);
  
  const { data: hero } = useSuspenseQuery(heroSettingsQuery);
  const { data: featuredProducts = [] } = useSuspenseQuery(featuredProductsQuery);
  const { data: branding } = useQuery(brandingQueryOptions);
  const { data: whisperReviews = [] } = useQuery(whisperReviewsQuery);
  const footerLogo = branding?.site_logo_url ?? branding?.site_icon_url ?? null;


  const selectedIds = (hero?.homepage_category_ids ?? []) as string[];
  const categories = selectedIds.length
    ? selectedIds
        .map((id) => allCategories.find((c) => c.id === id))
        .filter((c): c is (typeof allCategories)[number] => Boolean(c))
    : allCategories;

  const heroImage = hero?.hero_image ?? null;
  const heroOverlay = hero?.hero_overlay_image ?? null;

  const h = (hero ?? {}) as Record<string, unknown>;
  const signatureTitle = (h.signature_title as string) || "Our Signature Collection";
  const signatureSubtitle = (h.signature_subtitle as string) || "";
  const artEyebrow = (h.art_eyebrow as string) || "";
  const artTitle = (h.art_title as string) || "The Art of Veloura";
  const artBody = (h.art_body as string) || "";
  const artButtonLabel = (h.art_button_label as string) || "";
  const artButtonLink = (h.art_button_link as string) || "";
  const artImage = (h.art_image as string) || null;
  const bannerImage = (h.banner_image as string) || null;
  const signatureImage = (h.signature_image as string) || null;

  const notesTitle = (h.notes_title as string) || "Discover Your Signature Note";
  const notesSubtitle = (h.notes_subtitle as string) || "";
  const notes = ((h.notes_json as Note[] | null) ?? []) as Note[];
  const heroEnabled = (h.hero_enabled as boolean | undefined) ?? true;
  const bannerEnabled = (h.banner_enabled as boolean | undefined) ?? true;
  const signatureEnabled = (h.signature_enabled as boolean | undefined) ?? true;
  const artEnabled = (h.art_enabled as boolean | undefined) ?? true;
  const notesEnabled = (h.notes_enabled as boolean | undefined) ?? true;
  const whispersEnabled = (h.whispers_enabled as boolean | undefined) ?? true;
  const whispersTitle = (h.whispers_title as string) || "Customer Whispers";
  const customWhispers = ((h.whispers_json as CustomWhisper[] | null) ?? []) as CustomWhisper[];
  const whisperCards: WhisperCard[] = [
    ...customWhispers
      .filter((w) => w?.quote && w?.name)
      .map((w, i) => ({
        key: `c-${i}`,
        rating: Math.max(1, Math.min(5, Math.round(w.rating ?? 5))),
        title: null,
        body: w.quote,
        author: w.name,
        tag: w.tag,
      })),
    ...whisperReviews.map((r) => ({
      key: `r-${r.id}`,
      rating: r.rating,
      title: r.title,
      body: r.body ?? "",
      author: r.author_name,
      productSlug: r.products?.slug,
      productName: r.products?.name,
    })),
  ].slice(0, 6);
  const reelsTitle = (h.reels_title as string) || "From Our Community";
  const reelsEnabled = (h.reels_enabled as boolean | undefined) ?? true;
  const reels = ((h.reels_json as Reel[] | null) ?? []) as Reel[];
  const faqsTitle = (h.faqs_title as string) || "Frequently Asked Questions";
  const faqs = ((h.faqs_json as Faq[] | null) ?? []) as Faq[];
  const faqsEnabled = (h.faqs_enabled as boolean | undefined) ?? true;


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
        className="absolute inset-0 z-0 rounded-2xl overflow-hidden bg-gradient-to-br from-purple-100 to-purple-50 bg-contain bg-center bg-no-repeat"
        style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
      />
      <div
        className="absolute inset-0 z-30 rounded-2xl overflow-hidden bg-contain bg-center bg-no-repeat pointer-events-none"
        style={heroOverlay ? { backgroundImage: `url(${heroOverlay})` } : undefined}
      />
    </div>
  );

  const categoryCarousel = categories.length ? <CategoryCarousel categories={categories} /> : null;


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
    <div
      className="relative z-20 w-full -mt-20 sm:-mt-40 lg:-mt-48 bg-gradient-to-r from-[#a555f0] to-[#52277a] text-white py-1 sm:py-1.5 overflow-hidden shadow-lg bg-cover bg-center"
      style={bannerImage ? { backgroundImage: `url(${bannerImage})` } : undefined}
    >
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
        {heroEnabled ? (
          <>
            {/* Desktop layout */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-[1fr_2fr] gap-4 w-full max-w-[1600px] mx-auto pt-8 items-start px-6 lg:pl-12 xl:pl-20 2xl:pl-32">
                {heroImageBlock}
                {categoryCarousel}
              </div>
              {bannerEnabled ? marquee : null}
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
              {bannerEnabled ? marquee : null}
              <div className="w-full bg-gradient-to-r from-[#52277a] to-[#a555f0] pt-[calc(2rem+var(--safe-bottom))] sm:pt-[calc(6rem+var(--safe-bottom))] pb-3 sm:pb-6 flex items-end relative z-10">
                <div className="w-full max-w-7xl mx-auto pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] sm:pl-[max(1.5rem,var(--safe-left))] sm:pr-[max(1.5rem,var(--safe-right))]">
                  {categoryCarousel}
                </div>
              </div>
            </div>
          </>
        ) : bannerEnabled ? (
          marquee
        ) : null}


        {signatureEnabled ? (
        <>
        {/* Signature Collection */}
        <section
          className="w-full py-16 bg-gray-50 bg-cover bg-center"
          style={signatureImage ? { backgroundImage: `url(${signatureImage})` } : undefined}
        >

          <div className="max-w-7xl mx-auto px-4">
            <Reveal>
              <div className="text-center max-w-2xl mx-auto">
                <h2 className="text-3xl font-bold text-gray-900 inline-block pb-2 border-b-2 border-[#a555f0]">
                  {signatureTitle}
                </h2>
                {signatureSubtitle ? (
                  <p className="text-gray-600 mt-4">{signatureSubtitle}</p>
                ) : null}
              </div>
            </Reveal>
            {featuredProducts.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
                {featuredProducts.map((p, i) => (
                  <Reveal key={p.id} delay={i * 80}>
                    <ProductCard product={p as never} />
                  </Reveal>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 mt-10">New scents arriving soon.</p>
            )}
            <Reveal delay={150}>
              <div className="text-center mt-10">
                <Link
                  to="/products"
                  className="inline-block px-8 py-3 rounded-xl border-2 border-[#52277a] text-[#52277a] hover:bg-[#52277a] hover:text-white transition-colors font-semibold hover:scale-105 transform-gpu duration-300"
                >
                  View All Fragrances
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        </>
        ) : null}

        {artEnabled ? (
        <>
        {/* The Art of Veloura */}
        <section className="w-full py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <Reveal>
              <div
                className="relative w-full h-[400px] lg:h-[500px] rounded-3xl overflow-hidden bg-gradient-to-br from-[#52277a]/20 via-gray-200 to-[#a555f0]/20 shadow-xl bg-cover bg-center transition-transform duration-700 hover:scale-[1.02]"
                style={artImage ? { backgroundImage: `url(${artImage})` } : undefined}
              />
            </Reveal>
            <Reveal delay={150}>
              <div>
                {artEyebrow ? (
                  <p className="uppercase tracking-widest text-[#a555f0] text-sm font-semibold">
                    {artEyebrow}
                  </p>
                ) : null}
                <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mt-2">{artTitle}</h2>
                <p className="text-gray-600 leading-relaxed mt-4 whitespace-pre-line">{artBody}</p>
                {artButtonLabel ? (
                  <a
                    href={artButtonLink || "#"}
                    className="mt-6 inline-block px-8 py-3 rounded-xl border-2 border-[#52277a] text-[#52277a] hover:bg-[#52277a] hover:text-white transition-all font-semibold hover:scale-105 transform-gpu"
                  >
                    {artButtonLabel}
                  </a>
                ) : null}
              </div>
            </Reveal>
          </div>
        </section>
        </>
        ) : null}

        {/* Discover by Scent Profile */}
        {notesEnabled && notes.length > 0 ? (
          <section className="w-full py-16 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4">
              <div className="text-center max-w-2xl mx-auto">
                <h2 className="text-3xl font-bold text-gray-900">{notesTitle}</h2>
                {notesSubtitle ? <p className="text-gray-600 mt-3">{notesSubtitle}</p> : null}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
                {notes.map((c, i) => (
                  <Reveal key={c.title} delay={i * 120}>
                    <a
                      href={c.link || "#"}
                      className={`relative h-80 rounded-2xl overflow-hidden group cursor-pointer bg-gradient-to-br ${c.gradient} block transition-transform duration-500 hover:-translate-y-2 hover:shadow-2xl`}
                    >
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-4">
                        <h3 className="text-2xl font-bold tracking-wide transition-transform duration-500 group-hover:scale-110">{c.title}</h3>
                        <span className="mt-4 px-5 py-2 rounded-lg border border-white/70 text-sm font-semibold opacity-90 group-hover:opacity-100 group-hover:bg-white group-hover:text-[#52277a] transition">
                          Shop Category
                        </span>
                      </div>
                    </a>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* Customer Whispers — custom + top-rated product reviews */}
        {whispersEnabled && whisperCards.length > 0 ? (
          <section className="w-full py-16 bg-white">
            <div className="max-w-7xl mx-auto px-4">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900">{whispersTitle}</h2>
                <p className="text-sm text-gray-500 mt-2">
                  Real reviews from verified customers.{" "}
                  <Link to="/reviews" className="text-[#52277a] underline">See all</Link>
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-10">
                {whisperCards.map((c, i) => (
                  <Reveal key={c.key} delay={i * 100}>
                    <div className="p-8 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col h-full transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:border-[#a555f0]/30">
                      <div className="text-[#fbc02d] text-lg mb-3" aria-label={`${c.rating} out of 5`}>
                        {"★".repeat(c.rating)}{"☆".repeat(5 - c.rating)}
                      </div>
                      {c.title ? <p className="font-semibold text-gray-900 mb-1">{c.title}</p> : null}
                      {c.body ? <p className="text-gray-600 italic mb-6 line-clamp-5">"{c.body}"</p> : <div className="mb-6" />}
                      <div className="mt-auto flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{c.author}</span>
                        {c.productSlug && c.productName ? (
                          <Link
                            to="/product/$slug"
                            params={{ slug: c.productSlug }}
                            className="text-xs px-3 py-1 rounded-full bg-[#52277a]/10 text-[#52277a] font-medium hover:bg-[#52277a]/20"
                          >
                            {c.productName}
                          </Link>
                        ) : c.tag ? (
                          <span className="text-xs px-3 py-1 rounded-full bg-[#52277a]/10 text-[#52277a] font-medium">
                            {c.tag}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        ) : null}


        {/* Reels — 9:16 embeds */}
        {reelsEnabled && reels.length > 0 ? (
          <section className="w-full py-16 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-gray-900 inline-block pb-2 border-b-2 border-[#a555f0]">
                  {reelsTitle}
                </h2>
              </div>
              <Carousel
                opts={{ align: "start", loop: true, dragFree: false }}
                className="w-full"
              >
                <CarouselContent className="-ml-3 sm:-ml-4 touch-pan-y">
                  {reels.map((r, i) => {
                    return (
                      <CarouselItem
                        key={i}
                        className="pl-3 sm:pl-4 basis-[78%] xs:basis-[60%] sm:basis-1/3 lg:basis-1/4"
                      >
                        {r.link ? (
                          <a href={r.link} target="_blank" rel="noopener noreferrer" className="block">
                            <LazyReelTile reel={r} index={i} />
                          </a>
                        ) : (
                          <LazyReelTile reel={r} index={i} />
                        )}
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
                <CarouselPrevious className="hidden sm:flex -left-4" />
                <CarouselNext className="hidden sm:flex -right-4" />
              </Carousel>

            </div>
          </section>
        ) : null}


        {/* Frequently Asked Questions */}
        {faqsEnabled && faqs.length > 0 ? (
          <section className="w-full py-16 bg-gray-50" aria-labelledby="faq-heading">
            <div className="max-w-3xl mx-auto px-4">
              <div className="text-center mb-10">
                <h2 id="faq-heading" className="text-3xl font-bold text-gray-900 inline-block pb-2 border-b-2 border-[#a555f0]">
                  {faqsTitle}
                </h2>
              </div>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((f, i) => (
                  <AccordionItem key={`${f.q}-${i}`} value={`faq-${i}`} className="border-b border-gray-200">
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
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
}
