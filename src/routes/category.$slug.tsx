import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, effectivePrice, hasSale } from "@/lib/currency";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";

type ProductRow = {
  id: string; name: string;
  regular_price: number; sale_price: number | null;
  sizes_json: { size_label: string; price: number; sale_price?: number | null }[] | null;
  image_url: string | null;
};

const categoryPageOptions = (slug: string) => queryOptions({
  queryKey: ["category-page", slug],
  queryFn: async () => {
    const { data: cat, error: ce } = await supabase
      .from("categories")
      .select("id,name,slug,image_url,is_active")
      .eq("slug", slug)
      .maybeSingle();
    if (ce) throw ce;
    if (!cat || !cat.is_active) throw notFound();
    const { data: products, error: pe } = await supabase
      .from("products")
      .select("id,name,regular_price,sale_price,sizes_json,image_url")
      .eq("category_id", cat.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (pe) throw pe;
    return { category: cat, products: (products ?? []) as ProductRow[] };
  },
});

export const Route = createFileRoute("/category/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(categoryPageOptions(params.slug)),
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Veloura Essence` },
      { name: "description", content: `Shop the ${params.slug.replace(/-/g, " ")} collection at Veloura Essence.` },
    ],
  }),
  component: CategoryPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Category not found.
    </div>
  ),
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(categoryPageOptions(slug));

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8 flex items-center gap-4">
          {data.category.image_url && (
            <img src={data.category.image_url} alt="" className="w-20 h-20 rounded-2xl object-cover shadow-soft" />
          )}
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold">Category</p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-1">{data.category.name}</h1>
          </div>
        </div>

        {data.products.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-border bg-card/50 py-20 text-center">
            <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No products in this category yet.</p>
            <Link to="/" className="text-sm text-primary underline mt-2 inline-block">Back to home</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {data.products.map((p) => {
              const minSize = p.sizes_json?.[0];
              const regular = minSize?.price ?? p.regular_price;
              const sale = minSize?.sale_price ?? p.sale_price;
              const onSale = hasSale(regular, sale);
              const price = effectivePrice(regular, sale);
              return (
                <Link key={p.id} to="/product/$id" params={{ id: p.id }} className="group">
                  <div className="relative aspect-square rounded-2xl bg-muted overflow-hidden mb-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Sparkles className="w-8 h-8" /></div>
                    )}
                    {onSale && (
                      <span className="absolute top-2 right-2 bg-sale text-sale-foreground text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full shadow-soft">
                        Sale!
                      </span>
                    )}
                  </div>
                  <h3 className="font-medium text-sm truncate">{p.name}</h3>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`font-semibold text-sm ${onSale ? "text-sale" : ""}`}>{formatBDT(price)}</span>
                    {onSale && <span className="text-xs text-muted-foreground line-through">{formatBDT(regular)}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      <SiteFooter />
      <CartDrawer />
    </div>
  );
}
