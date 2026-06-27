import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";

type ReviewRow = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  author_name: string;
  created_at: string;
  product_id: string;
  products: { slug: string; name: string; image_url: string | null } | null;
};

export const Route = createFileRoute("/reviews")({
  head: () => ({
    meta: [
      { title: "Customer Reviews — Veloura Essence" },
      { name: "description", content: "Read what customers say about Veloura Essence fragrances." },
    ],
  }),
  component: ReviewsPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function ReviewsPage() {
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["reviews", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("id,rating,title,body,author_name,created_at,product_id,products(slug,name,image_url)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as ReviewRow[];
    },
  });

  const avg =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-serif text-[#52277a]">Customer Reviews</h1>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
            <div className="flex text-[#a555f0]">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className={`w-4 h-4 ${i <= Math.round(avg) ? "fill-current" : ""}`} />
              ))}
            </div>
            <span>
              {avg.toFixed(1)} average · {reviews.length} review{reviews.length === 1 ? "" : "s"}
            </span>
          </div>
        )}

        <div className="mt-8 space-y-4">
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-gray-500">No reviews yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded-2xl p-5 flex gap-4">
                {r.products?.image_url && (
                  <Link
                    to="/product/$slug"
                    params={{ slug: r.products.slug }}
                    className="shrink-0"
                  >
                    <img
                      src={r.products.image_url}
                      alt={r.products.name}
                      className="w-20 h-20 object-cover rounded-xl bg-gray-50"
                    />
                  </Link>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      {r.products && (
                        <Link
                          to="/product/$slug"
                          params={{ slug: r.products.slug }}
                          className="text-sm font-medium text-[#52277a] hover:underline"
                        >
                          {r.products.name}
                        </Link>
                      )}
                      <p className="text-xs text-gray-500">by {r.author_name}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex text-[#a555f0] my-1.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${i <= r.rating ? "fill-current" : "text-gray-200"}`}
                      />
                    ))}
                  </div>
                  {r.title && <p className="font-medium text-sm">{r.title}</p>}
                  {r.body && (
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{r.body}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <SiteFooter />
      <CartDrawer />
    </div>
  );
}
