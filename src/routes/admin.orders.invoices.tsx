import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { getAdminInvoicesByIds } from "@/lib/admin-mutations.functions";
import { InvoiceDocument, type InvoiceOrder, type InvoiceBranding } from "@/components/invoice-document";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { normalizeOklchInClone } from "@/lib/pdf-color-safe";

const searchSchema = z.object({ ids: z.string().min(1) });

export const Route = createFileRoute("/admin/orders/invoices")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Bulk Invoices" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: BulkInvoicesPage,
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

function BulkInvoicesPage() {
  const { ids } = Route.useSearch();
  const idList = ids.split(",").map((s: string) => s.trim()).filter(Boolean);
  const fetchInvoices = useServerFn(getAdminInvoicesByIds);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "bulk-invoices", ids],
    queryFn: () => fetchInvoices({ data: { ids: idList } }),
  });
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!data) return;
    setDownloading(true);
    try {
      const el = document.getElementById("bulk-invoices-print");
      if (!el) throw new Error("Not ready");
      const mod = await import("html2pdf.js");
      const html2pdf = (mod as unknown as { default: (...args: unknown[]) => unknown }).default ?? (mod as unknown as (...a: unknown[]) => unknown);
      await (html2pdf as unknown as (opts?: unknown) => {
        from: (el: HTMLElement) => { set: (o: unknown) => { save: () => Promise<void> } };
      })()
        .from(el)
        .set({
          margin: 0,
          filename: `invoices-${new Date().toISOString().slice(0, 10)}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", onclone: (doc: Document, el: HTMLElement) => normalizeOklchInClone(doc, el) },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"], before: ".invoice-page-break" },
        })
        .save();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  if (isLoading) {
    return <div className="p-16 text-center text-muted-foreground"><Loader2 className="w-5 h-5 inline animate-spin mr-2" />Loading invoices…</div>;
  }
  if (isError || !data) {
    return <div className="p-12 text-center text-destructive">{error instanceof Error ? error.message : "Could not load invoices."}</div>;
  }

  const orders = data.orders as unknown as InvoiceOrder[];
  const branding = data.branding as InvoiceBranding;

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <div className="max-w-5xl mx-auto px-4 py-6 print:hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/orders"><ArrowLeft className="w-4 h-4 mr-1" /> Back to orders</Link>
          </Button>
          <div className="text-sm text-muted-foreground">
            {orders.length} invoice{orders.length === 1 ? "" : "s"}
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

      <div id="bulk-invoices-print" className="pb-10 print:pb-0 flex flex-col items-center gap-6 print:gap-0">
        {orders.map((o, i) => (
          <div key={o.id} className={i > 0 ? "invoice-page-break" : ""}>
            <InvoiceDocument order={o} branding={branding} />
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: white !important; }
          body * { visibility: hidden !important; }
          #bulk-invoices-print, #bulk-invoices-print * { visibility: visible !important; }
          #bulk-invoices-print { position: absolute; left: 0; top: 0; width: 210mm; }
          #bulk-invoices-print > div { page-break-after: always; break-after: page; box-shadow: none !important; margin: 0 !important; }
          #bulk-invoices-print > div:last-child { page-break-after: auto; break-after: auto; }
        }
        .invoice-page-break { page-break-before: always; break-before: page; }
      `}</style>
    </div>
  );
}
