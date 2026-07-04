import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Eye, ShieldAlert, X, Truck, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { formatBDT } from "@/lib/currency";
import type { Database } from "@/integrations/supabase/types";
import { useServerFn } from "@tanstack/react-start";
import { listAdminOrders, updateOrderAdmin } from "@/lib/admin-mutations.functions";
import { getSteadfastFraudCheck, bulkCreateSteadfastShipments } from "@/lib/integrations.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { useSelection } from "@/hooks/use-selection";
import { BulkActionBar } from "@/components/bulk-action-bar";


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

type FraudResult = {
  total_parcels: number;
  total_delivered: number;
  total_cancelled: number;
  total_fraud_reports: number;
};

export const Route = createFileRoute("/admin/orders/")({ component: OrdersPage });

function OrdersPage() {
  const qc = useQueryClient();
  const fetchOrders = useServerFn(listAdminOrders);
  const updateOrder = useServerFn(updateOrderAdmin);
  const fraudFn = useServerFn(getSteadfastFraudCheck);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fraud, setFraud] = useState<{ phone: string; loading: boolean; result: FraudResult | null; error?: string } | null>(null);

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

  const filtered = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() + 86400000 : null;
    const s = search.trim().toLowerCase();
    return orders.filter((o) => {
      const c = (o.customer_json as { name?: string; phone?: string } | null) ?? {};
      if (paymentFilter !== "all" && o.payment_status !== paymentFilter) return false;
      const t = new Date(o.created_at).getTime();
      if (from && t < from) return false;
      if (to && t >= to) return false;
      if (s) {
        const hay = `${o.order_number} ${c.phone ?? ""} ${c.name ?? ""} ${o.tracking_code ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [orders, paymentFilter, dateFrom, dateTo, search]);

  async function runFraud(phone: string) {
    if (!phone) { toast.error("No phone on this order"); return; }
    setFraud({ phone, loading: true, result: null });
    try {
      const r = await fraudFn({ data: { phone } });
      setFraud({ phone, loading: false, result: r });
    } catch (e) {
      setFraud({ phone, loading: false, result: null, error: e instanceof Error ? e.message : "Failed" });
    }
  }

  function clearDates() { setDateFrom(""); setDateTo(""); }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
        <p className="text-muted-foreground mt-1">Manage incoming orders and fulfillment.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Search order # / phone / name / tracking…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as PaymentStatus | "all")}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Payment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          <span className="text-muted-foreground text-xs">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="icon" onClick={clearDates} className="h-8 w-8"><X className="w-4 h-4" /></Button>
          )}
        </div>
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
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Courier ID</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => {
                const c = (o.customer_json as { name?: string; phone?: string } | null) ?? {};
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(o.created_at).toLocaleDateString()}
                      <div className="opacity-60">{new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    </TableCell>
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
                    <TableCell className="text-xs font-mono">
                      {o.tracking_code ? (
                        <span className="px-2 py-0.5 rounded bg-muted">{o.tracking_code}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Fraud check"
                          onClick={() => runFraud(c.phone ?? "")}
                        >
                          <ShieldAlert className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to="/admin/orders/$id" params={{ id: o.id }}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <FraudDialog data={fraud} onClose={() => setFraud(null)} />
    </div>
  );
}

function FraudDialog({ data, onClose }: { data: { phone: string; loading: boolean; result: FraudResult | null; error?: string } | null; onClose: () => void }) {
  if (!data) return null;
  const r = data.result;
  const riskPct = r && r.total_parcels > 0 ? Math.round((r.total_cancelled / r.total_parcels) * 100) : 0;
  const risky = riskPct >= 50 || (r?.total_fraud_reports ?? 0) > 0;
  return (
    <Dialog open={!!data} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Fraud check
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">Phone: <span className="font-mono text-foreground">{data.phone}</span></div>
          {data.loading ? (
            <div className="py-6 text-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Checking…</div>
          ) : data.error ? (
            <div className="text-sm text-destructive">{data.error}</div>
          ) : r ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Stat label="Total parcels" value={r.total_parcels} />
                <Stat label="Delivered" value={r.total_delivered} tone="text-emerald-600" />
                <Stat label="Cancelled" value={r.total_cancelled} tone="text-rose-600" />
                <Stat label="Fraud reports" value={r.total_fraud_reports} tone={r.total_fraud_reports > 0 ? "text-rose-600" : ""} />
              </div>
              <div className={`text-xs rounded-md p-2 ${risky ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}>
                {risky
                  ? `⚠ High risk — cancellation rate ${riskPct}%${r.total_fraud_reports > 0 ? `, ${r.total_fraud_reports} fraud report(s)` : ""}.`
                  : `✓ Low risk — cancellation rate ${riskPct}%.`}
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="border rounded-md p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${tone}`}>{value}</div>
    </div>
  );
}
