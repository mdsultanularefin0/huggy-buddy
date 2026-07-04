import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ListingShell } from "./products";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  regular_price: number;
  sale_price: number | null;
  sizes_json: { size_label: string; price: number; sale_price?: number | null }[] | null;
  image_url: string | null;
  category_id: string | null;
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

      const [{ data: products, error: pe }, { data: cats }] = await Promise.all([
        supabase
          .from("products")
          .select("id,slug,name,regular_price,sale_price,sizes_json,image_url,category_id,in_stock")
          .eq("category_id", cat.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("categories")
          .select("id,name,slug")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);
      if (pe) throw pe;
      return {
        category: cat,
        products: (products ?? []) as ProductRow[],
        categories: (cats ?? []) as Cat[],
      };
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
    <ListingShell
      title={data.category.name}
      subtitle={`Discover our ${data.category.name} collection`}
      products={data.products}
      categories={data.categories}
      activeCategorySlug={data.category.slug}
    />
  );
}
