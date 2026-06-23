import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Sparkles, ShieldCheck, Truck, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, effectivePrice, hasSale } from "@/lib/currency";
import { SiteHeader } from "@/components/site-header";
import { CartDrawer } from "@/components/cart-drawer";

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
type SiteSettings = { marquee_text: string | null; hero_image: string | null };

const storefrontOptions = queryOptions({
  queryKey: ["storefront"],
  queryFn: async () => {
    const [products, combos, settings] = await Promise.all([
      supabase.from("products").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("combos").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("site_settings").select("marquee_text,hero_image").limit(1).maybeSingle(),
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
      <div className="bg-primary text-primary-foreground py-2 overflow-hidden">
        <div className="marquee-track text-sm font-medium tracking-wide whitespace-nowrap">
          <span className="px-8">{marquee}</span>
          <span className="px-8">{marquee}</span>
        </div>
      </div>

      <SiteHeader />

      <section className="bg-gradient-soft">
        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5" /> New season collection
            </div>
            <h1 className="text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
              Fragrance, <br />
              <span className="text-gradient-luxe">crafted with care.</span>
            </h1>
            <p className="text-lg text-muted-foreground mt-6 max-w-md">
              Discover signature scents, curated combos, and build-your-own perfume boxes — delivered fresh across Bangladesh.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link to="/" hash="perfumes"><Button variant="hero" size="xl">Shop the collection</Button></Link>
              <Link to="/" hash="byob"><Button variant="outline-luxe" size="xl">Build your box</Button></Link>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-12 max-w-md">
              <Feature icon={<Truck className="w-4 h-4" />} label="Fast delivery" />
              <Feature icon={<ShieldCheck className="w-4 h-4" />} label="100% authentic" />
              <Feature icon={<Gift className="w-4 h-4" />} label="Combos & gifts" />
            </div>
          </div>

          <div className="relative aspect-[4/5] rounded-3xl bg-gradient-luxe shadow-luxe overflow-hidden">
            {data.settings?.hero_image ? (
              <img src={data.settings.hero_image} alt="Featured fragrance" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-center text-primary-foreground/90 px-8">
                <div>
                  <Sparkles className="w-12 h-12 mx-auto mb-4" />
                  <p className="text-sm uppercase tracking-widest opacity-80">Featured</p>
                  <p className="text-2xl font-semibold mt-2">Coming soon</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="perfumes" className="max-w-7xl mx-auto px-6 py-20">
        <SectionHeader eyebrow="Signature" title="Individual Perfumes" />
        {data.products.length === 0 ? (
          <EmptyState text="Products will appear here once added in the admin panel." />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {data.products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

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

      <footer className="border-t bg-card">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row gap-4 items-center justify-between">
          <p className="text-sm text-muted-foreground">© Veloura Essence. All rights reserved.</p>
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Admin sign in</Link>
        </div>
      </footer>

      <CartDrawer />
    </div>
  );
}

function ProductCard({ product }: { product: ProductRow }) {
  const minSize = product.sizes_json?.[0];
  const regular = minSize?.price ?? product.regular_price;
  const sale = minSize?.sale_price ?? product.sale_price;
  const price = effectivePrice(regular, sale);
  return (
    <Link to="/product/$id" params={{ id: product.id }} className="group">
      <div className="aspect-square rounded-2xl bg-muted overflow-hidden mb-3">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Sparkles className="w-8 h-8" /></div>
        )}
      </div>
      <h3 className="font-medium text-sm truncate">{product.name}</h3>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="font-semibold text-sm">{formatBDT(price)}</span>
        {hasSale(regular, sale) && <span className="text-xs text-muted-foreground line-through">{formatBDT(regular)}</span>}
      </div>
    </Link>
  );
}

function ComboCard({ combo, byob }: { combo: ComboRow; byob?: boolean }) {
  const price = effectivePrice(combo.regular_price, combo.sale_price);
  return (
    <Link to="/combo/$id" params={{ id: combo.id }} className="group block rounded-2xl overflow-hidden bg-card border shadow-soft hover:shadow-luxe transition-shadow">
      <div className="aspect-[4/3] bg-muted overflow-hidden">
        {combo.image_url ? (
          <img src={combo.image_url} alt={combo.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Gift className="w-10 h-10" /></div>
        )}
      </div>
      <div className="p-5">
        {byob && <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">Build your own</span>}
        <h3 className="font-semibold tracking-tight mt-1">{combo.title}</h3>
        {combo.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{combo.description}</p>}
        <div className="flex items-baseline gap-2 mt-3">
          <span className="font-semibold">{formatBDT(price)}</span>
          {hasSale(combo.regular_price, combo.sale_price) && (
            <span className="text-xs text-muted-foreground line-through">{formatBDT(combo.regular_price)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="w-8 h-8 rounded-lg bg-card border flex items-center justify-center text-primary shadow-soft">{icon}</div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
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
