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

type Note = { title: string; gradient: string; link?: string };
type Whisper = { quote: string; name: string; tag?: string };
type Faq = { q: string; a: string };

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
  // Whispers
  const [whispersTitle, setWhispersTitle] = useState("");
  const [whispers, setWhispers] = useState<Whisper[]>([]);
  // FAQs
  const [faqsTitle, setFaqsTitle] = useState("");
  const [faqs, setFaqs] = useState<Faq[]>([]);

  type UploadKind = "hero" | "overlay" | "art" | "banner" | "signature";
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
    setFaqsTitle((s.faqs_title as string) ?? "");
    setFaqs(((s.faqs_json as Faq[] | null) ?? []) as Faq[]);
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
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
        whispers_json: whispers,
        faqs_title: faqsTitle,
        faqs_json: faqs,
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
        <TabsList className="grid grid-cols-3 sm:grid-cols-7 w-full h-auto">
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="banner">Banner</TabsTrigger>
          <TabsTrigger value="signature">Signature</TabsTrigger>
          <TabsTrigger value="art">Art</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="whispers">Whispers</TabsTrigger>
          <TabsTrigger value="faqs">FAQs</TabsTrigger>
        </TabsList>

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
            {notes.map((n, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Title</Label>
                    <Input value={n.title} onChange={(e) => setNotes((arr) => arr.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Link</Label>
                    <Input value={n.link ?? ""} onChange={(e) => setNotes((arr) => arr.map((x, j) => j === i ? { ...x, link: e.target.value } : x))} placeholder="/products" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tailwind gradient (e.g. <code>from-pink-300 to-purple-300</code>)</Label>
                  <Input value={n.gradient} onChange={(e) => setNotes((arr) => arr.map((x, j) => j === i ? { ...x, gradient: e.target.value } : x))} />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setNotes((arr) => arr.filter((_, j) => j !== i))}>
                    <Trash2 className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        </TabsContent>

        {/* WHISPERS */}
        <TabsContent value="whispers" className="mt-4 space-y-4">
          <Card className="p-6 space-y-3 shadow-card">
            <div className="space-y-2">
              <Label>Section title</Label>
              <Input value={whispersTitle} onChange={(e) => setWhispersTitle(e.target.value)} />
            </div>
          </Card>
          <Card className="p-6 space-y-3 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Testimonials</h3>
              <Button size="sm" variant="outline" onClick={() => setWhispers((w) => [...w, { quote: "", name: "", tag: "" }])}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            {whispers.length === 0 ? <p className="text-xs text-muted-foreground">No testimonials yet.</p> : null}
            {whispers.map((w, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Quote</Label>
                  <Textarea rows={2} value={w.quote} onChange={(e) => setWhispers((arr) => arr.map((x, j) => j === i ? { ...x, quote: e.target.value } : x))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input value={w.name} onChange={(e) => setWhispers((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tag</Label>
                    <Input value={w.tag ?? ""} onChange={(e) => setWhispers((arr) => arr.map((x, j) => j === i ? { ...x, tag: e.target.value } : x))} placeholder="Verified Buyer · …" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setWhispers((arr) => arr.filter((_, j) => j !== i))}>
                    <Trash2 className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        </TabsContent>

        {/* FAQS */}
        <TabsContent value="faqs" className="mt-4 space-y-4">
          <Card className="p-6 space-y-3 shadow-card">
            <div className="space-y-2">
              <Label>Section title</Label>
              <Input value={faqsTitle} onChange={(e) => setFaqsTitle(e.target.value)} />
            </div>
          </Card>
          <Card className="p-6 space-y-3 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Questions</h3>
              <Button size="sm" variant="outline" onClick={() => setFaqs((f) => [...f, { q: "", a: "" }])}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            {faqs.length === 0 ? <p className="text-xs text-muted-foreground">No FAQs yet.</p> : null}
            {faqs.map((f, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Question</Label>
                  <Input value={f.q} onChange={(e) => setFaqs((arr) => arr.map((x, j) => j === i ? { ...x, q: e.target.value } : x))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Answer</Label>
                  <Textarea rows={3} value={f.a} onChange={(e) => setFaqs((arr) => arr.map((x, j) => j === i ? { ...x, a: e.target.value } : x))} />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setFaqs((arr) => arr.filter((_, j) => j !== i))}>
                    <Trash2 className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
