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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Loader2, Upload, X, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";
import { useSelection } from "@/hooks/use-selection";
import { BulkActionBar } from "@/components/bulk-action-bar";
import type { Database } from "@/integrations/supabase/types";

type Category = Database["public"]["Tables"]["categories"]["Row"];

export const Route = createFileRoute("/admin/categories")({ component: CategoriesPage });

const empty = {
  name: "",
  slug: "",
  image_url: null as string | null,
  sort_order: 0,
  is_active: true,
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function CategoriesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name is required");
      const slug = form.slug.trim() || slugify(form.name);
      const payload = {
        name: form.name.trim(),
        slug,
        image_url: form.image_url,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      };
      const { error } = editing
        ? await supabase.from("categories").update(payload).eq("id", editing.id)
        : await supabase.from("categories").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Category updated" : "Category created");
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selection = useSelection(categories);
  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("categories").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`Deleted ${ids.length} categor${ids.length === 1 ? "y" : "ies"}`);
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      selection.clear();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorder = useMutation({
    mutationFn: async (ordered: Category[]) => {
      const updates = ordered.map((c, i) =>
        supabase.from("categories").update({ sort_order: i }).eq("id", c.id),
      );
      const results = await Promise.all(updates);
      const firstErr = results.find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
    },
    onMutate: async (ordered) => {
      await qc.cancelQueries({ queryKey: ["admin", "categories"] });
      const prev = qc.getQueryData<Category[]>(["admin", "categories"]);
      qc.setQueryData<Category[]>(["admin", "categories"], ordered.map((c, i) => ({ ...c, sort_order: i })));
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["admin", "categories"], ctx.prev);
      toast.error(e.message);
    },
    onSuccess: () => {
      toast.success("Order updated");
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      qc.invalidateQueries({ queryKey: ["public", "categories"] });
    },
  });

  const [dragId, setDragId] = useState<string | null>(null);
  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const list = [...categories];
    const from = list.findIndex((c) => c.id === dragId);
    const to = list.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setDragId(null);
    reorder.mutate(list);
  }

  function startNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function startEdit(c: Category) {
    setEditing(c);
    setForm({
      name: c.name,
      slug: c.slug,
      image_url: c.image_url,
      sort_order: c.sort_order,
      is_active: c.is_active,
    });
    setOpen(true);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadImage("hero-images", file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Categories</h1>
          <p className="text-muted-foreground mt-1">Manage product categories shown on the storefront.</p>
        </div>
        <Button onClick={startNew} variant="luxe">
          <Plus className="w-4 h-4 mr-1" /> New category
        </Button>
      </div>

      <Card className="shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No categories yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selection.allChecked ? true : selection.someChecked ? "indeterminate" : false}
                    onCheckedChange={(v) => selection.toggleAll(!!v)}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="w-8" />
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow
                  key={c.id}
                  draggable
                  onDragStart={() => setDragId(c.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(c.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`cursor-move ${dragId === c.id ? "opacity-50" : ""}`}
                >
                  <TableCell className="text-muted-foreground">
                    <GripVertical className="w-4 h-4" />
                  </TableCell>
                  <TableCell>
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} className="w-12 h-12 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                  <TableCell>{c.sort_order}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${c.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {c.is_active ? "Active" : "Hidden"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(c)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this category?")) del.mutate(c.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <p className="text-xs text-muted-foreground -mt-2">Drag rows to reorder. The top 3 active categories show on mobile/tablet; top 4 on desktop.</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({
                    ...f,
                    name,
                    slug: !editing && (!f.slug || f.slug === slugify(f.name)) ? slugify(name) : f.slug,
                  }));
                }}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="auto-generated from name"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Image</Label>
              <div className="mt-1 flex items-center gap-3">
                {form.image_url ? (
                  <div className="relative">
                    <img src={form.image_url} alt="" className="w-20 h-20 object-cover rounded" />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, image_url: null })}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : null}
                <label className="inline-flex items-center gap-2 px-3 py-2 border rounded cursor-pointer hover:bg-muted text-sm">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>{form.image_url ? "Replace" : "Upload"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <Label>Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending} variant="luxe">
              {save.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editing ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
