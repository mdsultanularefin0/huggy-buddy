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
        width: 1.2,
        height: 28,
        displayValue: false,
        margin: 0,
        background: "#ffffff",
      });
    } catch { /* noop */ }
  }, [value]);
  return <svg ref={ref} style={{ maxWidth: "100%" }} />;
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
  const due = Math.max(0, Number(order.total) - Number(order.amount_paid ?? 0));

  return (
    <div
      className="courier-label bg-white text-black border border-black overflow-hidden flex flex-col"
      style={{ width: "50mm", height: "72mm", padding: "2mm", fontSize: "7pt", lineHeight: 1.15 }}
    >
      <div className="flex justify-between items-start border-b border-black pb-1 mb-1">
        <div className="min-w-0">
          <div className="uppercase font-semibold truncate" style={{ fontSize: "6pt" }}>Veloura Essence</div>
          <div className="font-mono font-bold truncate" style={{ fontSize: "7pt" }}>{order.order_number}</div>
        </div>
        <div className="border border-black px-1 font-bold uppercase" style={{ fontSize: "6pt" }}>
          {due > 0 ? "COD" : "PAID"}
        </div>
      </div>

      <div className="text-center border-b border-black pb-1 mb-1">
        <div className="uppercase" style={{ fontSize: "5.5pt" }}>Courier ID</div>
        <div className="font-mono font-bold leading-tight break-all" style={{ fontSize: "11pt" }}>{courierId}</div>
      </div>

      <div className="border-b border-black pb-1 mb-1" style={{ fontSize: "6.5pt" }}>
        <div className="font-semibold truncate">{c.name ?? "—"}</div>
        {c.phone && <div>{c.phone}</div>}
        {c.address && <div className="line-clamp-2">{c.address}</div>}
        {(c.area || c.district) && <div className="truncate">{[c.area, c.district].filter(Boolean).join(", ")}</div>}
      </div>

      <div className="flex justify-between items-center border-b border-black pb-1 mb-1">
        <div>
          <div className="uppercase" style={{ fontSize: "5.5pt" }}>Items</div>
          <div className="font-bold">{totalQty}</div>
        </div>
        <div className="text-right">
          <div className="uppercase" style={{ fontSize: "5.5pt" }}>COD / Due</div>
          <div className="font-bold" style={{ fontSize: "9pt" }}>{formatBDT(due)}</div>
        </div>
      </div>

      <div style={{ fontSize: "5.5pt" }} className="flex-1 min-h-0 overflow-hidden">
        <ul>
          {items.slice(0, 2).map((it, i) => (
            <li key={i} className="flex justify-between gap-1 truncate">
              <span className="truncate">{it.name}</span>
              <span className="font-mono">×{it.qty}</span>
            </li>
          ))}
          {items.length > 2 && <li className="italic">+{items.length - 2} more…</li>}
        </ul>
      </div>

      <div className="mt-auto pt-1 border-t border-black flex justify-center">
        <Barcode value={courierId} />
      </div>
    </div>
  );
}

function BulkLabelsPage() {
  const { ids } = Route.useSearch();
  const idList = ids.split(",").map((s: string) => s.trim()).filter(Boolean);
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
  const pages: OrderRow[][] = [];
  for (let i = 0; i < orders.length; i += 16) pages.push(orders.slice(i, i + 16));

  return <BulkLabelsView orders={orders} pages={pages} />;
}

function BulkLabelsView({ orders, pages }: { orders: OrderRow[]; pages: OrderRow[][] }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const el = document.getElementById("bulk-labels-print");
      if (!el) throw new Error("Not ready");
      const mod = await import("html2pdf.js");
      const html2pdf = (mod as unknown as { default: (...args: unknown[]) => unknown }).default ?? (mod as unknown as (...a: unknown[]) => unknown);
      await (html2pdf as unknown as (opts?: unknown) => {
        from: (el: HTMLElement) => { set: (o: unknown) => { save: () => Promise<void> } };
      })()
        .from(el)
        .set({
          margin: 0,
          filename: `labels-${new Date().toISOString().slice(0, 10)}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"], before: ".a4-page:not(:first-child)" },
        })
        .save();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <div className="max-w-4xl mx-auto px-4 py-6 print:hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/orders"><ArrowLeft className="w-4 h-4 mr-1" /> Back to orders</Link>
          </Button>
          <div className="text-sm text-muted-foreground">
            {orders.length} label{orders.length === 1 ? "" : "s"} · {pages.length} A4 page{pages.length === 1 ? "" : "s"}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1" /> Print all
            </Button>
            <Button variant="luxe" size="sm" onClick={handleDownload} disabled={downloading}>
              {downloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div id="bulk-labels-print" className="pb-10 print:p-0 flex flex-col items-center gap-6 print:gap-0">
        {pages.map((page, pi) => (
          <div
            key={pi}
            className="a4-page bg-white shadow print:shadow-none"
            style={{ width: "210mm", height: "297mm", padding: "5mm", boxSizing: "border-box" }}
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: "repeat(4, 50mm)",
                gridTemplateRows: "repeat(4, 72mm)",
                gap: "0",
                justifyContent: "center",
                alignContent: "start",
              }}
            >
              {page.map((o) => <Label key={o.id} order={o} />)}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: white !important; }
          body * { visibility: hidden !important; }
          #bulk-labels-print, #bulk-labels-print * { visibility: visible !important; }
          #bulk-labels-print { position: absolute; left: 0; top: 0; }
          .a4-page { page-break-after: always; break-after: page; box-shadow: none !important; margin: 0 !important; }
          .a4-page:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>
    </div>
  );
}
  );
}
