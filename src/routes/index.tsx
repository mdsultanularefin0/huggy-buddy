import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Sparkles, Gift, Droplets, Package, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, effectivePrice, hasSale } from "@/lib/currency";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";
import { FlashTimer } from "@/components/flash-timer";
import heroCover from "@/assets/hero-cover.jpg.asset.json";

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
  timer_reset_date: string | null;
};

const storefrontOptions = queryOptions({
  queryKey: ["storefront"],
  queryFn: async () => {
    const [products, combos, settings] = await Promise.all([
      supabase.from("products").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("combos").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("site_settings").select("marquee_text,hero_image,timer_reset_date").limit(1).maybeSingle(),
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

const categories = [
  { label: "Perfumes", hash: "perfumes", icon: Droplets, tint: "from-primary/15 to-accent/10" },
  { label: "Combos", hash: "combos", icon: Package, tint: "from-accent/15 to-primary/10" },
  { label: "Build Your Box", hash: "byob", icon: Layers, tint: "from-primary/20 to-accent/15" },
  { label: "Gift Sets", hash: "combos", icon: Gift, tint: "from-accent/20 to-primary/10" },
];

function Landing() {
  const { data } = useSuspenseQuery(storefrontOptions);
  const marquee = data.settings?.marquee_text ?? "✦ Free delivery on orders over ৳400  ✦ Crafted in Bangladesh  ✦ Premium fragrances";
  const prebuilt = data.combos.filter((c) => c.combo_type === "prebuilt");
  const byob = data.combos.filter((c) => c.combo_type === "byob");

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground py-2 overflow-hidden">
        <div className="marquee-track text-sm font-medium tracking-wide whitespace-nowrap">
          <span className="px-8">{marquee}</span>
          <span className="px-8">{marquee}</span>
        </div>
      </div>

      <SiteHeader />

      {/* Hero */}
      <section className="bg-gradient-soft relative">
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-24 lg:pb-32 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Left: hero image, overlaps the next section */}
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-5">
              <Sparkles className="w-3.5 h-3.5" /> New season collection
            </div>
            <h1 className="text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
              Fragrance, <br />
              <span className="text-gradient-luxe">crafted with care.</span>
            </h1>
            <p className="text-lg text-muted-foreground mt-5 max-w-md">
              Signature scents, curated combos and build-your-own boxes — delivered fresh across Bangladesh.
            </p>
            <div className="flex flex-wrap gap-3 mt-7">
              <Link to="/" hash="perfumes"><Button variant="hero" size="xl">Shop the collection</Button></Link>
              <Link to="/" hash="byob"><Button variant="outline-luxe" size="xl">Build your box</Button></Link>
            </div>

            <div className="relative mt-10 lg:mt-12 z-10 -mb-32 lg:-mb-44">
              <div className="aspect-[5/4] rounded-3xl bg-gradient-luxe shadow-luxe overflow-hidden">
                {data.settings?.hero_image ? (
                  <img src={data.settings.hero_image} alt="Featured fragrance" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary-foreground/90">
                    <div className="text-center px-6">
                      <Sparkles className="w-12 h-12 mx-auto mb-4" />
                      <p className="text-sm uppercase tracking-widest opacity-80">Featured</p>
                      <p className="text-2xl font-semibold mt-2">Coming soon</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: 2x2 category grid */}
          <div className="grid grid-cols-2 gap-4 lg:gap-5">
            {categories.map(({ label, hash, icon: Icon, tint }) => (
              <Link
                key={label}
                to="/"
                hash={hash}
                className={`group relative aspect-square rounded-3xl border bg-gradient-to-br ${tint} p-5 flex flex-col justify-between overflow-hidden shadow-soft hover:shadow-luxe transition-shadow`}
              >
                <div className="w-11 h-11 rounded-2xl bg-card/70 backdrop-blur flex items-center justify-center text-primary shadow-soft">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-accent font-semibold">Shop</p>
                  <p className="text-lg font-semibold tracking-tight mt-1">{label}</p>
                </div>
                <span className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/20 blur-2xl group-hover:scale-125 transition-transform" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Flash sale */}
      <section className="max-w-7xl mx-auto px-6 pt-24 lg:pt-32">
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
