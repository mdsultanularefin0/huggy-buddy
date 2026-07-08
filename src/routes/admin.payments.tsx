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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Method = Database["public"]["Tables"]["payment_methods"]["Row"];

export const Route = createFileRoute("/admin/payments")({ component: PaymentsPage });

const PRESETS: { name: string; instructions: string; requiresAccount: boolean }[] = [
  { name: "Cash on Delivery", instructions: "Pay the full amount in cash when your order is delivered.", requiresAccount: false },
  { name: "Bkash Send Money", instructions: "Open bKash → Send Money → enter the number above → send the exact total → then submit your bKash number & TrxID below.", requiresAccount: true },
  { name: "Nagad Send Money", instructions: "Open Nagad → Send Money → enter the number above → send the exact total → then submit your Nagad number & TrxID below.", requiresAccount: true },
];

const empty = { method_name: "", sort_order: 0, is_active: true, account_number: "", instructions: "" };

function PaymentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Method | null>(null);
  const [form, setForm] = useState(empty);

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ["admin", "payment_methods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_methods").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { method_name: form.method_name, sort_order: Number(form.sort_order), is_active: form.is_active, account_number: form.account_number || null, instructions: form.instructions || null };
      const { error } = editing
        ? await supabase.from("payment_methods").update(payload).eq("id", editing.id)
        : await supabase.from("payment_methods").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Method updated" : "Method created");
      qc.invalidateQueries({ queryKey: ["admin", "payment_methods"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payment_methods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "payment_methods"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function startNew() { setEditing(null); setForm(empty); setOpen(true); }
  function startEdit(m: Method) {
    setEditing(m);
    setForm({ method_name: m.method_name, sort_order: m.sort_order, is_active: m.is_active, account_number: m.account_number ?? "", instructions: m.instructions ?? "" });
    setOpen(true);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Payment Methods</h1>
          <p className="text-muted-foreground mt-1">Cash on Delivery, bKash, Nagad, etc.</p>
        </div>
        <Button onClick={startNew} variant="luxe"><Plus className="w-4 h-4 mr-1" /> New method</Button>
      </div>

      <Card className="shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>
        ) : methods.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No payment methods yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Method</TableHead><TableHead>Order</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.method_name}</TableCell>
                  <TableCell>{m.sort_order}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${m.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {m.is_active ? "Active" : "Hidden"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(m)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete?")) del.mutate(m.id); }}>
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
          <DialogHeader><DialogTitle>{editing ? "Edit method" : "New method"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Method</Label>
              <Select
                value={PRESETS.some((p) => p.name === form.method_name) ? form.method_name : (form.method_name ? "__custom" : "")}
                onValueChange={(v) => {
                  if (v === "__custom") { setForm({ ...form, method_name: "" }); return; }
                  const preset = PRESETS.find((p) => p.name === v);
                  setForm({
                    ...form,
                    method_name: v,
                    instructions: form.instructions || preset?.instructions || "",
                    account_number: preset?.requiresAccount ? form.account_number : "",
                  });
                }}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select a method" /></SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                  <SelectItem value="__custom">Custom…</SelectItem>
                </SelectContent>
              </Select>
              {!PRESETS.some((p) => p.name === form.method_name) && (
                <Input value={form.method_name} onChange={(e) => setForm({ ...form, method_name: e.target.value })} className="mt-2" placeholder="Custom method name" />
              )}
            </div>
            <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="mt-1" /></div>
            <div>
              <Label>Account / receiver number</Label>
              <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} className="mt-1" placeholder="e.g. 01XXXXXXXXX (for Send Money)" />
              <p className="text-xs text-muted-foreground mt-1">Shown to customer at checkout so they can send payment.</p>
            </div>
            <div>
              <Label>Instructions (optional)</Label>
              <Input value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className="mt-1" placeholder="e.g. Send Money (Personal), no reference needed" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="luxe" onClick={() => save.mutate()} disabled={save.isPending || !form.method_name}>
              {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
