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
import { Plus, Pencil, Trash2, Loader2, Upload, X, GripVertical, Eye, EyeOff, PackageCheck, PackageX } from "lucide-react";
import { toast } from "sonner";
import { formatBDT } from "@/lib/currency";
import { HtmlEditor } from "@/components/html-editor";
import { uploadImage } from "@/lib/upload";
import type { Database } from "@/integrations/supabase/types";
import { Checkbox } from "@/components/ui/checkbox";
import { useSelection } from "@/hooks/use-selection";
import { BulkActionBar } from "@/components/bulk-action-bar";

type Product = Database["public"]["Tables"]["products"]["Row"];
type Size = { label: string; price: number; sale_price?: number | null; in_stock?: boolean };

export const Route = createFileRoute("/admin/products")({ component: ProductsPage });

const empty = {
  name: "",
  short_description: "",
  description: "",
  regular_price: 0,
  sale_price: null as number | null,
  images: [] as string[],
  is_active: true,
  in_stock: true,
  stock_quantity: 0,
  sizes_json: [] as Size[],
  category_id: null as string | null,
  note_type: "" as string,
};

function ProductsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: noteOptions = [] } = useQuery({
    queryKey: ["admin", "note-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notes").select("title").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return (data ?? []).map((n) => n.title).filter((t): t is string => !!t);
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const slugify = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const baseSlug = slugify(form.name) || `product-${Date.now()}`;
      const slug = editing ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;
      const payload = {
        name: form.name,
        slug,
        short_description: form.short_description || null,
        description: form.description || null,
        regular_price: Number(form.regular_price),
        sale_price: form.sale_price === null || form.sale_price === 0 ? null : Number(form.sale_price),
        image_url: form.images[0] ?? null,
        images_json: form.images as never,
        is_active: form.is_active,
        in_stock: form.in_stock,
        stock_quantity: Math.max(0, Number(form.stock_quantity) || 0),
        sizes_json: form.sizes_json as never,
        category_id: form.category_id,
        note_type: form.note_type || null,
      };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Product updated" : "Product created");
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStock = useMutation({
    mutationFn: async ({ id, in_stock }: { id: string; in_stock: boolean }) => {
      const { error } = await supabase.from("products").update({ in_stock }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "products"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const selection = useSelection(products);

  const bulk = useMutation({
    mutationFn: async ({ patch, ids }: { patch: Partial<Product>; ids: string[] }) => {
      const { error } = await supabase.from("products").update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Updated ${v.ids.length} product${v.ids.length === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      selection.clear();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("products").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`Deleted ${ids.length} product${ids.length === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      selection.clear();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function startEdit(p: Product) {
    setEditing(p);
    const pAny = p as Product & { images_json?: unknown; stock_quantity?: number };
    const imgs = Array.isArray(pAny.images_json) ? (pAny.images_json as string[]).filter(Boolean) : [];
    setForm({
      name: p.name,
      short_description: (p as Product & { short_description?: string | null }).short_description ?? "",
      description: p.description ?? "",
      regular_price: p.regular_price,
      sale_price: p.sale_price,
      images: imgs.length ? imgs : p.image_url ? [p.image_url] : [],
      is_active: p.is_active,
      in_stock: p.in_stock,
      stock_quantity: pAny.stock_quantity ?? 0,
      sizes_json: (Array.isArray(p.sizes_json) ? p.sizes_json : []) as Size[],
      category_id: (p as Product & { category_id: string | null }).category_id ?? null,
      note_type: (p as Product & { note_type?: string | null }).note_type ?? "",
    });
    setOpen(true);
  }

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    setUploading(true);
    try {
      const urls = await Promise.all(arr.map((f) => uploadImage("product-images", f)));
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) uploadFiles(e.target.files);
    e.target.value = "";
  }

  function reorderImage(from: number, to: number) {
    setForm((f) => {
      const next = [...f.images];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return { ...f, images: next };
    });
  }

  function removeImage(i: number) {
    setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));
  }

  function updateSize(i: number, patch: Partial<Size>) {
    setForm((f) => ({ ...f, sizes_json: f.sizes_json.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1">Manage your fragrance catalogue.</p>
        </div>
        <Button onClick={startNew} variant="luxe"><Plus className="w-4 h-4 mr-1" /> New product</Button>
      </div>

      <Card className="shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No products yet. Create your first one.</div>
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
                <TableHead className="w-16"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id} data-state={selection.isSelected(p.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selection.isSelected(p.id)}
                      onCheckedChange={(v) => selection.toggle(p.id, !!v)}
                      aria-label={`Select ${p.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-md object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    {p.sale_price ? (
                      <span><span className="text-foreground">{formatBDT(p.sale_price)}</span> <span className="line-through text-muted-foreground ml-1 text-xs">{formatBDT(p.regular_price)}</span></span>
                    ) : formatBDT(p.regular_price)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={p.in_stock !== false}
                        onCheckedChange={(v) => toggleStock.mutate({ id: p.id, in_stock: v })}
                      />
                      <span className={`text-xs ${p.in_stock !== false ? "text-primary" : "text-destructive"}`}>
                        {p.in_stock !== false ? "In stock" : "Out of stock"}
                      </span>
                      <span className={`ml-2 text-xs px-2 py-1 rounded-full ${p.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {p.is_active ? "Active" : "Hidden"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(p)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this product?")) del.mutate(p.id); }}>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Images {form.images.length > 0 && <span className="text-xs text-muted-foreground font-normal">— drag thumbnails to reorder. First image is the main.</span>}</Label>
              <div
                className="mt-2 border-2 border-dashed rounded-lg p-3"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
                }}
              >
                <div className="flex flex-wrap gap-3">
                  {form.images.map((url, i) => (
                    <div
                      key={url + i}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/img-idx", String(i)); e.dataTransfer.effectAllowed = "move"; }}
                      onDragOver={(e) => { if (e.dataTransfer.types.includes("text/img-idx")) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }}
                      onDrop={(e) => {
                        const raw = e.dataTransfer.getData("text/img-idx");
                        if (!raw) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const from = Number(raw);
                        if (!Number.isNaN(from) && from !== i) reorderImage(from, i);
                      }}
                      className="relative group w-24 h-24"
                    >
                      <img src={url} alt="" className="w-24 h-24 rounded-lg object-cover border cursor-move" />
                      {i === 0 && <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground">Main</span>}
                      <div className="absolute top-1 left-1 w-5 h-5 rounded bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <GripVertical className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <button type="button" onClick={() => removeImage(i)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <label className="w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 text-center px-1">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        <Upload className="w-5 h-5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground mt-1">Click or drop</span>
                      </>
                    )}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
                  </label>
                </div>
                {form.images.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">Drop images anywhere in this box to upload multiple at once.</p>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="short_desc">Short description</Label>
              <Textarea id="short_desc" value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} rows={2} placeholder="One-line tagline shown near the title" className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <div className="mt-1">
                <HtmlEditor value={form.description} onChange={(html) => setForm({ ...form, description: html })} />
              </div>
            </div>
            <div>
              <Label htmlFor="cat">Category</Label>
              <select
                id="cat"
                value={form.category_id ?? ""}
                onChange={(e) => setForm({ ...form, category_id: e.target.value || null })}
                className="mt-1 w-full h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="note_type">Scent note type</Label>
              <select
                id="note_type"
                value={form.note_type}
                onChange={(e) => setForm({ ...form, note_type: e.target.value })}
                className="mt-1 w-full h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">— None —</option>
                {noteOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
                {form.note_type && !noteOptions.includes(form.note_type) && (
                  <option value={form.note_type}>{form.note_type} (custom)</option>
                )}
              </select>
              <p className="text-xs text-muted-foreground mt-1">Options come from the homepage Scent notes section.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="reg">Regular price (BDT)</Label>
                <Input id="reg" type="number" value={form.regular_price} onChange={(e) => setForm({ ...form, regular_price: Number(e.target.value) })} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="sale">Sale price (optional)</Label>
                <Input id="sale" type="number" value={form.sale_price ?? ""} onChange={(e) => setForm({ ...form, sale_price: e.target.value === "" ? null : Number(e.target.value) })} className="mt-1" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Size variants (optional)</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, sizes_json: [...f.sizes_json, { label: "", price: 0, in_stock: true }] }))}>
                  <Plus className="w-3 h-3 mr-1" /> Add size
                </Button>
              </div>
              <div className="mt-2 space-y-2">
                {form.sizes_json.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_110px_110px_auto_auto] gap-2 items-center">
                    <Input placeholder="e.g. 50ml" value={s.label} onChange={(e) => updateSize(i, { label: e.target.value })} />
                    <Input type="number" placeholder="Price" value={s.price} onChange={(e) => updateSize(i, { price: Number(e.target.value) })} />
                    <Input type="number" placeholder="Sale" value={s.sale_price ?? ""} onChange={(e) => updateSize(i, { sale_price: e.target.value === "" ? null : Number(e.target.value) })} />
                    <label className="flex items-center gap-2 cursor-pointer px-1" title="In stock">
                      <Switch checked={s.in_stock !== false} onCheckedChange={(v) => updateSize(i, { in_stock: v })} />
                      <span className="text-xs text-muted-foreground">Stock</span>
                    </label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, sizes_json: f.sizes_json.filter((_, idx) => idx !== i) }))}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label htmlFor="qty">Stock quantity</Label>
                <Input
                  id="qty"
                  type="number"
                  min={0}
                  value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: Math.max(0, Number(e.target.value) || 0) })}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-6 h-10 items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <span className="text-sm">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={form.in_stock} onCheckedChange={(v) => setForm({ ...form, in_stock: v })} />
                  <span className="text-sm">In stock</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="luxe" onClick={() => save.mutate()} disabled={save.isPending || !form.name}>
              {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
