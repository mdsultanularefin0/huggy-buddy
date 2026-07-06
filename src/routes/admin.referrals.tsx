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

type Code = Database["public"]["Tables"]["referral_codes"]["Row"];

export const Route = createFileRoute("/admin/referrals")({ component: ReferralsPage });

const empty = { code: "", discount_amount: 0, discount_type: "fixed" as "fixed" | "percent", is_active: true };

function ReferralsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Code | null>(null);
  const [form, setForm] = useState(empty);

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ["admin", "referrals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("referral_codes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: usage = {} } = useQuery({
    queryKey: ["admin", "referral-usage"],
    queryFn: async () => {
      const { data, error } = await supabase.from("referral_usage").select("referral_code");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const u of data) counts[u.referral_code] = (counts[u.referral_code] ?? 0) + 1;
      return counts;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.trim().toUpperCase(),
        discount_amount: Number(form.discount_amount),
        discount_type: form.discount_type,
        is_active: form.is_active,
      };
      const { error } = editing
        ? await supabase.from("referral_codes").update(payload).eq("id", editing.id)
        : await supabase.from("referral_codes").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Code updated" : "Code created");
      qc.invalidateQueries({ queryKey: ["admin", "referrals"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("referral_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "referrals"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function startNew() { setEditing(null); setForm(empty); setOpen(true); }
  function startEdit(c: Code) {
    setEditing(c);
    setForm({ code: c.code, discount_amount: c.discount_amount, is_active: c.is_active });
    setOpen(true);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Referral Codes</h1>
          <p className="text-muted-foreground mt-1">Flat-discount codes for influencers & promotions.</p>
        </div>
        <Button onClick={startNew} variant="luxe"><Plus className="w-4 h-4 mr-1" /> New code</Button>
      </div>

      <Card className="shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>
        ) : codes.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No referral codes yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Times used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-medium">{c.code}</TableCell>
                  <TableCell>{formatBDT(c.discount_amount)}</TableCell>
                  <TableCell>{usage[c.code] ?? 0}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${c.is_active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
                      {c.is_active ? "Active" : "Disabled"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(c)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete code ${c.code}?`)) del.mutate(c.id); }}>
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
          <DialogHeader><DialogTitle>{editing ? "Edit code" : "New referral code"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="mt-1 font-mono" placeholder="e.g. SARAH10" />
            </div>
            <div>
              <Label>Discount amount (BDT)</Label>
              <Input type="number" value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: Number(e.target.value) })} className="mt-1" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="luxe" onClick={() => save.mutate()} disabled={save.isPending || !form.code.trim()}>
              {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
