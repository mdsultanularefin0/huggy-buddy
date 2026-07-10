import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Eye, ShieldAlert, X, Truck, CheckCheck, MoreVertical, FileText, ExternalLink, Copy, Phone, PackageCheck, PackageX, Ban, Download, Tag, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatBDT } from "@/lib/currency";
import type { Database } from "@/integrations/supabase/types";
import { useServerFn } from "@tanstack/react-start";
import { listAdminOrders, updateOrderAdmin, deleteOrdersAdmin } from "@/lib/admin-mutations.functions";
import { exportOrdersForCSV } from "@/lib/admin-data-ops.functions";
import { toCSV, downloadCSV } from "@/lib/csv";
import { getSteadfastFraudCheck, bulkCreateSteadfastShipments, getSteadfastDeliveryStatus } from "@/lib/integrations.functions";
import { getInvoiceToken } from "@/lib/invoice.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { useSelection } from "@/hooks/use-selection";
import { BulkActionBar } from "@/components/bulk-action-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "@tanstack/react-router";


type Order = Database["public"]["Tables"]["orders"]["Row"];
type OrderStatus = Database["public"]["Enums"]["order_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

const ORDER_STATUSES: OrderStatus[] = ["Pending", "Confirmed", "Processing", "Shipped", "Completed", "Cancelled", "Returned"];
const PAYMENT_STATUSES: PaymentStatus[] = ["Pending", "Paid", "Partially Paid", "Failed", "Refunded"];

const STATUS_TONE: Record<OrderStatus, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Confirmed: "bg-sky-100 text-sky-800",
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
  const deleteOrders = useServerFn(deleteOrdersAdmin);
  const fraudFn = useServerFn(getSteadfastFraudCheck);
  const bulkShipFn = useServerFn(bulkCreateSteadfastShipments);
  const checkStatusFn = useServerFn(getSteadfastDeliveryStatus);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;
  const [fraud, setFraud] = useState<{ phone: string; loading: boolean; result: FraudResult | null; error?: string } | null>(null);
  const [fraudByPhone, setFraudByPhone] = useState<Record<string, { loading?: boolean; result?: FraudResult; error?: string }>>({});

  const invoiceTokenFn = useServerFn(getInvoiceToken);
  const navigate = useNavigate();

  useEffect(() => { setPage(1); }, [statusFilter]);

  const { data: pageData, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["admin", "orders", statusFilter, page, limit],
    queryFn: () => fetchOrders({ data: { statusFilter, page, limit } }),
    placeholderData: (prev) => prev,
  });
  const orders: Order[] = pageData?.orders ?? [];
  const total = pageData?.total ?? 0;
  const totalPages = pageData?.totalPages ?? 1;

  useEffect(() => {
    const ch = supabase
      .channel("admin-orders-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  async function openInvoice(orderId: string, newTab = false) {
    try {
      const { token } = await invoiceTokenFn({ data: { id: orderId } });
      const url = `/invoice/${orderId}?token=${encodeURIComponent(token)}`;
      if (newTab) window.open(url, "_blank");
      else navigate({ to: "/invoice/$id", params: { id: orderId }, search: { token } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open invoice");
    }
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  }

  const shipOne = useMutation({
    mutationFn: async (id: string) => bulkShipFn({ data: { order_ids: [id] } }),
    onSuccess: () => { toast.success("Shipment created"); qc.invalidateQueries({ queryKey: ["admin", "orders"] }); },
    onError: (e: Error) => toast.error(e.message),
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

  const selection = useSelection(filtered);

  type OrdersPage = { orders: Order[]; total: number; totalPages: number };
  const patchOrdersCache = (ids: string[], patch: Partial<Order>) => {
    qc.setQueriesData<OrdersPage>({ queryKey: ["admin", "orders"] }, (old) => {
      if (!old?.orders) return old;
      const set = new Set(ids);
      return { ...old, orders: old.orders.map((o) => (set.has(o.id) ? { ...o, ...patch } : o)) };
    });
  };

  const bulkStatus = useMutation({
    mutationFn: async ({ ids, order_status }: { ids: string[]; order_status: OrderStatus }) => {
      await Promise.all(ids.map((id) => updateOrder({ data: { id, patch: { order_status } } })));
    },
    onMutate: async ({ ids, order_status }) => {
      await qc.cancelQueries({ queryKey: ["admin", "orders"] });
      patchOrdersCache(ids, { order_status } as Partial<Order>);
    },
    onSuccess: (_d, v) => {
      toast.success(`Updated ${v.ids.length} order${v.ids.length === 1 ? "" : "s"}`);
      selection.clear();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["admin", "orders"] }); },
  });

  const bulkPayment = useMutation({
    mutationFn: async ({ ids, payment_status }: { ids: string[]; payment_status: PaymentStatus }) => {
      await Promise.all(ids.map((id) => {
        const patch: Record<string, unknown> = { payment_status };
        if (payment_status === "Paid") {
          const row = orders?.find((o) => o.id === id);
          if (row) patch.amount_paid = Number(row.total);
        } else if (payment_status === "Pending") {
          patch.amount_paid = 0;
        }
        return updateOrder({ data: { id, patch } });
      }));
    },
    onMutate: async ({ ids, payment_status }) => {
      await qc.cancelQueries({ queryKey: ["admin", "orders"] });
      const patch: Partial<Order> = { payment_status };
      if (payment_status === "Pending") (patch as { amount_paid?: number }).amount_paid = 0;
      patchOrdersCache(ids, patch);
      if (payment_status === "Paid") {
        qc.setQueriesData<OrdersPage>({ queryKey: ["admin", "orders"] }, (old) => {
          if (!old?.orders) return old;
          const set = new Set(ids);
          return { ...old, orders: old.orders.map((o) => set.has(o.id) ? { ...o, payment_status, amount_paid: Number(o.total) } : o) };
        });
      }
    },
    onSuccess: (_d, v) => {
      toast.success(`Payment updated for ${v.ids.length} order${v.ids.length === 1 ? "" : "s"}`);
      selection.clear();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => { qc.invalidateQueries({ queryKey: ["admin", "orders"] }); },
  });

  const bulkShip = useMutation({
    mutationFn: async (ids: string[]) => bulkShipFn({ data: { order_ids: ids } }),
    onSuccess: () => {
      toast.success("Shipments created");
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      selection.clear();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => deleteOrders({ data: { ids } }),
    onSuccess: (r) => {
      toast.success(`Deleted ${r.deleted} order${r.deleted === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      selection.clear();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const COURIER_TO_ORDER: Record<string, OrderStatus> = {
    pending: "Shipped",
    in_review: "Processing",
    hold: "Processing",
    delivered_approval_pending: "Completed",
    partial_delivered_approval_pending: "Completed",
    delivered: "Completed",
    partial_delivered: "Completed",
    cancelled_approval_pending: "Returned",
    cancelled: "Returned",
  };
  const TERMINAL: OrderStatus[] = ["Completed", "Cancelled", "Returned"];

  const refreshAll = useMutation({
    mutationFn: async () => {
      const candidates = (orders ?? []).filter(
        (o) => !TERMINAL.includes(o.order_status) && (o.consignment_id || o.tracking_code),
      );
      let updated = 0;
      let skipped = (orders?.length ?? 0) - candidates.length;
      for (const o of candidates) {
        try {
          const r = await checkStatusFn({
            data: o.consignment_id
              ? { by: "cid" as const, value: String(o.consignment_id) }
              : { by: "tracking" as const, value: o.tracking_code ?? "" },
          });
          const mapped = COURIER_TO_ORDER[(r?.delivery_status ?? "").toLowerCase()];
          if (mapped && mapped !== o.order_status) {
            await updateOrder({ data: { id: o.id, patch: { order_status: mapped } } });
            updated++;
          }
        } catch {
          skipped++;
        }
      }
      return { updated, skipped, checked: candidates.length };
    },
    onSuccess: (r) => {
      toast.success(`Checked ${r.checked} · updated ${r.updated}${r.skipped ? ` · skipped ${r.skipped}` : ""}`);
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const anyBulkPending = bulkStatus.isPending || bulkPayment.isPending || bulkShip.isPending || bulkDelete.isPending;
  const MAX_PDF = 100;
  const selectedOrders = (orders ?? []).filter((o) => selection.selectedIds.includes(o.id));

  type CourierEligibility = { eligibleIds: string[]; skipped: { id: string; order_number: string; reason: string }[] };
  const courierEligibility: CourierEligibility = (() => {
    const eligibleIds: string[] = [];
    const skipped: CourierEligibility["skipped"] = [];
    for (const o of selectedOrders) {
      const c = (o.customer_json ?? {}) as { phone?: string; address?: string };
      let reason: string | null = null;
      if (o.consignment_id || o.tracking_code) reason = "already shipped";
      else if (o.order_status === "Cancelled" || o.order_status === "Returned") reason = `${o.order_status.toLowerCase()}`;
      else if (!c.phone) reason = "missing phone";
      else if (!c.address) reason = "missing address";
      if (reason) skipped.push({ id: o.id, order_number: o.order_number, reason });
      else eligibleIds.push(o.id);
    }
    return { eligibleIds, skipped };
  })();

  function runBulkShip() {
    if (selection.count === 0) { toast.error("Select at least one order"); return; }
    const { eligibleIds, skipped } = courierEligibility;
    if (eligibleIds.length === 0) {
      toast.error("No eligible orders", { description: "All selected orders are already shipped, cancelled, or missing address/phone." });
      return;
    }
    if (skipped.length > 0) {
      toast.warning(`Skipping ${skipped.length} order${skipped.length === 1 ? "" : "s"}`, {
        description: skipped.slice(0, 3).map((s) => `${s.order_number}: ${s.reason}`).join(" · ") + (skipped.length > 3 ? ` · +${skipped.length - 3} more` : ""),
      });
    }
    if (!confirm(`Create courier shipments for ${eligibleIds.length} order(s)?`)) return;
    bulkShip.mutate(eligibleIds);
  }

  function openBulkPdf(kind: "invoices" | "labels") {
    if (selection.count === 0) { toast.error("Select at least one order"); return; }
    if (selection.count > MAX_PDF) {
      toast.error(`Too many orders`, { description: `Select up to ${MAX_PDF} at a time (you have ${selection.count}).` });
      return;
    }
    const url = `/admin/orders/${kind}?ids=${encodeURIComponent(selection.selectedIds.join(","))}`;
    const w = window.open(url, "_blank");
    if (!w) { toast.error("Popup blocked", { description: "Allow popups for this site to open the print view." }); return; }
    toast.success(`Opening ${selection.count} ${kind}`);
  }

  async function runFraud(phone: string) {
    if (!phone) { toast.error("No phone on this order"); return; }
    setFraud({ phone, loading: true, result: null });
    setFraudByPhone((m) => ({ ...m, [phone]: { ...m[phone], loading: true } }));
    try {
      const r = await fraudFn({ data: { phone } });
      setFraud({ phone, loading: false, result: r });
      setFraudByPhone((m) => ({ ...m, [phone]: { loading: false, result: r } }));
      const pct = r.total_parcels > 0 ? Math.round((r.total_cancelled / r.total_parcels) * 100) : 0;
      const risky = pct >= 50 || r.total_fraud_reports > 0;
      toast[risky ? "warning" : "success"](`Fraud check: ${pct}% cancel rate${r.total_fraud_reports > 0 ? `, ${r.total_fraud_reports} report(s)` : ""}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      setFraud({ phone, loading: false, result: null, error: msg });
      setFraudByPhone((m) => ({ ...m, [phone]: { loading: false, error: msg } }));
    }
  }

  function clearDates() { setDateFrom(""); setDateTo(""); }

  const exportFn = useServerFn(exportOrdersForCSV);
  const [exporting, setExporting] = useState(false);
  async function handleExport() {
    setExporting(true);
    try {
      const rows = await exportFn({ data: { from: dateFrom || null, to: dateTo || null, statusFilter } });
      if (rows.length === 0) { toast.info("No orders match the current filters"); return; }
      const csv = toCSV(
        rows.map((r) => ({
          "Order Number": r.order_number,
          Date: new Date(r.date).toLocaleString(),
          "Customer Name": r.customer_name,
          Phone: r.phone,
          District: r.district,
          Total: r.total,
          "Payment Status": r.payment_status,
          "Order Status": r.order_status,
        })),
        ["Order Number", "Date", "Customer Name", "Phone", "District", "Total", "Payment Status", "Order Status"],
      );
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCSV(`veloura-orders-${stamp}.csv`, csv);
      toast.success(`Exported ${rows.length} order${rows.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Orders</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage incoming orders and fulfillment.</p>
      </div>

      <div className="flex flex-wrap items-end gap-2 sm:gap-3">
        <Input
          placeholder="Search order # / phone / name / tracking…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs"
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
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {filtered.length} of {total} order{total === 1 ? "" : "s"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshAll.mutate()}
            disabled={refreshAll.isPending}
            title="Check courier status for all in-progress orders on this page"
          >
            {refreshAll.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Refresh statuses
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
            Export CSV
          </Button>
        </div>
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
                <TableHead className="w-10">
                  <Checkbox
                    checked={selection.allChecked ? true : selection.someChecked ? "indeterminate" : false}
                    onCheckedChange={(v) => selection.toggleAll(!!v)}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Paid / Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Courier ID</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => {
                const c = (o.customer_json as { name?: string; phone?: string } | null) ?? {};
                return (
                  <TableRow key={o.id} data-state={selection.isSelected(o.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selection.isSelected(o.id)}
                        onCheckedChange={(v) => selection.toggle(o.id, !!v)}
                        aria-label={`Select ${o.order_number}`}
                      />
                    </TableCell>
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
                        onValueChange={(v) => {
                          const ps = v as PaymentStatus;
                          if (ps === "Paid") {
                            update.mutate({ id: o.id, payment_status: ps, amount_paid: Number(o.total) });
                          } else if (ps === "Pending") {
                            update.mutate({ id: o.id, payment_status: ps, amount_paid: 0 });
                          } else if (ps === "Partially Paid") {
                            const current = Number(o.amount_paid ?? 0);
                            const input = window.prompt(`Enter amount paid (0 – ${o.total}):`, String(current || ""));
                            if (input === null) return;
                            const n = Number(input);
                            if (!Number.isFinite(n) || n < 0) { toast.error("Invalid amount"); return; }
                            const clamped = Math.min(Math.max(0, n), Number(o.total));
                            update.mutate({ id: o.id, payment_status: ps, amount_paid: clamped });
                          } else {
                            update.mutate({ id: o.id, payment_status: ps });
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <PaidCell
                        order={o}
                        onSave={(amount_paid) => update.mutate({ id: o.id, amount_paid })}
                      />
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
                    <TableCell className="font-mono">
                      {o.consignment_id ? (
                        <span className="px-2 py-1 rounded bg-muted text-sm font-bold tracking-wide text-foreground inline-block">{o.consignment_id}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>



                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(() => {
                          const f = c.phone ? fraudByPhone[c.phone] : undefined;
                          const r = f?.result;
                          const pct = r && r.total_parcels > 0 ? Math.round((r.total_cancelled / r.total_parcels) * 100) : null;
                          const risky = r ? (pct !== null && pct >= 50) || r.total_fraud_reports > 0 : false;
                          const tone = f?.error
                            ? "text-rose-600"
                            : r
                              ? risky ? "text-rose-600" : "text-emerald-600"
                              : "";
                          return (
                            <Button
                              variant="ghost"
                              size="sm"
                              title={r ? `Cancel rate ${pct}%, ${r.total_fraud_reports} report(s)` : f?.error ?? "Fraud check"}
                              disabled={!c.phone || f?.loading}
                              onClick={() => runFraud(c.phone ?? "")}
                              className={tone}
                            >
                              {f?.loading
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <ShieldAlert className="w-4 h-4" />}
                              {pct !== null && <span className="ml-1 text-[11px] font-semibold">{pct}%</span>}
                            </Button>
                          );
                        })()}
                        <Button variant="ghost" size="sm" asChild title="View">
                          <Link to="/admin/orders/$id" params={{ id: o.id }}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="More actions">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel className="font-mono text-xs">{o.order_number}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate({ to: "/admin/orders/$id", params: { id: o.id } })}>
                              <Eye className="w-4 h-4 mr-2" /> View details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openInvoice(o.id, false)}>
                              <FileText className="w-4 h-4 mr-2" /> View invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openInvoice(o.id, true)}>
                              <ExternalLink className="w-4 h-4 mr-2" /> Invoice in new tab
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => runFraud(c.phone ?? "")}>
                              <ShieldAlert className="w-4 h-4 mr-2" /> Fraud check
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={shipOne.isPending || !!o.tracking_code}
                              onClick={() => shipOne.mutate(o.id)}
                            >
                              <Truck className="w-4 h-4 mr-2" />
                              {o.tracking_code ? "Already shipped" : "Send to Steadfast"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => update.mutate({ id: o.id, order_status: "Processing" })}>
                              <PackageCheck className="w-4 h-4 mr-2" /> Mark Processing
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => update.mutate({ id: o.id, order_status: "Shipped" })}>
                              <Truck className="w-4 h-4 mr-2" /> Mark Shipped
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => update.mutate({ id: o.id, order_status: "Completed" })}>
                              <CheckCheck className="w-4 h-4 mr-2" /> Mark Completed
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-rose-600 focus:text-rose-600"
                              onClick={() => {
                                if (confirm(`Cancel order ${o.order_number}?`)) update.mutate({ id: o.id, order_status: "Cancelled" });
                              }}
                            >
                              <Ban className="w-4 h-4 mr-2" /> Cancel order
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => update.mutate({ id: o.id, order_status: "Returned" })}>
                              <PackageX className="w-4 h-4 mr-2" /> Mark Returned
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => update.mutate({ id: o.id, payment_status: "Paid", amount_paid: Number(o.total) })}>
                              <CheckCheck className="w-4 h-4 mr-2" /> Mark Paid
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => copyText(o.order_number, "Order #")}>
                              <Copy className="w-4 h-4 mr-2" /> Copy order #
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!c.phone}
                              onClick={() => copyText(c.phone ?? "", "Phone")}
                            >
                              <Phone className="w-4 h-4 mr-2" /> Copy phone
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!o.tracking_code}
                              onClick={() => copyText(o.tracking_code ?? "", "Tracking")}
                            >
                              <Copy className="w-4 h-4 mr-2" /> Copy tracking
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-rose-600 focus:text-rose-600"
                              onClick={() => {
                                if (confirm(`Delete order ${o.order_number}? This cannot be undone.`)) bulkDelete.mutate([o.id]);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Delete order
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Page {page} of {totalPages} · {total} total
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {isFetching ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isFetching}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {isFetching ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Next
          </Button>
        </div>
      </div>

      <FraudDialog data={fraud} onClose={() => setFraud(null)} />

      <BulkActionBar count={selection.count} onClear={selection.clear}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={anyBulkPending}>
              {bulkStatus.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCheck className="w-4 h-4 mr-1" />}
              Order status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuLabel>Set order status ({selection.count})</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ORDER_STATUSES.map((s) => (
              <DropdownMenuItem
                key={s}
                className={s === "Cancelled" ? "text-rose-600" : undefined}
                onClick={() => {
                  if (selection.count === 0) { toast.error("Select at least one order"); return; }
                  if (s === "Cancelled" && !confirm(`Cancel ${selection.count} order(s)?`)) return;
                  bulkStatus.mutate({ ids: selection.selectedIds, order_status: s });
                }}
              >
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={anyBulkPending}>
              {bulkPayment.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PackageCheck className="w-4 h-4 mr-1" />}
              Payment
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuLabel>Set payment status ({selection.count})</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PAYMENT_STATUSES.map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => {
                  if (selection.count === 0) { toast.error("Select at least one order"); return; }
                  bulkPayment.mutate({ ids: selection.selectedIds, payment_status: s });
                }}
              >
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-5 w-px bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          disabled={anyBulkPending || courierEligibility.eligibleIds.length === 0}
          title={courierEligibility.eligibleIds.length === 0 ? "No eligible orders in selection" : `${courierEligibility.eligibleIds.length} eligible`}
          onClick={runBulkShip}
        >
          {bulkShip.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Truck className="w-4 h-4 mr-1" />}
          Send to courier{courierEligibility.eligibleIds.length !== selection.count ? ` (${courierEligibility.eligibleIds.length})` : ""}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={selection.count === 0 || selection.count > MAX_PDF}
          title={selection.count > MAX_PDF ? `Max ${MAX_PDF} at a time` : "Open printable invoices"}
          onClick={() => openBulkPdf("invoices")}
        >
          <FileText className="w-4 h-4 mr-1" /> Invoices
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={selection.count === 0 || selection.count > MAX_PDF}
          title={selection.count > MAX_PDF ? `Max ${MAX_PDF} at a time` : "Open printable labels"}
          onClick={() => openBulkPdf("labels")}
        >
          <Tag className="w-4 h-4 mr-1" /> Labels
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={anyBulkPending}>
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>More actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                if (selectedOrders.length === 0) { toast.error("Nothing selected"); return; }
                const nums = selectedOrders.map((o) => o.order_number).join(", ");
                navigator.clipboard.writeText(nums)
                  .then(() => toast.success(`Copied ${selectedOrders.length} order number${selectedOrders.length === 1 ? "" : "s"}`))
                  .catch(() => toast.error("Could not copy to clipboard"));
              }}
            >
              <Copy className="w-4 h-4 mr-2" /> Copy order numbers
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-rose-600"
              onClick={() => {
                if (selection.count === 0) { toast.error("Select at least one order"); return; }
                if (confirm(`Cancel ${selection.count} order(s)?`)) {
                  bulkStatus.mutate({ ids: selection.selectedIds, order_status: "Cancelled" });
                }
              }}
            >
              <Ban className="w-4 h-4 mr-2" /> Cancel orders
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-rose-600"
              onClick={() => {
                if (selection.count === 0) { toast.error("Select at least one order"); return; }
                if (confirm(`Permanently delete ${selection.count} order(s)? This cannot be undone.`)) {
                  bulkDelete.mutate(selection.selectedIds);
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete orders
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </BulkActionBar>

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

function PaidCell({ order, onSave }: { order: Order; onSave: (amount: number) => void }) {
  const total = Number(order.total);
  const [val, setVal] = useState<string>(String(order.amount_paid ?? 0));
  useEffect(() => { setVal(String(order.amount_paid ?? 0)); }, [order.amount_paid]);
  const paid = Math.min(Math.max(0, Number(val) || 0), total);
  const due = Math.max(0, total - paid);
  const commit = () => {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) { setVal(String(order.amount_paid ?? 0)); return; }
    const clamped = Math.min(Math.max(0, n), total);
    if (clamped !== n) setVal(String(clamped));
    if (clamped !== Number(order.amount_paid ?? 0)) onSave(clamped);
  };
  return (
    <div className="space-y-1">
      <Input
        type="number"
        min={0}
        max={total}
        step="0.01"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="h-8 w-24 text-xs"
      />
      <div className={`text-[11px] ${due > 0 ? "text-amber-600" : "text-emerald-600"}`}>
        Due: {formatBDT(due)}
      </div>
    </div>
  );
}
