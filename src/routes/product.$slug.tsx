import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Sparkles, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, effectivePrice, hasSale } from "@/lib/currency";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";
import { useCart } from "@/lib/cart-store";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ProductReviews } from "@/components/product-reviews";

type Size = { size_label: string; price: number; sale_price?: number | null };
type Product = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  regular_price: number;
  sale_price: number | null;
  sizes_json: Size[] | null;
  image_url: string | null;
  in_stock: boolean;
};

const productOptions = (slug: string) =>
  queryOptions({
    queryKey: ["product", "slug", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,slug,name,description,regular_price,sale_price,sizes_json,image_url,in_stock")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data as Product | null;
    },
  });

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(productOptions(params.slug));
    if (!p) throw notFound();
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Veloura Essence` },
      { name: "description", content: `Shop ${params.slug.replace(/-/g, " ")} at Veloura Essence — premium fragrance crafted in Bangladesh.` },
    ],
  }),
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
  const { slug } = Route.useParams();
  const { data: product } = useSuspenseQuery(productOptions(slug));
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
    if (!product.in_stock) {
      toast.error("This product is currently out of stock");
      return;
    }
    if (needsSize && sizeIdx === null) {
      toast.error("Please select a size before adding to cart");
      return;
    }
    const sizeLabel = chosen?.size_label ?? null;
    add({
      lineId: `product:${product.slug}:${sizeLabel ?? "default"}`,
      kind: "product",
      refId: product.id,
      name: product.name,
      imageUrl: product.image_url,
      unitPrice: price,
      regularPrice: regular,
      quantity: qty,
      size: sizeLabel,
    });
    toast.success(`${product.name}${sizeLabel ? ` (${sizeLabel})` : ""} × ${qty} added to cart`);
  };

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="max-w-7xl mx-auto py-12 px-4 grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <Link to="/products" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" /> All products
          </Link>
          <div className="aspect-square rounded-2xl bg-gray-50 overflow-hidden">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Sparkles className="w-12 h-12" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-square rounded-xl bg-gray-50 overflow-hidden border border-gray-100">
                {product.image_url ? (
                  <img src={product.image_url} alt="" className="w-full h-full object-cover opacity-80" />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#52277a]">{product.name}</h1>
          <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
            <div className="flex text-[#a555f0]">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="w-4 h-4 fill-current" />
              ))}
            </div>
            <span>5.0 · 24 reviews</span>
          </div>
          <div className="flex items-baseline gap-3 mt-4">
            <span className="text-2xl font-semibold">{formatBDT(price)}</span>
            {hasSale(regular, sale) && (
              <span className="text-base text-muted-foreground line-through">{formatBDT(regular)}</span>
            )}
          </div>
          {product.description && (
            <p className="text-sm text-gray-700 mt-5 whitespace-pre-line leading-relaxed">{product.description}</p>
          )}

          {sizes.length > 0 && (
            <div className="mt-8">
              <p className="text-sm font-medium mb-3">Variant</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s, i) => (
                  <button
                    key={s.size_label}
                    onClick={() => setSizeIdx(i)}
                    className={`px-4 py-2 rounded-xl border text-sm transition-colors ${
                      i === sizeIdx
                        ? "border-[#52277a] bg-[#52277a]/5 text-[#52277a] font-medium"
                        : "border-gray-200 hover:border-[#a555f0]/60"
                    }`}
                  >
                    {s.size_label} — {formatBDT(effectivePrice(s.price, s.sale_price))}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center border border-gray-200 rounded-xl">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2 text-lg">−</button>
              <span className="px-4 font-medium">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="px-3 py-2 text-lg">+</button>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="mt-4 w-full bg-[#52277a] hover:bg-[#3f1d5e] disabled:opacity-50 text-white rounded-2xl py-4 font-semibold transition-colors"
          >
            {!product.in_stock ? "Out of stock" : needsSize && sizeIdx === null ? "Select a variant" : "Add to Cart"}
          </button>

          <Accordion type="single" collapsible className="mt-8">
            <AccordionItem value="notes">
              <AccordionTrigger>Notes & Ingredients</AccordionTrigger>
              <AccordionContent>
                Crafted with premium imported oils. Top, heart, and base notes designed to evolve gracefully on skin.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="shipping">
              <AccordionTrigger>Shipping Info</AccordionTrigger>
              <AccordionContent>
                Nationwide delivery across Bangladesh in 2–4 business days. Free shipping on orders over ৳999.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="usage">
              <AccordionTrigger>How to Use</AccordionTrigger>
              <AccordionContent>
                Spray onto pulse points — wrists, neck, and behind the ears — from 15–20 cm away for best projection.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
      <ProductReviews productId={product.id} />
      <SiteFooter />
      <CartDrawer />
    </div>
  );
}
