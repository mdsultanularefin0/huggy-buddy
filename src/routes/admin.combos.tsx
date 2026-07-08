import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Upload, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useSelection } from "@/hooks/use-selection";
import { BulkActionBar } from "@/components/bulk-action-bar";

import { toast } from "sonner";
import { formatBDT } from "@/lib/currency";
import { uploadImage } from "@/lib/upload";
import { MediaPicker } from "@/components/media-picker";
import type { Database } from "@/integrations/supabase/types";

type Combo = Database["public"]["Tables"]["combos"]["Row"];
type ComboType = Database["public"]["Enums"]["combo_type"];
type ComboItem = { product_id: string; size_label?: string | null };

export const Route = createFileRoute("/admin/combos")({ component: CombosPage });

const empty = {
  title: "",
  description: "",
  combo_type: "prebuilt" as ComboType,
  regular_price: 0,
  sale_price: null as number | null,
  image_url: null as string | null,
  is_active: true,
  max_items_allowed: null as number | null,
  products_json: [] as ComboItem[],
  category_ids: [] as string[],
  note_ids: [] as string[],
};


function CombosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Combo | null>(null);
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState(false);

  const { data: combos = [], isLoading } = useQuery({
    queryKey: ["admin", "combos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("combos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["admin", "products", "options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: variants = [] } = useQuery({
    queryKey: ["admin", "variants", "options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("product_id,size_label")
        .order("sort_order");
      if (error) throw error;
      return data as { product_id: string; size_label: string }[];
    },
  });

  const variantsByProduct = new Map<string, string[]>();
  for (const v of variants) {
    const arr = variantsByProduct.get(v.product_id) ?? [];
    arr.push(v.size_label);
    variantsByProduct.set(v.product_id, arr);
  }

  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "combos", "categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name").order("sort_order");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });
  const { data: notes = [] } = useQuery({
    queryKey: ["admin", "combos", "notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id,title,scent_profile,is_active")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as { id: string; title: string; scent_profile: string | null; is_active: boolean }[];
    },
  });
  const { data: productCategoryLinks = [] } = useQuery({
    queryKey: ["admin", "product_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_categories").select("product_id,category_id");
      if (error) throw error;
      return data as { product_id: string; category_id: string }[];
    },
  });
  const { data: comboCategoryLinks = [] } = useQuery({
    queryKey: ["admin", "combo_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("combo_categories").select("combo_id,category_id");
      if (error) throw error;
      return data as { combo_id: string; category_id: string }[];
    },
  });
  const { data: comboNoteLinks = [] } = useQuery({
    queryKey: ["admin", "combo_notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("combo_notes").select("combo_id,note_id");
      if (error) throw error;
      return data as { combo_id: string; note_id: string }[];
    },
  });
  const catIdsByCombo = new Map<string, string[]>();
  for (const l of comboCategoryLinks) {
    const a = catIdsByCombo.get(l.combo_id) ?? [];
    a.push(l.category_id);
    catIdsByCombo.set(l.combo_id, a);
  }
  const noteIdsByCombo = new Map<string, string[]>();
  for (const l of comboNoteLinks) {
    const a = noteIdsByCombo.get(l.combo_id) ?? [];
    a.push(l.note_id);
    noteIdsByCombo.set(l.combo_id, a);
  }


  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description || null,
        combo_type: form.combo_type,
        regular_price: Number(form.regular_price),
        sale_price: form.sale_price === null || form.sale_price === 0 ? null : Number(form.sale_price),
        image_url: form.image_url,
        is_active: form.is_active,
        max_items_allowed:
          form.combo_type === "byob" && form.max_items_allowed
            ? Number(form.max_items_allowed)
            : null,
        products_json: form.products_json as never,
      };
      let comboId: string;
      if (editing) {
        const { error } = await supabase.from("combos").update(payload).eq("id", editing.id);
        if (error) throw error;
        comboId = editing.id;
      } else {
        const { data: created, error } = await supabase.from("combos").insert(payload).select("id").single();
        if (error) throw error;
        comboId = created.id;
      }
      await supabase.from("combo_categories").delete().eq("combo_id", comboId);
      if (form.category_ids.length) {
        const { error } = await supabase
          .from("combo_categories")
          .insert(form.category_ids.map((cid) => ({ combo_id: comboId, category_id: cid })));
        if (error) throw error;
      }
      await supabase.from("combo_notes").delete().eq("combo_id", comboId);
      if (form.note_ids.length) {
        const { error } = await supabase
          .from("combo_notes")
          .insert(form.note_ids.map((nid) => ({ combo_id: comboId, note_id: nid })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Combo updated" : "Combo created");
      qc.invalidateQueries({ queryKey: ["admin", "combos"] });
      qc.invalidateQueries({ queryKey: ["admin", "combo_categories"] });
      qc.invalidateQueries({ queryKey: ["admin", "combo_notes"] });
      qc.invalidateQueries({ queryKey: ["public", "products-page"] });
      qc.invalidateQueries({ queryKey: ["category-page"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("combos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "combos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selection = useSelection(combos);
  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("combos").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "combos"] });
      selection.clear();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function startEdit(c: Combo) {
    setEditing(c);
    setForm({
      title: c.title,
      description: c.description ?? "",
      combo_type: c.combo_type,
      regular_price: c.regular_price,
      sale_price: c.sale_price,
      image_url: c.image_url,
      is_active: c.is_active,
      max_items_allowed: c.max_items_allowed,
      products_json: Array.isArray(c.products_json) ? (c.products_json as unknown as ComboItem[]) : [],
      category_ids: catIdsByCombo.get(c.id) ?? [],
      note_ids: noteIdsByCombo.get(c.id) ?? [],
    });

    setOpen(true);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadImage("combo-images", file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function addItem() {
    if (!products[0]) return;
    const pid = products[0].id;
    const firstSize = variantsByProduct.get(pid)?.[0] ?? null;
    setForm((f) => ({ ...f, products_json: [...f.products_json, { product_id: pid, size_label: firstSize }] }));
  }
  function updateItem(i: number, patch: Partial<ComboItem>) {
    setForm((f) => ({
      ...f,
      products_json: f.products_json.map((it, idx) => {
        if (idx !== i) return it;
        const next = { ...it, ...patch };
        // When product changes, reset size to first available variant.
        if (patch.product_id && patch.product_id !== it.product_id) {
          next.size_label = variantsByProduct.get(patch.product_id)?.[0] ?? null;
        }
        return next;
      }),
    }));
  }
  function removeItem(i: number) {
    setForm((f) => ({ ...f, products_json: f.products_json.filter((_, idx) => idx !== i) }));
  }

  function addAllVariants() {
    const items: ComboItem[] = [];
    for (const p of products) {
      const sizes = variantsByProduct.get(p.id) ?? [];
      if (sizes.length === 0) {
        items.push({ product_id: p.id, size_label: null });
      } else {
        for (const s of sizes) items.push({ product_id: p.id, size_label: s });
      }
    }
    setForm((f) => ({ ...f, products_json: items }));
  }

  function fillPoolFromCategories(categoryIds: string[]) {
    if (categoryIds.length === 0) {
      toast.error("Select at least one category first.");
      return;
    }
    const set = new Set(categoryIds);
    const productIds = new Set(
      productCategoryLinks.filter((l) => set.has(l.category_id)).map((l) => l.product_id),
    );
    const items: ComboItem[] = [];
    for (const p of products) {
      if (!productIds.has(p.id)) continue;
      const sizes = variantsByProduct.get(p.id) ?? [];
      if (sizes.length === 0) items.push({ product_id: p.id, size_label: null });
      else for (const s of sizes) items.push({ product_id: p.id, size_label: s });
    }
    if (items.length === 0) {
      toast.error("No products found in the selected categories.");
      return;
    }
    setForm((f) => ({ ...f, products_json: items }));
    toast.success(`Filled pool with ${items.length} item${items.length === 1 ? "" : "s"}.`);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Combos</h1>
          <p className="text-muted-foreground mt-1">Pre-built bundles and Build-Your-Own-Box.</p>
        </div>
        <Button onClick={startNew} variant="luxe">
          <Plus className="w-4 h-4 mr-1" /> New combo
        </Button>
      </div>

      <Card className="shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…
          </div>
        ) : combos.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No combos yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selection.allChecked ? true : selection.someChecked ? "indeterminate" : false}
                    onCheckedChange={(v) => selection.toggleAll(!!v)}
                  />
                </TableHead>
                <TableHead className="w-16"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combos.map((c) => {
                const items = Array.isArray(c.products_json) ? (c.products_json as unknown[]).length : 0;
                return (
                  <TableRow key={c.id} data-state={selection.isSelected(c.id) ? "selected" : undefined}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selection.isSelected(c.id)}
                        onCheckedChange={(v) => selection.toggle(c.id, !!v)}
                      />
                    </TableCell>
                    <TableCell>
                      {c.image_url ? (
                        <img src={c.image_url} alt="" className="w-12 h-12 rounded-md object-cover" loading="lazy" />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-1 rounded-full bg-secondary/30">
                        {c.combo_type === "prebuilt" ? "Pre-built" : "Build-Your-Own"}
                      </span>
                    </TableCell>

                    <TableCell>
                      {c.sale_price ? (
                        <span>
                          <span className="line-through text-muted-foreground mr-1">{formatBDT(c.regular_price)}</span>
                          {formatBDT(c.sale_price)}
                        </span>
                      ) : (
                        formatBDT(c.regular_price)
                      )}
                    </TableCell>
                    <TableCell>
                      {c.combo_type === "byob" ? `Pool of ${items} · pick ${c.max_items_allowed ?? "?"}` : items}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full ${c.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {c.is_active ? "Active" : "Hidden"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(c)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete?")) del.mutate(c.id); }}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <BulkActionBar count={selection.count} onClear={selection.clear}>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => {
            if (confirm(`Delete ${selection.count} combo(s)?`)) bulkDelete.mutate(selection.selectedIds);
          }}
          disabled={bulkDelete.isPending}
        >
          <Trash2 className="w-4 h-4 mr-1" /> Delete
        </Button>
      </BulkActionBar>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit combo" : "New combo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.combo_type} onValueChange={(v) => setForm({ ...form, combo_type: v as ComboType })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prebuilt">Pre-built bundle</SelectItem>
                    <SelectItem value="byob">Build-Your-Own-Box</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.combo_type === "byob" && (
                <div>
                  <Label>Max items customer picks</Label>
                  <Input type="number" value={form.max_items_allowed ?? ""} onChange={(e) => setForm({ ...form, max_items_allowed: e.target.value === "" ? null : Number(e.target.value) })} className="mt-1" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Regular price (BDT)</Label>
                <Input type="number" value={form.regular_price} onChange={(e) => setForm({ ...form, regular_price: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <Label>Sale price (optional)</Label>
                <Input type="number" value={form.sale_price ?? ""} onChange={(e) => setForm({ ...form, sale_price: e.target.value === "" ? null : Number(e.target.value) })} className="mt-1" />
              </div>
            </div>

            <div>
              <Label>Image</Label>
              <div
                className="mt-1 border-2 border-dashed border-border rounded-lg p-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f && f.type.startsWith("image/")) handleUpload(f);
                }}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  {form.image_url && (
                    <div className="relative">
                      <img src={form.image_url} alt="" className="w-24 h-24 object-cover rounded-md" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, image_url: null })}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                      disabled={uploading}
                    />
                    <div className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-accent">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {form.image_url ? "Replace" : "Upload"}
                    </div>
                  </label>
                  <MediaPicker
                    onPick={(url: string) => setForm((f) => ({ ...f, image_url: url }))}
                  />

                </div>
                {!form.image_url && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">Drop an image, upload, or pick from the media library.</p>
                )}
              </div>
            </div>


            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>{form.combo_type === "byob" ? "Selectable products (pool)" : "Included products"}</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={addAllVariants} disabled={!products.length}>
                    Add all
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={!products.length}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </div>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {form.products_json.length === 0 && (
                  <p className="text-sm text-muted-foreground">No products added.</p>
                )}
                {form.products_json.map((it, i) => {
                  const sizes = variantsByProduct.get(it.product_id) ?? [];
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}.</span>
                      <Select value={it.product_id} onValueChange={(v) => updateItem(i, { product_id: v })}>
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {sizes.length > 0 ? (
                        <Select
                          value={it.size_label ?? sizes[0]}
                          onValueChange={(v) => updateItem(i, { size_label: v })}
                        >
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {sizes.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="w-32 text-xs text-muted-foreground italic px-2">No variants</span>
                      )}
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(i)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {form.products_json.length} item{form.products_json.length === 1 ? "" : "s"} in {form.combo_type === "byob" ? "pool" : "bundle"}.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Categories</Label>
                <p className="text-xs text-muted-foreground">Assign to one or more categories.</p>
                <div className="mt-2 max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                  {categories.length === 0 && <p className="text-xs text-muted-foreground">No categories yet.</p>}
                  {categories.map((c) => {
                    const checked = form.category_ids.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              category_ids: v
                                ? Array.from(new Set([...f.category_ids, c.id]))
                                : f.category_ids.filter((x) => x !== c.id),
                            }))
                          }
                        />
                        <span>{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Scent notes</Label>
                <p className="text-xs text-muted-foreground">Optional. Lets this combo show up under scent filters.</p>
                <div className="mt-2 max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
                  {notes.length === 0 && <p className="text-xs text-muted-foreground">No active notes yet.</p>}
                  {notes.map((n) => {
                    const checked = form.note_ids.includes(n.id);
                    return (
                      <label key={n.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              note_ids: v
                                ? Array.from(new Set([...f.note_ids, n.id]))
                                : f.note_ids.filter((x) => x !== n.id),
                            }))
                          }
                        />
                        <span>
                          {n.title}
                          {n.scent_profile && <span className="text-xs text-muted-foreground"> · {n.scent_profile}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>




            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="luxe" onClick={() => save.mutate()} disabled={save.isPending || !form.title}>
              {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
