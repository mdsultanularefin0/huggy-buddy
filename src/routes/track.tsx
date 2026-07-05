import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { lookupOrder } from "@/lib/orders.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track your order — Veloura Essence" },
      { name: "description", content: "Look up your Veloura Essence order using your order number and email." },
      { property: "og:title", content: "Track your order — Veloura Essence" },
      { property: "og:description", content: "Look up your Veloura Essence order using your order number and email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/track" }],
  }),
  component: TrackPage,
});

function TrackPage() {
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
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Search className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-semibold tracking-tight">Track your order</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Enter your order number and the email you used at checkout.
          </p>
        </div>

        <form onSubmit={handleLookup} className="rounded-2xl border bg-card p-6 grid gap-4">
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
          <Button type="submit" variant="luxe" disabled={loading}>
            {loading ? "Looking up…" : "Track order"}
          </Button>
        </form>
      </div>
      <SiteFooter />
    </div>
  );
}
