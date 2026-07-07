import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  product_notes_title: string | null;
  product_notes_content: string | null;
  product_shipping_title: string | null;
  product_shipping_content: string | null;
  product_usage_title: string | null;
  product_usage_content: string | null;
};

const FIELDS: { key: keyof Omit<Row, "id">; label: string; type: "input" | "textarea" }[] = [
  { key: "product_notes_title", label: "Section 1 — Title", type: "input" },
  { key: "product_notes_content", label: "Section 1 — Content", type: "textarea" },
  { key: "product_shipping_title", label: "Section 2 — Title", type: "input" },
  { key: "product_shipping_content", label: "Section 2 — Content", type: "textarea" },
  { key: "product_usage_title", label: "Section 3 — Title", type: "input" },
  { key: "product_usage_content", label: "Section 3 — Content", type: "textarea" },
];

export function ProductGlobalSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "site_settings", "product-accordions"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select(
          "id,product_notes_title,product_notes_content,product_shipping_title,product_shipping_content,product_usage_title,product_usage_content",
        )
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Row | null;
    },
  });

  const [form, setForm] = useState<Partial<Row>>({});
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        product_notes_title: form.product_notes_title ?? "",
        product_notes_content: form.product_notes_content ?? "",
        product_shipping_title: form.product_shipping_title ?? "",
        product_shipping_content: form.product_shipping_content ?? "",
        product_usage_title: form.product_usage_title ?? "",
        product_usage_content: form.product_usage_content ?? "",
      };
      if (data?.id) {
        const { error } = await supabase.from("site_settings").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Global product sections saved");
      qc.invalidateQueries({ queryKey: ["admin", "site_settings"] });
      qc.invalidateQueries({ queryKey: ["site_settings", "product-accordions"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Global product page sections</DialogTitle>
          <DialogDescription>
            These three accordion sections appear on every product page. Edits apply site-wide.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…
          </div>
        ) : (
          <div className="space-y-4">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                {f.type === "input" ? (
                  <Input
                    className="mt-1"
                    value={(form[f.key] as string) ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                ) : (
                  <Textarea
                    className="mt-1"
                    rows={4}
                    value={(form[f.key] as string) ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} variant="luxe">
            {save.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
