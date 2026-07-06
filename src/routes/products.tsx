import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { SlidersHorizontal } from "lucide-react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT, effectivePrice } from "@/lib/currency";
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
  in_stock?: boolean | null;
  scent_profile?: string | null;
};

type Cat = { id: string; name: string; slug: string };

export type ComboRow = {
  id: string;
  title: string;
  regular_price: number;
  sale_price: number | null;
  image_url: string | null;
  combo_type: "prebuilt" | "byob";
  max_items_allowed: number | null;
};

const productsPageOptions = queryOptions({
  queryKey: ["public", "products-page"],
  queryFn: async () => {
    const [{ data: products, error: pe }, { data: cats, error: ce }, { data: combos, error: coe }] = await Promise.all([
      supabase
        .from("products")
        .select("id,slug,name,regular_price,sale_price,sizes_json,image_url,category_id,in_stock,scent_profile")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("categories")
        .select("id,name,slug")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("combos")
        .select("id,title,regular_price,sale_price,image_url,combo_type,max_items_allowed")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
    ]);
    if (pe) throw pe;
    if (ce) throw ce;
    if (coe) throw coe;
    return {
      products: (products ?? []) as unknown as ProductRow[],
      categories: (cats ?? []) as Cat[],
      combos: (combos ?? []) as unknown as ComboRow[],
    };
  },
});

export const MAX_PRICE_DEFAULT = 10000;

export const listingSearchSchema = z.object({
  scent: fallback(z.array(z.string()).or(z.string()).optional(), undefined),
  maxPrice: fallback(z.coerce.number().int().min(0).max(1_000_000), MAX_PRICE_DEFAULT).default(MAX_PRICE_DEFAULT),
});

export type ListingSearch = z.infer<typeof listingSearchSchema>;

export const Route = createFileRoute("/products")({
  validateSearch: zodValidator(listingSearchSchema),
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
  return <ListingShell title="All Fragrances" subtitle="Every Veloura scent, one place." products={data.products} categories={data.categories} combos={data.combos} />;
}

export function normalizeScents(scent: string[] | string | undefined): string[] {
  if (!scent) return [];
  return Array.isArray(scent) ? scent : [scent];
}

export function ListingShell({
  title,
  subtitle,
  products,
  categories,
  combos = [],
  activeCategorySlug,
}: {
  title: string;
  subtitle?: string;
  products: ProductRow[];
  categories: Cat[];
  combos?: ComboRow[];
  activeCategorySlug?: string;
}) {
  // Both /products and /category/$slug use listingSearchSchema, so strict:false is safe.
  const search = useSearch({ strict: false }) as Partial<ListingSearch>;
  const navigate = useNavigate();
  const scents = normalizeScents(search.scent);
  const maxPrice = search.maxPrice ?? MAX_PRICE_DEFAULT;

  const setMaxPrice = (n: number) => {
    void navigate({
      to: ".",
      search: ((prev: Record<string, unknown>) => ({
        ...prev,
        maxPrice: n === MAX_PRICE_DEFAULT ? undefined : n,
      })) as never,
      replace: true,
    });
  };

  const setScents = (updater: (prev: string[]) => string[]) => {
    const next = updater(scents);
    void navigate({
      to: ".",
      search: ((prev: Record<string, unknown>) => ({
        ...prev,
        scent: next.length === 0 ? undefined : next,
      })) as never,
      replace: true,
    });
  };

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const min = p.sizes_json?.[0];
      const reg = min?.price ?? p.regular_price;
      const sale = min?.sale_price ?? p.sale_price;
      const price = effectivePrice(reg, sale);
      if (price > maxPrice) return false;
      if (scents.length > 0 && (!p.scent_profile || !scents.includes(p.scent_profile))) return false;
      return true;
    });
  }, [products, maxPrice, scents]);

  // Combos only show when the "All" listing is used (no category filter) and
  // when scent filters are inactive, since combos aren't scent-scoped.
  const filteredCombos = useMemo(() => {
    if (activeCategorySlug || scents.length > 0) return [];
    return combos.filter((c) => effectivePrice(c.regular_price, c.sale_price) <= maxPrice);
  }, [combos, maxPrice, scents, activeCategorySlug]);


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
  setScents: (updater: (prev: string[]) => string[]) => void;
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
  setScents: (updater: (prev: string[]) => string[]) => void;
}) {
  const { data: profiles = [], isLoading } = useQuery({
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

  if (isLoading) {
    return (
      <div>
        <h3 className="font-semibold text-sm uppercase tracking-wide text-[#52277a] mb-3">Scent Profile</h3>
        <p className="text-xs text-gray-500">Loading…</p>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div>
        <h3 className="font-semibold text-sm uppercase tracking-wide text-[#52277a] mb-3">Scent Profile</h3>
        <p className="text-xs text-gray-500">
          No scent profiles yet. Add active notes with a scent profile from the admin panel to filter by scent.
        </p>
      </div>
    );
  }

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
