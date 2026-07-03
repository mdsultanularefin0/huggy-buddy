import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { MediaPicker } from "@/components/media-picker";
import { ColorPicker } from "@/components/color-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";

const SCENT_PROFILES = ["Fresh & Floral", "Deep & Woody", "Sweet & Oriental"] as const;

const noteSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(60, "Title must be under 60 characters"),
  scent_profile: z.enum(SCENT_PROFILES, { message: "Scent profile is required" }),
});

export const Route = createFileRoute("/admin/notes")({ component: NotesPage });

type Note = {
  id: string;
  title: string;
  subtitle: string | null;
  image: string | null;
  bg: string | null;
  link: string | null;
  sort_order: number;
  is_active: boolean;
  scent_profile: string | null;
};

const empty = {
  title: "",
  subtitle: "",
  image: "",
  bg: "",
  link: "",
  sort_order: 0,
  is_active: true,
  scent_profile: "",
};

function NotesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [form, setForm] = useState(empty);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["admin", "notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notes").select("*").order("sort_order");
      if (error) throw error;
      return data as Note[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = noteSchema.safeParse({
        title: form.title,
        scent_profile: form.scent_profile,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0].message);
      }
      const title = parsed.data.title;
      const dup = notes.find(
        (n) => n.title.trim().toLowerCase() === title.toLowerCase() && n.id !== editing?.id,
      );
      if (dup) throw new Error("A note with this title already exists");

      const payload = {
        title,
        subtitle: form.subtitle.trim() || null,
        image: form.image || null,
        bg: form.bg || null,
        link: form.link.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
        scent_profile: parsed.data.scent_profile,
      };
      if (editing) {
        const { error } = await supabase.from("notes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Note updated" : "Note created");
      qc.invalidateQueries({ queryKey: ["admin", "notes"] });
      qc.invalidateQueries({ queryKey: ["public", "notes"] });
      qc.invalidateQueries({ queryKey: ["admin", "note-options"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "notes"] });
      qc.invalidateQueries({ queryKey: ["public", "notes"] });
      qc.invalidateQueries({ queryKey: ["admin", "note-options"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("notes").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "notes"] });
      qc.invalidateQueries({ queryKey: ["public", "notes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startNew() {
    setEditing(null);
    setForm({ ...empty, sort_order: notes.length });
    setOpen(true);
  }

  function startEdit(n: Note) {
    setEditing(n);
    setForm({
      title: n.title,
      subtitle: n.subtitle ?? "",
      image: n.image ?? "",
      bg: n.bg ?? "",
      link: n.link ?? "",
      sort_order: n.sort_order,
      is_active: n.is_active,
      scent_profile: n.scent_profile ?? "",
    });
    setOpen(true);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Scent Notes</h1>
          <p className="text-muted-foreground mt-1">
            Manage the note tags used on the homepage "Discover by Scent" section and available on product pages.
          </p>
        </div>
        <Button onClick={startNew} variant="luxe"><Plus className="w-4 h-4 mr-1" /> New note</Button>
      </div>

      <Card className="shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>
        ) : notes.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No notes yet. Create your first one.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>
                    {n.image ? (
                      <img src={n.image} alt={n.title} className="w-12 h-12 rounded-md object-cover" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-md"
                        style={
                          n.bg
                            ? n.bg.includes("gradient")
                              ? { backgroundImage: n.bg }
                              : { backgroundColor: n.bg }
                            : { background: "hsl(var(--muted))" }
                        }
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div>{n.title}</div>
                    {n.subtitle && <div className="text-xs text-muted-foreground">{n.subtitle}</div>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{n.sort_order}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={n.is_active}
                        onCheckedChange={(v) => toggle.mutate({ id: n.id, is_active: v })}
                      />
                      <span className={`text-xs ${n.is_active ? "text-primary" : "text-muted-foreground"}`}>
                        {n.is_active ? "Visible" : "Hidden"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(n)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this note?")) del.mutate(n.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit note" : "New note"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" placeholder="e.g. Floral, Oud, Woody" />
            </div>
            <div>
              <Label htmlFor="subtitle">Subtitle (optional)</Label>
              <Input id="subtitle" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Background image (optional)</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://…" />
                <MediaPicker onPick={(url) => setForm((f) => ({ ...f, image: url }))} />
                {form.image && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, image: "" })}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {form.image && <img src={form.image} alt="" className="mt-2 h-24 rounded-md object-cover" />}
            </div>
            <div>
              <Label>Background color or gradient (optional)</Label>
              <div className="mt-1">
                <ColorPicker
                  value={form.bg}
                  onChange={(v) => setForm({ ...form, bg: v })}
                  placeholder="#f5edff  or  linear-gradient(135deg, #a555f0, #52277a)"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Used when no image is set.</p>
            </div>
            <div>
              <Label htmlFor="link">Link (optional)</Label>
              <Input id="link" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/category/floral" className="mt-1" />
            </div>
            <div>
              <Label>Scent profile (optional)</Label>
              <Select
                value={form.scent_profile || "__none"}
                onValueChange={(v) => setForm({ ...form, scent_profile: v === "__none" ? "" : v })}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select scent profile" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {SCENT_PROFILES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label htmlFor="sort">Sort order</Label>
                <Input id="sort" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="mt-1" />
              </div>
              <label className="flex items-center gap-2 pb-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <span className="text-sm">Visible on site</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="luxe" onClick={() => save.mutate()} disabled={save.isPending || !form.title.trim() || !form.scent_profile}>
              {save.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
