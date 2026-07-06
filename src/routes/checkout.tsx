import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatBDT } from "@/lib/currency";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useCart, cartSubtotal } from "@/lib/cart-store";
import { createOrder, validateCoupon, validateReferral } from "@/lib/checkout.functions";
import { trackMetaEvent } from "@/lib/meta-pixel.functions";
import { fbqTrack } from "@/lib/meta-track";
import { BD_DISTRICTS } from "@/lib/bd-districts";
import { toast } from "sonner";

type Zone = {
  id: string; zone_name: string; fee_amount: number; free_shipping_threshold: number | null;
};
type PayMethod = { id: string; method_name: string };

const checkoutOptions = queryOptions({
  queryKey: ["checkout-config"],
  queryFn: async () => {
    const [zones, methods] = await Promise.all([
      supabase.from("delivery_zones").select("id,zone_name,fee_amount,free_shipping_threshold")
        .eq("is_active", true).order("sort_order", { ascending: true }),
      supabase.from("payment_methods").select("id,method_name")
        .eq("is_active", true).order("sort_order", { ascending: true }),
    ]);
    return {
      zones: (zones.data ?? []) as Zone[],
      methods: (methods.data ?? []) as PayMethod[],
    };
  },
});

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Veloura Essence" },
      { name: "description", content: "Complete your Veloura Essence order. Guest checkout available — no account required." },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Checkout — Veloura Essence" },
      { property: "og:description", content: "Complete your fragrance order securely. Guest checkout supported." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/checkout" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/checkout" }],
  }),

  loader: ({ context }) => context.queryClient.ensureQueryData(checkoutOptions),
  component: CheckoutPage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function CheckoutPage() {
  const { data } = useSuspenseQuery(checkoutOptions);
  const { items, clear } = useCart();
  const navigate = useNavigate();
  const createOrderFn = useServerFn(createOrder);
  const validateCouponFn = useServerFn(validateCoupon);
  const validateReferralFn = useServerFn(validateReferral);
  const trackMetaEventFn = useServerFn(trackMetaEvent);

  // InitiateCheckout — fire once per mount when cart has items.
  const initFired = useRef(false);
  useEffect(() => {
    if (initFired.current || items.length === 0) return;
    initFired.current = true;
    const eventId = `ic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const value = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const payload = {
      currency: "BDT",
      value,
      content_type: "product",
      content_ids: items.map((i) => i.refId),
      num_items: items.reduce((n, i) => n + i.quantity, 0),
    };
    fbqTrack("InitiateCheckout", payload, eventId);
    void trackMetaEventFn({
      data: {
        event_name: "InitiateCheckout",
        event_id: eventId,
        event_source_url: typeof window !== "undefined" ? window.location.href : undefined,
        custom_data: payload,
      },
    }).catch(() => { /* CAPI optional */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [district, setDistrict] = useState("");
  const [upazila, setUpazila] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(data.methods[0]?.method_name ?? "");
  const [promoCode, setPromoCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [appliedReferral, setAppliedReferral] = useState<{ code: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Auto-pick zone from district: "Dhaka" → Inside Dhaka, anything else → Outside Dhaka.
  const zone = useMemo(() => {
    if (!district) return undefined;
    const isDhaka = district.trim().toLowerCase() === "dhaka";
    const match = data.zones.find((z) =>
      isDhaka ? /inside\s*dhaka/i.test(z.zone_name) : /outside\s*dhaka/i.test(z.zone_name),
    );
    return match ?? data.zones[0];
  }, [data.zones, district]);
  const zoneId = zone?.id ?? "";

  const subtotal = cartSubtotal(items);
  const shippingFee = useMemo(() => {
    if (!zone) return 0;
    const threshold = zone.free_shipping_threshold ?? 0;
    return threshold > 0 && subtotal >= threshold ? 0 : zone.fee_amount;
  }, [zone, subtotal]);
  const couponDiscount = appliedCoupon?.discount ?? 0;
  const referralDiscount = appliedReferral?.discount ?? 0;
  const total = Math.max(0, subtotal + shippingFee - couponDiscount - referralDiscount);

  // Single promo field: try coupon first, fall back to referral. Admin still
  // manages coupons and referrals as separate tables/pages.
  const promoMutation = useMutation({
    mutationFn: async (code: string) => {
      // Try coupon first. If it's specifically "not a coupon", fall back to
      // referral. Surface any other coupon error (expired, min order, etc.).
      let couponErr: Error | null = null;
      try {
        const res = await validateCouponFn({ data: { code, subtotal } });
        return { kind: "coupon" as const, code: res.code, discount: res.discount };
      } catch (e) {
        couponErr = e as Error;
      }
      const isUnknownCoupon = /invalid coupon/i.test(couponErr?.message ?? "");
      if (!isUnknownCoupon) throw couponErr;
      try {
        const res = await validateReferralFn({ data: { code, subtotal } });
        return { kind: "referral" as const, code: res.code, discount: res.discount };
      } catch (e) {
        const refErr = e as Error;
        if (/invalid referral/i.test(refErr.message)) {
          throw new Error("Invalid promo code");
        }
        throw refErr;
      }
    },
    onSuccess: (res) => {
      setPromoError(null);
      setPromoCode(res.code);
      if (res.kind === "coupon") {
        setAppliedCoupon({ code: res.code, discount: res.discount });
        setAppliedReferral(null);
        toast.success(`Coupon ${res.code} applied — saved ${formatBDT(res.discount)}`);
      } else {
        setAppliedReferral({ code: res.code, discount: res.discount });
        setAppliedCoupon(null);
        toast.success(`Referral ${res.code} applied — saved ${formatBDT(res.discount)}`);
      }
    },
    onError: (err: Error) => {
      setAppliedCoupon(null);
      setAppliedReferral(null);
      setPromoError(err.message || "Invalid promo code");
    },
  });

  const applied = appliedCoupon ?? appliedReferral;
  const appliedKind = appliedCoupon ? "Coupon" : appliedReferral ? "Referral" : null;

  // Keep the displayed discount in sync with the server: whenever the cart
  // subtotal changes after a promo is applied, re-validate against the new
  // subtotal so percent coupons, min-order rules, and caps stay accurate.
  const appliedCode = applied?.code ?? null;
  const lastValidatedSubtotal = useRef<number | null>(null);
  useEffect(() => {
    if (!appliedCode) { lastValidatedSubtotal.current = null; return; }
    if (lastValidatedSubtotal.current === subtotal) return;
    lastValidatedSubtotal.current = subtotal;
    promoMutation.mutate(appliedCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedCode, subtotal]);

  function applyPromo() {
    const code = promoCode.trim();
    if (!code) { setPromoError("Enter a code"); return; }
    promoMutation.mutate(code);
  }
  function removePromo() {
    setAppliedCoupon(null);
    setAppliedReferral(null);
    setPromoCode("");
    setPromoError(null);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      return await createOrderFn({
        data: {
          customer: {
            name,
            phone,
            address: [address, upazila, district].filter(Boolean).join(", "),
            email: email || undefined,
          },
          deliveryZoneId: zoneId,
          paymentMethod,
          items,
          referralCode: appliedReferral?.code || undefined,
          couponCode: appliedCoupon?.code || undefined,
        },
      });
    },
    onSuccess: (res) => {
      // Meta Pixel Purchase (client) — deduped with server CAPI via eventID.
      const contentIds = items.map((i) => i.refId);
      fbqTrack(
        "Purchase",
        {
          currency: "BDT",
          value: res.total,
          content_type: "product",
          content_ids: contentIds,
          contents: items.map((i) => ({ id: i.refId, quantity: i.quantity, item_price: i.unitPrice })),
          num_items: items.reduce((n, i) => n + i.quantity, 0),
          order_id: res.orderNumber,
        },
        res.metaEventId,
      );
      clear();
      if (res.invoiceToken && typeof window !== "undefined") {
        try {
          sessionStorage.setItem(`invoice_token_${res.id}`, res.invoiceToken);
        } catch { /* storage disabled — invoice button will fall back to auth */ }
      }
      toast.success(`Order ${res.orderNumber} placed!`);
      navigate({ to: "/order/$id", params: { id: res.id } });
    },

    onError: (err: Error) => toast.error(err.message || "Failed to place order"),
  });

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <p className="text-muted-foreground">Your cart is empty.</p>
          <Link to="/" className="text-primary underline mt-4 inline-block">Continue shopping</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Guard against double-submits: Enter-key spam, form resubmits, or a
    // click that races the button's disabled state.
    if (mutation.isPending) return;
    if (!zoneId || !paymentMethod) return toast.error("Pick delivery zone & payment");
    if (name.trim().length < 2) return toast.error("Enter your full name");
    if (phone.trim().length < 6) return toast.error("Enter a valid phone number");
    if (!district) return toast.error("Select your district");
    if (upazila.trim().length < 2) return toast.error("Enter your upazila/thana");
    if (address.trim().length < 5) return toast.error("Enter a delivery address");
    mutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 sm:mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to shop
        </Link>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2">Checkout</h1>
        <p className="text-sm text-muted-foreground mb-6 sm:mb-8">
          Checking out as a guest — no account needed. Have one?{" "}
          <Link to="/auth" className="text-primary underline">Sign in</Link> to save this order to your history.
        </p>

        <form onSubmit={onSubmit} className="grid lg:grid-cols-[1fr_400px] gap-6 lg:gap-10">

          <div className="space-y-8">
            <section className="space-y-4">
              <h2 className="font-semibold">Contact & Delivery</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full name *</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="phone">Phone *</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="01XXXXXXXXX" />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email (optional)</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="district">District *</Label>
                  <Select value={district} onValueChange={setDistrict}>
                    <SelectTrigger id="district" className="mt-1">
                      <SelectValue placeholder="Select your district" />
                    </SelectTrigger>
                    <SelectContent>
                      {BD_DISTRICTS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="upazila">Upazila / Thana *</Label>
                  <Input
                    id="upazila"
                    value={upazila}
                    onChange={(e) => setUpazila(e.target.value)}
                    required
                    placeholder="e.g. Dhanmondi"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="address">Delivery address *</Label>
                <Textarea id="address" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="House, road, area / thana" />
              </div>
              <p className="text-xs text-muted-foreground">No account needed — guest checkout.</p>
            </section>

            <section className="space-y-3">
              <h2 className="font-semibold">Delivery Zone</h2>
              {zone ? (
                <div className="p-3 rounded-xl border border-primary/40 bg-primary/5">
                  <div className="font-medium text-sm">{zone.zone_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Auto-selected from district · {formatBDT(zone.fee_amount)}
                    {zone.free_shipping_threshold ? ` · Free over ${formatBDT(zone.free_shipping_threshold)}` : ""}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Select your district to see delivery charges.</p>
              )}
              <div className="grid sm:grid-cols-2 gap-2 opacity-70 pointer-events-none">
                {data.zones.map((z) => (
                  <div
                    key={z.id}
                    className={`text-left p-3 rounded-xl border ${zone?.id === z.id ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <div className="font-medium text-sm">{z.zone_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBDT(z.fee_amount)}
                      {z.free_shipping_threshold ? ` · Free over ${formatBDT(z.free_shipping_threshold)}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>

          <aside className="lg:sticky lg:top-24 h-fit p-4 sm:p-6 rounded-2xl border bg-card space-y-5">
            <h2 className="font-semibold">Order Summary</h2>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {items.map((i) => (
                <div key={i.lineId} className="flex justify-between text-sm">
                  <span className="truncate pr-2">
                    {i.name}{i.size ? ` (${i.size})` : ""} × {i.quantity}
                  </span>
                  <span className="font-medium">{formatBDT(i.unitPrice * i.quantity)}</span>
                </div>
              ))}
            </div>


            <div className="border-t pt-4 space-y-1.5">
              <Label htmlFor="promo" className="text-sm">Promo code</Label>
              <div className="flex gap-2">
                <Input
                  id="promo"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value.toUpperCase());
                    if (promoError) setPromoError(null);
                    if (applied) { setAppliedCoupon(null); setAppliedReferral(null); }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyPromo();
                    }
                  }}
                  placeholder="Coupon or referral code"
                  disabled={!!applied}
                  aria-invalid={!!promoError}
                  aria-describedby="promo-msg"
                />
                {applied ? (
                  <Button type="button" variant="outline" onClick={removePromo}>
                    <X className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyPromo}
                    disabled={promoMutation.isPending || !promoCode.trim()}
                  >
                    {promoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                  </Button>
                )}
              </div>
              <p id="promo-msg" className="text-xs min-h-[1rem]">
                {applied ? (
                  <span className="text-emerald-600 inline-flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {appliedKind} {applied.code} applied · −{formatBDT(applied.discount)}
                  </span>
                ) : promoError ? (
                  <span className="text-destructive">{promoError}</span>
                ) : (
                  <span className="text-muted-foreground">Have a coupon or referral code? Enter and tap Apply.</span>
                )}
              </p>
            </div>

            <div className="border-t pt-4 space-y-2">
              <Label className="text-sm">Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {data.methods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.method_name)}
                    className={`text-left p-2.5 rounded-lg border text-sm transition-colors ${paymentMethod === m.method_name ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-primary/40"}`}
                  >
                    {m.method_name}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t pt-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatBDT(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{shippingFee === 0 ? "Free" : formatBDT(shippingFee)}</span></div>
              {appliedCoupon && (
                <div className="flex justify-between text-emerald-600">
                  <span>Coupon ({appliedCoupon.code})</span>
                  <span>−{formatBDT(appliedCoupon.discount)}</span>
                </div>
              )}
              {appliedReferral && (
                <div className="flex justify-between text-emerald-600">
                  <span>Referral ({appliedReferral.code})</span>
                  <span>−{formatBDT(appliedReferral.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-base pt-2"><span>Total</span><span>{formatBDT(total)}</span></div>
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" isLoading={mutation.isPending} loadingText="Placing order…">
              {`Place order — ${formatBDT(total)}`}
            </Button>
          </aside>
        </form>
      </div>
      <SiteFooter />
    </div>
  );
}
