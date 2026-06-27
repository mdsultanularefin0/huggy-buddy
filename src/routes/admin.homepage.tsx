import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";

export const Route = createFileRoute("/admin/homepage")({ component: HomepagePage });

const NONE = "__none__";

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function HomepagePage() {
  const qc = useQueryClient();
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [heroOverlayUrl, setHeroOverlayUrl] = useState("");
  const [marqueeText, setMarqueeText] = useState("");
  const [flashTitle, setFlashTitle] = useState("");
  const [flashEnabled, setFlashEnabled] = useState(true);
  const [autoReset, setAutoReset] = useState(false);
  const [durationDays, setDurationDays] = useState(7);
  const [timerEndLocal, setTimerEndLocal] = useState("");
  const [catIds, setCatIds] = useState<(string | null)[]>([null, null, null, null]);
  const [uploading, setUploading] = useState<null | "hero" | "overlay">(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "site_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "categories", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, is_active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!settings) return;
    const s = settings as Record<string, unknown>;
    setHeroImageUrl((s.hero_image as string) ?? "");
    setHeroOverlayUrl((s.hero_overlay_image as string) ?? "");
    setMarqueeText((s.marquee_text as string) ?? "");
    setFlashTitle((s.flash_timer_title as string) ?? "");
    setFlashEnabled((s.flash_timer_enabled as boolean) ?? true);
    setAutoReset((s.flash_timer_auto_reset as boolean) ?? false);
    setDurationDays((s.flash_timer_duration_days as number) ?? 7);
    setTimerEndLocal(toLocalInput(s.timer_reset_date as string | null));
    const ids = ((s.homepage_category_ids as string[]) ?? []).slice(0, 4);
    setCatIds([0, 1, 2, 3].map((i) => ids[i] ?? null));
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        hero_image: heroImageUrl || null,
        hero_overlay_image: heroOverlayUrl || null,
        marquee_text: marqueeText,
        flash_timer_title: flashTitle,
        flash_timer_enabled: flashEnabled,
        flash_timer_auto_reset: autoReset,
        flash_timer_duration_days: Math.max(1, Math.floor(durationDays || 1)),
        timer_reset_date: timerEndLocal ? new Date(timerEndLocal).toISOString() : new Date().toISOString(),
        homepage_category_ids: catIds.filter((id): id is string => Boolean(id)),
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
      qc.invalidateQueries({ queryKey: ["public", "categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleUpload(file: File, kind: "hero" | "overlay") {
    try {
      setUploading(kind);
      const url = await uploadImage("hero-images", file);
      if (kind === "hero") setHeroImageUrl(url);
      else setHeroOverlayUrl(url);
      toast.success("Image uploaded — click Save to apply");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(null);
    }
  }

  function setSlot(i: number, value: string) {
    setCatIds((prev) => prev.map((v, idx) => (idx === i ? (value === NONE ? null : value) : v)));
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
              {uploading === "hero" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>Upload</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "hero"); e.target.value = ""; }}
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">Portrait 3:4 recommended. Shown in the left hero container on the homepage.</p>
        </div>

        <div className="space-y-2">
          <Label>Hero overlay image (transparent layer on top)</Label>
          <div className="rounded-lg border flex items-center justify-center bg-[conic-gradient(at_top_left,_#eee_25%,_#fff_0,_#fff_50%,_#eee_0,_#eee_75%,_#fff_0)] bg-[length:16px_16px] h-64 overflow-hidden">
            {heroOverlayUrl ? (
              <img src={heroOverlayUrl} alt="Hero overlay" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">No overlay</span>
            )}
          </div>
          <div className="flex gap-2">
            <Input value={heroOverlayUrl} onChange={(e) => setHeroOverlayUrl(e.target.value)} placeholder="Overlay image URL" className="flex-1" />
            <label className="inline-flex items-center gap-1 cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-muted">
              {uploading === "overlay" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>Upload</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "overlay"); e.target.value = ""; }}
              />
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-3 shadow-card">
        <div>
          <h2 className="text-lg font-semibold">Homepage categories</h2>
          <p className="text-xs text-muted-foreground">Pick up to 4 categories shown in the hero grid. Leave a slot empty for "Coming soon".</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {catIds.map((id, i) => (
            <div key={i} className="space-y-1">
              <Label className="text-xs">Slot {i + 1}</Label>
              <Select value={id ?? NONE} onValueChange={(v) => setSlot(i, v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— Empty —</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{!c.is_active ? " (inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 space-y-3 shadow-card">
        <div>
          <h2 className="text-lg font-semibold">Marquee banner</h2>
          <p className="text-xs text-muted-foreground">Scrolling text shown across the hero divider.</p>
        </div>
        <Textarea value={marqueeText} onChange={(e) => setMarqueeText(e.target.value)} rows={2} placeholder="Banner text" />
      </Card>

      <Card className="p-6 space-y-4 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Flash sale timer</h2>
            <p className="text-xs text-muted-foreground">Counts down to the end date. When auto-reset is on, it restarts for the chosen number of days.</p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="flash-enabled" className="text-sm">Enabled</Label>
            <Switch id="flash-enabled" checked={flashEnabled} onCheckedChange={setFlashEnabled} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={flashTitle} onChange={(e) => setFlashTitle(e.target.value)} placeholder="Flash Sale! Up to 200Tk Off!" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>End date & time</Label>
            <Input type="datetime-local" value={timerEndLocal} onChange={(e) => setTimerEndLocal(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Duration (days)</Label>
            <Input
              type="number"
              min={1}
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value) || 1)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label htmlFor="auto-reset" className="text-sm">Auto reset</Label>
            <p className="text-xs text-muted-foreground">When the timer hits zero, automatically restart for the duration above (default 7 days).</p>
          </div>
          <Switch id="auto-reset" checked={autoReset} onCheckedChange={setAutoReset} />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const end = new Date(Date.now() + (durationDays || 7) * 86_400_000);
              const pad = (n: number) => String(n).padStart(2, "0");
              setTimerEndLocal(
                `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`,
              );
            }}
          >
            Set end to now + {durationDays || 7} days
          </Button>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button variant="luxe" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save
        </Button>
      </div>
    </div>
  );
}
