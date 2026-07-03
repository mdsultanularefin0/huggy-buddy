import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Images, Upload, Copy, Trash2, Eye, Check } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";
import { Lightbox } from "@/components/lightbox";

const BUCKETS = ["hero-images", "product-images", "combo-images", "review-images"] as const;
const SIGN_TTL = 60 * 60 * 24 * 365 * 10;

type MediaItem = { name: string; url: string; bucket: string; created_at?: string };

async function loadBucket(bucket: string): Promise<MediaItem[]> {
  const { data: files, error } = await supabase.storage
    .from(bucket)
    .list("", { limit: 500, sortBy: { column: "created_at", order: "desc" } });
  if (error) return [];
  const entries = (files ?? []).filter((f) => f.name && !f.name.startsWith("."));
  const names = entries.map((f) => f.name);
  if (names.length === 0) return [];
  const { data: signed } = await supabase.storage.from(bucket).createSignedUrls(names, SIGN_TTL);
  if (signed && signed.length) {
    return signed.map((s, i) => ({
      name: names[i],
      url: s.signedUrl,
      bucket,
      created_at: entries[i].created_at,
    }));
  }
  return entries.map((e) => ({
    name: e.name,
    url: supabase.storage.from(bucket).getPublicUrl(e.name).data.publicUrl,
    bucket,
    created_at: e.created_at,
  }));
}

export function MediaPicker({ onPick, label = "Library" }: { onPick: (url: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [uploadBucket, setUploadBucket] = useState<typeof BUCKETS[number]>("product-images");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["media", "all-buckets"],
    enabled: open,
    queryFn: async (): Promise<MediaItem[]> => {
      const results = await Promise.all(BUCKETS.map(loadBucket));
      return results.flat();
    },
  });

  const filtered = useMemo(
    () =>
      (data ?? [])
        .filter((m) => filter === "all" || m.bucket === filter)
        .filter((m) => !query.trim() || m.name.toLowerCase().includes(query.toLowerCase())),
    [data, filter, query],
  );

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) await uploadImage(uploadBucket, f);
      toast.success(`Uploaded ${files.length} file${files.length > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["media", "all-buckets"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(item: MediaItem) {
    if (!confirm(`Delete ${item.name}?`)) return;
    const { error } = await supabase.storage.from(item.bucket).remove([item.name]);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["media", "all-buckets"] });
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }

  const urls = filtered.map((m) => m.url);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1">
          <Images className="w-4 h-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Media library</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search filename…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-48 h-9"
          />
          <div className="flex flex-wrap gap-1">
            {(["all", ...BUCKETS] as const).map((b) => (
              <Button
                key={b}
                type="button"
                size="sm"
                variant={filter === b ? "default" : "outline"}
                onClick={() => setFilter(b)}
              >
                {b === "all" ? "All" : b.replace("-images", "")}
              </Button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <select
              value={uploadBucket}
              onChange={(e) => setUploadBucket(e.target.value as typeof BUCKETS[number])}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              {BUCKETS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }}
            />
            <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
              Upload
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {query ? "No matches." : "No uploaded images yet."}
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto p-1">
            {filtered.map((m, i) => (
              <div
                key={`${m.bucket}/${m.name}`}
                className="group relative aspect-square rounded-md border bg-muted overflow-hidden"
                title={`${m.bucket}/${m.name}`}
              >
                <button
                  type="button"
                  onClick={() => { onPick(m.url); setOpen(false); }}
                  className="absolute inset-0 w-full h-full hover:ring-2 hover:ring-primary transition"
                >
                  <img src={m.url} alt={m.name} className="w-full h-full object-cover" loading="lazy" />
                </button>
                <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                  {m.bucket.replace("-images", "")}
                </span>
                <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPreview(i); }}
                    className="p-1 rounded bg-black/70 text-white hover:bg-black"
                    aria-label="Preview"
                  >
                    <Eye className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); copyUrl(m.url); }}
                    className="p-1 rounded bg-black/70 text-white hover:bg-black"
                    aria-label="Copy URL"
                  >
                    {copied === m.url ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(m); }}
                    className="p-1 rounded bg-red-600/90 text-white hover:bg-red-600"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {preview !== null && (
          <Lightbox images={urls} index={preview} onClose={() => setPreview(null)} onIndex={setPreview} />
        )}
      </DialogContent>
    </Dialog>
  );
}
