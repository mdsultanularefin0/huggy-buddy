import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, effectivePrice, hasSale } from "@/lib/currency";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useCart } from "@/lib/cart-store";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ProductReviews } from "@/components/product-reviews";

type Variant = {
  id: string;
  size_label: string;
  price: number;
  sale_price: number | null;
  stock_quantity: number;
  in_stock: boolean;
};
type Product = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  regular_price: number;
  sale_price: number | null;
  image_url: string | null;
  in_stock: boolean;
  product_variants: Variant[];
};

const productOptions = (slug: string) =>
  queryOptions({
    queryKey: ["product", "slug", slug],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("products")
        .select("id,slug,name,short_description,description,regular_price,sale_price,image_url,in_stock,category:categories(name,slug),product_variants(id,size_label,price,sale_price,stock_quantity,in_stock)")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (data?.product_variants) {
        data.product_variants.sort((a: Variant, b: Variant) => a.size_label.localeCompare(b.size_label));
      }
      return data as (Product & { category: { name: string; slug: string } | null }) | null;
    },
  });


export const Route = createFileRoute("/product/$slug")({
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(productOptions(params.slug));
    if (!p) throw notFound();
    const { getRequestOrigin } = await import("@/lib/origin.functions");
    const origin = await getRequestOrigin();
    return {
      origin,
      name: p.name,
      description: p.description,
      image: p.image_url,
      price: effectivePrice(p.regular_price, p.sale_price),
      inStock: p.in_stock,
    };
  },
  head: ({ params, loaderData }) => {
    const name = loaderData?.name ?? params.slug.replace(/-/g, " ");
    const desc =
      loaderData?.description?.slice(0, 155) ??
      `Shop ${name} at Veloura Essence — premium fragrance crafted in Bangladesh.`;
    const origin = loaderData?.origin ?? "";
    const path = `/product/${params.slug}`;
    const url = origin ? `${origin}${path}` : path;
    const img = loaderData?.image
      ? loaderData.image.startsWith("http")
        ? loaderData.image
        : `${origin}${loaderData.image}`
      : undefined;
    const meta: Array<Record<string, string>> = [
      { title: `${name} — Veloura Essence` },
      { name: "description", content: desc },
      { property: "og:title", content: `${name} — Veloura Essence` },
      { property: "og:description", content: desc },
      { property: "og:type", content: "product" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: name },
      { name: "twitter:description", content: desc },
    ];
    if (img) {
      meta.push(
        { property: "og:image", content: img },
        { property: "og:image:alt", content: name },
        { name: "twitter:image", content: img },
      );
    }
    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      name,
      description: desc,
      ...(img ? { image: img } : {}),
      ...(url ? { url } : {}),
      brand: { "@type": "Brand", name: "Veloura Essence" },
      offers: {
        "@type": "Offer",
        price: loaderData?.price ?? 0,
        priceCurrency: "BDT",
        availability:
          loaderData?.inStock === false
            ? "https://schema.org/OutOfStock"
            : "https://schema.org/InStock",
        ...(url ? { url } : {}),
      },
    };
    return {
      meta,
      links: [{ rel: "canonical", href: path }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
    };
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
  const { slug } = Route.useParams();
  const { data: product } = useSuspenseQuery(productOptions(slug));
  const variants = product?.product_variants ?? [];
  const [variantIdx, setVariantIdx] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const add = useCart((s) => s.add);

  if (!product) return null;
  const needsVariant = variants.length > 0;
  const chosen = variantIdx !== null ? variants[variantIdx] : undefined;
  const regular = chosen?.price ?? product.regular_price;
  const sale = chosen?.sale_price ?? product.sale_price;
  const price = effectivePrice(regular, sale);
  const chosenOut = chosen ? (!chosen.in_stock && chosen.stock_quantity <= 0) : false;
  const canAdd = product.in_stock && !chosenOut && (!needsVariant || variantIdx !== null);

  const handleAdd = () => {
    if (!product.in_stock) {
      toast.error("This product is currently out of stock");
      return;
    }
    if (needsVariant && variantIdx === null) {
      toast.error("Please select a size before adding to cart");
      return;
    }
    if (chosenOut) {
      toast.error("This variant is out of stock");
      return;
    }
    const sizeLabel = chosen?.size_label ?? null;
    add({
      lineId: `product:${product.slug}:${sizeLabel ?? "default"}`,
      kind: "product",
      refId: product.id,
      variantId: chosen?.id ?? null,
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
          <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li><Link to="/products" className="hover:text-foreground">All products</Link></li>
              {product.category && (
                <>
                  <li aria-hidden="true">/</li>
                  <li>
                    <Link to="/category/$slug" params={{ slug: product.category.slug }} className="hover:text-foreground">
                      {product.category.name}
                    </Link>
                  </li>
                </>
              )}
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-foreground truncate max-w-[16rem]">{product.name}</li>
            </ol>
          </nav>

          <div className="aspect-square rounded-2xl bg-gray-50 overflow-hidden">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-50" aria-hidden="true" />
            )}

          </div>
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-square rounded-xl bg-gray-50 overflow-hidden border border-gray-100">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={`${product.name} — view ${i + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover opacity-80"
                  />
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
          {(() => {
            const lines = (product.short_description ?? "")
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean);
            if (lines.length === 0) return null;
            if (lines.length === 1) {
              return <p className="text-sm text-gray-700 mt-5 leading-relaxed">{lines[0]}</p>;
            }
            return (
              <ul className="mt-5 space-y-1.5 text-sm text-gray-700 list-disc pl-5 marker:text-[#a555f0]">
                {lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            );
          })()}




          {variants.length > 0 && (
            <div className="mt-8">
              <p className="text-sm font-medium mb-3">Size</p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v, i) => {
                  const out = v.stock_quantity <= 0;
                  return (
                    <button
                      key={v.id}
                      onClick={() => !out && setVariantIdx(i)}
                      disabled={out}
                      className={`px-4 py-2 rounded-xl border text-sm transition-colors ${
                        out
                          ? "border-gray-200 text-gray-400 line-through cursor-not-allowed"
                          : i === variantIdx
                          ? "border-[#52277a] bg-[#52277a]/5 text-[#52277a] font-medium"
                          : "border-gray-200 hover:border-[#a555f0]/60"
                      }`}
                    >
                      {v.size_label} — {formatBDT(effectivePrice(v.price, v.sale_price))}
                      {out && <span className="ml-1 text-xs">(Out of Stock)</span>}
                    </button>
                  );
                })}
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
            {!product.in_stock ? "Out of stock" : needsVariant && variantIdx === null ? "Select a size" : chosenOut ? "Variant out of stock" : "Add to Cart"}
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
      {product.description && (
        <section className="max-w-7xl mx-auto px-4 pb-12">
          <h2 className="text-xl font-semibold text-[#52277a] mb-4">Description</h2>
          <article
            className="prose prose-gray max-w-none prose-headings:text-[#52277a] prose-a:text-[#a555f0] prose-li:marker:text-[#a555f0]"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        </section>
      )}
      <ProductReviews productId={product.id} />
      <SiteFooter />
    </div>
  );
}
