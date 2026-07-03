import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/color-picker";
import { ArrowDown, ArrowUp, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

const PRESETS_KEY = "color-picker-custom-presets";
const NAMES_KEY = "color-picker-custom-preset-names";

type Preset = { value: string; name: string };

function load(): Preset[] {
  if (typeof window === "undefined") return [];
  try {
    const values: string[] = JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]");
    const names: Record<string, string> = JSON.parse(localStorage.getItem(NAMES_KEY) || "{}");
    return values.map((v) => ({ value: v, name: names[v] || "" }));
  } catch {
    return [];
  }
}

function save(list: Preset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(list.map((p) => p.value)));
  const names: Record<string, string> = {};
  list.forEach((p) => { if (p.name) names[p.value] = p.name; });
  localStorage.setItem(NAMES_KEY, JSON.stringify(names));
}

export const Route = createFileRoute("/admin/color-presets")({
  head: () => ({ meta: [{ title: "Color Presets — Admin" }, { name: "robots", content: "noindex" }] }),
  component: ColorPresetsAdmin,
});

function ColorPresetsAdmin() {
  const [list, setList] = useState<Preset[]>([]);
  const [draft, setDraft] = useState("#a555f0");
  const [draftName, setDraftName] = useState("");

  useEffect(() => { setList(load()); }, []);

  function persist(next: Preset[]) {
    setList(next);
    save(next);
  }

  function add() {
    if (!draft) return;
    if (list.some((p) => p.value === draft)) {
      toast.error("Preset already exists");
      return;
    }
    persist([{ value: draft, name: draftName.trim() }, ...list]);
    setDraftName("");
    toast.success("Preset added");
  }

  function remove(i: number) {
    persist(list.filter((_, idx) => idx !== i));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    persist(next);
  }

  function rename(i: number, name: string) {
    const next = list.map((p, idx) => (idx === i ? { ...p, name } : p));
    setList(next);
  }

  function updateValue(i: number, value: string) {
    const next = list.map((p, idx) => (idx === i ? { ...p, value } : p));
    setList(next);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Color Presets</h1>
        <p className="text-sm text-muted-foreground">
          Manage the saved colors and gradients shown in every color picker. Stored locally in this browser.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="text-sm font-medium">Add new preset</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
          <div>
            <label className="text-xs text-muted-foreground">Color / Gradient</label>
            <ColorPicker value={draft} onChange={setDraft} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Name (optional)</label>
            <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="e.g. Brand purple" />
          </div>
          <Button onClick={add}><Plus className="w-4 h-4 mr-1" /> Add</Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card divide-y">
        <div className="p-4 flex items-center justify-between">
          <h2 className="text-sm font-medium">Saved presets ({list.length})</h2>
          <Button size="sm" variant="outline" onClick={() => { save(list); toast.success("Saved"); }}>
            <Save className="w-4 h-4 mr-1" /> Save changes
          </Button>
        </div>
        {list.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">No presets yet.</p>
        ) : list.map((p, i) => (
          <div key={i} className="p-3 flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-md border shrink-0"
              style={p.value.includes("gradient") ? { backgroundImage: p.value } : { backgroundColor: p.value }}
            />
            <Input
              className="max-w-[180px]"
              value={p.name}
              onChange={(e) => rename(i, e.target.value)}
              placeholder="Name"
            />
            <Input
              className="font-mono text-xs"
              value={p.value}
              onChange={(e) => updateValue(i, e.target.value)}
            />
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                <ArrowUp className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Move down">
                <ArrowDown className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove(i)} aria-label="Delete">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
