import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { saveFaqs } from "@/lib/content.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export type Faq = { q: string; a: string };

export function FaqEditor() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "site_settings", "faqs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("id, faqs_title, faqs_json")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [title, setTitle] = useState("");
  const [faqs, setFaqs] = useState<Faq[]>([]);

  useEffect(() => {
    if (!settings) return;
    setTitle((settings.faqs_title as string) ?? "");
    setFaqs(((settings.faqs_json as Faq[] | null) ?? []) as Faq[]);
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      if (!settings?.id) throw new Error("Homepage settings row missing");
      const clean = await saveFaqs({ data: { faqs_title: title, faqs } });
      const { error } = await supabase
        .from("site_settings")
        .update({ faqs_title: clean.faqs_title, faqs_json: clean.faqs_json })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("FAQs saved");
      qc.invalidateQueries({ queryKey: ["admin", "site_settings", "faqs"] });
      qc.invalidateQueries({ queryKey: ["site_settings", "faqs"] });
      qc.invalidateQueries({ queryKey: ["public", "site_settings", "hero"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          Public URL:{" "}
          <a href="/faq" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
            <code>/faq</code> <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <Card className="p-6 space-y-2">
        <Label>Section title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Frequently Asked Questions" />
      </Card>

      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Questions</h3>
          <Button size="sm" variant="outline" onClick={() => setFaqs((f) => [...f, { q: "", a: "" }])}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
        {faqs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No FAQs yet.</p>
        ) : null}
        {faqs.map((f, i) => (
          <div key={i} className="rounded-md border p-3 space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Question</Label>
              <Input
                value={f.q}
                onChange={(e) =>
                  setFaqs((arr) => arr.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Answer</Label>
              <Textarea
                rows={3}
                value={f.a}
                onChange={(e) =>
                  setFaqs((arr) => arr.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))
                }
              />
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFaqs((arr) => arr.filter((_, j) => j !== i))}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Remove
              </Button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
