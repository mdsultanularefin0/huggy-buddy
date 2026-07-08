import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";
import { validateAndOptimizeBrandImage } from "@/lib/image-validate";
import { HtmlEditor } from "@/components/html-editor";
import { DEFAULT_ORDER_EMAIL_SUBJECT, DEFAULT_ORDER_EMAIL_BODY } from "@/lib/order-email-template";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const [headerPosition, setHeaderPosition] = useState<"sticky" | "static" | "floating">("sticky");
  const [logoUrl, setLogoUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [headerLogoSize, setHeaderLogoSize] = useState(36);
  const [footerLogoSize, setFooterLogoSize] = useState(36);
  const [footerLogoAlign, setFooterLogoAlign] = useState<"left" | "center" | "right">("left");
  const [uploading, setUploading] = useState<"logo" | "icon" | null>(null);
  const [shopName, setShopName] = useState("");
  const [shopTagline, setShopTagline] = useState("");
  const [shopEmail, setShopEmail] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopHours, setShopHours] = useState("");
  const [socialFacebook, setSocialFacebook] = useState("");
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialTwitter, setSocialTwitter] = useState("");
  const [socialYoutube, setSocialYoutube] = useState("");
  const [socialTiktok, setSocialTiktok] = useState("");
  const [socialWhatsapp, setSocialWhatsapp] = useState("");
  const [orderEmailSubject, setOrderEmailSubject] = useState("");
  const [orderEmailBody, setOrderEmailBody] = useState("");

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
      const s = settings as Record<string, unknown>;
      const str = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : "");
      setHeaderPosition(((s.header_position as string) ?? "sticky") as "sticky" | "static" | "floating");
      setLogoUrl(str("site_logo_url"));
      setIconUrl(str("site_icon_url"));
      setHeaderLogoSize((s.header_logo_size as number | null) ?? 36);
      setFooterLogoSize((s.footer_logo_size as number | null) ?? 36);
      setFooterLogoAlign(((s.footer_logo_align as string) ?? "left") as "left" | "center" | "right");
      setShopName(str("shop_name"));
      setShopTagline(str("shop_tagline"));
      setShopEmail(str("shop_email"));
      setShopPhone(str("shop_phone"));
      setShopAddress(str("shop_address"));
      setShopHours(str("shop_hours"));
      setSocialFacebook(str("social_facebook"));
      setSocialInstagram(str("social_instagram"));
      setSocialTwitter(str("social_twitter"));
      setSocialYoutube(str("social_youtube"));
      setSocialTiktok(str("social_tiktok"));
      setSocialWhatsapp(str("social_whatsapp"));
      setOrderEmailSubject(str("order_email_subject"));
      setOrderEmailBody(str("order_email_body"));
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        header_position: headerPosition,
        site_logo_url: logoUrl || null,
        site_icon_url: iconUrl || null,
        header_logo_size: headerLogoSize,
        footer_logo_size: footerLogoSize,
        footer_logo_align: footerLogoAlign,
        shop_name: shopName || null,
        shop_tagline: shopTagline || null,
        shop_email: shopEmail || null,
        shop_phone: shopPhone || null,
        shop_address: shopAddress || null,
        shop_hours: shopHours || null,
        social_facebook: socialFacebook || null,
        social_instagram: socialInstagram || null,
        social_twitter: socialTwitter || null,
        social_youtube: socialYoutube || null,
        social_tiktok: socialTiktok || null,
        social_whatsapp: socialWhatsapp || null,
        order_email_subject: orderEmailSubject || null,
        order_email_body: orderEmailBody || null,
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

  async function handleUpload(kind: "logo" | "icon", file: File) {
    try {
      setUploading(kind);
      const optimized = await validateAndOptimizeBrandImage(kind, file);
      const url = await uploadImage("hero-images", optimized);
      if (kind === "logo") setLogoUrl(url);
      else setIconUrl(url);
      toast.success(`Image uploaded — click Save to apply`);
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
        <h1 className="text-3xl font-semibold tracking-tight">Site Settings</h1>
        <p className="text-muted-foreground mt-1">Global site configuration. Hero, marquee, categories, and CTA band have moved to the <Link to="/admin/homepage" className="underline font-medium">Homepage Editor</Link>.</p>
      </div>

      <Tabs defaultValue="branding" className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="shop">Shop info</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-4">
          <Card className="p-6 space-y-6 shadow-card">
            <div className="grid sm:grid-cols-2 gap-6">
              <BrandUpload
                label="Site logo"
                hint="Shown in the header. PNG/SVG with transparent background recommended."
                url={logoUrl}
                onUrlChange={setLogoUrl}
                onFile={(f) => handleUpload("logo", f)}
                busy={uploading === "logo"}
                previewClass="bg-primary p-3 h-20"
              />
              <BrandUpload
                label="Site icon (favicon)"
                hint="Browser tab icon. Square PNG, 256×256 or larger."
                url={iconUrl}
                onUrlChange={setIconUrl}
                onFile={(f) => handleUpload("icon", f)}
                busy={uploading === "icon"}
                previewClass="bg-muted p-3 h-20"
              />
            </div>
            <SaveBar pending={save.isPending} onSave={() => save.mutate()} />
          </Card>
        </TabsContent>

        <TabsContent value="shop" className="mt-4">
          <Card className="p-6 space-y-6 shadow-card">
            <div>
              <Label className="text-base">Shop information</Label>
              <p className="text-xs text-muted-foreground">Used on the Contact page, footer, and as fallback when no logo is set.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Shop name" value={shopName} onChange={setShopName} placeholder="Veloura Essence" />
              <Field label="Tagline" value={shopTagline} onChange={setShopTagline} placeholder="Crafted scents, honest pricing." />
              <Field label="Email" value={shopEmail} onChange={setShopEmail} placeholder="hello@example.com" type="email" />
              <Field label="Phone" value={shopPhone} onChange={setShopPhone} placeholder="+880 1234-567890" />
              <Field label="Address" value={shopAddress} onChange={setShopAddress} placeholder="Street, City" textarea />
              <Field label="Opening hours" value={shopHours} onChange={setShopHours} placeholder="Mon–Sat, 10am–8pm" textarea />
            </div>
            <SaveBar pending={save.isPending} onSave={() => save.mutate()} />
          </Card>
        </TabsContent>

        <TabsContent value="social" className="mt-4">
          <Card className="p-6 space-y-6 shadow-card">
            <div>
              <Label className="text-base">Social media links</Label>
              <p className="text-xs text-muted-foreground">Leave blank to hide an icon. Use full URLs (https://…).</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Facebook" value={socialFacebook} onChange={setSocialFacebook} placeholder="https://facebook.com/yourpage" />
              <Field label="Instagram" value={socialInstagram} onChange={setSocialInstagram} placeholder="https://instagram.com/handle" />
              <Field label="Twitter / X" value={socialTwitter} onChange={setSocialTwitter} placeholder="https://x.com/handle" />
              <Field label="YouTube" value={socialYoutube} onChange={setSocialYoutube} placeholder="https://youtube.com/@channel" />
              <Field label="TikTok" value={socialTiktok} onChange={setSocialTiktok} placeholder="https://tiktok.com/@handle" />
              <Field label="WhatsApp" value={socialWhatsapp} onChange={setSocialWhatsapp} placeholder="https://wa.me/8801234567890" />
            </div>
            <SaveBar pending={save.isPending} onSave={() => save.mutate()} />
          </Card>
        </TabsContent>

        <TabsContent value="layout" className="mt-4">
          <Card className="p-6 space-y-6 shadow-card">
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
              <p className="text-xs text-muted-foreground mt-1"><b>Sticky</b> follows scroll and reserves space. <b>Static</b> scrolls away. <b>Floating</b> overlays the hero.</p>
            </div>

            <div className="border-t pt-6 space-y-3">
              <div>
                <Label className="text-base">Header logo size</Label>
                <p className="text-xs text-muted-foreground">Zoom the logo shown in the site header.</p>
              </div>
              <Label>Size: <span className="font-mono">{headerLogoSize}px</span></Label>
              <input
                type="range"
                min={20}
                max={96}
                step={2}
                value={headerLogoSize}
                onChange={(e) => setHeaderLogoSize(Number(e.target.value))}
                className="w-full"
              />
              {logoUrl && (
                <div className="rounded-lg border bg-primary p-4 flex items-center">
                  <img src={logoUrl} alt="Header preview" style={{ height: headerLogoSize }} className="w-auto object-contain" />
                </div>
              )}
            </div>

            <div className="border-t pt-6 space-y-4">
              <div>
                <Label className="text-base">Footer logo</Label>
                <p className="text-xs text-muted-foreground">Size and alignment of the logo in the site footer.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <Label>Size: <span className="font-mono">{footerLogoSize}px</span></Label>
                  <input
                    type="range"
                    min={20}
                    max={96}
                    step={2}
                    value={footerLogoSize}
                    onChange={(e) => setFooterLogoSize(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                </div>
                <div>
                  <Label>Alignment</Label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setFooterLogoAlign(a)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${footerLogoAlign === a ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {logoUrl && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className={`flex items-center ${footerLogoAlign === "center" ? "justify-center" : footerLogoAlign === "right" ? "justify-end" : "justify-start"}`}>
                    <img src={logoUrl} alt="Footer preview" style={{ height: footerLogoSize }} className="w-auto object-contain" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">Footer preview</p>
                </div>
              )}
            </div>
            <SaveBar pending={save.isPending} onSave={() => save.mutate()} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BrandUpload({ label, hint, url, onUrlChange, onFile, busy, previewClass }: {
  label: string;
  hint: string;
  url: string;
  onUrlChange: (v: string) => void;
  onFile: (f: File) => void;
  busy: boolean;
  previewClass: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className={`rounded-lg border flex items-center justify-center ${previewClass}`}>
        {url ? (
          <img src={url} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">No image</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => onUrlChange(e.target.value)} placeholder="Image URL" className="flex-1" />
        <label className="inline-flex items-center gap-1 cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-muted">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          <span>Upload</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type, textarea }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {textarea ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type ?? "text"} />
      )}
    </div>
  );
}

function SaveBar({ pending, onSave }: { pending: boolean; onSave: () => void }) {
  return (
    <div className="flex justify-end border-t pt-6">
      <Button variant="luxe" onClick={onSave} disabled={pending}>
        {pending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save settings
      </Button>
    </div>
  );
}
