import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, Pencil, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatBDT } from "@/lib/currency";
import type { Database } from "@/integrations/supabase/types";
import { useServerFn } from "@tanstack/react-start";
import { updateCustomerAdmin, deleteCustomersAdmin } from "@/lib/admin-mutations.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { useSelection } from "@/hooks/use-selection";
import { BulkActionBar } from "@/components/bulk-action-bar";

type Customer = Database["public"]["Tables"]["customers"]["Row"];
type RiskLevel = Database["public"]["Enums"]["risk_level"];

export const Route = createFileRoute("/admin/customers")({ component: CustomersPage });

function CustomersPage() {
  const qc = useQueryClient();
  const updateCustomer = useServerFn(updateCustomerAdmin);
  const deleteCustomers = useServerFn(deleteCustomersAdmin);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", risk_level: "normal" as RiskLevel, notes: "" });

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: orderStats = {} } = useQuery({
    queryKey: ["admin", "customer-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("customer_id,total,order_status");
      if (error) throw error;
      const stats: Record<string, { count: number; spent: number; cancelled: number }> = {};
      for (const o of data) {
        if (!o.customer_id) continue;
        const s = stats[o.customer_id] ?? { count: 0, spent: 0, cancelled: 0 };
        s.count++;
        if (o.order_status === "Completed") s.spent += o.total;
        if (o.order_status === "Cancelled" || o.order_status === "Returned") s.cancelled++;
        stats[o.customer_id] = s;
      }
      return stats;
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await updateCustomer({
        data: {
          id: editing.id,
          patch: { name: form.name || null, risk_level: form.risk_level, notes: form.notes || null },
        },
      });
    },
    onSuccess: () => {
      toast.success("Customer updated");
      qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(c: Customer) {
    setEditing(c);
    setForm({ name: c.name ?? "", risk_level: c.risk_level, notes: c.notes ?? "" });
  }

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (c.phone ?? "").toLowerCase().includes(s) || (c.name ?? "").toLowerCase().includes(s) || (c.email ?? "").toLowerCase().includes(s);
  });

  const selection = useSelection(filtered);

  const bulkRisk = useMutation({
    mutationFn: async ({ ids, risk_level }: { ids: string[]; risk_level: RiskLevel }) => {
      await Promise.all(
        ids.map((id) => updateCustomer({ data: { id, patch: { risk_level } } })),
      );
    },
    onSuccess: (_d, v) => {
      toast.success(`Updated ${v.ids.length} customer${v.ids.length === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      selection.clear();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => deleteCustomers({ data: { ids } }),
    onSuccess: (r) => {
      toast.success(`Deleted ${r.deleted} customer${r.deleted === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      selection.clear();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Customers</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">Track buyers and flag risky accounts.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search by phone, name, email…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:max-w-xs" />
        <span className="text-sm text-muted-foreground sm:ml-auto">{filtered.length} customer{filtered.length === 1 ? "" : "s"}</span>
      </div>

      <Card className="shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No customers yet.</div>
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
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Spent</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const s = orderStats[c.id] ?? { count: 0, spent: 0, cancelled: 0 };
                return (
                  <TableRow key={c.id} data-state={selection.isSelected(c.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selection.isSelected(c.id)}
                        onCheckedChange={(v) => selection.toggle(c.id, !!v)}
                        aria-label={`Select ${c.name ?? c.phone}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{c.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{c.phone}</TableCell>
                    <TableCell>
                      <div className="text-sm">{s.count}</div>
                      {s.cancelled > 0 && (
                        <div className="text-xs text-rose-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {s.cancelled} cancelled
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{formatBDT(s.spent)}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full ${c.risk_level === "high" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {c.risk_level === "high" ? "⚠ High risk" : "Normal"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(c)}><Pencil className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <BulkActionBar count={selection.count} onClear={selection.clear}>
        <Button variant="ghost" size="sm" disabled={bulkRisk.isPending} onClick={() => bulkRisk.mutate({ ids: selection.selectedIds, risk_level: "high" })}>
          <ShieldAlert className="w-4 h-4 mr-1 text-rose-600" /> Flag high risk
        </Button>
        <Button variant="ghost" size="sm" disabled={bulkRisk.isPending} onClick={() => bulkRisk.mutate({ ids: selection.selectedIds, risk_level: "normal" })}>
          <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" /> Mark normal
        </Button>
      </BulkActionBar>


      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit customer</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="text-sm text-muted-foreground">{editing.phone}</div>
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
              <div>
                <Label>Risk level</Label>
                <Select value={form.risk_level} onValueChange={(v) => setForm({ ...form, risk_level: v as RiskLevel })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High risk (flag for review)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Admin notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="luxe" onClick={() => update.mutate()} disabled={update.isPending}>
              {update.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
