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
  const [uploading, setUploading] = useState<"hero" | "overlay" | null>(null);

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
      const s = settings as { hero_image?: string | null; hero_3d_overlay_image?: string | null };
      setHeroImageUrl(s.hero_image ?? "");
      setOverlayImageUrl(s.hero_3d_overlay_image ?? "");
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { hero_image: heroImageUrl || null, hero_3d_overlay_image: overlayImageUrl || null };
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

  async function handleUpload(kind: "hero" | "overlay", file: File) {
    try {
      setUploading(kind);
      const url = await uploadImage("hero-images", file);
      if (kind === "hero") setHeroImageUrl(url);
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

      <Card className="p-6 space-y-6 shadow-card">
        <HeroUpload
          label="Hero image (left container)"
          hint="Portrait 3:4 recommended. Background model image."
          url={heroImageUrl}
          onUrlChange={setHeroImageUrl}
          onFile={(f) => handleUpload("hero", f)}
          busy={uploading === "hero"}
        />

        <HeroUpload
          label="Hero 3D Overlay (Transparent PNG)"
          hint="Transparent PNG layered on top of the hero. Will extend below into the marquee/CTA area."
          url={overlayImageUrl}
          onUrlChange={setOverlayImageUrl}
          onFile={(f) => handleUpload("overlay", f)}
          busy={uploading === "overlay"}
        />


        <div className="flex justify-end">
          <Button variant="luxe" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save
          </Button>
        </div>
      </Card>
    </div>
  );
}
