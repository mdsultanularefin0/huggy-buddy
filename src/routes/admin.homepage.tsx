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
import { Loader2, Upload, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";
import { MediaPicker } from "@/components/media-picker";
import { saveFaqs } from "@/lib/content.functions";

export const Route = createFileRoute("/admin/homepage")({ component: HomepagePage });

const NONE = "__none__";

type Note = { title: string; gradient: string; link?: string; image?: string; bg?: string };
type Faq = { q: string; a: string };
type Reel = { url: string; caption?: string; link?: string };
type Whisper = { quote: string; name: string; tag?: string; rating?: number };

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function HomepagePage() {
  const qc = useQueryClient();
  // Hero
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [heroOverlayUrl, setHeroOverlayUrl] = useState("");
  // Banner
  const [marqueeText, setMarqueeText] = useState("");
  const [bannerImage, setBannerImage] = useState("");
  // Timer
  const [flashTitle, setFlashTitle] = useState("");
  const [flashEnabled, setFlashEnabled] = useState(true);
  const [autoReset, setAutoReset] = useState(false);
  const [durationDays, setDurationDays] = useState(7);
  const [timerEndLocal, setTimerEndLocal] = useState("");
  // Signature
  const [catIds, setCatIds] = useState<(string | null)[]>([null, null, null, null]);
  const [signatureTitle, setSignatureTitle] = useState("");
  const [signatureSubtitle, setSignatureSubtitle] = useState("");
  const [signatureImage, setSignatureImage] = useState("");
  // Art of Veloura
  const [artEyebrow, setArtEyebrow] = useState("");
  const [artTitle, setArtTitle] = useState("");
  const [artBody, setArtBody] = useState("");
  const [artButtonLabel, setArtButtonLabel] = useState("");
  const [artButtonLink, setArtButtonLink] = useState("");
  const [artImage, setArtImage] = useState("");
  // Notes
  const [notesTitle, setNotesTitle] = useState("");
  const [notesSubtitle, setNotesSubtitle] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  // Whispers (title + optional custom items; real product reviews are merged on the homepage)
  const [whispersTitle, setWhispersTitle] = useState("");
  const [whispers, setWhispers] = useState<Whisper[]>([]);
  // Reels (9:16 embeds)
  const [reelsTitle, setReelsTitle] = useState("");
  const [reelsEnabled, setReelsEnabled] = useState(true);
  const [reels, setReels] = useState<Reel[]>([]);
  // FAQs
  const [faqsTitle, setFaqsTitle] = useState("");
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [faqsEnabled, setFaqsEnabled] = useState(true);
  // Section enable toggles
  const [heroEnabled, setHeroEnabled] = useState(true);
  const [bannerEnabled, setBannerEnabled] = useState(true);
  const [signatureEnabled, setSignatureEnabled] = useState(true);
  const [artEnabled, setArtEnabled] = useState(true);
  const [notesEnabled, setNotesEnabled] = useState(true);
  const [whispersEnabled, setWhispersEnabled] = useState(true);


  type UploadKind = "hero" | "overlay" | "art" | "banner" | "signature" | `note-${number}`;
  const [uploading, setUploading] = useState<null | UploadKind>(null);


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
    setBannerImage((s.banner_image as string) ?? "");
    setFlashTitle((s.flash_timer_title as string) ?? "");
    setFlashEnabled((s.flash_timer_enabled as boolean) ?? true);
    setAutoReset((s.flash_timer_auto_reset as boolean) ?? false);
    setDurationDays((s.flash_timer_duration_days as number) ?? 7);
    setTimerEndLocal(toLocalInput(s.timer_reset_date as string | null));
    const ids = ((s.homepage_category_ids as string[]) ?? []).slice(0, 4);
    setCatIds([0, 1, 2, 3].map((i) => ids[i] ?? null));
    setSignatureTitle((s.signature_title as string) ?? "");
    setSignatureSubtitle((s.signature_subtitle as string) ?? "");
    setSignatureImage((s.signature_image as string) ?? "");

    setArtEyebrow((s.art_eyebrow as string) ?? "");
    setArtTitle((s.art_title as string) ?? "");
    setArtBody((s.art_body as string) ?? "");
    setArtButtonLabel((s.art_button_label as string) ?? "");
    setArtButtonLink((s.art_button_link as string) ?? "");
    setArtImage((s.art_image as string) ?? "");
    setNotesTitle((s.notes_title as string) ?? "");
    setNotesSubtitle((s.notes_subtitle as string) ?? "");
    setNotes(((s.notes_json as Note[] | null) ?? []) as Note[]);
    setWhispersTitle((s.whispers_title as string) ?? "");
    setWhispers(((s.whispers_json as Whisper[] | null) ?? []) as Whisper[]);
    setReelsTitle((s.reels_title as string) ?? "");
    setReelsEnabled((s.reels_enabled as boolean) ?? true);
    setReels(((s.reels_json as Reel[] | null) ?? []) as Reel[]);
    setFaqsTitle((s.faqs_title as string) ?? "");
    setFaqs(((s.faqs_json as Faq[] | null) ?? []) as Faq[]);
    setFaqsEnabled((s.faqs_enabled as boolean) ?? true);
    setHeroEnabled((s.hero_enabled as boolean) ?? true);
    setBannerEnabled((s.banner_enabled as boolean) ?? true);
    setSignatureEnabled((s.signature_enabled as boolean) ?? true);
    setArtEnabled((s.art_enabled as boolean) ?? true);
    setNotesEnabled((s.notes_enabled as boolean) ?? true);
    setWhispersEnabled((s.whispers_enabled as boolean) ?? true);
  }, [settings]);


  const save = useMutation({
    mutationFn: async () => {
      const cleanFaqs = await saveFaqs({ data: { faqs_title: faqsTitle, faqs } });
      const payload = {
        hero_image: heroImageUrl || null,
        hero_overlay_image: heroOverlayUrl || null,
        marquee_text: marqueeText,
        banner_image: bannerImage || null,
        flash_timer_title: flashTitle,
        flash_timer_enabled: flashEnabled,
        flash_timer_auto_reset: autoReset,
        flash_timer_duration_days: Math.max(1, Math.floor(durationDays || 1)),
        timer_reset_date: timerEndLocal ? new Date(timerEndLocal).toISOString() : new Date().toISOString(),
        homepage_category_ids: catIds.filter((id): id is string => Boolean(id)),
        signature_title: signatureTitle,
        signature_subtitle: signatureSubtitle,
        signature_image: signatureImage || null,

        art_eyebrow: artEyebrow,
        art_title: artTitle,
        art_body: artBody,
        art_button_label: artButtonLabel,
        art_button_link: artButtonLink,
        art_image: artImage || null,
        notes_title: notesTitle,
        notes_subtitle: notesSubtitle,
        notes_json: notes,
        whispers_title: whispersTitle,
        whispers_json: whispers
          .map((w) => ({
            quote: (w.quote ?? "").trim(),
            name: (w.name ?? "").trim(),
            tag: (w.tag ?? "").trim() || undefined,
            rating: Math.max(1, Math.min(5, Math.round(w.rating ?? 5))),
          }))
          .filter((w) => w.quote && w.name),
        reels_title: reelsTitle,
        reels_enabled: reelsEnabled,
        reels_json: reels.filter((r) => r.url.trim().length > 0),
        faqs_title: cleanFaqs.faqs_title,
        faqs_json: cleanFaqs.faqs_json,
        faqs_enabled: faqsEnabled,
        hero_enabled: heroEnabled,
        banner_enabled: bannerEnabled,
        signature_enabled: signatureEnabled,
        art_enabled: artEnabled,
        notes_enabled: notesEnabled,
        whispers_enabled: whispersEnabled,

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

  async function handleUpload(file: File, kind: UploadKind) {
    try {
      setUploading(kind);
      const url = await uploadImage("hero-images", file);
      if (kind === "hero") setHeroImageUrl(url);
      else if (kind === "overlay") setHeroOverlayUrl(url);
      else if (kind === "art") setArtImage(url);
      else if (kind === "banner") setBannerImage(url);
      else if (kind === "signature") setSignatureImage(url);
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
      <div className="flex items-start justify-between gap-4 sticky top-0 z-10 bg-background py-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Homepage</h1>
          <p className="text-muted-foreground mt-1">Customize each section of the homepage.</p>
        </div>
        <Button variant="luxe" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save
        </Button>
      </div>

      <Tabs defaultValue="hero" className="w-full">
        <TabsList className="grid grid-cols-3 sm:grid-cols-9 w-full h-auto">
          <TabsTrigger value="visibility">Visibility</TabsTrigger>
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="banner">Banner</TabsTrigger>
          <TabsTrigger value="signature">Signature</TabsTrigger>
          <TabsTrigger value="art">Art</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="whispers">Whispers</TabsTrigger>
          <TabsTrigger value="reels">Reels</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
        </TabsList>

        {/* VISIBILITY */}
        <TabsContent value="visibility" className="mt-4 space-y-4">
          <Card className="p-6 space-y-3 shadow-card">
            <h2 className="text-lg font-semibold">Section visibility</h2>
            <p className="text-xs text-muted-foreground">Toggle which sections appear on the homepage.</p>
            {([
              ["Hero (image + categories + flash timer)", heroEnabled, setHeroEnabled],
              ["Marquee banner", bannerEnabled, setBannerEnabled],
              ["Signature collection", signatureEnabled, setSignatureEnabled],
              ["The Art of Veloura", artEnabled, setArtEnabled],
              ["Scent notes", notesEnabled, setNotesEnabled],
              ["Customer whispers", whispersEnabled, setWhispersEnabled],
              ["Reels", reelsEnabled, setReelsEnabled],
              ["FAQ", faqsEnabled, setFaqsEnabled],
            ] as const).map(([label, value, setter]) => (
              <div key={label} className="flex items-center justify-between border-t pt-3 first:border-t-0 first:pt-0">
                <Label className="text-sm font-normal">{label}</Label>
                <Switch checked={value} onCheckedChange={setter} />
              </div>
            ))}
          </Card>
        </TabsContent>



        {/* HERO */}
        <TabsContent value="hero" className="mt-4 space-y-4">
          <Card className="p-6 space-y-4 shadow-card">
            <div className="space-y-2">
              <Label>Hero image (left container)</Label>
              <div className="rounded-lg border flex items-center justify-center bg-muted h-64 overflow-hidden">
                {heroImageUrl ? <img src={heroImageUrl} alt="Hero" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No image</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Input value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} placeholder="Image URL" className="flex-1 min-w-[200px]" />
                <label className="inline-flex items-center gap-1 cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  {uploading === "hero" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>Upload</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "hero"); e.target.value = ""; }} />
                </label>
                <MediaPicker onPick={setHeroImageUrl} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Hero overlay image</Label>
              <div className="rounded-lg border flex items-center justify-center bg-[conic-gradient(at_top_left,_#eee_25%,_#fff_0,_#fff_50%,_#eee_0,_#eee_75%,_#fff_0)] bg-[length:16px_16px] h-64 overflow-hidden">
                {heroOverlayUrl ? <img src={heroOverlayUrl} alt="Hero overlay" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No overlay</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Input value={heroOverlayUrl} onChange={(e) => setHeroOverlayUrl(e.target.value)} placeholder="Overlay URL" className="flex-1 min-w-[200px]" />
                <label className="inline-flex items-center gap-1 cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  {uploading === "overlay" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>Upload</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "overlay"); e.target.value = ""; }} />
                </label>
                <MediaPicker onPick={setHeroOverlayUrl} />
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Flash sale timer</h2>
                <p className="text-xs text-muted-foreground">Shown inside the hero.</p>
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
                <Input type="number" min={1} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value) || 1)} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="auto-reset" className="text-sm">Auto reset</Label>
                <p className="text-xs text-muted-foreground">Restart for the duration above when it hits zero.</p>
              </div>
              <Switch id="auto-reset" checked={autoReset} onCheckedChange={setAutoReset} />
            </div>
          </Card>
        </TabsContent>

        {/* BANNER */}
        <TabsContent value="banner" className="mt-4 space-y-4">
          <Card className="p-6 space-y-3 shadow-card">
            <div>
              <h2 className="text-lg font-semibold">Marquee banner</h2>
              <p className="text-xs text-muted-foreground">Scrolling text shown across the hero divider.</p>
            </div>
            <Textarea value={marqueeText} onChange={(e) => setMarqueeText(e.target.value)} rows={3} placeholder="Banner text" />
          </Card>
          <Card className="p-6 space-y-3 shadow-card">
            <div>
              <h2 className="text-lg font-semibold">Banner background image</h2>
              <p className="text-xs text-muted-foreground">Optional — replaces the gradient behind the marquee.</p>
            </div>
            <div className="rounded-lg border flex items-center justify-center bg-muted h-40 overflow-hidden">
              {bannerImage ? <img src={bannerImage} alt="Banner" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No image</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Input value={bannerImage} onChange={(e) => setBannerImage(e.target.value)} placeholder="Image URL" className="flex-1 min-w-[200px]" />
              <label className="inline-flex items-center gap-1 cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-muted">
                {uploading === "banner" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>Upload</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "banner"); e.target.value = ""; }} />
              </label>
              <MediaPicker onPick={setBannerImage} />
              {bannerImage ? <Button variant="ghost" size="sm" onClick={() => setBannerImage("")}>Clear</Button> : null}
            </div>
          </Card>
        </TabsContent>

        {/* SIGNATURE */}
        <TabsContent value="signature" className="mt-4 space-y-4">
          <Card className="p-6 space-y-3 shadow-card">
            <h2 className="text-lg font-semibold">Section heading</h2>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={signatureTitle} onChange={(e) => setSignatureTitle(e.target.value)} placeholder="Our Signature Collection" />
            </div>
            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Textarea value={signatureSubtitle} onChange={(e) => setSignatureSubtitle(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Background image</Label>
              <div className="rounded-lg border flex items-center justify-center bg-muted h-40 overflow-hidden">
                {signatureImage ? <img src={signatureImage} alt="Signature" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No image</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Input value={signatureImage} onChange={(e) => setSignatureImage(e.target.value)} placeholder="Image URL" className="flex-1 min-w-[200px]" />
                <label className="inline-flex items-center gap-1 cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  {uploading === "signature" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>Upload</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "signature"); e.target.value = ""; }} />
                </label>
                <MediaPicker onPick={setSignatureImage} />
                {signatureImage ? <Button variant="ghost" size="sm" onClick={() => setSignatureImage("")}>Clear</Button> : null}
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-3 shadow-card">
            <div>
              <h2 className="text-lg font-semibold">Hero category slots</h2>
              <p className="text-xs text-muted-foreground">Up to 4 categories shown in the hero grid.</p>
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
                        <SelectItem key={c.id} value={c.id}>{c.name}{!c.is_active ? " (inactive)" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* ART */}
        <TabsContent value="art" className="mt-4">
          <Card className="p-6 space-y-3 shadow-card">
            <h2 className="text-lg font-semibold">The Art of Veloura</h2>
            <div className="space-y-2">
              <Label>Eyebrow</Label>
              <Input value={artEyebrow} onChange={(e) => setArtEyebrow(e.target.value)} placeholder="Luxury in Every Drop" />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={artTitle} onChange={(e) => setArtTitle(e.target.value)} placeholder="The Art of Veloura" />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea value={artBody} onChange={(e) => setArtBody(e.target.value)} rows={5} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Button label</Label>
                <Input value={artButtonLabel} onChange={(e) => setArtButtonLabel(e.target.value)} placeholder="Discover Our Story" />
              </div>
              <div className="space-y-2">
                <Label>Button link</Label>
                <Input value={artButtonLink} onChange={(e) => setArtButtonLink(e.target.value)} placeholder="/about" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Image</Label>
              <div className="rounded-lg border flex items-center justify-center bg-muted h-48 overflow-hidden">
                {artImage ? <img src={artImage} alt="Art" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No image</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Input value={artImage} onChange={(e) => setArtImage(e.target.value)} placeholder="Image URL" className="flex-1 min-w-[200px]" />
                <label className="inline-flex items-center gap-1 cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  {uploading === "art" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>Upload</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "art"); e.target.value = ""; }} />
                </label>
                <MediaPicker onPick={setArtImage} />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* NOTES */}
        <TabsContent value="notes" className="mt-4 space-y-4">
          <Card className="p-6 space-y-3 shadow-card">
            <h2 className="text-lg font-semibold">Scent notes section</h2>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={notesTitle} onChange={(e) => setNotesTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Textarea value={notesSubtitle} onChange={(e) => setNotesSubtitle(e.target.value)} rows={2} />
            </div>
          </Card>
          <Card className="p-6 space-y-3 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Note cards</h3>
              <Button size="sm" variant="outline" onClick={() => setNotes((n) => [...n, { title: "New Note", gradient: "from-pink-300 to-purple-300", link: "/products" }])}>
                <Plus className="w-4 h-4 mr-1" /> Add card
              </Button>
            </div>
            {notes.length === 0 ? <p className="text-xs text-muted-foreground">No cards yet.</p> : null}
            {notes.map((n, i) => {
              const updateAt = (patch: Partial<Note>) =>
                setNotes((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              const uploadKey = `note-${i}`;
              return (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Title</Label>
                    <Input value={n.title} onChange={(e) => updateAt({ title: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Link</Label>
                    <Input value={n.link ?? ""} onChange={(e) => updateAt({ link: e.target.value })} placeholder="/products" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Background image (optional — overrides color/gradient)</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input value={n.image ?? ""} onChange={(e) => updateAt({ image: e.target.value })} placeholder="https://…" />
                    <input
                      id={`file-${uploadKey}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                          setUploading(uploadKey as UploadKind);
                          const url = await uploadImage("hero-images", f);
                          updateAt({ image: url });
                          toast.success("Uploaded — click Save to apply");
                        } catch (err) {
                          toast.error((err as Error).message);
                        } finally {
                          setUploading(null);
                          e.target.value = "";
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={uploading === uploadKey}
                      onClick={() => document.getElementById(`file-${uploadKey}`)?.click()}
                    >
                      {uploading === uploadKey ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                      Upload
                    </Button>
                    <MediaPicker onPick={(url) => updateAt({ image: url })} />
                    {n.image ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => updateAt({ image: "" })}>
                        Clear
                      </Button>
                    ) : null}
                  </div>
                  {n.image ? (
                    <img src={n.image} alt="" className="mt-1 h-16 w-24 object-cover rounded border" />
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Custom background (color or CSS gradient — overrides Tailwind gradient below)</Label>
                  <ColorPicker
                    value={n.bg ?? ""}
                    onChange={(v) => updateAt({ bg: v })}
                    placeholder="#a555f0  or  linear-gradient(135deg,#a555f0,#52277a)"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tailwind gradient fallback (e.g. <code>from-pink-300 to-purple-300</code>)</Label>
                  <Input value={n.gradient} onChange={(e) => updateAt({ gradient: e.target.value })} />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setNotes((arr) => arr.filter((_, j) => j !== i))}>
                    <Trash2 className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
              </div>
              );
            })}
          </Card>
        </TabsContent>

        {/* WHISPERS */}
        <TabsContent value="whispers" className="mt-4 space-y-4">
          <Card className="p-6 space-y-3 shadow-card">
            <div className="space-y-2">
              <Label>Section title</Label>
              <Input value={whispersTitle} onChange={(e) => setWhispersTitle(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Real product reviews rated 4★ or higher are pulled in automatically (latest first).
              Add custom whispers below to feature alongside them.
            </p>
          </Card>

          <Card className="p-6 space-y-3 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Custom whispers</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setWhispers((w) => [...w, { quote: "", name: "", tag: "", rating: 5 }])}
              >
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            {whispers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No custom whispers yet.</p>
            ) : null}
            {whispers.map((w, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Quote</Label>
                  <Textarea
                    rows={2}
                    value={w.quote}
                    onChange={(e) =>
                      setWhispers((arr) => arr.map((x, j) => (j === i ? { ...x, quote: e.target.value } : x)))
                    }
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={w.name}
                      onChange={(e) =>
                        setWhispers((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tag</Label>
                    <Input
                      value={w.tag ?? ""}
                      onChange={(e) =>
                        setWhispers((arr) => arr.map((x, j) => (j === i ? { ...x, tag: e.target.value } : x)))
                      }
                      placeholder="Verified Buyer · …"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rating (1–5)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={w.rating ?? 5}
                      onChange={(e) =>
                        setWhispers((arr) =>
                          arr.map((x, j) => (j === i ? { ...x, rating: Number(e.target.value) || 5 } : x))
                        )
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setWhispers((arr) => arr.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        </TabsContent>


        {/* REELS */}
        <TabsContent value="reels" className="mt-4 space-y-4">
          <Card className="p-6 space-y-3 shadow-card">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Show reels on homepage</h2>
                <p className="text-xs text-muted-foreground">
                  Embed TikTok, Instagram Reels, or YouTube Shorts in a 9:16 grid.
                </p>
              </div>
              <Switch checked={reelsEnabled} onCheckedChange={setReelsEnabled} />
            </div>
            <div className="space-y-2">
              <Label>Section title</Label>
              <Input value={reelsTitle} onChange={(e) => setReelsTitle(e.target.value)} placeholder="From Our Community" />
            </div>
          </Card>

          <Card className="p-6 space-y-3 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Reels</h3>
              <Button size="sm" variant="outline" onClick={() => setReels((r) => [...r, { url: "", caption: "", link: "" }])}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            {reels.length === 0 ? <p className="text-xs text-muted-foreground">No reels yet.</p> : null}
            {reels.map((r, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Embed URL (TikTok video, Instagram reel, or YouTube Short)</Label>
                  <Input
                    value={r.url}
                    onChange={(e) => setReels((arr) => arr.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
                    placeholder="https://www.tiktok.com/@user/video/1234567890"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Caption (optional)</Label>
                    <Input
                      value={r.caption ?? ""}
                      onChange={(e) => setReels((arr) => arr.map((x, j) => j === i ? { ...x, caption: e.target.value } : x))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Click-through link (optional)</Label>
                    <Input
                      value={r.link ?? ""}
                      onChange={(e) => setReels((arr) => arr.map((x, j) => j === i ? { ...x, link: e.target.value } : x))}
                      placeholder="https://…"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setReels((arr) => arr.filter((_, j) => j !== i))}>
                    <Trash2 className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        </TabsContent>


        {/* FAQ */}
        <TabsContent value="faq" className="mt-4 space-y-4">
          <Card className="p-6 space-y-3 shadow-card">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">FAQ on homepage</h2>
                <p className="text-xs text-muted-foreground">
                  Toggle whether the FAQ section appears on the homepage. Edit the questions in Pages → FAQ.
                </p>
              </div>
              <Switch checked={faqsEnabled} onCheckedChange={setFaqsEnabled} />
            </div>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}
