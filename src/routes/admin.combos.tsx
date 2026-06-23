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
import { toast } from "sonner";
import { formatBDT } from "@/lib/currency";
import { uploadImage } from "@/lib/upload";
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
      const { error } = editing
        ? await supabase.from("combos").update(payload).eq("id", editing.id)
        : await supabase.from("combos").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Combo updated" : "Combo created");
      qc.invalidateQueries({ queryKey: ["admin", "combos"] });
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
    });
    setOpen(true);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadImage(file, "combo-images");
      setForm((f) => ({ ...f, image_url: url }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function addItem() {
    if (!products[0]) return;
    setForm((f) => ({ ...f, products_json: [...f.products_json, { product_id: products[0].id, size_label: null }] }));
  }
  function updateItem(i: number, patch: Partial<ComboItem>) {
    setForm((f) => ({
      ...f,
      products_json: f.products_json.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    }));
  }
  function removeItem(i: number) {
    setForm((f) => ({ ...f, products_json: f.products_json.filter((_, idx) => idx !== i) }));
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
                  <TableRow key={c.id}>
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
              <div className="mt-1 flex items-center gap-3">
                {form.image_url && (
                  <div className="relative">
                    <img src={form.image_url} alt="" className="w-20 h-20 object-cover rounded-md" />
                    <button onClick={() => setForm({ ...form, image_url: null })} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                  <div className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm hover:bg-accent">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {form.image_url ? "Replace" : "Upload"}
                  </div>
                </label>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>{form.combo_type === "byob" ? "Selectable products (pool)" : "Included products"}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={!products.length}>
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {form.products_json.length === 0 && (
                  <p className="text-sm text-muted-foreground">No products added.</p>
                )}
                {form.products_json.map((it, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={it.product_id} onValueChange={(v) => updateItem(i, { product_id: v })}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Size (optional)" value={it.size_label ?? ""} onChange={(e) => updateItem(i, { size_label: e.target.value || null })} className="w-32" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(i)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
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
