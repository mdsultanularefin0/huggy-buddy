import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyWishlist, toggleMyWishlist } from "@/lib/account.functions";
import { ProductCard } from "@/components/product-card";
import { Heart, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account/wishlist")({
  head: () => ({
    meta: [
      { title: "Wishlist — My Account | Veloura Essence" },
      { name: "description", content: "Products you've saved to your wishlist." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: WishlistPage,
});

type Row = {
  id: string;
  product_id: string;
  products: {
    id: string;
    name: string;
    slug: string;
    regular_price: number;
    sale_price: number | null;
    image_url: string | null;
  } | null;
};

function WishlistPage() {
  const fetchList = useServerFn(listMyWishlist);
  const toggle = useServerFn(toggleMyWishlist);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-wishlist"],
    queryFn: () => fetchList() as Promise<Row[]>,
  });

  const removeMut = useMutation({
    mutationFn: (productId: string) => toggle({ data: { productId } }),
    onSuccess: () => {
      toast.success("Removed from wishlist");
      qc.invalidateQueries({ queryKey: ["my-wishlist"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Wishlist</h1>
        <p className="text-sm text-muted-foreground">Fragrances you've saved for later.</p>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Heart className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>Your wishlist is empty.</p>
          <Link to="/products" className="text-primary underline text-sm">Browse fragrances</Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r) => {
            if (!r.products) return null;
            const p = r.products;
            return (
              <div key={r.id} className="relative">
                <button
                  onClick={() => removeMut.mutate(p.id)}
                  disabled={removeMut.isPending}
                  aria-label="Remove from wishlist"
                  className="absolute top-2 right-2 z-20 w-9 h-9 rounded-full bg-white/95 flex items-center justify-center shadow-md hover:bg-white hover:text-destructive transition"
                >
                  <X className="w-4 h-4" />
                </button>
                <ProductCard product={p} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
