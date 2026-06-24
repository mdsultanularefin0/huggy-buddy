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
  const [bgUrl, setBgUrl] = useState("");
  const [fgUrl, setFgUrl] = useState("");
  const [uploading, setUploading] = useState<"bg" | "fg" | null>(null);

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
      const s = settings as { hero_image?: string | null; hero_bg_image?: string | null; hero_fg_image?: string | null };
      setBgUrl(s.hero_bg_image ?? s.hero_image ?? "");
      setFgUrl(s.hero_fg_image ?? "");
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        hero_bg_image: bgUrl || null,
        hero_fg_image: fgUrl || null,
        hero_image: bgUrl || null,
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

  async function handleUpload(file: File, slot: "bg" | "fg") {
    try {
      setUploading(slot);
      const url = await uploadImage("hero-images", file);
      if (slot === "bg") setBgUrl(url);
      else setFgUrl(url);
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

  const slots: Array<{ key: "bg" | "fg"; label: string; value: string; setValue: (v: string) => void; hint: string }> = [
    { key: "bg", label: "Background Model Image", value: bgUrl, setValue: setBgUrl, hint: "Portrait 3:4. Sits behind the marquee banner." },
    { key: "fg", label: "Foreground 3D Overlay (Transparent PNG)", value: fgUrl, setValue: setFgUrl, hint: "Transparent PNG. Sits in front of the marquee banner." },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Homepage</h1>
        <p className="text-muted-foreground mt-1">Customize the homepage hero section.</p>
      </div>

      <Card className="p-6 space-y-6 shadow-card">
        {slots.map((s) => (
          <div key={s.key} className="space-y-2">
            <Label>{s.label}</Label>
            <div className="rounded-lg border flex items-center justify-center bg-muted h-64 overflow-hidden">
              {s.value ? (
                <img src={s.value} alt={s.label} className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">No image</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input value={s.value} onChange={(e) => s.setValue(e.target.value)} placeholder="Image URL" className="flex-1" />
              <label className="inline-flex items-center gap-1 cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-muted">
                {uploading === s.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, s.key); e.target.value = ""; }}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">{s.hint}</p>
          </div>
        ))}

        <div className="flex justify-end">
          <Button variant="luxe" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save
          </Button>
        </div>
      </Card>
    </div>
  );
}
