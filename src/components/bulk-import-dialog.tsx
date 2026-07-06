import { useRef, useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Download, FileSpreadsheet, Loader2, Upload, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  BULK_IMPORT_HEADERS,
  bulkImportProducts,
  type ImportResult,
} from "@/lib/admin-data-ops.functions";
import { toCSV, downloadCSV } from "@/lib/csv";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

type ParsedRow = {
  product_handle: string;
  product_name: string;
  description: string;
  category_slug: string;
  scent_profile: string;
  variant_size_label: string;
  variant_price: number;
  variant_stock: number;
};

const HEADER_MAP: Record<string, keyof ParsedRow> = {
  "Product Handle": "product_handle",
  "Product Handle (Slug)": "product_handle",
  "Product Name": "product_name",
  Description: "description",
  "Category Slug": "category_slug",
  "Scent Profile": "scent_profile",
  "Variant Size Label": "variant_size_label",
  "Variant Price": "variant_price",
  "Variant Stock": "variant_stock",
};

export function BulkImportDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const importFn = useServerFn(bulkImportProducts);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setFile(null);
    setRows([]);
    setParseErrors([]);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function downloadSample() {
    const sample = [
      {
        "Product Handle": "amber-oud",
        "Product Name": "Amber Oud",
        Description: "Warm amber with smoky oud.",
        "Category Slug": "signature",
        "Scent Profile": "Oud",
        "Variant Size Label": "6ml",
        "Variant Price": 500,
        "Variant Stock": 20,
      },
      {
        "Product Handle": "amber-oud",
        "Product Name": "Amber Oud",
        Description: "Warm amber with smoky oud.",
        "Category Slug": "signature",
        "Scent Profile": "Oud",
        "Variant Size Label": "12ml",
        "Variant Price": 900,
        "Variant Stock": 12,
      },
    ];
    downloadCSV(
      "veloura-bulk-import-sample.csv",
      toCSV(sample, [...BULK_IMPORT_HEADERS]),
    );
  }

  function handleFile(f: File) {
    setFile(f);
    setResult(null);
    setParseErrors([]);
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const errs: string[] = [];
        const parsed: ParsedRow[] = [];
        res.data.forEach((raw, i) => {
          const row: Partial<ParsedRow> = {};
          for (const [csvHeader, key] of Object.entries(HEADER_MAP)) {
            if (raw[csvHeader] !== undefined) {
              const val = raw[csvHeader].trim();
              if (key === "variant_price" || key === "variant_stock") {
                (row as Record<string, unknown>)[key] = Number(val || 0);
              } else {
                (row as Record<string, unknown>)[key] = val;
              }
            }
          }
          if (!row.product_handle || !row.product_name || !row.variant_size_label) {
            errs.push(`Row ${i + 2}: missing required Product Handle / Name / Variant Size Label`);
            return;
          }
          parsed.push({
            product_handle: row.product_handle,
            product_name: row.product_name,
            description: row.description ?? "",
            category_slug: row.category_slug ?? "",
            scent_profile: row.scent_profile ?? "",
            variant_size_label: row.variant_size_label,
            variant_price: Number(row.variant_price ?? 0),
            variant_stock: Number(row.variant_stock ?? 0),
          });
        });
        setRows(parsed);
        setParseErrors(errs);
      },
      error: (err) => setParseErrors([err.message]),
    });
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setSubmitting(true);
    try {
      const res = await importFn({ data: { rows } });
      setResult(res);
      const total = res.created_products + res.updated_products;
      toast.success(
        `Imported ${total} product${total === 1 ? "" : "s"} (${res.variants_upserted} variants)` +
          (res.errors.length ? `, ${res.errors.length} row error${res.errors.length === 1 ? "" : "s"}` : ""),
      );
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk import products</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border p-3 flex items-start justify-between gap-3 bg-muted/30">
            <div className="text-sm">
              <div className="font-medium">Not sure of the format?</div>
              <p className="text-muted-foreground text-xs mt-1">
                Download the sample CSV. Rows sharing the same <code>Product Handle</code> become
                variants of the same product.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadSample}>
              <Download className="w-4 h-4 mr-1" /> Sample CSV
            </Button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            className={`border-2 border-dashed rounded-md p-6 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-muted"
            }`}
          >
            <FileSpreadsheet className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm mt-2">
              {file ? file.name : "Drag & drop your CSV, or click to browse"}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="mt-3 flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-1" /> Choose file
              </Button>
              {file && (
                <Button variant="ghost" size="sm" onClick={reset}>
                  <X className="w-4 h-4 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>

          {rows.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Parsed <strong className="text-foreground">{rows.length}</strong> row
              {rows.length === 1 ? "" : "s"} across{" "}
              <strong className="text-foreground">
                {new Set(rows.map((r) => r.product_handle.toLowerCase())).size}
              </strong>{" "}
              product{rows.length === 1 ? "" : "s"}.
            </div>
          )}

          {parseErrors.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-center gap-1 font-medium">
                <AlertTriangle className="w-4 h-4" /> Parse warnings
              </div>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-xs">
                {parseErrors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {parseErrors.length > 10 && <li>…and {parseErrors.length - 10} more</li>}
              </ul>
            </div>
          )}

          {result && (
            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                Created {result.created_products}, updated {result.updated_products}, variants{" "}
                {result.variants_upserted}
              </div>
              {result.errors.length > 0 && (
                <div className="text-rose-700">
                  <div className="font-medium flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> {result.errors.length} row error
                    {result.errors.length === 1 ? "" : "s"}
                  </div>
                  <ul className="mt-1 list-disc list-inside text-xs max-h-40 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <li key={i}>Row {e.row} failed: {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button
            variant="luxe"
            onClick={handleImport}
            disabled={submitting || rows.length === 0}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Import {rows.length > 0 ? `${rows.length} row${rows.length === 1 ? "" : "s"}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
