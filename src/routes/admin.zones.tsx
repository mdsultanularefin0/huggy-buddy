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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatBDT } from "@/lib/currency";
import type { Database } from "@/integrations/supabase/types";

type Zone = Database["public"]["Tables"]["delivery_zones"]["Row"];

export const Route = createFileRoute("/admin/zones")({ component: ZonesPage });

const empty = { zone_name: "", fee_amount: 0, free_shipping_threshold: null as number | null, sort_order: 0, is_active: true };

function ZonesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [form, setForm] = useState(empty);

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["admin", "zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_zones").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        zone_name: form.zone_name,
        fee_amount: Number(form.fee_amount),
        free_shipping_threshold: form.free_shipping_threshold === null || form.free_shipping_threshold === 0 ? null : Number(form.free_shipping_threshold),
        sort_order: Number(form.sort_order),
        is_active: form.is_active,
      };
      const { error } = editing
        ? await supabase.from("delivery_zones").update(payload).eq("id", editing.id)
        : await supabase.from("delivery_zones").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Zone updated" : "Zone created");
      qc.invalidateQueries({ queryKey: ["admin", "zones"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "zones"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function startNew() { setEditing(null); setForm(empty); setOpen(true); }
  function startEdit(z: Zone) {
    setEditing(z);
    setForm({ zone_name: z.zone_name, fee_amount: z.fee_amount, free_shipping_threshold: z.free_shipping_threshold, sort_order: z.sort_order, is_active: z.is_active });
    setOpen(true);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Delivery Zones</h1>
          <p className="text-muted-foreground mt-1">Configure shipping fees per region.</p>
        </div>
        <Button onClick={startNew} variant="luxe"><Plus className="w-4 h-4 mr-1" /> New zone</Button>
      </div>

      <Card className="shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>
        ) : zones.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No zones yet. Add Dhaka City, Outside Dhaka, etc.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Free shipping over</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((z) => (
                <TableRow key={z.id}>
                  <TableCell className="font-medium">{z.zone_name}</TableCell>
                  <TableCell>{formatBDT(z.fee_amount)}</TableCell>
                  <TableCell>{z.free_shipping_threshold ? formatBDT(z.free_shipping_threshold) : "—"}</TableCell>
                  <TableCell>{z.sort_order}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${z.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {z.is_active ? "Active" : "Hidden"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(z)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete?")) del.mutate(z.id); }}>
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
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit zone" : "New zone"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Zone name</Label><Input value={form.zone_name} onChange={(e) => setForm({ ...form, zone_name: e.target.value })} className="mt-1" placeholder="e.g. Dhaka City" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Fee (BDT)</Label><Input type="number" value={form.fee_amount} onChange={(e) => setForm({ ...form, fee_amount: Number(e.target.value) })} className="mt-1" /></div>
              <div><Label>Free shipping threshold</Label><Input type="number" value={form.free_shipping_threshold ?? ""} onChange={(e) => setForm({ ...form, free_shipping_threshold: e.target.value === "" ? null : Number(e.target.value) })} className="mt-1" /></div>
            </div>
            <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="mt-1" /></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="luxe" onClick={() => save.mutate()} disabled={save.isPending || !form.zone_name}>
              {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
