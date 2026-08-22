import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Gift, Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, effectivePrice, hasSale } from "@/lib/currency";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useCart } from "@/lib/cart-store";
import { toast } from "sonner";

type ComboItem = { product_id: string; size_label?: string | null };
type ComboSizePrice = { size_label: string; regular_price: number; sale_price: number | null };
type Combo = {
  id: string; title: string; description: string | null;
  combo_type: "prebuilt" | "byob";
  regular_price: number; sale_price: number | null;
  products_json: ComboItem[];
  size_pricing_json?: ComboSizePrice[] | null;
  image_url: string | null; max_items_allowed: number | null;
};
type ProductMini = { id: string; name: string; image_url: string | null; in_stock: boolean };
type VariantMini = { id: string; product_id: string; size_label: string; in_stock: boolean; sort_order: number };
type CategoryMini = { id: string; name: string };

const comboOptions = (id: string) =>
  queryOptions({
    queryKey: ["combo", id],
    queryFn: async () => {
      const { data: combo, error } = await supabase
        .from("combos").select("*").eq("id", id).eq("is_active", true).maybeSingle();
      if (error) throw error;
      if (!combo) return null;
      const productIds = ((combo.products_json as ComboItem[]) ?? []).map((p) => p.product_id);
      const [productsRes, prodCatsRes, variantsRes] = await Promise.all([
        productIds.length
          ? supabase.from("products").select("id,name,image_url,in_stock").in("id", productIds)
          : Promise.resolve({ data: [] as ProductMini[] } as { data: ProductMini[] }),
        productIds.length
          ? supabase.from("product_categories").select("product_id,category_id").in("product_id", productIds)
          : Promise.resolve({ data: [] as { product_id: string; category_id: string }[] }),
        productIds.length
          ? supabase
              .from("product_variants")
              .select("id,product_id,size_label,in_stock,sort_order")
              .in("product_id", productIds)
              .order("sort_order")
          : Promise.resolve({ data: [] as VariantMini[] }),
      ]);
      const catIds = Array.from(new Set((prodCatsRes.data ?? []).map((r) => r.category_id)));
      const { data: cats } = catIds.length
        ? await supabase.from("categories").select("id,name").in("id", catIds).order("name")
        : { data: [] as CategoryMini[] };
      const productCatMap: Record<string, string[]> = {};
      (prodCatsRes.data ?? []).forEach((r) => {
        (productCatMap[r.product_id] ||= []).push(r.category_id);
      });
      const variantMap: Record<string, VariantMini[]> = {};
      ((variantsRes.data ?? []) as VariantMini[]).forEach((v) => {
        (variantMap[v.product_id] ||= []).push(v);
      });
      return {
        combo: combo as unknown as Combo,
        products: (productsRes.data ?? []) as ProductMini[],
        categories: (cats ?? []) as CategoryMini[],
        productCatMap,
        variantMap,
      };

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
  const [activeCat, setActiveCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [chosenSize, setChosenSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const add = useCart((s) => s.add);
  const navigate = useNavigate();

  if (!data) return null;
  const { combo, products, categories, productCatMap, variantMap } = data;
  const isByob = combo.combo_type === "byob";
  const limit = combo.max_items_allowed ?? products.length;
  const isComplete = selected.length === limit;

  // Sizes shared by every included product (prebuilt only).
  const sizePricing = (combo.size_pricing_json ?? []).filter((sp) => sp?.size_label);
  const sharedSizes: string[] = (() => {
    if (isByob) return [];
    const ids = Array.from(new Set(combo.products_json.map((ci) => ci.product_id)));
    if (!ids.length) return [];
    const lists = ids.map((pid) => (variantMap[pid] ?? []).filter((v) => v.in_stock).map((v) => v.size_label));
    if (lists.some((l) => l.length === 0)) return [];
    return lists[0].filter((s) => lists.every((l) => l.includes(s)));
  })();
  const sizeOptions = sizePricing.length
    ? sizePricing.map((sp) => sp.size_label).filter((s) => !sharedSizes.length || sharedSizes.includes(s))
    : sharedSizes;
  const activeSize = chosenSize ?? sizeOptions[0] ?? combo.products_json[0]?.size_label ?? null;
  const activePricing = sizePricing.find((sp) => sp.size_label === activeSize) ?? null;
  const baseRegular = activePricing?.regular_price ?? combo.regular_price;
  const baseSale = activePricing ? activePricing.sale_price : combo.sale_price;
  const price = effectivePrice(baseRegular, baseSale);

  const sizeFor = (ci: ComboItem) => activeSize ?? ci.size_label ?? null;


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
      : combo.products_json.map((ci, i) => {
          const p = products.find((x) => x.id === ci.product_id);
          const size = sizeFor(i, ci);
          return { productId: ci.product_id, name: `${p?.name ?? ""}${size ? ` (${size})` : ""}` };
        });
    const hash = isByob
      ? selected.slice().sort().join("-").slice(0, 16)
      : combo.products_json.map((ci, i) => sizeFor(i, ci) ?? "-").join("|").slice(0, 40);
    return {
      lineId: `${isByob ? "byob" : "combo"}:${combo.id}:${hash}`,
      kind: (isByob ? "byob" : "combo") as "byob" | "combo",
      refId: combo.id,
      name: combo.title,
      imageUrl: combo.image_url,
      unitPrice: price,
      regularPrice: combo.regular_price,
      quantity: isByob ? 1 : qty,
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
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 sm:mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to shop
          </Link>
          <div className="grid md:grid-cols-2 gap-6 md:gap-10">
            <div className="aspect-[4/3] rounded-2xl sm:rounded-3xl bg-muted overflow-hidden">
              {combo.image_url ? (
                <img src={combo.image_url} alt={combo.title} loading="lazy" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Gift className="w-12 h-12" /></div>
              )}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">{combo.title}</h1>
              <div className="flex items-baseline gap-3 mt-3">
                <span className="text-xl sm:text-2xl font-semibold">{formatBDT(price)}</span>
                {hasSale(combo.regular_price, combo.sale_price) && (
                  <span className="text-sm sm:text-base text-muted-foreground line-through">{formatBDT(combo.regular_price)}</span>
                )}
              </div>
              {combo.description && (
                <p className="text-sm text-muted-foreground mt-4 sm:mt-5 whitespace-pre-line">{combo.description}</p>
              )}
              <div className="mt-6 sm:mt-8">
                <p className="text-sm font-medium mb-3">Includes</p>
                <div className="space-y-2">
                  {combo.products_json.map((ci, i) => {
                    const p = products.find((x) => x.id === ci.product_id);
                    if (!p) return null;
                    const opts = (variantMap[ci.product_id] ?? []).filter((v) => v.in_stock);
                    const current = sizeFor(i, ci);
                    return (
                      <div key={`${ci.product_id}-${i}`} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                        <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                          {p.image_url && <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" />}
                        </div>
                        <span className="flex-1 text-sm font-medium min-w-0 truncate">{p.name}</span>
                        {opts.length > 1 ? (
                          <select
                            aria-label={`Size for ${p.name}`}
                            value={current ?? ""}
                            onChange={(e) => setSizes((s) => ({ ...s, [i]: e.target.value }))}
                            className="shrink-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                          >
                            {opts.map((v) => (
                              <option key={v.id} value={v.size_label}>{v.size_label}</option>
                            ))}
                          </select>
                        ) : current ? (
                          <span className="shrink-0 text-xs text-muted-foreground">{current}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex items-center gap-4">
                <span className="text-sm font-medium">Quantity</span>
                <div className="inline-flex items-center rounded-full border border-border overflow-hidden">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="px-3 py-2 hover:bg-muted disabled:opacity-40"
                    disabled={qty <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-4 text-sm font-semibold tabular-nums">{qty}</span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => setQty((q) => Math.min(20, q + 1))}
                    className="px-3 py-2 hover:bg-muted"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <Button variant="hero" size="lg" className="w-full mt-6 sm:mt-8" onClick={handleAdd}>
                Add to cart — {formatBDT(price * qty)}
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
    <div className="min-h-screen bg-background pb-40 sm:pb-32">
      <SiteHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 sm:mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to shop
        </Link>

        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">Build your own</span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight mt-2">{combo.title}</h1>
          <div className="flex items-baseline justify-center gap-3 mt-3">
            <span className="text-xl sm:text-2xl font-semibold">{formatBDT(price)}</span>
            {hasSale(combo.regular_price, combo.sale_price) && (
              <span className="text-sm sm:text-base text-muted-foreground line-through">{formatBDT(combo.regular_price)}</span>
            )}
          </div>
          {combo.description && (
            <p className="text-sm text-muted-foreground mt-4 whitespace-pre-line">{combo.description}</p>
          )}
          <p className="text-sm font-medium mt-6">
            Pick {limit} items · <span className={isComplete ? "text-primary" : "text-muted-foreground"}>{selected.length}/{limit} selected</span>
          </p>
        </div>

        {categories.length >= 2 && (
          <div className="flex flex-wrap justify-center gap-2 mb-6 sm:mb-8">
            {[{ id: "all", name: "All" }, ...categories].map((c) => {
              const active = activeCat === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCat(c.id)}
                  className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#52277a] text-white"
                      : "bg-[#f5edff] text-[#52277a] hover:bg-[#ece2f7]"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="max-w-md mx-auto mb-6 sm:mb-8">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search perfumes…"
            className="w-full px-4 py-2.5 rounded-full border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#52277a]/40"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {products
            .filter((p) => activeCat === "all" || (productCatMap[p.id] ?? []).includes(activeCat))
            .filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
            .map((p) => {
            const checked = selected.includes(p.id);
            const outOfStock = !p.in_stock;
            const disabled = outOfStock || (!checked && selected.length >= limit);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => { if (outOfStock) { toast.error(`${p.name} is out of stock`); return; } toggle(p.id); }}
                disabled={disabled}
                aria-pressed={checked}
                aria-disabled={disabled}
                title={outOfStock ? "Out of stock" : undefined}
                className={`group relative text-left bg-[#f5edff] rounded-2xl sm:rounded-3xl transition-all duration-300 ${
                  checked ? "ring-2 ring-[#52277a] shadow-[0_20px_40px_-15px_rgba(82,39,122,0.35)]" : "hover:shadow-[0_20px_40px_-15px_rgba(82,39,122,0.2)]"
                } ${disabled && !outOfStock ? "opacity-40 cursor-not-allowed" : ""} ${outOfStock ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                {checked && (
                  <span className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#52277a] text-white flex items-center justify-center shadow-lg">
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </span>
                )}
                <div className={`relative aspect-[4/5] overflow-hidden rounded-2xl sm:rounded-3xl bg-[#ece2f7] ${outOfStock ? "opacity-70" : ""}`}>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Gift className="w-8 h-8" />
                    </div>
                  )}
                  {outOfStock && (
                    <div className="absolute inset-0 flex items-center justify-center px-2">
                      <span className="bg-red-600 text-white px-3 py-1.5 sm:px-6 sm:py-2.5 text-[9px] sm:text-[10px] font-bold tracking-[0.15em] sm:tracking-[0.2em] uppercase rounded-full shadow-lg text-center">
                        Out of stock
                      </span>
                    </div>
                  )}
                </div>
                <div className="px-2 py-3 sm:px-3 sm:py-4 text-center">
                  {(() => {
                    const catName = (productCatMap[p.id] ?? [])
                      .map((cid) => categories.find((c) => c.id === cid)?.name)
                      .filter(Boolean)[0];
                    return catName ? (
                      <p className="text-[9px] sm:text-[10px] tracking-[0.2em] uppercase text-gray-400 mb-1 font-medium truncate">
                        {catName}
                      </p>
                    ) : null;
                  })()}
                  <h3 className="text-xs sm:text-sm font-serif text-[#1a1a1a] truncate">{p.name}</h3>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          {/* Mobile: two rows (info on top, buttons below). Desktop: single row. */}
          <div className="grid gap-2 sm:flex sm:items-center sm:gap-4">
            <div className="min-w-0 sm:flex-1 flex items-center justify-between sm:block gap-3">
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{combo.title}</p>
                <p className="text-sm font-semibold">
                  {selected.length}/{limit} picked · {formatBDT(price)}
                </p>
              </div>
              {/* Mobile-only progress dots for a quick glance */}
              <div className="flex sm:hidden gap-1 shrink-0" aria-hidden="true">
                {Array.from({ length: limit }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${i < selected.length ? "bg-[#52277a]" : "bg-muted-foreground/30"}`}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-2 sm:flex sm:items-center sm:gap-3 sm:shrink-0">
              <Button variant="outline" size="lg" onClick={handleAdd} disabled={!isComplete} className="px-3 sm:px-6">
                Add
                <span className="hidden sm:inline">&nbsp;to cart</span>
              </Button>
              <Button variant="hero" size="lg" onClick={handleCheckout} disabled={!isComplete} className="min-w-0">
                <span className="truncate">
                  {isComplete ? "Checkout" : `Pick ${limit - selected.length} more`}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

