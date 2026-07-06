import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyOrders } from "@/lib/account.functions";
import { getInvoiceToken } from "@/lib/invoice.functions";
import { formatBDT } from "@/lib/currency";
import { MoreVertical, Package, Eye, FileText, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function statusVariant(status: string): { className: string } {
  const s = status.toLowerCase();
  if (["delivered", "completed", "paid"].includes(s))
    return { className: "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100" };
  if (["shipped", "out_for_delivery", "in_transit"].includes(s))
    return { className: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100" };
  if (["processing", "confirmed"].includes(s))
    return { className: "bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-100" };
  if (["pending", "unpaid", "on_hold"].includes(s))
    return { className: "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100" };
  if (["cancelled", "canceled", "refunded", "failed"].includes(s))
    return { className: "bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100" };
  return { className: "bg-muted text-foreground/70 border-border hover:bg-muted" };
}


export const Route = createFileRoute("/_authenticated/account/orders/")({
  head: () => ({
    meta: [
      { title: "Orders — My Account | Veloura Essence" },
      { name: "description", content: "View your Veloura Essence order history." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OrdersList,
});

function OrdersList() {
  const fetchOrders = useServerFn(listMyOrders);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => fetchOrders(),
  });

  async function openInvoice(orderId: string, newTab = false) {
    const t = toast.loading("Opening invoice…");
    try {
      const { token } = await getInvoiceToken({ data: { id: orderId } });
      const url = `/invoice/${orderId}?token=${token}`;
      toast.dismiss(t);
      if (newTab) window.open(url, "_blank");
      else navigate({ to: "/invoice/$id", params: { id: orderId }, search: { token } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open invoice", { id: t });
    }
  }

  async function copyOrderNumber(num: string) {
    try {
      await navigator.clipboard.writeText(num);
      toast.success("Order number copied");
    } catch {
      toast.error("Copy failed");
    }
  }

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
              <div
                key={o.id}
                className="relative p-4 rounded-xl border bg-card hover:shadow-md transition"
              >
                <Link
                  to="/account/orders/$id"
                  params={{ id: o.id }}
                  className="block pr-10"
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
                      <div className="mt-1 flex flex-wrap justify-end gap-1">
                        <Badge variant="outline" className={statusVariant(o.order_status).className}>
                          {o.order_status}
                        </Badge>
                        <Badge variant="outline" className={statusVariant(o.payment_status).className}>
                          {o.payment_status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Link>

                <div className="absolute top-3 right-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 bg-background"
                        aria-label="Order actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() => navigate({ to: "/account/orders/$id", params: { id: o.id } })}
                      >
                        <Eye className="w-4 h-4 mr-2" /> View details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openInvoice(o.id, false)}>
                        <FileText className="w-4 h-4 mr-2" /> View invoice
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openInvoice(o.id, true)}>
                        <ExternalLink className="w-4 h-4 mr-2" /> Invoice in new tab
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => copyOrderNumber(o.order_number)}>
                        <Copy className="w-4 h-4 mr-2" /> Copy order number
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
