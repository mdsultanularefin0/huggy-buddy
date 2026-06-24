import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";

export const Route = createFileRoute("/admin/homepage")({ component: HomepagePage });

function HomepagePage() {
  const qc = useQueryClient();
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [overlayImageUrl, setOverlayImageUrl] = useState("");
  const [uploading, setUploading] = useState<null | "hero" | "overlay">(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "site_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      const s = settings as { hero_image?: string | null; hero_overlay_left?: string | null };
      setHeroImageUrl(s.hero_image ?? "");
      setOverlayImageUrl(s.hero_overlay_left ?? "");
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        hero_image: heroImageUrl || null,
        hero_overlay_left: overlayImageUrl || null,
      };
      if (settings?.id) {
        const { error } = await supabase.from("site_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Homepage saved");
      qc.invalidateQueries({ queryKey: ["admin", "site_settings"] });
      qc.invalidateQueries({ queryKey: ["public", "site_settings", "hero"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleUpload(file: File, target: "hero" | "overlay") {
    try {
      setUploading(target);
      const url = await uploadImage("hero-images", file);
      if (target === "hero") setHeroImageUrl(url);
      else setOverlayImageUrl(url);
      toast.success("Image uploaded — click Save to apply");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(null);
    }
  }

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Homepage</h1>
        <p className="text-muted-foreground mt-1">Customize the homepage hero section.</p>
      </div>

      <Card className="p-6 space-y-4 shadow-card">
        <div className="space-y-2">
          <Label>Hero image (left container)</Label>
          <div className="rounded-lg border flex items-center justify-center bg-muted h-64 overflow-hidden">
            {heroImageUrl ? (
              <img src={heroImageUrl} alt="Hero" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">No image</span>
            )}
          </div>
          <div className="flex gap-2">
            <Input value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} placeholder="Image URL" className="flex-1" />
            <label className="inline-flex items-center gap-1 cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-muted">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>Upload</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">Portrait 3:4 recommended. Shown in the left hero container on the homepage.</p>
        </div>

        <div className="flex justify-end">
          <Button variant="luxe" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save
          </Button>
        </div>
      </Card>
    </div>
  );
}
