import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Upload, Copy, Trash2, Eye, Check, Images } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";
import { Lightbox } from "@/components/lightbox";
import { getMediaServerConfig } from "@/lib/integrations.functions";

export const Route = createFileRoute("/admin/media")({
  head: () => ({ meta: [{ title: "Media Library — Admin" }, { name: "robots", content: "noindex" }] }),
  component: MediaLibraryPage,
});

const BUCKETS = ["hero-images", "product-images", "combo-images", "review-images"] as const;
const MEDIA_SERVER = "media-server" as const;
type Source = typeof BUCKETS[number] | typeof MEDIA_SERVER;
const SIGN_TTL = 60 * 60 * 24 * 365 * 10;

type MediaItem = {
  name: string;
  url: string;
  source: Source;
  kind: "image" | "video";
  size?: number;
  created_at?: string | null;
};

function isVideo(name: string) {
  return /\.(mp4|webm|mov|mkv|m4v)$/i.test(name);
}

async function loadBucket(bucket: typeof BUCKETS[number]): Promise<MediaItem[]> {
  const { data: files, error } = await supabase.storage
    .from(bucket)
    .list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
  if (error) return [];
  const entries = (files ?? []).filter((f) => f.name && !f.name.startsWith("."));
  const names = entries.map((f) => f.name);
  if (names.length === 0) return [];
  const { data: signed } = await supabase.storage.from(bucket).createSignedUrls(names, SIGN_TTL);
  return (signed ?? [])
    .map((s, i) => ({
      name: names[i],
      url: s.signedUrl ?? "",
      source: bucket as Source,
      kind: isVideo(names[i]) ? ("video" as const) : ("image" as const),
      created_at: entries[i].created_at,
    }))
    .filter((m) => m.url);
}

async function loadMediaServer(cfg: { base_url: string; api_key: string } | null): Promise<MediaItem[]> {
  if (!cfg) return [];
  try {
    const res = await fetch(`${cfg.base_url}/list`, { headers: { "x-api-key": cfg.api_key } });
    if (!res.ok) return [];
    const body = (await res.json()) as { files?: { name: string; url: string; size: number; created: string }[] };
    return (body.files ?? []).map((f) => ({
      name: f.name,
      url: f.url,
      source: MEDIA_SERVER,
      kind: isVideo(f.name) ? "video" : "image",
      size: f.size,
      created_at: f.created,
    }));
  } catch {
    return [];
  }
}

function MediaLibraryPage() {
  const [filter, setFilter] = useState<"all" | Source>("all");
  const [query, setQuery] = useState("");
  const [uploadTo, setUploadTo] = useState<Source>("product-images");
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const getCfg = useServerFn(getMediaServerConfig);

  const cfgQ = useQuery({
    queryKey: ["media-server", "config"],
    queryFn: () => getCfg().catch(() => null),
    retry: false,
  });
  const mediaServerCfg = cfgQ.data ?? null;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["media", "unified", !!mediaServerCfg],
    queryFn: async (): Promise<MediaItem[]> => {
      const results = await Promise.all([
        ...BUCKETS.map((b) => loadBucket(b)),
        loadMediaServer(mediaServerCfg),
      ]);
      return results.flat();
    },
  });

  const filtered = useMemo(
    () =>
      (data ?? [])
        .filter((m) => filter === "all" || m.source === filter)
        .filter((m) => !query.trim() || m.name.toLowerCase().includes(query.toLowerCase())),
    [data, filter, query],
  );

  const stats = useMemo(() => {
    const s: Record<string, number> = { all: (data ?? []).length };
    for (const b of BUCKETS) s[b] = (data ?? []).filter((m) => m.source === b).length;
    s[MEDIA_SERVER] = (data ?? []).filter((m) => m.source === MEDIA_SERVER).length;
    return s;
  }, [data]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (uploadTo === MEDIA_SERVER && !mediaServerCfg) {
      return toast.error("Media server not configured. Set it up in Integrations.");
    }
    const arr = Array.from(files);
    setUploading({ done: 0, total: arr.length });
    let ok = 0;
    for (let i = 0; i < arr.length; i++) {
      try {
        if (uploadTo === MEDIA_SERVER) {
          const fd = new FormData();
          fd.append("file", arr[i]);
          const res = await fetch(`${mediaServerCfg!.base_url}/upload`, {
            method: "POST",
            headers: { "x-api-key": mediaServerCfg!.api_key },
            body: fd,
          });
          if (!res.ok) throw new Error(`${arr[i].name}: ${res.status}`);
        } else {
          await uploadImage(uploadTo, arr[i]);
        }
        ok++;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
      setUploading({ done: i + 1, total: arr.length });
    }
    setUploading(null);
    if (ok > 0) toast.success(`Uploaded ${ok}/${arr.length} to ${uploadTo}`);
    qc.invalidateQueries({ queryKey: ["media", "unified"] });
  }

  async function deleteOne(item: MediaItem): Promise<boolean> {
    if (item.source === MEDIA_SERVER) {
      if (!mediaServerCfg) return false;
      const res = await fetch(`${mediaServerCfg.base_url}/files/${encodeURIComponent(item.name)}`, {
        method: "DELETE",
        headers: { "x-api-key": mediaServerCfg.api_key },
      });
      return res.ok;
    }
    const { error } = await supabase.storage.from(item.source).remove([item.name]);
    if (error) toast.error(error.message);
    return !error;
  }

  async function handleDelete(item: MediaItem) {
    if (!confirm(`Delete ${item.name}?`)) return;
    const ok = await deleteOne(item);
    if (ok) toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["media", "unified"] });
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected file(s)?`)) return;
    const items = (data ?? []).filter((m) => selected.has(`${m.source}/${m.name}`));
    for (const it of items) await deleteOne(it);
    toast.success("Deleted");
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["media", "unified"] });
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

  const previewables = filtered.filter((m) => m.kind === "image");
  const previewUrls = previewables.map((m) => m.url);

  const sourceLabel = (s: Source) => (s === MEDIA_SERVER ? "server" : s.replace("-images", ""));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Images className="w-7 h-7" /> Media Library
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Unified view of all uploads across Cloud storage and the external media server.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={uploadTo}
            onChange={(e) => setUploadTo(e.target.value as Source)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            title="Upload destination"
          >
            <optgroup label="Cloud storage">
              {BUCKETS.map((b) => <option key={b} value={b}>{b}</option>)}
            </optgroup>
            <optgroup label="External">
              <option value={MEDIA_SERVER} disabled={!mediaServerCfg}>
                media-server {mediaServerCfg ? "" : "(not configured)"}
              </option>
            </optgroup>
          </select>
          <input
            ref={fileRef}
            type="file"
            accept={uploadTo === MEDIA_SERVER ? "image/*,video/*" : "image/*"}
            multiple
            className="hidden"
            onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={!!uploading}>
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> {uploading.done}/{uploading.total}</>
              : <><Upload className="w-4 h-4 mr-1" /> Upload</>}
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>
      </div>

      {!mediaServerCfg && (
        <p className="text-xs text-muted-foreground">
          External media server not connected.{" "}
          <Link to="/admin/integrations" className="underline">Configure it in Integrations</Link>{" "}
          to upload big videos and see them here.
        </p>
      )}

      <Card className="p-4 space-y-4">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
          className="border-2 border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground hover:bg-muted/30 transition cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          Drag & drop files here, or click to browse. Uploading to <b>{uploadTo}</b>.
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search filename…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-56 h-9"
          />
          <div className="flex flex-wrap gap-1">
            {(["all", ...BUCKETS, MEDIA_SERVER] as const).map((b) => (
              <Button
                key={b}
                size="sm"
                variant={filter === b ? "default" : "outline"}
                onClick={() => setFilter(b as "all" | Source)}
              >
                {b === "all" ? "All" : sourceLabel(b as Source)} ({stats[b] ?? 0})
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
            {query ? "No matches." : "No uploaded files yet."}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filtered.map((m) => {
              const key = `${m.source}/${m.name}`;
              const isSel = selected.has(key);
              const previewIdx = m.kind === "image" ? previewables.findIndex((p) => p.url === m.url) : -1;
              return (
                <div
                  key={key}
                  className={`group relative aspect-square rounded-md border bg-muted overflow-hidden ${isSel ? "ring-2 ring-primary" : ""}`}
                  title={key}
                >
                  {m.kind === "video" ? (
                    <video src={m.url} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img src={m.url} alt={m.name} className="w-full h-full object-cover" loading="lazy" />
                  )}
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggleSelect(key)}
                    className="absolute top-2 left-2 w-4 h-4 accent-primary"
                    aria-label="Select"
                  />
                  <span className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                    {sourceLabel(m.source)}{m.kind === "video" ? " • vid" : ""}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-1.5 flex gap-1 justify-end bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition">
                    {previewIdx >= 0 && (
                      <button type="button" onClick={() => setPreview(previewIdx)}
                        className="p-1.5 rounded bg-black/70 text-white hover:bg-black" aria-label="Preview">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button type="button" onClick={() => copyUrl(m.url)}
                      className="p-1.5 rounded bg-black/70 text-white hover:bg-black" aria-label="Copy URL">
                      {copied === m.url ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button type="button" onClick={() => handleDelete(m)}
                      className="p-1.5 rounded bg-red-600/90 text-white hover:bg-red-600" aria-label="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {preview !== null && previewUrls.length > 0 && (
        <Lightbox images={previewUrls} index={preview} onClose={() => setPreview(null)} onIndex={setPreview} />
      )}
    </div>
  );
}
