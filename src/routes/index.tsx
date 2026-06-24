import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Sparkles, Gift, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, effectivePrice, hasSale } from "@/lib/currency";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";
import { FlashTimer } from "@/components/flash-timer";

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header chrome: brand-colored, full width, marquee with dual overlay images */}
      <div className="relative bg-primary text-primary-foreground overflow-hidden">
        <div className="marquee-track text-sm font-medium tracking-wide whitespace-nowrap py-2.5">
          <span className="px-8">{marquee}</span>
          <span className="px-8">{marquee}</span>
          <span className="px-8">{marquee}</span>
        </div>
        {data.settings?.hero_overlay_left && (
          <img
            src={data.settings.hero_overlay_left}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-10 md:h-12 w-auto select-none drop-shadow-lg"
          />
        )}
        {data.settings?.hero_overlay_right && (
          <img
            src={data.settings.hero_overlay_right}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-10 md:h-12 w-auto select-none drop-shadow-lg"
          />
        )}
      </div>

      <SiteHeader />

      {/* Full-bleed brand hero */}
      <section className="relative w-full bg-primary text-primary-foreground overflow-hidden">
        {data.settings?.hero_image && (
          <img
            src={data.settings.hero_image}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent/70 mix-blend-multiply" />
        <div className="absolute -top-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-sale/20 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-28 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em]">
            <Sparkles className="w-3.5 h-3.5" /> Veloura Essence
          </span>
          <h1 className="mt-6 text-4xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05]">
            Luxury fragrances,<br className="hidden md:block" /> crafted for Bangladesh
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-base md:text-lg text-primary-foreground/85">
            Curated perfumes, dual combo deals, and build-your-own boxes — delivered to your door with free shipping over ৳400.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <Link to="/" hash="perfumes">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 rounded-full px-7">
                Shop perfumes <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link to="/" hash="combos">
              <Button size="lg" variant="outline" className="rounded-full px-7 border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                Explore combos
              </Button>
            </Link>
          </div>
        </div>
      </section>


      {/* Flash sale */}
      <section className="max-w-7xl mx-auto px-6 pt-12">
        <FlashTimer resetDate={data.settings?.timer_reset_date ?? null} />
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
