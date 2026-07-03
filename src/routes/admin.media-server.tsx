import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Upload, Copy, Trash2, Eye, Check, Server, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Lightbox } from "@/components/lightbox";
import { getMediaServerConfig } from "@/lib/integrations.functions";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/media-server")({
  head: () => ({ meta: [{ title: "Media Server — Admin" }, { name: "robots", content: "noindex" }] }),
  component: MediaServerPage,
});

type ServerFile = { name: string; size: number; created: string; url: string };

function isVideo(name: string) {
  return /\.(mp4|webm|mov|mkv)$/i.test(name);
}

function MediaServerPage() {
  const getConfig = useServerFn(getMediaServerConfig);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const configQ = useQuery({
    queryKey: ["media-server", "config"],
    queryFn: () => getConfig(),
    retry: false,
  });

  const listQ = useQuery({
    queryKey: ["media-server", "list", configQ.data?.base_url],
    enabled: !!configQ.data,
    queryFn: async (): Promise<ServerFile[]> => {
      const { base_url, api_key } = configQ.data!;
      const res = await fetch(`${base_url}/list`, { headers: { "x-api-key": api_key } });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const body = await res.json();
      return body.files ?? [];
    },
  });

  const filtered = useMemo(() => {
    const files = listQ.data ?? [];
    if (!query.trim()) return files;
    const q = query.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [listQ.data, query]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !configQ.data) return;
    const { base_url, api_key } = configQ.data;
    const arr = Array.from(files);
    setUploading({ done: 0, total: arr.length });
    let ok = 0;
    for (let i = 0; i < arr.length; i++) {
      try {
        const fd = new FormData();
        fd.append("file", arr[i]);
        const res = await fetch(`${base_url}/upload`, {
          method: "POST",
          headers: { "x-api-key": api_key },
          body: fd,
        });
        if (!res.ok) throw new Error(`${arr[i].name}: ${res.status}`);
        ok++;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
      setUploading({ done: i + 1, total: arr.length });
    }
    setUploading(null);
    if (ok > 0) toast.success(`Uploaded ${ok}/${arr.length}`);
    qc.invalidateQueries({ queryKey: ["media-server", "list"] });
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete ${name}?`) || !configQ.data) return;
    const { base_url, api_key } = configQ.data;
    const res = await fetch(`${base_url}/files/${encodeURIComponent(name)}`, {
      method: "DELETE",
      headers: { "x-api-key": api_key },
    });
    if (!res.ok) return toast.error(`Delete failed (${res.status})`);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["media-server", "list"] });
  }

  async function handleBulkDelete() {
    if (selected.size === 0 || !configQ.data) return;
    if (!confirm(`Delete ${selected.size} file(s)?`)) return;
    const { base_url, api_key } = configQ.data;
    for (const name of selected) {
      await fetch(`${base_url}/files/${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: { "x-api-key": api_key },
      }).catch(() => null);
    }
    setSelected(new Set());
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["media-server", "list"] });
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

  function toggleSelect(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  if (configQ.isLoading) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…
      </div>
    );
  }

  if (configQ.error || !configQ.data) {
    return (
      <Card className="p-8 max-w-xl text-center space-y-3">
        <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground" />
        <h2 className="text-lg font-semibold">Media Server not configured</h2>
        <p className="text-sm text-muted-foreground">
          Add your Base URL and API Key in Integrations first.
        </p>
        <Button asChild><Link to="/admin/integrations">Go to Integrations</Link></Button>
      </Card>
    );
  }

  const previewUrls = filtered.map((f) => f.url);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Server className="w-7 h-7" /> Media Server
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            External upload server ({configQ.data.base_url}). Videos over 1080p / 8Mbps auto-transcode.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={!!uploading}>
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-1" /> {uploading.done}/{uploading.total}</>
            ) : (
              <><Upload className="w-4 h-4 mr-1" /> Upload</>
            )}
          </Button>
          <Button variant="outline" onClick={() => listQ.refetch()} disabled={listQ.isFetching}>
            {listQ.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-4">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
          className="border-2 border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground hover:bg-muted/30 transition cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          Drag & drop images or videos here, or click to browse.
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search filename…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-56 h-9"
          />
          <span className="text-xs text-muted-foreground">
            {filtered.length} file{filtered.length === 1 ? "" : "s"}
          </span>
          {selected.size > 0 && (
            <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="ml-auto">
              <Trash2 className="w-4 h-4 mr-1" /> Delete {selected.size}
            </Button>
          )}
        </div>

        {listQ.isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…
          </div>
        ) : listQ.error ? (
          <p className="py-8 text-center text-sm text-destructive">
            {(listQ.error as Error).message}
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {query ? "No matches." : "No files uploaded yet."}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filtered.map((m, i) => {
              const isSel = selected.has(m.name);
              const video = isVideo(m.name);
              return (
                <div
                  key={m.name}
                  className={`group relative aspect-square rounded-md border bg-muted overflow-hidden ${isSel ? "ring-2 ring-primary" : ""}`}
                  title={`${m.name} • ${(m.size / 1024 / 1024).toFixed(1)} MB`}
                >
                  {video ? (
                    <video src={m.url} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img src={m.url} alt={m.name} className="w-full h-full object-cover" loading="lazy" />
                  )}
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggleSelect(m.name)}
                    className="absolute top-2 left-2 w-4 h-4 accent-primary"
                    aria-label="Select"
                  />
                  {video && (
                    <span className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                      video
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-1.5 flex gap-1 justify-end bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition">
                    {!video && (
                      <button type="button" onClick={() => setPreview(i)}
                        className="p-1.5 rounded bg-black/70 text-white hover:bg-black" aria-label="Preview">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button type="button" onClick={() => copyUrl(m.url)}
                      className="p-1.5 rounded bg-black/70 text-white hover:bg-black" aria-label="Copy URL">
                      {copied === m.url ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button type="button" onClick={() => handleDelete(m.name)}
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

      {preview !== null && (
        <Lightbox
          images={previewUrls.filter((_, i) => !isVideo(filtered[i].name))}
          index={preview}
          onClose={() => setPreview(null)}
          onIndex={setPreview}
        />
      )}
    </div>
  );
}
