import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBDT } from "@/lib/currency";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getOrderById, lookupOrder, claimGuestOrder } from "@/lib/orders.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type OrderRow = {
  id: string; order_number: string; total: number; subtotal: number;
  shipping_fee: number; discount: number; payment_method: string;
  user_id: string | null;
  customer_json: { name?: string; phone?: string; address?: string; email?: string } | null;
  items_json: { name: string; size?: string | null; quantity: number; unitPrice: number }[] | null;
};


const orderOptions = (id: string) =>
  queryOptions({
    queryKey: ["order", id],
    queryFn: async () => {
      const data = await getOrderById({ data: { id } });
      return data as unknown as OrderRow | null;
    },
  });

export const Route = createFileRoute("/order/$id")({
  head: () => ({ meta: [{ title: "Order Confirmation — Veloura Essence" }] }),
  loader: async ({ context, params }) => {
    const o = await context.queryClient.ensureQueryData(orderOptions(params.id));
    if (!o) throw notFound();
  },
  component: OrderPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => (
    <div className="p-12 text-center">
      <p className="text-muted-foreground">Order not found.</p>
      <Link to="/" className="text-primary underline mt-4 inline-block">Back to shop</Link>
    </div>
  ),
});

function OrderPage() {
  const { id } = Route.useParams();
  const { data: order } = useSuspenseQuery(orderOptions(id));
  if (!order) return null;
  const items = order.items_json ?? [];
  const c = order.customer_json ?? {};

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <CheckCircle2 className="w-14 h-14 text-accent mx-auto" />
          <h1 className="text-3xl font-semibold tracking-tight mt-4">Thank you!</h1>
          <p className="text-muted-foreground mt-2">Your order has been placed successfully.</p>
          <p className="text-sm mt-3">
            Order # <span className="font-mono font-semibold">{order.order_number}</span>
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div>
            <h2 className="font-semibold mb-2">Delivery to</h2>
            <p className="text-sm">{c.name}</p>
            <p className="text-sm text-muted-foreground">{c.phone}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{c.address}</p>
          </div>

          <div className="border-t pt-4">
            <h2 className="font-semibold mb-3">Items</h2>
            <div className="space-y-2">
              {items.map((i, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{i.name}{i.size ? ` (${i.size})` : ""} × {i.quantity}</span>
                  <span className="font-medium">{formatBDT(i.unitPrice * i.quantity)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatBDT(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{order.shipping_fee === 0 ? "Free" : formatBDT(order.shipping_fee)}</span></div>
            {order.discount > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>−{formatBDT(order.discount)}</span></div>
            )}
            <div className="flex justify-between font-semibold text-base pt-2"><span>Total</span><span>{formatBDT(order.total)}</span></div>
            <div className="flex justify-between pt-2"><span className="text-muted-foreground">Payment</span><span>{order.payment_method}</span></div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Save this page or bookmark the URL to check your order later — no account required.
        </p>
        <div className="text-center mt-6">
          <Link to="/"><Button variant="luxe">Continue shopping</Button></Link>
        </div>

        <ClaimAccountSection order={order} />
        <TrackOrderSection />

      </div>
      <SiteFooter />
    </div>
  );
}

function TrackOrderSection() {
  const navigate = useNavigate();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await lookupOrder({ data: { orderNumber, email } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      navigate({ to: "/order/$id", params: { id: res.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-12 rounded-2xl border bg-card p-6">
      <div className="flex items-center gap-2 mb-2">
        <Search className="w-5 h-5 text-primary" />
        <h2 className="font-semibold">Track your order</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Enter the order number and the email used at checkout to view a different order.
      </p>
      <form onSubmit={handleLookup} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="track-order-number">Order number</Label>
          <Input
            id="track-order-number"
            placeholder="VE-XXXXXX-XXXXXX"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="track-email">Email</Label>
          <Input
            id="track-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" variant="luxe" className="w-full sm:w-auto" disabled={loading}>
            {loading ? "Looking up…" : "Track order"}
          </Button>
        </div>
      </form>
    </div>
  );
}

