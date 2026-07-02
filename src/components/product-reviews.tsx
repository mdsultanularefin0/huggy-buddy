import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

type Review = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  author_name: string;
  created_at: string;
  user_id: string;
};

export function ProductReviews({ productId }: { productId: string }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("id,rating,title,body,author_name,created_at,user_id")
        .eq("product_id", productId)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Review[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const author = name.trim() || user?.email?.split("@")[0] || "";
      if (!author) throw new Error("Please enter your name");
      if (!body.trim()) throw new Error("Please write your review");
      const { error } = await supabase.from("product_reviews").insert({
        product_id: productId,
        user_id: user?.id ?? null,
        author_name: author,
        rating,
        title: title.trim() || null,
        body: body.trim() || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks! Your review is awaiting approval.");
      setTitle("");
      setBody("");
      setName("");
      setRating(5);
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const avg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  return (
    <section className="max-w-7xl mx-auto px-4 py-12 border-t border-gray-100">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-serif text-[#52277a]">Customer Reviews</h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
              <div className="flex text-[#a555f0]">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i <= Math.round(avg) ? "fill-current" : ""}`}
                  />
                ))}
              </div>
              <span>
                {avg.toFixed(1)} · {reviews.length} review{reviews.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>
        <Link to="/reviews" className="text-sm text-[#52277a] underline">
          See all reviews
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-10">
        <div>
          <h3 className="font-medium mb-4">Write a review</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
            className="space-y-3"
          >
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(i)}
                  aria-label={`${i} star`}
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${
                      i <= (hover || rating)
                        ? "text-[#a555f0] fill-current"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={user ? "Display name (optional)" : "Your name"}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share your thoughts..."
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={submit.isPending}
              className="bg-[#52277a] hover:bg-[#3f1d5e] disabled:opacity-50 text-white rounded-xl px-6 py-2.5 text-sm font-semibold"
            >
              {submit.isPending ? "Posting..." : "Post Review"}
            </button>
            {!user && (
              <p className="text-xs text-gray-500">
                Reviews appear after admin approval. Want to skip? <Link to="/auth" className="underline">Sign in</Link>.
              </p>
            )}
          </form>
        </div>

        <div className="space-y-5">
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading reviews...</p>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-gray-500">No reviews yet. Be the first!</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{r.author_name}</p>
                  <span className="text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex text-[#a555f0] my-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${i <= r.rating ? "fill-current" : "text-gray-200"}`}
                    />
                  ))}
                </div>
                {r.title && <p className="font-medium text-sm mt-1">{r.title}</p>}
                {r.body && <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{r.body}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
