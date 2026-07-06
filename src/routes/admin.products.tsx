import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Loader2, Upload, X, GripVertical, Eye, EyeOff, PackageCheck, PackageX, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { formatBDT } from "@/lib/currency";
import { HtmlEditor } from "@/components/html-editor";
import { uploadImage } from "@/lib/upload";
import type { Database } from "@/integrations/supabase/types";
import { Checkbox } from "@/components/ui/checkbox";
import { useSelection } from "@/hooks/use-selection";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { MediaPicker } from "@/components/media-picker";
import { BulkImportDialog } from "@/components/bulk-import-dialog";

type Product = Database["public"]["Tables"]["products"]["Row"];
type Variant = {
  id?: string;
  size_label: string;
  price: number;
  sale_price: number | null;
  stock_quantity: number;
  in_stock: boolean;
};
type ActiveFilter = "all" | "active" | "inactive";
type StockFilter = "all" | "in" | "out";

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
  variants: [] as Variant[],
  category_id: null as string | null,
  scent_profile: "" as string,
  category_ids: [] as string[],
  note_ids: [] as string[],
  badge: "" as string,
  is_new_arrival: false,


};


function ProductsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false });
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

  const { data: combos = [] } = useQuery({
    queryKey: ["admin", "products", "combos-inline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combos")
        .select("id,title,combo_type,regular_price,sale_price,is_active,image_url")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["admin", "notes-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id,title,scent_profile,is_active")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as { id: string; title: string; scent_profile: string | null; is_active: boolean }[];
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
  const { data: productNoteLinks = [] } = useQuery({
    queryKey: ["admin", "product_notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_notes").select("product_id,note_id");
      if (error) throw error;
      return data as { product_id: string; note_id: string }[];
    },
  });
  const categoryIdsByProduct = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of productCategoryLinks) {
      const a = m.get(l.product_id) ?? [];
      a.push(l.category_id);
      m.set(l.product_id, a);
    }
    return m;
  }, [productCategoryLinks]);
  const noteIdsByProduct = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of productNoteLinks) {
      const a = m.get(l.product_id) ?? [];
      a.push(l.note_id);
      m.set(l.product_id, a);
    }
    return m;
  }, [productNoteLinks]);




  const save = useMutation({
    mutationFn: async () => {
      const slugify = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const baseSlug = slugify(form.name) || `product-${Date.now()}`;
      const slug = editing ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;
      const cleanVariants = form.variants
        .map((v) => {
          const qty = Math.max(0, Number(v.stock_quantity) || 0);
          const inStock = qty > 0 ? false : !!v.in_stock;
          return {
            ...v,
            size_label: v.size_label.trim(),
            price: Math.max(0, Number(v.price) || 0),
            sale_price:
              v.sale_price === null || v.sale_price === undefined || Number(v.sale_price) === 0
                ? null
                : Math.max(0, Number(v.sale_price)),
            stock_quantity: inStock ? 0 : qty,
            in_stock: inStock,
          };
        })
        .filter((v) => v.size_label.length > 0);
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
        category_id: form.category_ids[0] ?? form.category_id ?? null,
        scent_profile:
          (form.note_ids.length > 0 && notes.find((n) => n.id === form.note_ids[0])?.scent_profile) ||
          form.scent_profile ||
          null,
        badge: form.badge.trim() || null,
        is_new_arrival: form.is_new_arrival,
      };


      let productId: string;
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
        productId = editing.id;
      } else {
        const { data: created, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        productId = created.id;
      }

      // Diff-sync variants: delete removed, upsert kept/new
      const { data: existingVariants } = await (supabase as any)
        .from("product_variants")
        .select("id")
        .eq("product_id", productId);
      const existingIds: string[] = (existingVariants ?? []).map((v: { id: string }) => v.id);
      const keptIds = new Set(cleanVariants.map((v) => v.id).filter(Boolean) as string[]);
      const toDelete = existingIds.filter((id) => !keptIds.has(id));
      if (toDelete.length) {
        const { error } = await (supabase as any).from("product_variants").delete().in("id", toDelete);
        if (error) throw error;
      }
      if (cleanVariants.length) {
        const rows = cleanVariants.map((v, idx) => ({
          ...(v.id ? { id: v.id } : {}),
          product_id: productId,
          size_label: v.size_label,
          price: v.price,
          sale_price: v.sale_price,
          stock_quantity: v.stock_quantity,
          in_stock: v.in_stock,
          sort_order: idx,
        }));
        const { error } = await (supabase as any)
          .from("product_variants")
          .upsert(rows, { onConflict: "id" });
        if (error) throw error;
      }

      // Sync category & note assignments (many-to-many)
      await supabase.from("product_categories").delete().eq("product_id", productId);
      if (form.category_ids.length) {
        const rows = form.category_ids.map((cid) => ({ product_id: productId, category_id: cid }));
        const { error } = await supabase.from("product_categories").insert(rows);
        if (error) throw error;
      }
      await supabase.from("product_notes").delete().eq("product_id", productId);
      if (form.note_ids.length) {
        const rows = form.note_ids.map((nid) => ({ product_id: productId, note_id: nid }));
        const { error } = await supabase.from("product_notes").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Product updated" : "Product created");
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["admin", "product_categories"] });
      qc.invalidateQueries({ queryKey: ["admin", "product_notes"] });
      qc.invalidateQueries({ queryKey: ["public", "products-page"] });
      qc.invalidateQueries({ queryKey: ["category-page"] });
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

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeFilter === "active" && !p.is_active) return false;
      if (activeFilter === "inactive" && p.is_active) return false;
      if (stockFilter === "in" && p.in_stock === false) return false;
      if (stockFilter === "out" && p.in_stock !== false) return false;
      if (categoryFilter !== "all") {
        const cids = categoryIdsByProduct.get(p.id) ?? [];
        const legacy = p.category_id ?? "";
        if (!cids.includes(categoryFilter) && legacy !== categoryFilter) return false;
      }
      if (s && !p.name.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [products, search, activeFilter, stockFilter, categoryFilter, categoryIdsByProduct]);


  const selection = useSelection(filtered);

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

  async function startEdit(p: Product) {
    setEditing(p);
    const pAny = p as Product & { images_json?: unknown; stock_quantity?: number };
    const imgs = Array.isArray(pAny.images_json) ? (pAny.images_json as string[]).filter(Boolean) : [];
    const { data: vRows } = await (supabase as any)
      .from("product_variants")
      .select("id,size_label,price,sale_price,stock_quantity,in_stock,sort_order")
      .eq("product_id", p.id)
      .order("sort_order");
    const variants: Variant[] = (vRows ?? []).map((v: Variant) => ({
      id: v.id,
      size_label: v.size_label,
      price: v.price,
      sale_price: v.sale_price ?? null,
      stock_quantity: v.stock_quantity ?? 0,
      in_stock: v.in_stock ?? ((v.stock_quantity ?? 0) === 0),
    }));
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
      variants,
      category_id: (p as Product & { category_id: string | null }).category_id ?? null,
      scent_profile: (p as Product & { scent_profile?: string | null }).scent_profile ?? "",
      category_ids: categoryIdsByProduct.get(p.id) ?? [],
      note_ids: noteIdsByProduct.get(p.id) ?? [],
      badge: (p as Product & { badge?: string | null }).badge ?? "",
      is_new_arrival: (p as Product & { is_new_arrival?: boolean | null }).is_new_arrival ?? false,


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

  function updateVariant(i: number, patch: Partial<Variant>) {
    setForm((f) => ({ ...f, variants: f.variants.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1">Manage your fragrance catalogue.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setImportOpen(true)} variant="outline">
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Bulk import
          </Button>
          <Button onClick={startNew} variant="luxe"><Plus className="w-4 h-4 mr-1" /> New product</Button>
        </div>
      </div>

      <BulkImportDialog open={importOpen} onOpenChange={setImportOpen} />

      {combos.length > 0 && (
        <Card className="shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold">Combos & Bundles</h2>
              <p className="text-xs text-muted-foreground">Pre-built packs and Build-Your-Own-Box. Manage in the Combos tab.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <a href="/admin/combos">Manage combos</a>
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {combos.map((c) => (
              <a
                key={c.id}
                href="/admin/combos"
                className="flex items-center gap-3 p-2 rounded-md border hover:bg-accent transition-colors"
              >
                {c.image_url ? (
                  <img src={c.image_url} alt="" className="w-12 h-12 rounded object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{c.combo_type === "prebuilt" ? "Combo Pack" : "Custom Combo"}</span>
                    <span>·</span>
                    <span>{c.sale_price ? formatBDT(c.sale_price) : formatBDT(c.regular_price)}</span>
                    {!c.is_active && <span className="text-muted-foreground">· Hidden</span>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </Card>
      )}


      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as ActiveFilter)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Hidden</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock</SelectItem>
            <SelectItem value="in">In stock</SelectItem>
            <SelectItem value="out">Out of stock</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {(search || activeFilter !== "all" || stockFilter !== "all" || categoryFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setActiveFilter("all"); setStockFilter("all"); setCategoryFilter("all"); }}>
            <X className="w-4 h-4 mr-1" /> Clear
          </Button>
        )}
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} of {products.length}
        </span>
      </div>

      <Card className="shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">{products.length === 0 ? "No products yet. Create your first one." : "No products match these filters."}</div>
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
              {filtered.map((p) => (
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

      <BulkActionBar count={selection.count} onClear={selection.clear}>
        <Button variant="ghost" size="sm" onClick={() => bulk.mutate({ ids: selection.selectedIds, patch: { is_active: true } })} disabled={bulk.isPending}>
          <Eye className="w-4 h-4 mr-1" /> Activate
        </Button>
        <Button variant="ghost" size="sm" onClick={() => bulk.mutate({ ids: selection.selectedIds, patch: { is_active: false } })} disabled={bulk.isPending}>
          <EyeOff className="w-4 h-4 mr-1" /> Hide
        </Button>
        <Button variant="ghost" size="sm" onClick={() => bulk.mutate({ ids: selection.selectedIds, patch: { in_stock: true } })} disabled={bulk.isPending}>
          <PackageCheck className="w-4 h-4 mr-1" /> In stock
        </Button>
        <Button variant="ghost" size="sm" onClick={() => bulk.mutate({ ids: selection.selectedIds, patch: { in_stock: false } })} disabled={bulk.isPending}>
          <PackageX className="w-4 h-4 mr-1" /> Out of stock
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={bulkDelete.isPending}
          onClick={() => {
            if (confirm(`Delete ${selection.count} product(s)? This cannot be undone.`)) bulkDelete.mutate(selection.selectedIds);
          }}
        >
          <Trash2 className="w-4 h-4 mr-1" /> Delete
        </Button>
      </BulkActionBar>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="basics" className="py-2">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basics">Basics</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
            </TabsList>

            <TabsContent forceMount value="basics" className="space-y-4 mt-4 data-[state=inactive]:hidden">
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
                <Label>Categories</Label>
                <p className="text-xs text-muted-foreground">Assign to one or more categories.</p>
                <div className="mt-2 max-h-40 overflow-y-auto rounded-md border p-2 grid grid-cols-2 gap-1">
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
                <Label>
                  Scent notes <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">Pick one or more notes. Drives the storefront scent filter.</p>
                <div className="mt-2 max-h-40 overflow-y-auto rounded-md border p-2 grid grid-cols-2 gap-1">
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

            </TabsContent>

            <TabsContent forceMount value="media" className="space-y-4 mt-4 data-[state=inactive]:hidden">
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
                    <div className="w-24 h-24">
                      <MediaPicker
                        label="Library"
                        onPick={(url: string) => setForm((f) => f.images.includes(url) ? f : { ...f, images: [...f.images, url] })}
                      />
                    </div>
                  </div>
                  {form.images.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">Drop images, upload, or pick from the media library.</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent forceMount value="pricing" className="space-y-4 mt-4 data-[state=inactive]:hidden">
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
                <Label htmlFor="badge">Custom badge text (optional)</Label>
                <Input
                  id="badge"
                  value={form.badge}
                  maxLength={16}
                  placeholder='e.g. "New", "Hot", "Limited"'
                  onChange={(e) => setForm({ ...form, badge: e.target.value })}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Shown as the red circle on the product card. Leave empty to auto-show "Sale" when discounted.</p>
              </div>
              <p className="text-xs text-muted-foreground">Base pricing is used when a product has no variants. Add variants below to sell per-size with their own pricing.</p>

            </TabsContent>

            <TabsContent forceMount value="inventory" className="space-y-4 mt-4 data-[state=inactive]:hidden">
              <div>
                <div className="flex items-center justify-between">
                  <Label>Variants (size / price / stock)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, variants: [...f.variants, { size_label: "", price: 0, sale_price: null, stock_quantity: 0, in_stock: true }] }))}>
                    <Plus className="w-3 h-3 mr-1" /> Add variant
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Each row is a size (e.g. 50ml). Toggle <strong>In stock</strong> to keep it always available without tracking quantity; otherwise, set a stock quantity to track inventory.</p>
                {form.variants.length > 0 && (
                  <div className="grid grid-cols-[1fr_90px_90px_90px_90px_auto] gap-2 items-center mt-2 px-1 text-xs text-muted-foreground">
                    <span>Size</span><span>Price</span><span>Sale</span><span>Stock qty</span><span>In stock</span><span></span>
                  </div>
                )}
                <div className="mt-1 space-y-2">
                  {form.variants.map((v, i) => {
                    const qtyLocked = v.in_stock; // toggle on -> qty disabled and forced 0
                    const toggleLocked = v.stock_quantity > 0; // qty > 0 -> toggle disabled (off)
                    return (
                      <div key={v.id ?? `new-${i}`} className="grid grid-cols-[1fr_90px_90px_90px_90px_auto] gap-2 items-center">
                        <Input placeholder="e.g. 50ml" value={v.size_label} onChange={(e) => updateVariant(i, { size_label: e.target.value })} />
                        <Input type="number" min={0} placeholder="Price" value={v.price} onChange={(e) => updateVariant(i, { price: Number(e.target.value) })} />
                        <Input type="number" min={0} placeholder="Sale" value={v.sale_price ?? ""} onChange={(e) => updateVariant(i, { sale_price: e.target.value === "" ? null : Number(e.target.value) })} />
                        <Input
                          type="number"
                          min={0}
                          placeholder="Stock"
                          disabled={qtyLocked}
                          value={qtyLocked ? 0 : v.stock_quantity}
                          onChange={(e) => updateVariant(i, { stock_quantity: Math.max(0, Number(e.target.value) || 0) })}
                        />
                        <div className="flex justify-center">
                          <Switch
                            checked={v.in_stock}
                            disabled={toggleLocked}
                            onCheckedChange={(val) => updateVariant(i, { in_stock: val, ...(val ? { stock_quantity: 0 } : {}) })}
                          />
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, variants: f.variants.filter((_, idx) => idx !== i) }))}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end pt-2 border-t">
                <div>
                  <Label htmlFor="qty">Base stock quantity</Label>
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
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="luxe" onClick={() => save.mutate()} disabled={save.isPending || !form.name || form.note_ids.length === 0}>
              {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
