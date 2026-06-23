import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, effectivePrice, hasSale } from "@/lib/currency";
import { SiteHeader } from "@/components/site-header";
import { CartDrawer } from "@/components/cart-drawer";
import { useCart } from "@/lib/cart-store";
import { toast } from "sonner";

type Size = { size_label: string; price: number; sale_price?: number | null };
type Product = {
  id: string; name: string; description: string | null;
  regular_price: number; sale_price: number | null;
  sizes_json: Size[] | null;
  image_url: string | null; in_stock: boolean;
};

const productOptions = (id: string) =>
  queryOptions({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products").select("*").eq("id", id).eq("is_active", true).maybeSingle();
      if (error) throw error;
      return data as Product | null;
    },
  });

export const Route = createFileRoute("/product/$id")({
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(productOptions(params.id));
    if (!p) throw notFound();
  },
  component: ProductPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => (
    <div className="p-12 text-center">
      <p className="text-muted-foreground">Product not found.</p>
      <Link to="/" className="text-primary underline mt-4 inline-block">Back to shop</Link>
    </div>
  ),
});

function ProductPage() {
  const { id } = Route.useParams();
  const { data: product } = useSuspenseQuery(productOptions(id));
  const sizes = product?.sizes_json ?? [];
  const [sizeIdx, setSizeIdx] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const add = useCart((s) => s.add);

  if (!product) return null;
  const needsSize = sizes.length > 0;
  const chosen = sizeIdx !== null ? sizes[sizeIdx] : undefined;
  const regular = chosen?.price ?? product.regular_price;
  const sale = chosen?.sale_price ?? product.sale_price;
  const price = effectivePrice(regular, sale);
  const canAdd = product.in_stock && (!needsSize || sizeIdx !== null);

  const handleAdd = () => {
    const sizeLabel = chosen?.size_label ?? null;
    add({
      lineId: `product:${product.id}:${sizeLabel ?? "default"}`,
      kind: "product",
      refId: product.id,
      name: product.name,
      imageUrl: product.image_url,
      unitPrice: price,
      regularPrice: regular,
      quantity: qty,
      size: sizeLabel,
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
          <div className="aspect-square rounded-3xl bg-muted overflow-hidden">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Sparkles className="w-12 h-12" /></div>
            )}
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{product.name}</h1>
            <div className="flex items-baseline gap-3 mt-3">
              <span className="text-2xl font-semibold">{formatBDT(price)}</span>
              {hasSale(regular, sale) && (
                <span className="text-base text-muted-foreground line-through">{formatBDT(regular)}</span>
              )}
            </div>
            {product.description && (
              <p className="text-sm text-muted-foreground mt-5 whitespace-pre-line">{product.description}</p>
            )}

            {sizes.length > 0 && (
              <div className="mt-8">
                <p className="text-sm font-medium mb-3">Size</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s, i) => (
                    <button
                      key={s.size_label}
                      onClick={() => setSizeIdx(i)}
                      className={`px-4 py-2 rounded-xl border text-sm transition-colors ${
                        i === sizeIdx ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:border-primary/40"
                      }`}
                    >
                      {s.size_label} — {formatBDT(effectivePrice(s.price, s.sale_price))}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center gap-4">
              <div className="flex items-center border rounded-xl">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2 text-lg">−</button>
                <span className="px-4 font-medium">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="px-3 py-2 text-lg">+</button>
              </div>
              <Button variant="hero" size="lg" className="flex-1" onClick={handleAdd} disabled={!canAdd}>
                {!product.in_stock ? "Out of stock" : needsSize && sizeIdx === null ? "Select a size" : "Add to cart"}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <CartDrawer />
    </div>
  );
}
