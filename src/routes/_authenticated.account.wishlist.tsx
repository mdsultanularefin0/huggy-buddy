import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyWishlist, toggleMyWishlist } from "@/lib/account.functions";
import { formatBDT } from "@/lib/currency";
import { Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  products: { id: string; name: string; slug: string; regular_price: number; sale_price: number | null; image_url: string | null } | null;
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
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["my-wishlist"] });
    },
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((r) => {
            if (!r.products) return null;
            const p = r.products;
            const price = p.sale_price ?? p.regular_price;
            return (
              <div key={r.id} className="rounded-xl border overflow-hidden bg-card relative group">
                <button
                  onClick={() => removeMut.mutate(p.id)}
                  aria-label="Remove"
                  className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white shadow"
                >
                  <X className="w-4 h-4" />
                </button>
                <Link to="/product/$slug" params={{ slug: p.slug }}>
                  <div className="aspect-square bg-muted overflow-hidden">
                    {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" />}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-sm text-primary font-semibold mt-1">{formatBDT(price)}</p>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
