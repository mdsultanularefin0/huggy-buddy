import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { unsubscribeNewsletter } from "@/lib/email.functions";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({
    meta: [
      { title: "Unsubscribe — Veloura Essence" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : "",
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = Route.useSearch();
  const unsub = useServerFn(unsubscribeNewsletter);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { setState("error"); setMessage("Missing token."); return; }
    unsub({ data: { token } })
      .then((r) => { setState("ok"); setMessage(`${r.email} has been unsubscribed.`); })
      .catch((e: Error) => { setState("error"); setMessage(e.message); });
  }, [token, unsub]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-16">
        <Card className="p-8 text-center">
          {state === "loading" && <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />}
          {state === "ok" && (
            <>
              <CheckCircle2 className="w-10 h-10 mx-auto text-green-600 mb-3" />
              <h1 className="text-xl font-semibold">You've been unsubscribed</h1>
              <p className="text-sm text-muted-foreground mt-2">{message}</p>
            </>
          )}
          {state === "error" && (
            <>
              <XCircle className="w-10 h-10 mx-auto text-destructive mb-3" />
              <h1 className="text-xl font-semibold">Something went wrong</h1>
              <p className="text-sm text-muted-foreground mt-2">{message}</p>
            </>
          )}
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
