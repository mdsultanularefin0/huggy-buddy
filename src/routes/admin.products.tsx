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
import { Plus, Pencil, Trash2, Loader2, Upload, X, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { formatBDT } from "@/lib/currency";
import { uploadImage } from "@/lib/upload";
import type { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];
type Size = { label: string; price: number; sale_price?: number | null };

export const Route = createFileRoute("/admin/products")({ component: ProductsPage });

const empty = {
  name: "",
  description: "",
  regular_price: 0,
  sale_price: null as number | null,
  images: [] as string[],
  is_active: true,
  in_stock: true,
  stock_quantity: 0,
  sizes_json: [] as Size[],
  category_id: null as string | null,
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

  const save = useMutation({
    mutationFn: async () => {
      const slugify = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const baseSlug = slugify(form.name) || `product-${Date.now()}`;
      const slug = editing ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;
      const payload = {
        name: form.name,
        slug,
        description: form.description || null,
        regular_price: Number(form.regular_price),
        sale_price: form.sale_price === null || form.sale_price === 0 ? null : Number(form.sale_price),
        image_url: form.image_url,
        is_active: form.is_active,
        in_stock: form.in_stock,
        sizes_json: form.sizes_json as never,
        category_id: form.category_id,
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

  function startNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function startEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      regular_price: p.regular_price,
      sale_price: p.sale_price,
      image_url: p.image_url,
      is_active: p.is_active,
      in_stock: p.in_stock,
      sizes_json: (Array.isArray(p.sizes_json) ? p.sizes_json : []) as Size[],
      category_id: (p as Product & { category_id: string | null }).category_id ?? null,
    });
    setOpen(true);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage("product-images", file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
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
                <TableHead className="w-16"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
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
                    <span className={`text-xs px-2 py-1 rounded-full ${p.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {p.is_active ? "Active" : "Hidden"}
                    </span>
                    {!p.in_stock && <span className="ml-2 text-xs text-destructive">Out of stock</span>}
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
              <Label>Image</Label>
              <div className="mt-2 flex items-center gap-3">
                {form.image_url ? (
                  <div className="relative">
                    <img src={form.image_url} alt="" className="w-24 h-24 rounded-lg object-cover border" />
                    <button onClick={() => setForm((f) => ({ ...f, image_url: null }))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-muted/50">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
                    <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                  </label>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1" />
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
                <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, sizes_json: [...f.sizes_json, { label: "", price: 0 }] }))}>
                  <Plus className="w-3 h-3 mr-1" /> Add size
                </Button>
              </div>
              <div className="mt-2 space-y-2">
                {form.sizes_json.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_120px_auto] gap-2 items-center">
                    <Input placeholder="e.g. 50ml" value={s.label} onChange={(e) => updateSize(i, { label: e.target.value })} />
                    <Input type="number" placeholder="Price" value={s.price} onChange={(e) => updateSize(i, { price: Number(e.target.value) })} />
                    <Input type="number" placeholder="Sale" value={s.sale_price ?? ""} onChange={(e) => updateSize(i, { sale_price: e.target.value === "" ? null : Number(e.target.value) })} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, sizes_json: f.sizes_json.filter((_, idx) => idx !== i) }))}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-6">
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
