import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";
import heroHand from "@/assets/hero-hand.png.asset.json";
import heroMain from "@/assets/hero-main.png.asset.json";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const [marquee, setMarquee] = useState("");
  const [hero, setHero] = useState<string | null>(null);
  const [overlayLeft, setOverlayLeft] = useState<string | null>(null);
  const [overlayRight, setOverlayRight] = useState<string | null>(null);
  const [resetDate, setResetDate] = useState("");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

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
      setMarquee(settings.marquee_text);
      setHero(settings.hero_image);
      setOverlayLeft(settings.hero_overlay_left);
      setOverlayRight(settings.hero_overlay_right);
      setResetDate(settings.timer_reset_date?.slice(0, 16) ?? "");
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        marquee_text: marquee,
        hero_image: hero,
        hero_overlay_left: overlayLeft,
        hero_overlay_right: overlayRight,
        timer_reset_date: resetDate ? new Date(resetDate).toISOString() : new Date().toISOString(),
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
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["admin", "site_settings"] });
      qc.invalidateQueries({ queryKey: ["storefront"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleUpload(key: "hero" | "left" | "right", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingKey(key);
    try {
      const url = await uploadImage("hero-images", file);
      if (key === "hero") setHero(url);
      if (key === "left") setOverlayLeft(url);
      if (key === "right") setOverlayRight(url);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingKey(null);
    }
  }

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>;
  }

  const slots: { key: "hero" | "left" | "right"; label: string; value: string | null; setter: (v: string | null) => void; hint: string }[] = [
    { key: "hero", label: "Hero background image (optional)", value: hero, setter: setHero, hint: "Optional background image layered behind the hero. Leave empty for a clean brand-colored hero." },
    { key: "left", label: "Marquee overlay — left", value: overlayLeft, setter: setOverlayLeft, hint: "Floats over the left side of the marquee banner. PNG with transparency works best." },
    { key: "right", label: "Marquee overlay — right", value: overlayRight, setter: setOverlayRight, hint: "Floats over the right side of the marquee banner. PNG with transparency works best." },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Site Settings</h1>
        <p className="text-muted-foreground mt-1">Storefront hero, marquee, overlays, and countdown timer.</p>
      </div>

      <HeroPreview marquee={marquee} hero={hero} overlayLeft={overlayLeft} overlayRight={overlayRight} />

      <Card className="p-6 space-y-5 shadow-card">
        <div>
          <Label htmlFor="marquee">Marquee text</Label>
          <Input id="marquee" value={marquee} onChange={(e) => setMarquee(e.target.value)} className="mt-1" placeholder="Free delivery on orders over ৳ 2000" />
          <p className="text-xs text-muted-foreground mt-1">Shown as the scrolling announcement at the top of the storefront.</p>
        </div>

        {slots.map((slot) => (
          <div key={slot.key}>
            <Label>{slot.label}</Label>
            <div className="mt-2 flex items-center gap-3">
              {slot.value ? (
                <div className="relative">
                  <img src={slot.value} alt="" className="w-48 h-28 rounded-lg object-cover border bg-muted" />
                  <button onClick={() => slot.setter(null)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="w-48 h-28 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-muted/50">
                  {uploadingKey === slot.key ? <Loader2 className="w-5 h-5 animate-spin" /> : <div className="text-center"><Upload className="w-5 h-5 text-muted-foreground mx-auto" /><div className="text-xs text-muted-foreground mt-1">Upload</div></div>}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(slot.key, e)} disabled={uploadingKey !== null} />
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{slot.hint}</p>
          </div>
        ))}

        <div>
          <Label htmlFor="reset">Countdown timer reset</Label>
          <Input id="reset" type="datetime-local" value={resetDate} onChange={(e) => setResetDate(e.target.value)} className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1">The storefront promo countdown resets from this moment.</p>
        </div>

        <div className="flex justify-end">
          <Button variant="luxe" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save settings
          </Button>
        </div>
      </Card>
    </div>
  );
}
