import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Check, X, Trash2, Loader2, Plus, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";

export const Route = createFileRoute("/admin/reviews")({
  head: () => ({ meta: [{ title: "Reviews — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminReviewsPage,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

type Status = "pending" | "approved" | "rejected";
type Row = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  author_name: string;
  status: Status;
  created_at: string;
  user_id: string | null;
  product_id: string;
  images: string[] | null;
  products: { name: string; slug: string } | null;
};

function AdminReviewsPage() {
  const [tab, setTab] = useState<Status>("pending");
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "reviews", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("id,rating,title,body,author_name,status,created_at,user_id,product_id,images,products(name,slug)")
        .eq("status", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("product_reviews").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "approved" ? "Approved" : v.status === "rejected" ? "Rejected" : "Updated");
      qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
      qc.invalidateQueries({ queryKey: ["reviews"] });
      qc.invalidateQueries({ queryKey: ["public", "reviews", "whispers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = useQuery({
    queryKey: ["admin", "reviews", "counts"],
    queryFn: async () => {
      const q = (s: Status) =>
        supabase.from("product_reviews").select("id", { count: "exact", head: true }).eq("status", s);
      const [p, a, r] = await Promise.all([q("pending"), q("approved"), q("rejected")]);
      return { pending: p.count ?? 0, approved: a.count ?? 0, rejected: r.count ?? 0 };
    },
  });

  const tabs: { key: Status; label: string }[] = [
    { key: "pending", label: `Pending (${counts.data?.pending ?? 0})` },
    { key: "approved", label: `Approved (${counts.data?.approved ?? 0})` },
    { key: "rejected", label: `Rejected (${counts.data?.rejected ?? 0})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Reviews</h1>
          <p className="text-sm text-muted-foreground">Approve or reject customer reviews before they appear on the site.</p>
        </div>
        <AddReviewDialog onCreated={() => { qc.invalidateQueries({ queryKey: ["admin", "reviews"] }); qc.invalidateQueries({ queryKey: ["reviews"] }); }} />
      </div>

      <div className="flex gap-2 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {tab} reviews.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{r.author_name}</span>
                    {!r.user_id && <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Guest</span>}
                    <span className="text-muted-foreground">· {new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex text-primary my-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={`w-4 h-4 ${i <= r.rating ? "fill-current" : "text-muted"}`} />
                    ))}
                  </div>
                  {r.products && (
                    <p className="text-xs text-muted-foreground">
                      on <span className="font-medium text-foreground">{r.products.name}</span>
                    </p>
                  )}
                  {r.title && <p className="font-medium mt-2">{r.title}</p>}
                  {r.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{r.body}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  {r.status !== "approved" && (
                    <Button size="sm" onClick={() => setStatus.mutate({ id: r.id, status: "approved" })} disabled={setStatus.isPending}>
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  )}
                  {r.status !== "rejected" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r.id, status: "rejected" })} disabled={setStatus.isPending}>
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this review?")) remove.mutate(r.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddReviewDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [author, setAuthor] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>("approved");
  const [submitting, setSubmitting] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["admin", "reviews", "products-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
    enabled: open,
  });

  async function submit() {
    if (!productId) return toast.error("Pick a product");
    if (!author.trim()) return toast.error("Author name required");
    setSubmitting(true);
    const { error } = await supabase.from("product_reviews").insert({
      product_id: productId,
      author_name: author.trim(),
      rating,
      title: title.trim() || null,
      body: body.trim() || null,
      status,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Review added");
    setOpen(false);
    setProductId(""); setAuthor(""); setRating(5); setTitle(""); setBody(""); setStatus("approved");
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add review</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add review</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Author name</Label>
              <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Jane D." />
            </div>
            <div>
              <Label>Rating</Label>
              <Select value={String(rating)} onValueChange={(v) => setRating(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 4, 3, 2, 1].map((n) => <SelectItem key={n} value={String(n)}>{n} star{n > 1 ? "s" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Title (optional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Body (optional)</Label>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Approved (visible)</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Adding…" : "Add review"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
