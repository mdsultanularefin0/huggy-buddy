import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { getInvoiceOrder } from "@/lib/invoice.functions";
import { InvoiceDocument, type InvoiceOrder, type InvoiceBranding } from "@/components/invoice-document";
import { toast } from "sonner";
import { normalizeOklchInClone } from "@/lib/pdf-color-safe";

const searchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/invoice/$id")({
  validateSearch: (s) => searchSchema.parse(s),
  head: ({ params }) => ({
    meta: [
      { title: `Invoice INV-${params.id.slice(0, 8)}` },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: InvoicePage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-12 text-center">
        <p className="text-destructive mb-4">{error.message}</p>
        <Button variant="outline" onClick={() => { reset(); router.invalidate(); }}>Retry</Button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-12 text-center">Invoice not found.</div>,
});

function InvoicePage() {
  const { id } = Route.useParams();
  const { token } = Route.useSearch();
  const fetchInvoice = useServerFn(getInvoiceOrder);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["invoice", id, token ?? ""],
    queryFn: () => fetchInvoice({ data: { id, token: token ?? null } }),
    retry: false,
  });
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!data) return;
    setDownloading(true);
    try {
      const el = document.getElementById("invoice-document");
      if (!el) throw new Error("Invoice not ready");
      const mod = await import("html2pdf.js");
      const html2pdf = (mod as unknown as { default: (...args: unknown[]) => unknown }).default ?? (mod as unknown as (...a: unknown[]) => unknown);
      await (html2pdf as unknown as () => { from: (el: HTMLElement) => { set: (o: unknown) => { save: () => Promise<void> } } })()
        .from(el)
        .set({
          margin: 0,
          filename: `invoice-${data.order.order_number}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 3,
            useCORS: true,
            backgroundColor: "#ffffff",
            windowWidth: el.scrollWidth,
            windowHeight: el.scrollHeight,
            onclone: (doc: Document, el: HTMLElement) => normalizeOklchInClone(doc, el),
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
          pagebreak: { mode: ["css", "legacy", "avoid-all"] },
        })
        .save();

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  if (isLoading) {
    return <div className="p-16 text-center text-muted-foreground"><Loader2 className="w-5 h-5 inline animate-spin mr-2" />Loading invoice…</div>;
  }
  if (isError || !data) {
    return <div className="p-12 text-center text-destructive">{error instanceof Error ? error.message : "Could not load invoice."}</div>;
  }

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <div className="max-w-5xl mx-auto px-4 py-6 print:hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Back to shop</Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1" /> Print
            </Button>
            <Button variant="luxe" size="sm" onClick={handleDownload} disabled={downloading}>
              {downloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              Download PDF
            </Button>
          </div>
        </div>
      </div>
      <div className="pb-10 print:pb-0">
        <InvoiceDocument
          order={data.order as unknown as InvoiceOrder}
          branding={data.branding as InvoiceBranding}
        />
      </div>
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; }
          #invoice-document { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>
    </div>
  );
}
