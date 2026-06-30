import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { uploadImage } from "@/lib/upload";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/upload-test")({ component: UploadTestPage });

type Result = {
  bucket: string;
  url: string;
  httpStatus: number | null;
  loaded: boolean | null;
  error?: string;
};

const BUCKETS = ["hero-images", "product-images", "combo-images"];

// 1x1 transparent PNG
const PNG_BYTES = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  ),
  (c) => c.charCodeAt(0),
);

async function runTest(bucket: string): Promise<Result> {
  try {
    const file = new File([PNG_BYTES], `test-${Date.now()}.png`, { type: "image/png" });
    const url = await uploadImage(bucket, file);
    const res = await fetch(url, { method: "GET" });
    const loaded = await new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
    return { bucket, url, httpStatus: res.status, loaded };
  } catch (e) {
    return { bucket, url: "", httpStatus: null, loaded: false, error: (e as Error).message };
  }
}

function UploadTestPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);
  const [logoCheck, setLogoCheck] = useState<{ url: string; status: number } | null>(null);

  async function runAll() {
    setRunning(true);
    setResults([]);
    const out: Result[] = [];
    for (const b of BUCKETS) {
      out.push(await runTest(b));
      setResults([...out]);
    }
    // Check current saved logo
    const { data } = await supabase
      .from("site_settings")
      .select("site_logo_url")
      .limit(1)
      .maybeSingle();
    if (data?.site_logo_url) {
      try {
        const r = await fetch(data.site_logo_url);
        setLogoCheck({ url: data.site_logo_url, status: r.status });
      } catch {
        setLogoCheck({ url: data.site_logo_url, status: 0 });
      }
    }
    setRunning(false);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Upload diagnostics</h1>
        <p className="text-muted-foreground mt-1">
          Uploads a 1×1 PNG to each storage bucket and verifies it serves back over HTTP and renders
          in an &lt;img&gt; tag. Also re-checks the current site logo URL.
        </p>
      </div>

      <Button variant="luxe" onClick={runAll} disabled={running}>
        {running && <Loader2 className="w-4 h-4 animate-spin mr-1" />}Run test
      </Button>

      {results.length > 0 && (
        <Card className="p-6 space-y-4">
          {results.map((r) => (
            <div key={r.bucket} className="border-b last:border-0 pb-4 last:pb-0">
              <div className="flex items-center gap-2 font-medium">
                {r.loaded && r.httpStatus === 200 ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive" />
                )}
                {r.bucket}
                <span className="text-xs text-muted-foreground ml-auto">
                  HTTP {r.httpStatus ?? "—"} · img {r.loaded ? "ok" : "fail"}
                </span>
              </div>
              {r.error && <p className="text-xs text-destructive mt-1">{r.error}</p>}
              {r.url && (
                <div className="flex items-center gap-3 mt-2">
                  <img src={r.url} alt="" className="w-8 h-8 border rounded bg-muted" />
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline truncate flex-1"
                  >
                    {r.url}
                  </a>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {logoCheck && (
        <Card className="p-6">
          <div className="flex items-center gap-2 font-medium">
            {logoCheck.status === 200 ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-destructive" />
            )}
            Current site logo · HTTP {logoCheck.status}
          </div>
          <a
            href={logoCheck.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs underline truncate block mt-2"
          >
            {logoCheck.url}
          </a>
        </Card>
      )}
    </div>
  );
}
