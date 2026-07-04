import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Search, UserPlus, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBDT } from "@/lib/currency";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getOrderById, lookupOrder, claimGuestOrder } from "@/lib/orders.functions";
import { getInvoiceToken } from "@/lib/invoice.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type OrderRow = {
  id: string; order_number: string; total: number; subtotal: number;
  shipping_fee: number; discount: number; payment_method: string;
  user_id: string | null;
  customer_json: { name?: string; phone?: string; address?: string; email?: string } | null;
  items_json: { name: string; size?: string | null; quantity: number; unitPrice: number }[] | null;
};


const orderOptions = (id: string) =>
  queryOptions({
    queryKey: ["order", id],
    queryFn: async () => {
      const data = await getOrderById({ data: { id } });
      return data as unknown as OrderRow | null;
    },
  });

export const Route = createFileRoute("/order/$id")({
  head: ({ params, loaderData }) => {
    const orderNumber = (loaderData as { orderNumber?: string } | undefined)?.orderNumber;
    const title = orderNumber
      ? `Order ${orderNumber} — Veloura Essence`
      : "Order Confirmation — Veloura Essence";
    const description = orderNumber
      ? `Status and details for Veloura Essence order ${orderNumber}.`
      : "Your Veloura Essence order confirmation and status.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex,nofollow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `/order/${params.id}` },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: `/order/${params.id}` }],
    };
  },

  loader: async ({ context, params }) => {
    const o = await context.queryClient.ensureQueryData(orderOptions(params.id));
    if (!o) throw notFound();
    return { orderNumber: o.order_number };
  },

  component: OrderPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => (
    <div className="p-12 text-center">
      <p className="text-muted-foreground">Order not found.</p>
      <Link to="/" className="text-primary underline mt-4 inline-block">Back to shop</Link>
    </div>
  ),
});

function OrderPage() {
  const { id } = Route.useParams();
  const { data: order } = useSuspenseQuery(orderOptions(id));
  if (!order) return null;
  const items = order.items_json ?? [];
  const c = order.customer_json ?? {};

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <CheckCircle2 className="w-14 h-14 text-accent mx-auto" />
          <h1 className="text-3xl font-semibold tracking-tight mt-4">Thank you!</h1>
          <p className="text-muted-foreground mt-2">Your order has been placed successfully.</p>
          <p className="text-sm mt-3">
            Order # <span className="font-mono font-semibold">{order.order_number}</span>
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div>
            <h2 className="font-semibold mb-2">Delivery to</h2>
            <p className="text-sm">{c.name}</p>
            <p className="text-sm text-muted-foreground">{c.phone}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{c.address}</p>
          </div>

          <div className="border-t pt-4">
            <h2 className="font-semibold mb-3">Items</h2>
            <div className="space-y-2">
              {items.map((i, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{i.name}{i.size ? ` (${i.size})` : ""} × {i.quantity}</span>
                  <span className="font-medium">{formatBDT(i.unitPrice * i.quantity)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatBDT(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{order.shipping_fee === 0 ? "Free" : formatBDT(order.shipping_fee)}</span></div>
            {order.discount > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>−{formatBDT(order.discount)}</span></div>
            )}
            <div className="flex justify-between font-semibold text-base pt-2"><span>Total</span><span>{formatBDT(order.total)}</span></div>
            <div className="flex justify-between pt-2"><span className="text-muted-foreground">Payment</span><span>{order.payment_method}</span></div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Save this page or bookmark the URL to check your order later — no account required.
        </p>
        <div className="text-center mt-6 flex flex-wrap gap-2 justify-center">
          <Link to="/"><Button variant="luxe">Continue shopping</Button></Link>
          <InvoiceButton orderId={order.id} />
        </div>

        <ClaimAccountSection order={order} />
        <TrackOrderSection />

      </div>
      <SiteFooter />
    </div>
  );
}

function TrackOrderSection() {
  const navigate = useNavigate();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await lookupOrder({ data: { orderNumber, email } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      navigate({ to: "/order/$id", params: { id: res.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-12 rounded-2xl border bg-card p-6">
      <div className="flex items-center gap-2 mb-2">
        <Search className="w-5 h-5 text-primary" />
        <h2 className="font-semibold">Track your order</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Enter the order number and the email used at checkout to view a different order.
      </p>
      <form onSubmit={handleLookup} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="track-order-number">Order number</Label>
          <Input
            id="track-order-number"
            placeholder="VE-XXXXXX-XXXXXX"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="track-email">Email</Label>
          <Input
            id="track-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" variant="luxe" className="w-full sm:w-auto" disabled={loading}>
            {loading ? "Looking up…" : "Track order"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ClaimAccountSection({ order }: { order: OrderRow }) {
  const qc = useQueryClient();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const email = order.customer_json?.email ?? "";
  const retryBtnRef = useRef<HTMLButtonElement>(null);
  const statusMsg = loading
    ? (signedIn ? "Linking order to your account…" : "Creating your account…")
    : "";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (lastError && !loading) retryBtnRef.current?.focus();
  }, [lastError, loading]);


  if (order.user_id || !email || signedIn === null || claimed) return null;

  async function attach(): Promise<boolean> {
    const tId = toast.loading("Linking order to your account…");
    try {
      const res = await claimGuestOrder({ data: { orderId: order.id } });
      if (!res.ok) {
        toast.error(res.error, { id: tId });
        setLastError(res.error);
        return false;
      }
      toast.success("Order saved to your account", { id: tId });
      setLastError(null);
      setClaimed(true);
      await qc.invalidateQueries({ queryKey: ["order", order.id] });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error while linking order.";
      toast.error(msg, { id: tId, description: "Check your connection and retry." });
      setLastError(msg);
      return false;
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLastError(null);
    const tId = toast.loading("Creating your account…");
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.href },
      });
      if (error) {
        toast.error(error.message, { id: tId });
        setLastError(error.message);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        toast.success("Account created", { id: tId });
        await attach();
      } else {
        toast.success("Account created — check your email to confirm, then sign in to save this order.", { id: tId });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-up failed.";
      toast.error(msg, { id: tId, description: "Please try again." });
      setLastError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleAttachSignedIn() {
    setLoading(true);
    setLastError(null);
    try { await attach(); } finally { setLoading(false); }
  }

  async function handleRetry() {
    setLoading(true);
    try { await attach(); } finally { setLoading(false); }
  }

  return (
    <div className="mt-8 rounded-2xl border bg-card p-6" aria-labelledby="claim-heading">
      <div className="flex items-center gap-2 mb-2">
        <UserPlus className="w-5 h-5 text-primary" aria-hidden="true" />
        <h2 id="claim-heading" className="font-semibold">Save this order to an account</h2>
      </div>
      {signedIn ? (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Link this order to your signed-in account to view it later under My orders.
          </p>
          <Button
            variant="luxe"
            onClick={handleAttachSignedIn}
            disabled={loading}
            aria-busy={loading}
            aria-describedby="claim-status"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> Linking…</>
            ) : (
              "Link to my account"
            )}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Create an account with <span className="font-medium text-foreground">{email}</span> to track this order and speed up future checkouts.
          </p>
          <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-[1fr_auto] items-end" aria-busy={loading}>
            <div className="space-y-1.5">
              <Label htmlFor="claim-password">Choose a password</Label>
              <Input
                id="claim-password"
                type="password"
                minLength={6}
                required
                disabled={loading}
                aria-disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" variant="luxe" disabled={loading} aria-busy={loading} aria-describedby="claim-status">
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> Creating…</>
              ) : (
                "Create account & save"
              )}
            </Button>
          </form>
        </>
      )}

      {/* Polite status region for spinner state announcements */}
      <span id="claim-status" role="status" aria-live="polite" className="sr-only">
        {statusMsg}
      </span>

      {lastError && !loading && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
        >
          <span className="text-destructive">{lastError}</span>
          <Button
            ref={retryBtnRef}
            size="sm"
            variant="outline"
            onClick={handleRetry}
            disabled={loading}
            aria-label={`Retry: ${lastError}`}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" /> Retry
          </Button>
        </div>
      )}
    </div>
  );
}




