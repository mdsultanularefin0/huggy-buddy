import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  
  ExternalLink,
  PhoneCall,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { lookupOrder } from "@/lib/orders.functions";
import { toast } from "sonner";
import { pageMeta } from "@/lib/seo-meta";

export const Route = createFileRoute("/track")({
  head: () => pageMeta({
    path: "/track",
    title: "Track your order — Veloura Essence",
    description: "Look up your Veloura Essence order using your order number and email.",
  }),
  component: TrackPage,
});


type OrderInfo = {
  id: string;
  order_number: string;
  order_status: string | null;
  payment_status: string | null;
  courier_status: string | null;
  tracking_code: string | null;
  consignment_id: number | null;
  total: number;
  amount_paid: number;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
  };
};



function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function statusTone(s: string | null | undefined) {
  const v = (s ?? "").toLowerCase();
  if (["delivered", "paid", "completed"].includes(v)) return "text-emerald-600";
  if (["cancelled", "canceled", "failed", "refunded", "returned"].includes(v)) return "text-rose-600";
  if (["shipped", "in_transit", "processing", "confirmed", "partial"].includes(v)) return "text-amber-600";
  return "text-muted-foreground";
}

type Step = {
  key: string;
  label: string;
  at: string | null;
  Icon: React.ComponentType<{ className?: string }>;
  done: boolean;
  active?: boolean;
  detail?: string;
};

function buildTimeline(o: OrderInfo): Step[] {
  const orderStatus = (o.order_status ?? "").toLowerCase();
  const courier = (o.courier_status ?? "").toLowerCase();

  const isCancelled = ["cancelled", "canceled"].includes(orderStatus);
  const isDelivered = ["delivered", "completed", "complete"].includes(orderStatus) || courier === "delivered";
  const isShipped =
    ["shipped", "in_transit", "on_the_way", "picked_up"].some((s) => courier.includes(s)) ||
    !!o.consignment_id ||
    !!o.tracking_code;
  const isConfirmed = ["processing", "confirmed"].includes(orderStatus) || isShipped || isDelivered;



  const steps: Step[] = [
    {
      key: "placed",
      label: "Order placed",
      at: o.created_at,
      Icon: Package,
      done: true,
      detail: `Order ${o.order_number}`,
    },
    {
      key: "confirmed",
      label: "Order confirmed",
      at: isConfirmed ? o.updated_at : null,
      Icon: PhoneCall,
      done: isConfirmed,
    },
    {
      key: "processing",
      label: "Processing",
      at: isConfirmed ? o.updated_at : null,
      Icon: Clock,
      done: isConfirmed,
    },
    {
      key: "shipped",
      label: "Shipped",
      at: isShipped ? o.updated_at : null,
      Icon: Truck,
      done: isShipped,
    },
    {
      key: "delivered",
      label: isCancelled ? "Cancelled" : "Delivered",
      at: isDelivered || isCancelled ? o.updated_at : null,
      Icon: isCancelled ? XCircle : CheckCircle2,
      done: isDelivered || isCancelled,
    },
  ];

  // mark the last completed step as "current"
  const lastDone = [...steps].reverse().find((s) => s.done);
  if (lastDone) lastDone.active = true;
  return steps;
}

function currentStatusLabel(o: OrderInfo) {
  return o.order_status ? `Order: ${o.order_status}` : "Pending";
}

function paymentSubtext(o: OrderInfo) {
  const status = o.payment_status ? o.payment_status : "pending";
  return o.payment_method ? `Payment: ${status} • ${o.payment_method}` : `Payment: ${status}`;
}

function TrackPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setOrders([]);
    setSelectedId(null);
    try {
      const res = await lookupOrder({ data: { orderNumber, contact } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOrders(res.orders);
      setSelectedId(res.orders[0].id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  const order = orders.find((o) => o.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-6 py-10 sm:py-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Search className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-semibold tracking-tight">Track your order</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Enter your order number and the email or phone used at checkout.
          </p>
        </div>

        <form onSubmit={handleLookup} className="rounded-2xl border bg-card p-6 grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="track-order">Order number</Label>
            <Input
              id="track-order"
              placeholder="VE-XXXXXX-XXXXXX"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              minLength={3}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="track-contact">Email or phone</Label>
            <Input
              id="track-contact"
              placeholder="you@example.com or 01XXXXXXXXX"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              minLength={3}
              required
            />
          </div>
          <Button type="submit" variant="luxe" disabled={loading}>
            {loading ? "Looking up…" : "Track order"}
          </Button>
        </form>


        {orders.length > 1 && (
          <div className="mt-6 rounded-2xl border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
              {orders.length} orders found — select one
            </p>
            <div className="grid gap-2">
              {orders.map((o) => {
                const active = o.id === selectedId;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedId(o.id)}
                    className={`text-left rounded-lg border px-3 py-2 flex items-center justify-between gap-3 transition-colors ${
                      active ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{o.order_number}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</p>
                    </div>
                    <span className={`text-xs ${statusTone(o.order_status)}`}>
                      {o.order_status ?? "pending"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {order && (
          <div className="mt-8 rounded-2xl border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Order</p>
                <p className="text-lg font-semibold">{order.order_number}</p>
                <p className={`text-sm mt-1 ${statusTone(order.order_status)}`}>
                  {currentStatusLabel(order)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{paymentSubtext(order)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Link
                  to="/order/$id"
                  params={{ id: order.id }}
                  className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                >
                  View full order <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>


            <ol className="relative border-l border-border pl-6 space-y-6">
              {buildTimeline(order).map((step) => {
                const Icon = step.Icon;
                const doneCls = step.done
                  ? step.active
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                    : "bg-primary/90 text-primary-foreground"
                  : "bg-muted text-muted-foreground";
                return (
                  <li key={step.key} className="relative">
                    <span
                      className={`absolute -left-[34px] flex h-7 w-7 items-center justify-center rounded-full ${doneCls}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className={`text-sm font-medium ${step.done ? "" : "text-muted-foreground"}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {step.at ? fmtDate(step.at) : "Pending"}
                      </p>
                    </div>
                    {step.detail && (
                      <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}

