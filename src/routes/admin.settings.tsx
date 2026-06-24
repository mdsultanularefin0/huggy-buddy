import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const [headerPosition, setHeaderPosition] = useState<"sticky" | "static" | "floating">("sticky");

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
      setHeaderPosition(((settings as { header_position?: string }).header_position as "sticky" | "static" | "floating") ?? "sticky");
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { header_position: headerPosition };
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

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Site Settings</h1>
        <p className="text-muted-foreground mt-1">Global site configuration. Hero, marquee, categories, and CTA band have moved to the <Link to="/admin/homepage" className="underline font-medium">Homepage Editor</Link>.</p>
      </div>

      <Card className="p-6 space-y-5 shadow-card">
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
          <p className="text-xs text-muted-foreground mt-1"><b>Sticky</b> follows scroll and reserves space (no overlap). <b>Static</b> scrolls away with the page. <b>Floating</b> overlays the hero (transparent until scrolled).</p>
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
