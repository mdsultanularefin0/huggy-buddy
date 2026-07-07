// Turn raw server-fn / RPC error messages into short, user-friendly text
// for checkout, coupon, and referral flows. Keeps toasts readable when the
// backend surfaces a Zod issue, a Postgres error, or a network failure.

const KNOWN_PATTERNS: Array<[RegExp, string]> = [
  [/out of stock:?\s*(.*)/i, "Sorry, $1 just sold out. Please remove it and try again."],
  [/invalid delivery zone/i, "That delivery zone isn't available. Please pick another."],
  [/failed to save customer/i, "We couldn't save your details. Please check your phone/email and try again."],
  [/failed to place order/i, "We couldn't place your order. Please try again in a moment."],
  [/could not validate coupon/i, "Couldn't check that coupon right now. Please try again."],
  [/could not validate referral/i, "Couldn't check that referral code right now. Please try again."],
  [/invalid coupon code/i, "That coupon code isn't valid."],
  [/invalid referral code/i, "That referral code isn't valid."],
  [/coupon (has )?expired|this coupon has expired/i, "This coupon has expired."],
  [/usage limit/i, "This coupon has reached its usage limit."],
  [/misconfigured/i, "This code isn't set up correctly. Please try another."],
  [/no discount/i, "This code doesn't apply a discount to your order."],
  [/already used this referral/i, "You've already used this referral code."],
  [/own referral code/i, "You can't use your own referral code."],
  [/minimum order of (\d+)/i, "Add more to reach the minimum order of ৳$1 for this code."],
  [/invalid quantity/i, "One of the items has an invalid quantity."],
  [/network|failed to fetch|load failed/i, "Network issue. Check your connection and try again."],
  [/unauthorized/i, "Please sign in and try again."],
  [/timeout|timed out/i, "The request took too long. Please try again."],
];

export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!raw) return fallback;

  // Strip common RPC framing like "Error: " or JSON wrappers.
  let msg = raw.replace(/^Error:\s*/i, "").trim();
  if (msg.startsWith("{")) {
    try {
      const parsed = JSON.parse(msg) as { message?: string; error?: string };
      msg = parsed.message ?? parsed.error ?? msg;
    } catch { /* keep original */ }
  }

  for (const [re, out] of KNOWN_PATTERNS) {
    const m = msg.match(re);
    if (m) return out.replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? "");
  }

  // Zod validation shape: "customer.phone: String must contain at least 6 character(s)"
  if (/expected|required|invalid_type|must contain|too_small/i.test(msg)) {
    return "Some details don't look right. Please check the form and try again.";
  }

  // Trim overly long backend detail so the toast stays readable.
  return msg.length > 160 ? fallback : msg;
}
