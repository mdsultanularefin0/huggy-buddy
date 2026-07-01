import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyOrders } from "@/lib/account.functions";
import { formatBDT } from "@/lib/currency";
import { Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account/orders/")({
  component: OrdersList,
});

function OrdersList() {
  const fetchOrders = useServerFn(listMyOrders);
  const { data, isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => fetchOrders(),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground">Track and review your past orders.</p>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No orders yet.</p>
          <Link to="/products" className="text-primary underline text-sm">Browse fragrances</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((o) => {
            const items = Array.isArray(o.items_json) ? o.items_json.length : 0;
            return (
              <Link
                key={o.id}
                to="/account/orders/$id"
                params={{ id: o.id }}
                className="block p-4 rounded-xl border bg-card hover:shadow-md transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()} · {items} item{items === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatBDT(o.total)}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.order_status} · {o.payment_status}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
