import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { zodValidator } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { ListingShell, listingSearchSchema } from "./products";

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

const categoryPageOptions = (slug: string) =>
  queryOptions({
    queryKey: ["category-page", slug],
    queryFn: async () => {
      const { data: cat, error: ce } = await supabase
        .from("categories")
        .select("id,name,slug,image_url,is_active")
        .eq("slug", slug)
        .maybeSingle();
      if (ce) throw ce;
      if (!cat || !cat.is_active) throw notFound();

      // Product IDs assigned to this category via the join table
      const { data: linkRows, error: lie } = await supabase
        .from("product_categories")
        .select("product_id")
        .eq("category_id", cat.id);
      if (lie) throw lie;
      const linkedIds = Array.from(new Set((linkRows ?? []).map((r) => r.product_id)));

      const [
        { data: linkedProducts, error: lpe },
        { data: legacyProducts, error: pe },
        { data: cats },
        { data: combos, error: coe },
        { data: pCats, error: pce },
        { data: pNotes, error: pne },
        { data: cCats, error: cce },
        { data: cNotes, error: cne },
      ] = await Promise.all([
        linkedIds.length
          ? supabase
              .from("products")
              .select("id,slug,name,regular_price,sale_price,sizes_json,image_url,category_id,in_stock,scent_profile,badge")
              .in("id", linkedIds)
              .eq("is_active", true)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as ProductRow[], error: null }),
        supabase
          .from("products")
          .select("id,slug,name,regular_price,sale_price,sizes_json,image_url,category_id,in_stock,scent_profile,badge")
          .eq("category_id", cat.id)
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
      if (lpe) throw lpe;
      if (pe) throw pe;
      if (coe) throw coe;
      if (pce) throw pce;
      if (pne) throw pne;
      if (cce) throw cce;
      if (cne) throw cne;

      // Merge (unique by id) — a product can appear via link or legacy column.
      const map = new Map<string, ProductRow>();
      for (const p of (linkedProducts ?? []) as unknown as ProductRow[]) map.set(p.id, p);
      for (const p of (legacyProducts ?? []) as unknown as ProductRow[]) map.set(p.id, p);

      return {
        category: cat,
        products: Array.from(map.values()),
        categories: (cats ?? []) as Cat[],
        combos: (combos ?? []) as unknown as {
          id: string; title: string; regular_price: number; sale_price: number | null;
          image_url: string | null; combo_type: "prebuilt" | "byob"; max_items_allowed: number | null;
        }[],
        productCategoryLinks: (pCats ?? []) as { product_id: string; category_id: string }[],
        productNoteLinks: (pNotes ?? []) as { product_id: string; note: { scent_profile: string | null } | null }[],
        comboCategoryLinks: (cCats ?? []) as { combo_id: string; category_id: string }[],
        comboNoteLinks: (cNotes ?? []) as { combo_id: string; note: { scent_profile: string | null } | null }[],
      };
    },
  });

export const Route = createFileRoute("/category/$slug")({
  validateSearch: zodValidator(listingSearchSchema),
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
    <ListingShell
      title={data.category.name}
      subtitle={`Discover our ${data.category.name} collection`}
      products={data.products}
      categories={data.categories}
      combos={data.combos}
      activeCategorySlug={data.category.slug}
      productCategoryLinks={data.productCategoryLinks}
      productNoteLinks={data.productNoteLinks}
      comboCategoryLinks={data.comboCategoryLinks}
      comboNoteLinks={data.comboNoteLinks}
    />
  );
}
