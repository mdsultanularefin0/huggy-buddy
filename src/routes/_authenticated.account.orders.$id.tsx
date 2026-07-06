import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyOrder } from "@/lib/account.functions";
import { formatBDT } from "@/lib/currency";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/account/orders/$id")({
  head: () => ({
    meta: [
      { title: "Order Details — My Account | Veloura Essence" },
      { name: "description", content: "View details for your Veloura Essence order." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OrderDetail,
});

type Item = {
  name: string;
  quantity: number;
  unitPrice: number;
  size?: string | null;
  imageUrl?: string | null;
  selections?: { productId: string; name: string }[] | null;
};

type Customer = { name?: string; phone?: string; email?: string; address?: string };

function OrderDetail() {
  const { id } = Route.useParams();
  const fetchOrder = useServerFn(getMyOrder);
  const { data: o, isLoading } = useQuery({
    queryKey: ["my-order", id],
    queryFn: () => fetchOrder({ data: { id } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!o) return <p>Order not found.</p>;
  const items = (o.items_json ?? []) as Item[];
  const customer = (o.customer_json ?? {}) as Customer;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/account/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> Back to orders
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link to="/invoice/$id" params={{ id: o.id }} target="_blank">
            <FileText className="w-4 h-4 mr-1" /> View invoice
          </Link>
        </Button>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{o.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            Placed {new Date(o.created_at).toLocaleString()}
          </p>
        </div>
        <div className="text-right text-sm">
          <p><span className="text-muted-foreground">Status:</span> <strong>{o.order_status}</strong></p>
          <p><span className="text-muted-foreground">Payment:</span> <strong>{o.payment_status}</strong></p>
          {o.tracking_code && <p><span className="text-muted-foreground">Tracking:</span> {o.tracking_code}</p>}
        </div>
      </header>

      <section>
        <h2 className="font-semibold mb-2">Items</h2>
        <div className="divide-y border rounded-xl">
          {items.map((it, i) => (
            <div key={i} className="p-3 flex gap-3">
              <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                {it.imageUrl && <img src={it.imageUrl} alt={it.name} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{it.name}</p>
                {it.size && <p className="text-xs text-muted-foreground">{it.size}</p>}
                <p className="text-xs text-muted-foreground">Qty {it.quantity}</p>
                {it.selections && it.selections.length > 0 && (
                  <ul className="mt-1 text-xs text-muted-foreground list-disc list-inside">
                    {it.selections.map((s, si) => (
                      <li key={si}>{s.name}</li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-sm font-semibold">{formatBDT(it.unitPrice * it.quantity)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="p-4 rounded-xl border">
          <h3 className="font-semibold mb-2">Delivery to</h3>
          <p className="text-sm">{customer.name}</p>
          <p className="text-sm text-muted-foreground">{customer.phone}</p>
          {customer.email && <p className="text-sm text-muted-foreground">{customer.email}</p>}
          <p className="text-sm mt-1">{customer.address}</p>
        </div>
        <div className="p-4 rounded-xl border">
          <h3 className="font-semibold mb-2">Summary</h3>
          <dl className="text-sm space-y-1">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatBDT(o.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Shipping</dt><dd>{formatBDT(o.shipping_fee)}</dd></div>
            {o.discount > 0 && (
              <div className="flex justify-between text-primary"><dt>Discount</dt><dd>−{formatBDT(o.discount)}</dd></div>
            )}
            <div className="flex justify-between font-semibold border-t pt-1 mt-1">
              <dt>Total</dt><dd>{formatBDT(o.total)}</dd>
            </div>
            <div className="flex justify-between pt-2"><dt>Payment method</dt><dd>{o.payment_method}</dd></div>
          </dl>
        </div>
      </section>
    </div>
  );
}
