// Pure referral-code evaluation. Kept I/O-free so unit tests and both
// server call sites (validateReferral, createOrder) share one code path.

export type ReferralRow = {
  code: string;
  discount_amount: number | null;
  discount_type: string | null;
  is_active: boolean | null;
};

export type ReferralEvalOk = {
  ok: true;
  code: string;
  discount: number;
  discountType: "percent" | "flat";
};

export type ReferralEvalErr = {
  ok: false;
  reason:
    | "not_found"
    | "inactive"
    | "invalid_config"
    | "no_discount"
    | "self_referral"
    | "already_used";
  message: string;
};

export type ReferralEvalResult = ReferralEvalOk | ReferralEvalErr;

export type ReferralContext = {
  /** Buyer's own referral code, if any — a customer can't redeem their own. */
  ownCode?: string | null;
  /** Referral codes this buyer has already redeemed before. */
  previouslyUsedCodes?: string[];
};

export function evaluateReferral(
  ref: ReferralRow | null | undefined,
  subtotal: number,
  ctx: ReferralContext = {},
): ReferralEvalResult {
  if (!ref) return { ok: false, reason: "not_found", message: "Invalid referral code" };
  if (!ref.is_active) return { ok: false, reason: "inactive", message: "Invalid referral code" };

  const codeNorm = ref.code.trim().toLowerCase();
  if (ctx.ownCode && ctx.ownCode.trim().toLowerCase() === codeNorm) {
    return { ok: false, reason: "self_referral", message: "You can't use your own referral code" };
  }
  if ((ctx.previouslyUsedCodes ?? []).some((c) => c.trim().toLowerCase() === codeNorm)) {
    return { ok: false, reason: "already_used", message: "You have already used this referral code" };
  }

  const type = ref.discount_type === "percent" ? "percent" : ref.discount_type === "flat" ? "flat" : null;
  if (!type) return { ok: false, reason: "invalid_config", message: "Referral code is misconfigured" };

  const raw = Number(ref.discount_amount ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) {
    return { ok: false, reason: "invalid_config", message: "Referral code is misconfigured" };
  }

  const sub = Number.isFinite(subtotal) ? Math.max(0, Math.floor(subtotal)) : 0;
  const discount =
    type === "percent"
      ? Math.floor((sub * Math.min(raw, 100)) / 100)
      : Math.min(Math.floor(raw), sub);

  if (discount <= 0) {
    return { ok: false, reason: "no_discount", message: "Referral code has no discount" };
  }

  return { ok: true, code: ref.code, discount, discountType: type };
}
