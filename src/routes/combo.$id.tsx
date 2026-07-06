import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Gift, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, effectivePrice, hasSale } from "@/lib/currency";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useCart } from "@/lib/cart-store";
import { toast } from "sonner";

type ComboItem = { product_id: string; size_label?: string | null };
type Combo = {
  id: string; title: string; description: string | null;
  combo_type: "prebuilt" | "byob";
  regular_price: number; sale_price: number | null;
  products_json: ComboItem[];
  image_url: string | null; max_items_allowed: number | null;
};
type ProductMini = { id: string; name: string; image_url: string | null; in_stock: boolean };

const comboOptions = (id: string) =>
  queryOptions({
    queryKey: ["combo", id],
    queryFn: async () => {
      const { data: combo, error } = await supabase
        .from("combos").select("*").eq("id", id).eq("is_active", true).maybeSingle();
      if (error) throw error;
      if (!combo) return null;
      const productIds = ((combo.products_json as ComboItem[]) ?? []).map((p) => p.product_id);
      const { data: products } = productIds.length
        ? await supabase.from("products").select("id,name,image_url,in_stock").in("id", productIds)
        : { data: [] };
      return { combo: combo as unknown as Combo, products: (products ?? []) as ProductMini[] };
    },
  });

export const Route = createFileRoute("/combo/$id")({
  loader: async ({ context, params }) => {
    const c = await context.queryClient.ensureQueryData(comboOptions(params.id));
    if (!c) throw notFound();
    return c;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Combo not found" }, { name: "robots", content: "noindex" }] };
    }
    const { combo } = loaderData;
    const title = `${combo.title} — Veloura Essence`;
    const description = combo.description?.slice(0, 160) ?? `Shop the ${combo.title} combo at Veloura Essence.`;
    const meta = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "product" },
      { property: "og:url", content: `/combo/${params.id}` },
    ];
    if (combo.image_url) {
      meta.push(
        { property: "og:image", content: combo.image_url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: combo.image_url },
      );
    }
    return { meta };
  },
  component: ComboPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => (
    <div className="p-12 text-center">
      <p className="text-muted-foreground">Combo not found.</p>
      <Link to="/" className="text-primary underline mt-4 inline-block">Back to shop</Link>
    </div>
  ),
});

function ComboPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(comboOptions(id));
  const [selected, setSelected] = useState<string[]>([]);
  const add = useCart((s) => s.add);
  const navigate = useNavigate();

  if (!data) return null;
  const { combo, products } = data;
  const price = effectivePrice(combo.regular_price, combo.sale_price);
  const isByob = combo.combo_type === "byob";
  const limit = combo.max_items_allowed ?? products.length;
  const isComplete = selected.length === limit;

  const toggle = (pid: string) => {
    setSelected((prev) => {
      if (prev.includes(pid)) return prev.filter((x) => x !== pid);
      if (prev.length >= limit) {
        toast.error(`You can pick up to ${limit} items.`);
        return prev;
      }
      return [...prev, pid];
    });
  };

  const buildLine = () => {
    const selections = isByob
      ? selected.map((pid) => {
          const p = products.find((x) => x.id === pid)!;
          return { productId: pid, name: p.name };
        })
      : combo.products_json.map((ci) => {
          const p = products.find((x) => x.id === ci.product_id);
          return { productId: ci.product_id, name: p?.name ?? "" };
        });
    const hash = isByob ? selected.slice().sort().join("-").slice(0, 16) : "fixed";
    return {
      lineId: `${isByob ? "byob" : "combo"}:${combo.id}:${hash}`,
      kind: (isByob ? "byob" : "combo") as "byob" | "combo",
      refId: combo.id,
      name: combo.title,
      imageUrl: combo.image_url,
      unitPrice: price,
      regularPrice: combo.regular_price,
      quantity: 1,
      selections,
    };
  };

  const handleAdd = () => {
    if (isByob && !isComplete) {
      toast.error(`Please pick exactly ${limit} items.`);
      return;
    }
    add(buildLine());
    toast.success("Added to cart");
  };

  const handleCheckout = () => {
    if (isByob && !isComplete) {
      toast.error(`Please pick exactly ${limit} items.`);
      return;
    }
    add(buildLine());
    navigate({ to: "/checkout" });
  };

  // Prebuilt: keep original two-column layout
  if (!isByob) {
    const included = combo.products_json
      .map((ci) => products.find((p) => p.id === ci.product_id))
      .filter(Boolean) as ProductMini[];
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-6xl mx-auto px-6 py-10">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to shop
          </Link>
          <div className="grid md:grid-cols-2 gap-10">
            <div className="aspect-[4/3] rounded-3xl bg-muted overflow-hidden">
              {combo.image_url ? (
                <img src={combo.image_url} alt={combo.title} loading="lazy" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Gift className="w-12 h-12" /></div>
              )}
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{combo.title}</h1>
              <div className="flex items-baseline gap-3 mt-3">
                <span className="text-2xl font-semibold">{formatBDT(price)}</span>
                {hasSale(combo.regular_price, combo.sale_price) && (
                  <span className="text-base text-muted-foreground line-through">{formatBDT(combo.regular_price)}</span>
                )}
              </div>
              {combo.description && (
                <p className="text-sm text-muted-foreground mt-5 whitespace-pre-line">{combo.description}</p>
              )}
              <div className="mt-8">
                <p className="text-sm font-medium mb-3">Includes</p>
                <div className="space-y-2">
                  {included.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                      <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        {p.image_url && <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" />}
                      </div>
                      <span className="flex-1 text-sm font-medium">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Button variant="hero" size="lg" className="w-full mt-8" onClick={handleAdd}>
                Add to cart — {formatBDT(price)}
              </Button>
            </div>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  // BYOB: hero + selectable card grid + sticky action bar
  return (
    <div className="min-h-screen bg-background pb-32">
      <SiteHeader />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to shop
        </Link>

        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">Build your own</span>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-2">{combo.title}</h1>
          <div className="flex items-baseline justify-center gap-3 mt-3">
            <span className="text-2xl font-semibold">{formatBDT(price)}</span>
            {hasSale(combo.regular_price, combo.sale_price) && (
              <span className="text-base text-muted-foreground line-through">{formatBDT(combo.regular_price)}</span>
            )}
          </div>
          {combo.description && (
            <p className="text-sm text-muted-foreground mt-4 whitespace-pre-line">{combo.description}</p>
          )}
          <p className="text-sm font-medium mt-6">
            Pick {limit} items · <span className={isComplete ? "text-primary" : "text-muted-foreground"}>{selected.length}/{limit} selected</span>
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
          {products.map((p) => {
            const checked = selected.includes(p.id);
            const disabled = !checked && selected.length >= limit;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                disabled={disabled}
                aria-pressed={checked}
                className={`group relative text-left bg-[#f5edff] rounded-3xl transition-all duration-300 ${
                  checked ? "ring-2 ring-[#52277a] shadow-[0_20px_40px_-15px_rgba(82,39,122,0.35)]" : "hover:shadow-[0_20px_40px_-15px_rgba(82,39,122,0.2)]"
                } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {checked && (
                  <span className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-[#52277a] text-white flex items-center justify-center shadow-lg">
                    <Check className="w-4 h-4" />
                  </span>
                )}
                <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-[#ece2f7]">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Gift className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="px-3 py-4 text-center">
                  <h3 className="text-sm font-serif text-[#1a1a1a] truncate">{p.name}</h3>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{combo.title}</p>
            <p className="text-sm font-semibold">
              {selected.length}/{limit} picked · {formatBDT(price)}
            </p>
          </div>
          <Button variant="outline" size="lg" onClick={handleAdd} disabled={!isComplete}>
            Add to cart
          </Button>
          <Button variant="hero" size="lg" onClick={handleCheckout} disabled={!isComplete}>
            {isComplete ? "Checkout" : `Pick ${limit - selected.length} more`}
          </Button>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
