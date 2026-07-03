import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect } from "react";
import { Loader2, Eye, Truck } from "lucide-react";
import { toast } from "sonner";
import { formatBDT } from "@/lib/currency";
import type { Database } from "@/integrations/supabase/types";
import { useServerFn } from "@tanstack/react-start";
import { listAdminOrders, updateOrderAdmin } from "@/lib/admin-mutations.functions";

type Order = Database["public"]["Tables"]["orders"]["Row"];
type OrderStatus = Database["public"]["Enums"]["order_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

const ORDER_STATUSES: OrderStatus[] = ["Pending", "Processing", "Shipped", "Completed", "Cancelled", "Returned"];
const PAYMENT_STATUSES: PaymentStatus[] = ["Pending", "Paid", "Failed", "Refunded"];

const STATUS_TONE: Record<OrderStatus, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Processing: "bg-blue-100 text-blue-800",
  Shipped: "bg-indigo-100 text-indigo-800",
  Completed: "bg-emerald-100 text-emerald-800",
  Cancelled: "bg-rose-100 text-rose-800",
  Returned: "bg-muted text-muted-foreground",
};

export const Route = createFileRoute("/admin/orders")({ component: OrdersPage });

function OrdersPage() {
  const qc = useQueryClient();
  const fetchOrders = useServerFn(listAdminOrders);
  const updateOrder = useServerFn(updateOrderAdmin);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<Order | null>(null);

  const { data: orders = [], isLoading, isError, error } = useQuery({
    queryKey: ["admin", "orders", statusFilter],
    queryFn: () => fetchOrders({ data: { statusFilter } }),
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<Order> & { id: string }) => {
      const { id, ...rest } = patch;
      await updateOrder({ data: { id, patch: rest } });
    },
    onSuccess: () => {
      toast.success("Order updated");
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    const c = (o.customer_json as { name?: string; phone?: string } | null) ?? {};
    return (
      o.order_number.toLowerCase().includes(s) ||
      (c.phone ?? "").toLowerCase().includes(s) ||
      (c.name ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
        <p className="text-muted-foreground mt-1">Manage incoming orders and fulfillment.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search order # / phone / name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} order{filtered.length === 1 ? "" : "s"}</span>
      </div>

      <Card className="shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>
        ) : isError ? (
          <div className="p-12 text-center text-destructive">{error instanceof Error ? error.message : "Could not load orders."}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No orders found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => {
                const c = (o.customer_json as { name?: string; phone?: string } | null) ?? {};
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{c.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.phone ?? ""}</div>
                    </TableCell>
                    <TableCell className="font-medium">{formatBDT(o.total)}</TableCell>
                    <TableCell>
                      <Select
                        value={o.payment_status}
                        onValueChange={(v) => update.mutate({ id: o.id, payment_status: v as PaymentStatus })}
                      >
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={o.order_status}
                        onValueChange={(v) => update.mutate({ id: o.id, order_status: v as OrderStatus })}
                      >
                        <SelectTrigger className={`h-8 w-36 border-0 ${STATUS_TONE[o.order_status]}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setViewing(o)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <OrderDetailDialog
        order={viewing}
        onClose={() => setViewing(null)}
        onSave={(patch) => update.mutate(patch, { onSuccess: () => setViewing(null) })}
        saving={update.isPending}
      />
    </div>
  );
}

function OrderDetailDialog({
  order, onClose, onSave, saving,
}: {
  order: Order | null;
  onClose: () => void;
  onSave: (patch: Partial<Order> & { id: string }) => void;
  saving: boolean;
}) {
  const [tracking, setTracking] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (order) {
      setTracking(order.tracking_code ?? "");
      setNotes(order.notes ?? "");
    }
  }, [order]);

  function close() {
    setTracking(""); setNotes("");
    onClose();
  }

  if (!order) return null;
  const c = (order.customer_json as { name?: string; phone?: string; address?: string; email?: string } | null) ?? {};
  const items = (order.items_json as Array<{ name?: string; qty?: number; price?: number; size?: string }>) ?? [];

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">{order.order_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Customer</h3>
            <div className="text-sm space-y-1">
              <div><span className="font-medium">{c.name ?? "—"}</span> · {c.phone}</div>
              {c.email && <div className="text-muted-foreground">{c.email}</div>}
              {c.address && <div className="text-muted-foreground">{c.address}</div>}
            </div>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Items</h3>
            <div className="border rounded-lg divide-y">
              {items.map((it, i) => (
                <div key={i} className="flex justify-between items-center p-3 text-sm">
                  <div>
                    <div className="font-medium">{it.name}</div>
                    {it.size && <div className="text-xs text-muted-foreground">{it.size}</div>}
                  </div>
                  <div className="text-right">
                    <div>{formatBDT((it.price ?? 0) * (it.qty ?? 1))}</div>
                    <div className="text-xs text-muted-foreground">{it.qty} × {formatBDT(it.price ?? 0)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatBDT(order.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{formatBDT(order.shipping_fee)}</span></div>
              {order.discount > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Discount{order.referral_used ? ` (${order.referral_used})` : ""}</span><span>−{formatBDT(order.discount)}</span></div>
              )}
              <div className="flex justify-between font-semibold pt-2 border-t"><span>Total</span><span>{formatBDT(order.total)}</span></div>
              <div className="text-xs text-muted-foreground pt-1">Payment: {order.payment_method}</div>
            </div>
          </section>

          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Fulfillment</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Tracking code (Steadfast / courier)</Label>
                <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. SF123456" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Internal notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1" />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>Close</Button>
          <Button
            variant="luxe"
            onClick={() => onSave({ id: order.id, tracking_code: tracking || null, notes: notes || null })}
            disabled={saving}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
