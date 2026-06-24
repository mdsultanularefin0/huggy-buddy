import { createFileRoute, Link } from "@tanstack/react-router";
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
type SiteSettings = {
  marquee_text: string | null;
  hero_image: string | null;
  hero_overlay_left: string | null;
  hero_overlay_right: string | null;
  timer_reset_date: string | null;
};

const storefrontOptions = queryOptions({
  queryKey: ["storefront"],
  queryFn: async () => {
    const [products, combos, settings] = await Promise.all([
      supabase.from("products").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("combos").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("site_settings").select("marquee_text,hero_image,hero_overlay_left,hero_overlay_right,timer_reset_date").limit(1).maybeSingle(),
    ]);
    return {
      products: (products.data ?? []) as ProductRow[],
      combos: (combos.data ?? []) as ComboRow[],
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
  const marquee = data.settings?.marquee_text ?? "✦ Free delivery on orders over ৳400  ✦ Crafted in Bangladesh  ✦ Premium fragrances";
  const prebuilt = data.combos.filter((c) => c.combo_type === "prebuilt");
  const byob = data.combos.filter((c) => c.combo_type === "byob");

  // Top 4 featured combos shown as hero cards (right-side grid)
  const featuredCombos = data.combos.slice(0, 4);
  const overlayLeft = data.settings?.hero_overlay_left ?? heroHand.url;
  const overlayRight = data.settings?.hero_overlay_right;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* HERO — white panel: main image on left, 4 combo cards on right */}
      <section className="relative w-full bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 md:pt-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-center">
            <div className="md:col-span-5 relative">
              <img
                src={data.settings?.hero_image ?? heroMain.url}
                alt="Veloura Essence signature perfume"
                className="w-full h-auto object-contain select-none"
                loading="eager"
              />
            </div>
            <div className="md:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {featuredCombos.length > 0
                ? featuredCombos.map((c) => <HeroComboCard key={c.id} combo={c} />)
                : DEFAULT_HERO_CARDS.map((c) => (
                    <div key={c.title} className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-soft bg-gradient-luxe">
                      <div className="absolute inset-x-0 bottom-0 bg-primary/70 backdrop-blur-sm py-2.5 text-center">
                        <p className="text-white text-sm md:text-base font-semibold tracking-tight">{c.title}</p>
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        </div>

        {/* Marquee strip with left-bleeding hand overlay */}
        <div className="relative mt-6 md:mt-8">
          <div className="bg-primary text-primary-foreground overflow-hidden">
            <div className="marquee-track whitespace-nowrap py-2.5 text-sm md:text-base font-semibold tracking-wide pl-[14%] md:pl-[12%]">
              <span className="px-8">{marquee}</span>
              <span className="px-8">{marquee}</span>
              <span className="px-8">{marquee}</span>
            </div>
          </div>
          {/* Purple CTA band */}
          <div className="bg-gradient-to-r from-primary via-primary to-accent/80 text-primary-foreground">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-10 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="flex justify-center md:justify-start md:pl-[18%]">
                <Link to="/" hash="perfumes">
                  <Button
                    size="lg"
                    className="rounded-2xl bg-transparent border-2 border-white/70 text-white hover:bg-white hover:text-primary px-10 py-6 text-xl font-semibold shadow-[0_0_30px_rgba(255,255,255,0.25)] transition-all"
                  >
                    Order Now
                  </Button>
                </Link>
              </div>
              <div className="flex justify-center md:justify-end">
                <FlashTimer resetDate={data.settings?.timer_reset_date ?? null} />
              </div>
            </div>
          </div>
          {/* Dual overlay images bleeding from marquee strip downward */}
          {overlayLeft && (
            <img
              src={overlayLeft}
              alt=""
              aria-hidden="true"
              className="pointer-events-none select-none absolute left-0 -top-10 md:-top-20 h-[180px] md:h-[340px] w-auto z-10 drop-shadow-2xl"
            />
          )}
          {overlayRight && (
            <img
              src={overlayRight}
              alt=""
              aria-hidden="true"
              className="pointer-events-none select-none absolute right-0 -top-10 md:-top-20 h-[180px] md:h-[340px] w-auto z-10 drop-shadow-2xl scale-x-[-1]"
            />
          )}
        </div>
      </section>



      {/* Perfumes */}
      <section id="perfumes" className="max-w-7xl mx-auto px-6 py-20">
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
        <div className="max-w-7xl mx-auto px-6 py-20">
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
      <section id="byob" className="max-w-7xl mx-auto px-6 py-20">
        <SectionHeader eyebrow="Personal" title="Build Your Own Box" />
        {byob.length === 0 ? (
          <EmptyState text="BYOB boxes will appear here once added in the admin panel." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {byob.map((c) => <ComboCard key={c.id} combo={c} byob />)}
          </div>
        )}
      </section>

      <SiteFooter />
      <CartDrawer />
    </div>
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
