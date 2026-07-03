import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Upload, Copy, Trash2, Eye, Check, Images } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";
import { Lightbox } from "@/components/lightbox";

export const Route = createFileRoute("/admin/media")({
  head: () => ({ meta: [{ title: "Media Library — Admin" }, { name: "robots", content: "noindex" }] }),
  component: MediaLibraryPage,
});

const BUCKETS = ["hero-images", "product-images", "combo-images", "review-images"] as const;
const SIGN_TTL = 60 * 60 * 24 * 365 * 10;

type MediaItem = { name: string; url: string; bucket: string; created_at?: string | null };

async function loadBucket(bucket: string): Promise<MediaItem[]> {
  const { data: files, error } = await supabase.storage
    .from(bucket)
    .list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
  if (error) return [];
  const entries = (files ?? []).filter((f) => f.name && !f.name.startsWith("."));
  const names = entries.map((f) => f.name);
  if (names.length === 0) return [];
  const { data: signed } = await supabase.storage.from(bucket).createSignedUrls(names, SIGN_TTL);
  return (signed ?? []).map((s, i) => ({
    name: names[i],
    url: s.signedUrl ?? "",
    bucket,
    created_at: entries[i].created_at,
  })).filter((m) => m.url);
}

function MediaLibraryPage() {
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [uploadBucket, setUploadBucket] = useState<typeof BUCKETS[number]>("product-images");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["media", "all-buckets"],
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

  const stats = useMemo(() => {
    const s: Record<string, number> = { all: (data ?? []).length };
    for (const b of BUCKETS) s[b] = (data ?? []).filter((m) => m.bucket === b).length;
    return s;
  }, [data]);

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

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected file(s)?`)) return;
    const byBucket: Record<string, string[]> = {};
    for (const key of selected) {
      const [bucket, ...rest] = key.split("/");
      (byBucket[bucket] ||= []).push(rest.join("/"));
    }
    for (const [bucket, names] of Object.entries(byBucket)) {
      const { error } = await supabase.storage.from(bucket).remove(names);
      if (error) toast.error(`${bucket}: ${error.message}`);
    }
    toast.success("Deleted");
    setSelected(new Set());
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

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const urls = filtered.map((m) => m.url);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Images className="w-7 h-7" /> Media Library
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Browse, upload, and manage images across all storage buckets.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
            Upload
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-4">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleUpload(e.dataTransfer.files);
          }}
          className="border-2 border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground hover:bg-muted/30 transition cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          Drag & drop images here, or click to browse. Uploading to <b>{uploadBucket}</b>.
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search filename…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-56 h-9"
          />
          <div className="flex flex-wrap gap-1">
            {(["all", ...BUCKETS] as const).map((b) => (
              <Button
                key={b}
                size="sm"
                variant={filter === b ? "default" : "outline"}
                onClick={() => setFilter(b)}
              >
                {b === "all" ? "All" : b.replace("-images", "")} ({stats[b] ?? 0})
              </Button>
            ))}
          </div>
          {selected.size > 0 && (
            <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="ml-auto">
              <Trash2 className="w-4 h-4 mr-1" /> Delete {selected.size}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {query ? "No matches." : "No uploaded images yet."}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filtered.map((m, i) => {
              const key = `${m.bucket}/${m.name}`;
              const isSel = selected.has(key);
              return (
                <div
                  key={key}
                  className={`group relative aspect-square rounded-md border bg-muted overflow-hidden ${isSel ? "ring-2 ring-primary" : ""}`}
                  title={key}
                >
                  <img src={m.url} alt={m.name} className="w-full h-full object-cover" loading="lazy" />
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggleSelect(key)}
                    className="absolute top-2 left-2 w-4 h-4 accent-primary"
                    aria-label="Select"
                  />
                  <span className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                    {m.bucket.replace("-images", "")}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-1.5 flex gap-1 justify-end bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition">
                    <button
                      type="button"
                      onClick={() => setPreview(i)}
                      className="p-1.5 rounded bg-black/70 text-white hover:bg-black"
                      aria-label="Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => copyUrl(m.url)}
                      className="p-1.5 rounded bg-black/70 text-white hover:bg-black"
                      aria-label="Copy URL"
                    >
                      {copied === m.url ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(m)}
                      className="p-1.5 rounded bg-red-600/90 text-white hover:bg-red-600"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {preview !== null && (
        <Lightbox images={urls} index={preview} onClose={() => setPreview(null)} onIndex={setPreview} />
      )}
    </div>
  );
}
