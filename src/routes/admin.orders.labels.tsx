import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { z } from "zod";
import JsBarcode from "jsbarcode";
import { getAdminOrdersByIds } from "@/lib/admin-mutations.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { formatBDT } from "@/lib/currency";

const searchSchema = z.object({ ids: z.string().min(1) });

export const Route = createFileRoute("/admin/orders/labels")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Courier Labels" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: BulkLabelsPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-12 text-center">
        <p className="text-destructive mb-4">{error.message}</p>
        <Button variant="outline" onClick={() => { reset(); router.invalidate(); }}>Retry</Button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-12 text-center">No orders.</div>,
});

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        width: 2,
        height: 70,
        displayValue: true,
        fontSize: 16,
        margin: 0,
        background: "#ffffff",
      });
    } catch { /* noop */ }
  }, [value]);
  return <svg ref={ref} />;
}

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  payment_method: string | null;
  total: number;
  amount_paid: number | null;
  tracking_code: string | null;
  consignment_id: number | null;
  customer_json: unknown;
  items_json: unknown;
};

function Label({ order }: { order: OrderRow }) {
  const c = (order.customer_json as { name?: string; phone?: string; address?: string; district?: string; area?: string } | null) ?? {};
  const items = ((order.items_json as Array<Record<string, unknown>>) ?? []).map((it) => ({
    name: (it.name as string | undefined) ?? "",
    qty: (it.qty as number | undefined) ?? (it.quantity as number | undefined) ?? 1,
  }));
  const totalQty = items.reduce((n, it) => n + (it.qty ?? 1), 0);
  const courierId = order.consignment_id ? String(order.consignment_id) : (order.tracking_code ?? order.order_number);

  return (
    <div
      className="courier-label bg-white text-black mx-auto border border-black shadow print:shadow-none print:border-0"
      style={{ width: "100mm", padding: "6mm" }}
    >
      <div className="flex justify-between items-start border-b border-black pb-2 mb-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider">Veloura Essence</div>
          <div className="text-xs">Order: <span className="font-mono font-semibold">{order.order_number}</span></div>
        </div>
        <div className="text-right text-[10px]">
          {new Date(order.created_at).toLocaleDateString()}
          <div className="mt-1 border border-black px-2 py-0.5 font-bold uppercase">
            {order.payment_method === "COD" ? "Cash on Delivery" : "Prepaid"}
          </div>
        </div>
      </div>

      <div className="text-center py-2 border-b border-black">
        <div className="text-[10px] uppercase tracking-wider mb-1">Courier ID</div>
        <div className="flex justify-center"><Barcode value={courierId} /></div>
      </div>

      <div className="grid grid-cols-2 gap-2 py-2 border-b border-black text-[11px]">
        <div>
          <div className="uppercase tracking-wider text-[9px]">From</div>
          <div className="font-semibold">Veloura Essence</div>
          <div>Dhaka, Bangladesh</div>
        </div>
        <div>
          <div className="uppercase tracking-wider text-[9px]">To</div>
          <div className="font-semibold">{c.name ?? "—"}</div>
          {c.phone && <div>{c.phone}</div>}
          {c.address && <div>{c.address}</div>}
          {(c.area || c.district) && <div>{[c.area, c.district].filter(Boolean).join(", ")}</div>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 py-2 border-b border-black text-[11px] text-center">
        <div>
          <div className="uppercase tracking-wider text-[9px]">Items</div>
          <div className="font-bold text-base">{totalQty}</div>
        </div>
        <div>
          <div className="uppercase tracking-wider text-[9px]">COD Amount</div>
          <div className="font-bold text-base">
            {order.payment_method === "COD" ? formatBDT(Math.max(0, Number(order.total) - Number(order.amount_paid ?? 0))) : formatBDT(0)}
          </div>
        </div>
        <div>
          <div className="uppercase tracking-wider text-[9px]">Weight</div>
          <div className="font-bold text-base">0.5 kg</div>
        </div>
      </div>

      <div className="py-2 text-[10px]">
        <div className="uppercase tracking-wider text-[9px] mb-1">Contents</div>
        <ul className="space-y-0.5">
          {items.map((it, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate">{it.name}</span>
              <span className="font-mono">×{it.qty}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BulkLabelsPage() {
  const { ids } = Route.useSearch();
  const idList = ids.split(",").map((s) => s.trim()).filter(Boolean);
  const fetchOrders = useServerFn(getAdminOrdersByIds);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "orders-bulk-labels", ids],
    queryFn: () => fetchOrders({ data: { ids: idList } }),
  });

  if (isLoading) {
    return <div className="p-16 text-center text-muted-foreground"><Loader2 className="w-5 h-5 inline animate-spin mr-2" />Loading labels…</div>;
  }
  if (isError || !data) {
    return <div className="p-12 text-center text-destructive">{error instanceof Error ? error.message : "Could not load orders."}</div>;
  }

  const orders = data as OrderRow[];

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <div className="max-w-3xl mx-auto px-4 py-6 print:hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/orders"><ArrowLeft className="w-4 h-4 mr-1" /> Back to orders</Link>
          </Button>
          <div className="text-sm text-muted-foreground">{orders.length} label{orders.length === 1 ? "" : "s"}</div>
          <Button variant="luxe" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> Print all
          </Button>
        </div>
      </div>

      <div className="pb-10 print:p-0 space-y-6 print:space-y-0">
        {orders.map((o) => (
          <div key={o.id} className="label-page">
            <Label order={o} />
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          @page { size: 100mm 150mm; margin: 0; }
          body { background: white !important; }
          .label-page { page-break-after: always; break-after: page; }
          .label-page:last-child { page-break-after: auto; break-after: auto; }
          .courier-label { box-shadow: none !important; border: 0 !important; margin: 0 !important; }
        }
      `}</style>
    </div>
  );
}
