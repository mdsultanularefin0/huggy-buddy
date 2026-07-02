import { createFileRoute, Link, notFound } from "@tanstack/react-router";
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
type ProductMini = { id: string; name: string; image_url: string | null };

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
        ? await supabase.from("products").select("id,name,image_url").in("id", productIds)
        : { data: [] };
      return { combo: combo as unknown as Combo, products: (products ?? []) as ProductMini[] };
    },
  });

export const Route = createFileRoute("/combo/$id")({
  loader: async ({ context, params }) => {
    const c = await context.queryClient.ensureQueryData(comboOptions(params.id));
    if (!c) throw notFound();
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

  if (!data) return null;
  const { combo, products } = data;
  const price = effectivePrice(combo.regular_price, combo.sale_price);
  const isByob = combo.combo_type === "byob";
  const limit = combo.max_items_allowed ?? products.length;

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

  const handleAdd = () => {
    if (isByob && selected.length !== limit) {
      toast.error(`Please pick exactly ${limit} items.`);
      return;
    }
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
    add({
      lineId: `${isByob ? "byob" : "combo"}:${combo.id}:${hash}`,
      kind: isByob ? "byob" : "combo",
      refId: combo.id,
      name: combo.title,
      imageUrl: combo.image_url,
      unitPrice: price,
      regularPrice: combo.regular_price,
      quantity: 1,
      selections,
    });
    toast.success("Added to cart");
  };

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
            {isByob && <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">Build your own</span>}
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-1">{combo.title}</h1>
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
              <p className="text-sm font-medium mb-3">
                {isByob ? `Pick ${limit} items (${selected.length}/${limit})` : "Includes"}
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {(isByob ? products : combo.products_json.map((ci) => products.find((p) => p.id === ci.product_id)).filter(Boolean) as ProductMini[]).map((p) => {
                  const checked = isByob && selected.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => isByob && toggle(p.id)}
                      disabled={!isByob}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                        checked ? "border-primary bg-primary/5" : "border-border"
                      } ${isByob ? "hover:border-primary/40 cursor-pointer" : "cursor-default"}`}
                    >
                      <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        {p.image_url && <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" />}
                      </div>
                      <span className="flex-1 text-sm font-medium">{p.name}</span>
                      {isByob && (
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${checked ? "bg-primary border-primary" : "border-border"}`}>
                          {checked && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                      )}
                    </button>
                  );
                })}
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
