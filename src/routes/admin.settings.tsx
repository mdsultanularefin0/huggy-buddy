import { createFileRoute, Link } from "@tanstack/react-router";
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
import { validateAndOptimizeBrandImage } from "@/lib/image-validate";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const [headerPosition, setHeaderPosition] = useState<"sticky" | "static" | "floating">("sticky");
  const [logoUrl, setLogoUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [footerLogoSize, setFooterLogoSize] = useState(36);
  const [footerLogoAlign, setFooterLogoAlign] = useState<"left" | "center" | "right">("left");
  const [uploading, setUploading] = useState<"logo" | "icon" | null>(null);

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
      const s = settings as {
        header_position?: string;
        site_logo_url?: string | null;
        site_icon_url?: string | null;
        footer_logo_size?: number | null;
        footer_logo_align?: string | null;
      };
      setHeaderPosition((s.header_position as "sticky" | "static" | "floating") ?? "sticky");
      setLogoUrl(s.site_logo_url ?? "");
      setIconUrl(s.site_icon_url ?? "");
      setFooterLogoSize(s.footer_logo_size ?? 36);
      setFooterLogoAlign((s.footer_logo_align as "left" | "center" | "right") ?? "left");
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        header_position: headerPosition,
        site_logo_url: logoUrl || null,
        site_icon_url: iconUrl || null,
        footer_logo_size: footerLogoSize,
        footer_logo_align: footerLogoAlign,
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
      const url = await uploadImage("hero-images", file);
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

        <div className="flex justify-end">
          <Button variant="luxe" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save settings
          </Button>
        </div>
      </Card>
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
