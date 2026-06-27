import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Images } from "lucide-react";

const BUCKET = "hero-images";
const SIGN_TTL = 60 * 60 * 24 * 365 * 10;

type MediaItem = { name: string; url: string };

export function MediaPicker({ onPick, label = "Library" }: { onPick: (url: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["media", BUCKET],
    enabled: open,
    queryFn: async (): Promise<MediaItem[]> => {
      const { data: files, error } = await supabase.storage
        .from(BUCKET)
        .list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      const names = (files ?? []).filter((f) => f.name && !f.name.startsWith(".")).map((f) => f.name);
      if (names.length === 0) return [];
      const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrls(names, SIGN_TTL);
      if (signErr) throw signErr;
      return (signed ?? [])
        .map((s, i) => ({ name: names[i], url: s.signedUrl }))
        .filter((m): m is MediaItem => !!m.url);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1">
          <Images className="w-4 h-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Media library</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
            </Button>
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…
          </div>
        ) : !data || data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No uploaded images yet.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto p-1">
            {data.map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => { onPick(m.url); setOpen(false); }}
                className="group relative aspect-square rounded-md border bg-muted overflow-hidden hover:ring-2 hover:ring-primary transition"
                title={m.name}
              >
                <img src={m.url} alt={m.name} className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
