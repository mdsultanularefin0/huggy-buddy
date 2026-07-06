import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { SlidersHorizontal } from "lucide-react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
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
    const [
      { data: products, error: pe },
      { data: cats, error: ce },
      { data: combos, error: coe },
      { data: pCats, error: pce },
      { data: pNotes, error: pne },
      { data: cCats, error: cce },
      { data: cNotes, error: cne },
    ] = await Promise.all([
      supabase
        .from("products")
        .select("id,slug,name,regular_price,sale_price,sizes_json,image_url,category_id,in_stock,scent_profile,badge,is_new_arrival")
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
      supabase.from("product_categories").select("product_id,category_id"),
      supabase.from("product_notes").select("product_id,note:notes(scent_profile)"),
      supabase.from("combo_categories").select("combo_id,category_id"),
      supabase.from("combo_notes").select("combo_id,note:notes(scent_profile)"),
    ]);
    if (pe) throw pe;
    if (ce) throw ce;
    if (coe) throw coe;
    if (pce) throw pce;
    if (pne) throw pne;
    if (cce) throw cce;
    if (cne) throw cne;
    return {
      products: (products ?? []) as unknown as ProductRow[],
      categories: (cats ?? []) as Cat[],
      combos: (combos ?? []) as unknown as ComboRow[],
      productCategoryLinks: (pCats ?? []) as { product_id: string; category_id: string }[],
      productNoteLinks: (pNotes ?? []) as { product_id: string; note: { scent_profile: string | null } | null }[],
      comboCategoryLinks: (cCats ?? []) as { combo_id: string; category_id: string }[],
      comboNoteLinks: (cNotes ?? []) as { combo_id: string; note: { scent_profile: string | null } | null }[],
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
  return (
    <ListingShell
      title="All Fragrances"
      subtitle="Every Veloura scent, one place."
      products={data.products}
      categories={data.categories}
      combos={data.combos}
      productCategoryLinks={data.productCategoryLinks}
      productNoteLinks={data.productNoteLinks}
      comboCategoryLinks={data.comboCategoryLinks}
      comboNoteLinks={data.comboNoteLinks}
    />
  );
}

export function normalizeScents(scent: string[] | string | undefined): string[] {
  if (!scent) return [];
  return Array.isArray(scent) ? scent : [scent];
}

export type ListingLinks = {
  productCategoryLinks?: { product_id: string; category_id: string }[];
  productNoteLinks?: { product_id: string; note: { scent_profile: string | null } | null }[];
  comboCategoryLinks?: { combo_id: string; category_id: string }[];
  comboNoteLinks?: { combo_id: string; note: { scent_profile: string | null } | null }[];
};

export function ListingShell({
  title,
  subtitle,
  products,
  categories,
  combos = [],
  activeCategorySlug,
  productCategoryLinks = [],
  productNoteLinks = [],
  comboCategoryLinks = [],
  comboNoteLinks = [],
}: {
  title: string;
  subtitle?: string;
  products: ProductRow[];
  categories: Cat[];
  combos?: ComboRow[];
  activeCategorySlug?: string;
} & ListingLinks) {
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

  const activeCategoryId = useMemo(
    () => categories.find((c) => c.slug === activeCategorySlug)?.id ?? null,
    [categories, activeCategorySlug],
  );

  const productScents = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of productNoteLinks) {
      const s = l.note?.scent_profile;
      if (!s) continue;
      const set = m.get(l.product_id) ?? new Set<string>();
      set.add(s);
      m.set(l.product_id, set);
    }
    return m;
  }, [productNoteLinks]);

  const productCategoryIds = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of productCategoryLinks) {
      const set = m.get(l.product_id) ?? new Set<string>();
      set.add(l.category_id);
      m.set(l.product_id, set);
    }
    return m;
  }, [productCategoryLinks]);

  const comboScents = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of comboNoteLinks) {
      const s = l.note?.scent_profile;
      if (!s) continue;
      const set = m.get(l.combo_id) ?? new Set<string>();
      set.add(s);
      m.set(l.combo_id, set);
    }
    return m;
  }, [comboNoteLinks]);

  const comboCategoryIds = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of comboCategoryLinks) {
      const set = m.get(l.combo_id) ?? new Set<string>();
      set.add(l.category_id);
      m.set(l.combo_id, set);
    }
    return m;
  }, [comboCategoryLinks]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const min = p.sizes_json?.[0];
      const reg = min?.price ?? p.regular_price;
      const sale = min?.sale_price ?? p.sale_price;
      const price = effectivePrice(reg, sale);
      if (price > maxPrice) return false;
      if (activeCategoryId) {
        const cids = productCategoryIds.get(p.id);
        const legacy = p.category_id;
        if (!(cids?.has(activeCategoryId)) && legacy !== activeCategoryId) return false;
      }
      if (scents.length > 0) {
        const set = productScents.get(p.id) ?? new Set<string>();
        if (p.scent_profile) set.add(p.scent_profile);
        if (!scents.some((s) => set.has(s))) return false;
      }
      return true;
    });
  }, [products, maxPrice, scents, activeCategoryId, productCategoryIds, productScents]);

  // Combos show when: no scent filter (or a matching scent link exists);
  // and category matches by link, legacy slug rule, or no filter.
  const filteredCombos = useMemo(() => {
    return combos.filter((c) => {
      if (effectivePrice(c.regular_price, c.sale_price) > maxPrice) return false;
      if (activeCategorySlug) {
        const linkedCats = comboCategoryIds.get(c.id) ?? new Set<string>();
        const linkMatch = activeCategoryId ? linkedCats.has(activeCategoryId) : false;
        if (!linkMatch) return false;
      }

      if (scents.length > 0) {
        const set = comboScents.get(c.id) ?? new Set<string>();
        if (!scents.some((s) => set.has(s))) return false;
      }
      return true;
    });
  }, [combos, maxPrice, scents, activeCategorySlug, activeCategoryId, comboCategoryIds, comboScents]);





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

          {filtered.length === 0 && filteredCombos.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center text-gray-500">
              No products match your filters.
            </div>
          ) : (
            <div className="space-y-10">
              {filteredCombos.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-[#52277a] mb-4">Combo Packs</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCombos.map((c) => (
                      <ComboCard key={c.id} combo={c} />
                    ))}
                  </div>
                </div>
              )}
              {filtered.length > 0 && (
                <div>
                  {filteredCombos.length > 0 && (
                    <h2 className="text-lg font-semibold tracking-tight text-[#52277a] mb-4">Fragrances</h2>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                </div>
              )}
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

function ComboCard({ combo }: { combo: ComboRow }) {
  const onSale = hasSale(combo.regular_price, combo.sale_price);
  const price = effectivePrice(combo.regular_price, combo.sale_price);
  const pickN = combo.combo_type === "byob" ? combo.max_items_allowed ?? null : null;
  return (
    <Link
      to="/combo/$id"
      params={{ id: combo.id }}
      className="group relative block bg-[#f5edff] rounded-3xl transition-shadow duration-500 hover:shadow-[0_30px_60px_-15px_rgba(82,39,122,0.25)]"
    >
      <span className="absolute -top-2 -left-2 sm:-top-3 sm:-left-3 md:-top-4 md:-left-4 z-10 w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 rounded-full bg-[#52277a] text-white flex items-center justify-center text-[7px] sm:text-[8px] md:text-[10px] font-bold tracking-widest uppercase shadow-lg ring-2 sm:ring-4 ring-white">
        Combo
      </span>
      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-[#ece2f7]">
        {combo.image_url ? (
          <img
            src={combo.image_url}
            alt={combo.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#ece2f7] to-[#d8c4f0]">
            <span className="text-[#52277a] font-serif text-3xl">{pickN ? `Pick ${pickN}` : "Combo"}</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-end justify-center pb-6 opacity-0 translate-y-2 transition-all duration-500 group-hover:opacity-100 group-hover:translate-y-0">
          <span className="bg-white/95 backdrop-blur-sm text-[#52277a] px-8 py-3 text-[10px] font-bold tracking-[0.2em] uppercase rounded-full border border-[#52277a]/10 group-hover:bg-[#52277a] group-hover:text-white transition-colors duration-300">
            {pickN ? `Build Combo` : "View Combo"}
          </span>
        </div>
      </div>
      <div className="px-4 py-6 text-center">
        <p className="text-[10px] tracking-[0.25em] uppercase text-gray-400 mb-2 font-medium">
          Veloura Combo
        </p>
        <h3 className="text-base text-[#1a1a1a] mb-3 leading-tight font-serif truncate">
          {combo.title}
        </h3>
        <div className="flex items-center justify-center gap-3">
          {onSale && (
            <span className="text-xs text-gray-400 line-through font-light">{formatBDT(combo.regular_price)}</span>
          )}
          <span className={`text-sm font-semibold ${onSale ? "text-[#a555f0]" : "text-[#52277a]"}`}>
            {formatBDT(price)}
          </span>
        </div>
      </div>
    </Link>
  );
}
