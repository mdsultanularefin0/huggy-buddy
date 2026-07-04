import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";

import { useMemo, useState } from "react";
import { Sparkles, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, effectivePrice, hasSale } from "@/lib/currency";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  regular_price: number;
  sale_price: number | null;
  sizes_json: { size_label: string; price: number; sale_price?: number | null }[] | null;
  image_url: string | null;
  category_id: string | null;
  note_type?: string | null;
};

type Cat = { id: string; name: string; slug: string };

const productsPageOptions = queryOptions({
  queryKey: ["public", "products-page"],
  queryFn: async () => {
    const [{ data: products, error: pe }, { data: cats, error: ce }] = await Promise.all([
      supabase
        .from("products")
        .select("id,slug,name,regular_price,sale_price,sizes_json,image_url,category_id,in_stock")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("categories")
        .select("id,name,slug")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);
    if (pe) throw pe;
    if (ce) throw ce;
    return { products: (products ?? []) as ProductRow[], categories: (cats ?? []) as Cat[] };

  },
});

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "All Fragrances — Veloura Essence" },
      { name: "description", content: "Browse all Veloura Essence luxury perfumes, combos, and signature scents." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(productsPageOptions),
  component: ProductsPage,
});


function ProductsPage() {
  const { data } = useSuspenseQuery(productsPageOptions);
  return <ListingShell title="All Fragrances" subtitle="Every Veloura scent, one place." products={data.products} categories={data.categories} />;
}

export function ListingShell({
  title,
  subtitle,
  products,
  categories,
  activeCategorySlug,
}: {
  title: string;
  subtitle?: string;
  products: ProductRow[];
  categories: Cat[];
  activeCategorySlug?: string;
}) {
  const [maxPrice, setMaxPrice] = useState<number>(10000);
  const [scents, setScents] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const min = p.sizes_json?.[0];
      const reg = min?.price ?? p.regular_price;
      const sale = min?.sale_price ?? p.sale_price;
      const price = effectivePrice(reg, sale);
      return price <= maxPrice;
    });
  }, [products, maxPrice]);

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="w-full h-48 bg-gray-50 flex items-center justify-center text-center px-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#52277a]">{title}</h1>
          {subtitle && <p className="text-sm text-gray-600 mt-2">{subtitle}</p>}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="hidden lg:block lg:col-span-1">
          <div className="sticky top-24 space-y-8">
            <FiltersPanel
              categories={categories}
              activeCategorySlug={activeCategorySlug}
              maxPrice={maxPrice}
              setMaxPrice={setMaxPrice}
              scents={scents}
              setScents={setScents}
            />
          </div>
        </aside>

        <div className="lg:col-span-3">
          <div className="lg:hidden mb-4 flex justify-between items-center">
            <p className="text-sm text-gray-600">{filtered.length} product{filtered.length === 1 ? "" : "s"}</p>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <SlidersHorizontal className="w-4 h-4" /> Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="text-[#52277a]">Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-8">
                  <FiltersPanel
                    categories={categories}
                    activeCategorySlug={activeCategorySlug}
                    maxPrice={maxPrice}
                    setMaxPrice={setMaxPrice}
                    scents={scents}
                    setScents={setScents}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center text-gray-500">
              <Sparkles className="w-8 h-8 mx-auto mb-3 text-[#a555f0]" />
              No products match your filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

function FiltersPanel({
  categories,
  activeCategorySlug,
  maxPrice,
  setMaxPrice,
  scents,
  setScents,
}: {
  categories: Cat[];
  activeCategorySlug?: string;
  maxPrice: number;
  setMaxPrice: (n: number) => void;
  scents: string[];
  setScents: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  return (
    <>
      <div>
        <h3 className="font-semibold text-sm uppercase tracking-wide text-[#52277a] mb-3">Categories</h3>
        <ul className="space-y-2 text-sm">
          <li>
            <Link to="/products" className={`hover:text-[#a555f0] ${!activeCategorySlug ? "font-semibold text-[#52277a]" : "text-gray-700"}`}>
              All
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                to="/category/$slug"
                params={{ slug: c.slug }}
                className={`hover:text-[#a555f0] ${activeCategorySlug === c.slug ? "font-semibold text-[#52277a]" : "text-gray-700"}`}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-semibold text-sm uppercase tracking-wide text-[#52277a] mb-3">Price Range</h3>
        <input
          type="range"
          min={500}
          max={10000}
          step={100}
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="w-full accent-[#a555f0]"
        />
        <p className="text-xs text-gray-600 mt-1">Up to {formatBDT(maxPrice)}</p>
      </div>

      <ScentProfileFilter scents={scents} setScents={setScents} />

    </>
  );
}

function ScentProfileFilter({
  scents,
  setScents,
}: {
  scents: string[];
  setScents: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const { data: profiles = [] } = useQuery({
    queryKey: ["public", "notes", "scent-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("scent_profile")
        .eq("is_active", true)
        .not("scent_profile", "is", null)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return Array.from(
        new Set(
          (data as { scent_profile: string | null }[])
            .map((n) => n.scent_profile)
            .filter((s): s is string => Boolean(s)),
        ),
      );
    },
    staleTime: 5 * 60 * 1000,
  });

  if (profiles.length === 0) return null;

  return (
    <div>
      <h3 className="font-semibold text-sm uppercase tracking-wide text-[#52277a] mb-3">Scent Profile</h3>
      <ul className="space-y-2 text-sm">
        {profiles.map((s) => (
          <li key={s}>
            <label className="flex items-center gap-2 cursor-pointer text-gray-700">
              <input
                type="checkbox"
                checked={scents.includes(s)}
                onChange={(e) =>
                  setScents((prev) => (e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)))
                }
                className="accent-[#a555f0]"
              />
              {s}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

