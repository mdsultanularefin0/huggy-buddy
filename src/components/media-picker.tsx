import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Images } from "lucide-react";

const BUCKETS = ["hero-images", "product-images", "combo-images"] as const;
const SIGN_TTL = 60 * 60 * 24 * 365 * 10;

type MediaItem = { name: string; url: string; bucket: string };

async function loadBucket(bucket: string): Promise<MediaItem[]> {
  const { data: files, error } = await supabase.storage
    .from(bucket)
    .list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });
  if (error) return [];
  const names = (files ?? []).filter((f) => f.name && !f.name.startsWith(".")).map((f) => f.name);
  if (names.length === 0) return [];
  // Try public URLs first; fall back to signed URLs for private buckets.
  const { data: signed } = await supabase.storage.from(bucket).createSignedUrls(names, SIGN_TTL);
  if (signed && signed.length) {
    return signed
      .map((s, i) => ({ name: names[i], url: s.signedUrl, bucket }))
      .filter((m): m is MediaItem => !!m.url);
  }
  return names.map((n) => ({
    name: n,
    url: supabase.storage.from(bucket).getPublicUrl(n).data.publicUrl,
    bucket,
  }));
}

export function MediaPicker({ onPick, label = "Library" }: { onPick: (url: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["media", "all-buckets"],
    enabled: open,
    queryFn: async (): Promise<MediaItem[]> => {
      const results = await Promise.all(BUCKETS.map(loadBucket));
      return results.flat();
    },
  });

  const filtered = (data ?? []).filter((m) => filter === "all" || m.bucket === filter);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1">
          <Images className="w-4 h-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Media library</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {(["all", ...BUCKETS] as const).map((b) => (
            <Button
              key={b}
              type="button"
              size="sm"
              variant={filter === b ? "default" : "outline"}
              onClick={() => setFilter(b)}
            >
              {b === "all" ? "All" : b}
            </Button>
          ))}
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No uploaded images yet.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto p-1">
            {filtered.map((m) => (
              <button
                key={`${m.bucket}/${m.name}`}
                type="button"
                onClick={() => { onPick(m.url); setOpen(false); }}
                className="group relative aspect-square rounded-md border bg-muted overflow-hidden hover:ring-2 hover:ring-primary transition"
                title={`${m.bucket}/${m.name}`}
              >
                <img src={m.url} alt={m.name} className="w-full h-full object-cover" loading="lazy" />
                <span className="absolute bottom-1 left-1 right-1 text-[10px] px-1 py-0.5 rounded bg-black/60 text-white truncate">
                  {m.bucket}
                </span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
