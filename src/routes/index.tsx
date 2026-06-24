import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Sparkles, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, effectivePrice, hasSale } from "@/lib/currency";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";
import { FlashTimer } from "@/components/flash-timer";
import heroHand from "@/assets/hero-hand.png.asset.json";
import heroMain from "@/assets/hero-main.png.asset.json";

type ProductRow = {
  id: string; name: string; description: string | null;
  regular_price: number; sale_price: number | null;
  sizes_json: { size_label: string; price: number; sale_price?: number | null }[] | null;
  image_url: string | null; in_stock: boolean;
};
type ComboRow = {
  id: string; title: string; description: string | null;
  combo_type: "prebuilt" | "byob";
  regular_price: number; sale_price: number | null;
  image_url: string | null; max_items_allowed: number | null;
};
type CategoryRow = {
  id: string; name: string; slug: string; image_url: string | null;
  sort_order: number; is_active: boolean;
};
type SiteSettings = {
  marquee_text: string | null;
  hero_image: string | null;
  hero_bg_image: string | null;
  hero_fg_image: string | null;
  hero_overlay_left: string | null;
  hero_overlay_right: string | null;
  header_position: "sticky" | "static" | "floating" | null;
  timer_reset_date: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_cta_label: string | null;
  cta_band_text: string | null;
  cta_band_button_label: string | null;
  cta_band_button_link: string | null;
  site_logo_url: string | null;
  site_icon_url: string | null;
  footer_logo_size: number | null;
  footer_logo_align: "left" | "center" | "right" | null;
};

const storefrontOptions = queryOptions({
  queryKey: ["storefront"],
  queryFn: async () => {
    const [products, combos, categories, settings] = await Promise.all([
      supabase.from("products").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("combos").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("categories").select("id,name,slug,image_url,sort_order,is_active").eq("is_active", true).order("sort_order", { ascending: true }),
      supabase.from("site_settings").select("*").limit(1).maybeSingle(),
    ]);
    return {
      products: (products.data ?? []) as ProductRow[],
      combos: (combos.data ?? []) as ComboRow[],
      categories: (categories.data ?? []) as CategoryRow[],
      settings: (settings.data ?? null) as SiteSettings | null,
    };
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veloura Essence — Luxury Perfumes in Bangladesh" },
      { name: "description", content: "Curated luxury fragrances, dual combo deals, and build-your-own perfume boxes. Delivered across Bangladesh." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(storefrontOptions),
  component: Landing,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function Landing() {
  const { data } = useSuspenseQuery(storefrontOptions);
  const s = data.settings;
  const marquee = s?.marquee_text ?? "VELOURA ESSENCE NOW MORE AFFORDABLE, STARTING ONLY AT 200 BDT";
  const prebuilt = data.combos.filter((c) => c.combo_type === "prebuilt");
  const byob = data.combos.filter((c) => c.combo_type === "byob");
  const heroCategories = data.categories.slice(0, 4);
  const bgImg = s?.hero_bg_image ?? s?.hero_image ?? heroMain.url;
  const fgImg = s?.hero_fg_image ?? heroHand.url;
  const ctaLabel = s?.cta_band_button_label ?? s?.hero_cta_label ?? "Order Now";
  const ctaLink = s?.cta_band_button_link ?? "";

  const CtaWrap = ({ children }: { children: React.ReactNode }) =>
    ctaLink.startsWith("/#") ? (
      <Link to="/" hash={ctaLink.slice(2)}>{children}</Link>
    ) : ctaLink ? (
      <a href={ctaLink}>{children}</a>
    ) : (
      <Link to="/" hash="perfumes">{children}</Link>
    );

  return (
    <div className="min-h-screen bg-background">
      <FaviconSetter url={s?.site_icon_url} />
      <SiteHeader position={s?.header_position ?? "sticky"} logoUrl={s?.site_logo_url ?? null} />

      {/* HERO — split background, 4-card top row, model overlay on the left */}
      <section className="relative w-full overflow-hidden bg-white">
        {(s?.hero_title || s?.hero_subtitle) && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 md:pt-8 text-center">
            {s?.hero_title && <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">{s.hero_title}</h1>}
            {s?.hero_subtitle && <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">{s.hero_subtitle}</p>}
          </div>
        )}

        {/* TOP: full-width 4 cards, with extra left padding on desktop to make room for the model */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 md:pt-10 relative z-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:pl-[18%]">
            {(heroCategories.length > 0 ? heroCategories : DEFAULT_HERO_CARDS.map((c, i) => ({ id: String(i), name: c.title, slug: "", image_url: null, sort_order: i, is_active: true } as CategoryRow))).map((c) => (
              <HeroCategoryCard key={c.id} cat={c} />
            ))}
          </div>
        </div>

        {/* Marquee — sits at the seam between white top and gradient bottom */}
        <div className="relative bg-primary text-primary-foreground overflow-hidden z-10 mt-6 md:mt-10">
          <div className="marquee-track whitespace-nowrap py-2.5 text-sm md:text-base font-bold tracking-wide">
            <span className="px-8">{marquee}</span>
            <span className="px-8">{marquee}</span>
            <span className="px-8">{marquee}</span>
          </div>
        </div>

        {/* BOTTOM: brand gradient, CTA on left, Flash timer on right */}
        <div
          className="relative z-20"
          style={{ background: "linear-gradient(to right, #52277a 0%, #a555f0 100%)" }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-16 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="flex flex-col items-center md:items-start gap-4 md:pl-[22%]">
              {s?.cta_band_text && (
                <p className="text-white/90 text-sm md:text-base max-w-md text-center md:text-left">{s.cta_band_text}</p>
              )}
              <CtaWrap>
                <Button
                  size="lg"
                  className="rounded-2xl bg-[#a555f0] hover:bg-[#b66ff5] text-white border-2 border-[#e9c8ff] px-12 py-7 text-xl font-semibold shadow-[0_0_35px_rgba(216,168,255,0.9)] transition-all"
                >
                  {ctaLabel}
                </Button>
              </CtaWrap>
            </div>
            <div className="flex justify-center md:justify-end">
              <FlashTimer resetDate={s?.timer_reset_date ?? null} />
            </div>
          </div>
        </div>

        {/* Model + bottle overlay — spans full hero height, anchored bottom-left */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-full md:w-1/2 lg:w-[42%] z-30">
          <div className="relative w-full h-full">
            {bgImg && (
              <img
                src={bgImg}
                alt="Veloura Essence hero"
                className="absolute bottom-0 left-0 h-full w-auto max-w-none object-contain object-left-bottom select-none"
                loading="eager"
              />
            )}
            {fgImg && (
              <img
                src={fgImg}
                alt=""
                aria-hidden="true"
                className="absolute bottom-0 left-0 h-[115%] w-auto max-w-none object-contain object-left-bottom select-none drop-shadow-2xl"
                style={{ marginLeft: "-6%", marginBottom: "-4%" }}
              />
            )}
          </div>
        </div>
      </section>




      {/* Perfumes */}
      <section id="perfumes" className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <SectionHeader eyebrow="Signature" title="Individual Perfumes" />
        {data.products.length === 0 ? (
          <EmptyState text="Products will appear here once added in the admin panel." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {data.products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* Combos */}
      <section id="combos" className="bg-gradient-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <SectionHeader eyebrow="Curated" title="Pre-Built Combos" />
          {prebuilt.length === 0 ? (
            <EmptyState text="Combos will appear here once added in the admin panel." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {prebuilt.map((c) => <ComboCard key={c.id} combo={c} />)}
            </div>
          )}
        </div>
      </section>

      {/* BYOB */}
      <section id="byob" className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <SectionHeader eyebrow="Personal" title="Build Your Own Box" />
        {byob.length === 0 ? (
          <EmptyState text="BYOB boxes will appear here once added in the admin panel." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {byob.map((c) => <ComboCard key={c.id} combo={c} byob />)}
          </div>
        )}
      </section>

      <SiteFooter logoUrl={s?.site_logo_url ?? null} logoSize={s?.footer_logo_size ?? null} logoAlign={s?.footer_logo_align ?? null} />
      <CartDrawer />
    </div>
  );
}

function FaviconSetter({ url }: { url?: string | null }) {
  useEffect(() => {
    if (!url || typeof document === "undefined") return;
    const existing = document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']");
    existing.forEach((el) => el.parentNode?.removeChild(el));
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = url;
    document.head.appendChild(link);
  }, [url]);
  return null;
}

function CtaButton({ children }: { children: React.ReactNode }) {
  return (
    <Button
      size="lg"
      className="rounded-2xl bg-transparent border-2 border-white/70 text-white hover:bg-white hover:text-primary px-10 py-6 text-xl font-semibold shadow-[0_0_30px_rgba(255,255,255,0.25)] transition-all"
    >
      {children}
    </Button>
  );
}

function HeroCategoryCard({ cat }: { cat: CategoryRow }) {
  return (
    <Link
      to="/category/$slug"
      params={{ slug: cat.slug }}
      className="group relative aspect-[3/4] min-h-[260px] sm:min-h-[320px] lg:min-h-[400px] rounded-2xl overflow-hidden shadow-soft bg-muted block"
    >
      {cat.image_url ? (
        <img
          src={cat.image_url}
          alt={cat.name}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
          <Gift className="w-10 h-10" />
        </div>
      )}
      {/* readable dark gradient overlay at the bottom */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 py-3 text-center">
        <p className="text-white text-sm md:text-base font-semibold tracking-tight truncate px-2 drop-shadow">
          {cat.name}
        </p>
      </div>
    </Link>
  );
}


function ProductCard({ product }: { product: ProductRow }) {
  const minSize = product.sizes_json?.[0];
  const regular = minSize?.price ?? product.regular_price;
  const sale = minSize?.sale_price ?? product.sale_price;
  const onSale = hasSale(regular, sale);
  const price = effectivePrice(regular, sale);
  return (
    <Link to="/product/$id" params={{ id: product.id }} className="group">
      <div className="relative aspect-square rounded-2xl bg-muted overflow-hidden mb-3">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Sparkles className="w-8 h-8" /></div>
        )}
        {onSale && (
          <span className="absolute top-2 right-2 bg-sale text-sale-foreground text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full shadow-soft">
            Sale!
          </span>
        )}
      </div>
      <h3 className="font-medium text-sm truncate">{product.name}</h3>
      <div className="flex items-baseline gap-2 mt-1">
        <span className={`font-semibold text-sm ${onSale ? "text-sale" : ""}`}>{formatBDT(price)}</span>
        {onSale && <span className="text-xs text-muted-foreground line-through">{formatBDT(regular)}</span>}
      </div>
    </Link>
  );
}

function ComboCard({ combo, byob }: { combo: ComboRow; byob?: boolean }) {
  const onSale = hasSale(combo.regular_price, combo.sale_price);
  const price = effectivePrice(combo.regular_price, combo.sale_price);
  return (
    <Link to="/combo/$id" params={{ id: combo.id }} className="group block rounded-2xl overflow-hidden bg-card border shadow-soft hover:shadow-luxe transition-shadow">
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {combo.image_url ? (
          <img src={combo.image_url} alt={combo.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Gift className="w-10 h-10" /></div>
        )}
        {onSale && (
          <span className="absolute top-3 right-3 bg-sale text-sale-foreground text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full shadow-soft">
            Sale!
          </span>
        )}
      </div>
      <div className="p-5">
        {byob && <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">Build your own</span>}
        <h3 className="font-semibold tracking-tight mt-1">{combo.title}</h3>
        {combo.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{combo.description}</p>}
        <div className="flex items-baseline gap-2 mt-3">
          <span className={`font-semibold ${onSale ? "text-sale" : ""}`}>{formatBDT(price)}</span>
          {onSale && <span className="text-xs text-muted-foreground line-through">{formatBDT(combo.regular_price)}</span>}
        </div>
      </div>
    </Link>
  );
}

const DEFAULT_HERO_CARDS = [
  { title: "Summer Combo" },
  { title: "Girl's Secret" },
  { title: "Student Budget" },
  { title: "Gift Ready" },
];

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-10">
      <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold">{eyebrow}</p>
      <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mt-2">{title}</h2>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-border bg-card/50 py-20 text-center">
      <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{text}</p>
    </div>
  );
}
