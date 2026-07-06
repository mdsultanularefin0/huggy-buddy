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

      const [{ data: products, error: pe }, { data: cats }, { data: combos, error: coe }] = await Promise.all([
        supabase
          .from("products")
          .select("id,slug,name,regular_price,sale_price,sizes_json,image_url,category_id,in_stock,scent_profile")
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
      ]);
      if (pe) throw pe;
      if (coe) throw coe;
      return {
        category: cat,
        products: (products ?? []) as unknown as ProductRow[],
        categories: (cats ?? []) as Cat[],
        combos: (combos ?? []) as unknown as {
          id: string; title: string; regular_price: number; sale_price: number | null;
          image_url: string | null; combo_type: "prebuilt" | "byob"; max_items_allowed: number | null;
        }[],
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
    />
  );
}
