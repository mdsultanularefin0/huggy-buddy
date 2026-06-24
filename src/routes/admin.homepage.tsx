import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Upload, X, Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";
import type { Database } from "@/integrations/supabase/types";

type Category = Database["public"]["Tables"]["categories"]["Row"];

export const Route = createFileRoute("/admin/homepage")({ component: HomepageEditor });

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

function HomepageEditor() {
  const qc = useQueryClient();

  // ---- site_settings ----
  const [marquee, setMarquee] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [heroCtaLabel, setHeroCtaLabel] = useState("");
  const [hero, setHero] = useState<string | null>(null);
  const [overlayLeft, setOverlayLeft] = useState<string | null>(null);
  const [overlayRight, setOverlayRight] = useState<string | null>(null);
  const [resetDate, setResetDate] = useState("");
  const [headerPosition, setHeaderPosition] = useState<"sticky" | "static" | "floating">("sticky");
  const [ctaText, setCtaText] = useState("");
  const [ctaBtnLabel, setCtaBtnLabel] = useState("");
  const [ctaBtnLink, setCtaBtnLink] = useState("");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["admin", "site_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!settings) return;
    const s = settings as Record<string, unknown>;
    setMarquee((s.marquee_text as string) ?? "");
    setHeroTitle((s.hero_title as string) ?? "");
    setHeroSubtitle((s.hero_subtitle as string) ?? "");
    setHeroCtaLabel((s.hero_cta_label as string) ?? "");
    setHero((s.hero_image as string) ?? null);
    setOverlayLeft((s.hero_overlay_left as string) ?? null);
    setOverlayRight((s.hero_overlay_right as string) ?? null);
    setResetDate(((s.timer_reset_date as string) ?? "").slice(0, 16));
    setHeaderPosition(((s.header_position as "sticky" | "static" | "floating") ?? "sticky"));
    setCtaText((s.cta_band_text as string) ?? "");
    setCtaBtnLabel((s.cta_band_button_label as string) ?? "");
    setCtaBtnLink((s.cta_band_button_link as string) ?? "");
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        marquee_text: marquee,
        hero_image: hero,
        hero_overlay_left: overlayLeft,
        hero_overlay_right: overlayRight,
        hero_title: heroTitle || null,
        hero_subtitle: heroSubtitle || null,
        hero_cta_label: heroCtaLabel || null,
        cta_band_text: ctaText || null,
        cta_band_button_label: ctaBtnLabel || null,
        cta_band_button_link: ctaBtnLink || null,
        header_position: headerPosition,
        timer_reset_date: resetDate ? new Date(resetDate).toISOString() : new Date().toISOString(),
      };
      const existingId = (settings as { id?: string } | null)?.id;
      if (existingId) {
        const { error } = await supabase.from("site_settings").update(payload).eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Homepage saved");
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

  // ---- categories ----
  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({
    name: "",
    slug: "",
    image_url: null as string | null,
    is_active: true,
  });
  const [catUploading, setCatUploading] = useState(false);

  function startNewCat() {
    setEditingCat(null);
    setCatForm({ name: "", slug: "", image_url: null, is_active: true });
    setCatOpen(true);
  }
  function startEditCat(c: Category) {
    setEditingCat(c);
    setCatForm({ name: c.name, slug: c.slug, image_url: c.image_url, is_active: c.is_active });
    setCatOpen(true);
  }

  const saveCat = useMutation({
    mutationFn: async () => {
      const slug = catForm.slug || slugify(catForm.name);
      const payload = {
        name: catForm.name,
        slug,
        image_url: catForm.image_url,
        is_active: catForm.is_active,
      };
      if (editingCat) {
        const { error } = await supabase.from("categories").update(payload).eq("id", editingCat.id);
        if (error) throw error;
      } else {
        const nextOrder = (categories.at(-1)?.sort_order ?? 0) + 1;
        const { error } = await supabase.from("categories").insert({ ...payload, sort_order: nextOrder });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingCat ? "Category updated" : "Category created");
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      qc.invalidateQueries({ queryKey: ["storefront"] });
      setCatOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      qc.invalidateQueries({ queryKey: ["storefront"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderCat = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const idx = categories.findIndex((c) => c.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= categories.length) return;
      const a = categories[idx];
      const b = categories[swapIdx];
      const { error: e1 } = await supabase.from("categories").update({ sort_order: b.sort_order }).eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("categories").update({ sort_order: a.sort_order }).eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      qc.invalidateQueries({ queryKey: ["storefront"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleCatUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCatUploading(true);
    try {
      const url = await uploadImage("hero-images", file);
      setCatForm((f) => ({ ...f, image_url: url }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCatUploading(false);
    }
  }

  if (settingsLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…
      </div>
    );
  }

  const imageSlots: { key: "hero" | "left" | "right"; label: string; value: string | null; setter: (v: string | null) => void; hint: string }[] = [
    { key: "hero", label: "Hero main image", value: hero, setter: setHero, hint: "Featured product/lifestyle image on the left of the hero." },
    { key: "left", label: "Marquee overlay — left", value: overlayLeft, setter: setOverlayLeft, hint: "Floats over the left edge of the marquee. PNG with transparency works best." },
    { key: "right", label: "Marquee overlay — right", value: overlayRight, setter: setOverlayRight, hint: "Floats over the right edge of the marquee." },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Homepage Editor</h1>
          <p className="text-muted-foreground mt-1">Edit every section of your storefront homepage in one place.</p>
        </div>
        <Button variant="luxe" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
          Save changes
        </Button>
      </div>

      {/* HERO */}
      <Card className="p-6 space-y-5 shadow-card">
        <h2 className="text-lg font-semibold">Hero section</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Hero title</Label>
            <Input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} placeholder="Veloura Essence" className="mt-1" />
          </div>
          <div>
            <Label>Hero CTA label</Label>
            <Input value={heroCtaLabel} onChange={(e) => setHeroCtaLabel(e.target.value)} placeholder="Order Now" className="mt-1" />
          </div>
        </div>
        <div>
          <Label>Hero subtitle</Label>
          <Textarea value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} rows={2} className="mt-1" />
        </div>

        {imageSlots.map((slot) => (
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
      </Card>

      {/* CATEGORIES */}
      <Card className="p-6 space-y-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Category cards</h2>
            <p className="text-xs text-muted-foreground mt-1">Shown as the hero grid. First 4 active categories appear. Each links to a category page.</p>
          </div>
          <Button onClick={startNewCat} variant="luxe" size="sm"><Plus className="w-4 h-4 mr-1" /> New category</Button>
        </div>

        {catsLoading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">No categories yet.</div>
        ) : (
          <div className="grid gap-2">
            {categories.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 p-2 border rounded-lg">
                {c.image_url ? (
                  <img src={c.image_url} alt="" className="w-14 h-14 rounded-md object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-md bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">/{c.slug}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${c.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {c.is_active ? "Active" : "Hidden"}
                </span>
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => reorderCat.mutate({ id: c.id, direction: "up" })}><ArrowUp className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" disabled={i === categories.length - 1} onClick={() => reorderCat.mutate({ id: c.id, direction: "down" })}><ArrowDown className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => startEditCat(c)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this category?")) delCat.mutate(c.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* MARQUEE */}
      <Card className="p-6 space-y-4 shadow-card">
        <h2 className="text-lg font-semibold">Marquee strip</h2>
        <div>
          <Label htmlFor="marquee">Marquee text</Label>
          <Input id="marquee" value={marquee} onChange={(e) => setMarquee(e.target.value)} className="mt-1" placeholder="Free delivery on orders over ৳400" />
        </div>
      </Card>

      {/* CTA BAND */}
      <Card className="p-6 space-y-4 shadow-card">
        <h2 className="text-lg font-semibold">Call-to-action band</h2>
        <div>
          <Label>Band text (optional)</Label>
          <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} className="mt-1" placeholder="Limited offer — shop today" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Button label</Label>
            <Input value={ctaBtnLabel} onChange={(e) => setCtaBtnLabel(e.target.value)} className="mt-1" placeholder="Order Now" />
          </div>
          <div>
            <Label>Button link</Label>
            <Input value={ctaBtnLink} onChange={(e) => setCtaBtnLink(e.target.value)} className="mt-1" placeholder="/#perfumes" />
          </div>
        </div>
        <div>
          <Label htmlFor="reset">Countdown timer reset</Label>
          <Input id="reset" type="datetime-local" value={resetDate} onChange={(e) => setResetDate(e.target.value)} className="mt-1" />
        </div>
      </Card>

      {/* HEADER */}
      <Card className="p-6 space-y-4 shadow-card">
        <h2 className="text-lg font-semibold">Header behavior</h2>
        <div>
          <Label>Header position</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["sticky", "static", "floating"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setHeaderPosition(p)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${headerPosition === p ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1"><b>Sticky</b> follows scroll. <b>Static</b> scrolls away. <b>Floating</b> overlays the hero.</p>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button variant="luxe" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
          Save changes
        </Button>
      </div>

      {/* Category dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Image</Label>
              <div className="mt-2 flex items-center gap-3">
                {catForm.image_url ? (
                  <div className="relative">
                    <img src={catForm.image_url} alt="" className="w-32 h-32 rounded-lg object-cover border" />
                    <button onClick={() => setCatForm((f) => ({ ...f, image_url: null }))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="w-32 h-32 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-muted/50">
                    {catUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <div className="text-center"><Upload className="w-5 h-5 text-muted-foreground mx-auto" /><div className="text-xs text-muted-foreground mt-1">Upload</div></div>}
                    <input type="file" accept="image/*" className="hidden" onChange={handleCatUpload} disabled={catUploading} />
                  </label>
                )}
              </div>
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={catForm.name}
                onChange={(e) => setCatForm((f) => ({
                  ...f,
                  name: e.target.value,
                  slug: editingCat ? f.slug : slugify(e.target.value),
                }))}
                className="mt-1"
                placeholder="Summer Combo"
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={catForm.slug} onChange={(e) => setCatForm((f) => ({ ...f, slug: slugify(e.target.value) }))} className="mt-1" placeholder="summer-combo" />
              <p className="text-xs text-muted-foreground mt-1">URL: /category/{catForm.slug || "your-slug"}</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={catForm.is_active} onCheckedChange={(v) => setCatForm((f) => ({ ...f, is_active: v }))} />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>Cancel</Button>
            <Button variant="luxe" onClick={() => saveCat.mutate()} disabled={saveCat.isPending || !catForm.name}>
              {saveCat.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
