import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminOrderById, updateOrderAdmin } from "@/lib/admin-mutations.functions";
import { createSteadfastShipment, getSteadfastDeliveryStatus } from "@/lib/integrations.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { formatBDT } from "@/lib/currency";
import type { Database } from "@/integrations/supabase/types";

type OrderStatus = Database["public"]["Enums"]["order_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

const ORDER_STATUSES: OrderStatus[] = ["Pending", "Processing", "Shipped", "Completed", "Cancelled", "Returned"];
const PAYMENT_STATUSES: PaymentStatus[] = ["Pending", "Paid", "Partially Paid", "Failed", "Refunded"];

const STATUS_TONE: Record<OrderStatus, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Processing: "bg-blue-100 text-blue-800",
  Shipped: "bg-indigo-100 text-indigo-800",
  Completed: "bg-emerald-100 text-emerald-800",
  Cancelled: "bg-rose-100 text-rose-800",
  Returned: "bg-muted text-muted-foreground",
};

export const Route = createFileRoute("/admin/orders/$id")({
  component: AdminOrderDetail,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Order not found.</div>,
});

function AdminOrderDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const fetchOrder = useServerFn(getAdminOrderById);
  const updateOrder = useServerFn(updateOrderAdmin);
  const shipSteadfast = useServerFn(createSteadfastShipment);
  const checkStatus = useServerFn(getSteadfastDeliveryStatus);

  const { data: order, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "order", id],
    queryFn: () => fetchOrder({ data: { id } }),
  });
  const [remoteStatus, setRemoteStatus] = useState<string | null>(null);

  const [tracking, setTracking] = useState("");
  const [notes, setNotes] = useState("");
  const [amountPaid, setAmountPaid] = useState("0");

  useEffect(() => {
    if (order) {
      setTracking(order.tracking_code ?? "");
      setNotes(order.notes ?? "");
      setAmountPaid(String(order.amount_paid ?? 0));
    }
  }, [order]);

  const update = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      await updateOrder({ data: { id, patch } });
    },
    onSuccess: () => {
      toast.success("Order updated");
      qc.invalidateQueries({ queryKey: ["admin", "order", id] });
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      router.invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ship = useMutation({
    mutationFn: () => shipSteadfast({ data: { order_id: id } }),
    onSuccess: (r) => {
      const t = r?.consignment?.tracking_code;
      toast.success(t ? `Sent to Steadfast (${t})` : "Sent to Steadfast");
      qc.invalidateQueries({ queryKey: ["admin", "order", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshStatus = useMutation({
    mutationFn: () => checkStatus({ data: { by: "invoice", value: order?.order_number ?? "" } }),
    onSuccess: (r) => {
      setRemoteStatus(r?.delivery_status ?? "unknown");
      toast.success(`Steadfast: ${r?.delivery_status ?? "unknown"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>;
  }
  if (isError) {
    return <div className="p-12 text-center text-destructive">{error instanceof Error ? error.message : "Could not load order."}</div>;
  }
  if (!order) {
    return <div className="p-12 text-center text-muted-foreground">Order not found.</div>;
  }

  const c = (order.customer_json as { name?: string; phone?: string; address?: string; email?: string; district?: string; area?: string } | null) ?? {};
  const items = ((order.items_json as Array<Record<string, unknown>>) ?? []).map((it) => ({
    name: (it.name as string | undefined) ?? "",
    qty: (it.qty as number | undefined) ?? (it.quantity as number | undefined) ?? 1,
    price: (it.price as number | undefined) ?? (it.unitPrice as number | undefined) ?? 0,
    size: it.size as string | undefined,
    image: (it.image as string | undefined) ?? (it.imageUrl as string | undefined),
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/orders"><ArrowLeft className="w-4 h-4 mr-1" />Back to orders</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/invoice/$id" params={{ id }} target="_blank">
            <FileText className="w-4 h-4 mr-1" /> View invoice
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold font-mono">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            Placed {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={order.payment_status} onValueChange={(v) => {
            const ps = v as PaymentStatus;
            if (ps === "Paid") {
              setAmountPaid(String(order.total));
              update.mutate({ payment_status: ps, amount_paid: Number(order.total) });
            } else if (ps === "Pending") {
              setAmountPaid("0");
              update.mutate({ payment_status: ps, amount_paid: 0 });
            } else {
              update.mutate({ payment_status: ps });
            }
          }}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={order.order_status} onValueChange={(v) => update.mutate({ order_status: v as OrderStatus })}>
            <SelectTrigger className={`h-9 w-40 border-0 ${STATUS_TONE[order.order_status]}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2 space-y-3">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Line items</h3>
          <div className="border rounded-lg divide-y">
            {items.map((it, i) => (
              <div key={i} className="flex justify-between items-center p-3 text-sm gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {it.image && <img src={it.image} alt="" className="w-12 h-12 rounded object-cover" />}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{it.name}</div>
                    {it.size && <div className="text-xs text-muted-foreground">{it.size}</div>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div>{formatBDT((it.price ?? 0) * (it.qty ?? 1))}</div>
                  <div className="text-xs text-muted-foreground">{it.qty} × {formatBDT(it.price ?? 0)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1 text-sm pt-2">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatBDT(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{formatBDT(order.shipping_fee)}</span></div>
            {order.discount > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Discount{order.referral_used ? ` (${order.referral_used})` : ""}</span><span>−{formatBDT(order.discount)}</span></div>
            )}
            <div className="flex justify-between font-semibold pt-2 border-t"><span>Total</span><span>{formatBDT(order.total)}</span></div>
            <div className="text-xs text-muted-foreground pt-1">Payment method: {order.payment_method}</div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5 space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Customer</h3>
            <div className="text-sm space-y-1">
              <div className="font-medium">{c.name ?? "—"}</div>
              {c.phone && <div className="text-muted-foreground">{c.phone}</div>}
              {c.email && <div className="text-muted-foreground">{c.email}</div>}
            </div>
          </Card>

          <Card className="p-5 space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Shipping address</h3>
            <div className="text-sm space-y-1 text-muted-foreground">
              {c.address && <div>{c.address}</div>}
              {(c.area || c.district) && <div>{[c.area, c.district].filter(Boolean).join(", ")}</div>}
              {!c.address && !c.area && !c.district && <div>—</div>}
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" /> Fulfillment
            </h3>
            <div>
              <Label className="text-xs">Tracking code</Label>
              <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. SF123456" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Internal notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1" />
            </div>
            <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
              <Label className="text-xs">Amount paid</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="mt-1"
              />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{formatBDT(order.total)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Balance due</span>
                <span className={`font-semibold ${Math.max(0, order.total - (Number(amountPaid) || 0)) > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {formatBDT(Math.max(0, order.total - (Number(amountPaid) || 0)))}
                </span>
              </div>
            </div>
            <Button
              variant="luxe"
              className="w-full"
              disabled={update.isPending}
              onClick={() => {
                const n = Number(amountPaid);
                const paid = Number.isFinite(n) && n >= 0 ? n : 0;
                update.mutate({
                  tracking_code: tracking || null,
                  notes: notes || null,
                  amount_paid: paid,
                });
              }}
            >
              {update.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Save
            </Button>
            <div className="pt-2 border-t space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Steadfast courier</div>
              {(order.consignment_id || order.tracking_code || order.courier_status) && (
                <div className="text-xs space-y-1 rounded bg-muted/50 p-2">
                  {order.consignment_id && <div>Consignment ID: <span className="font-mono">{order.consignment_id}</span></div>}
                  {order.tracking_code && <div>Tracking code: <span className="font-mono">{order.tracking_code}</span></div>}
                  {order.courier_status && <div className="capitalize">Status: <span className="font-medium">{order.courier_status.replace(/_/g, " ")}</span></div>}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" disabled={ship.isPending} onClick={() => ship.mutate()}>
                  {ship.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Truck className="w-4 h-4 mr-1" />}
                  Send
                </Button>
                <Button variant="outline" size="sm" className="flex-1" disabled={refreshStatus.isPending || !order.order_number} onClick={() => refreshStatus.mutate()}>
                  {refreshStatus.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Check status
                </Button>
              </div>
              {remoteStatus && <div className="text-xs text-muted-foreground">Delivery: <span className="font-medium">{remoteStatus}</span></div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
