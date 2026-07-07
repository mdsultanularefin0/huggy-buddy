// Pure coupon evaluation. No I/O — kept isomorphic so both the server
// (validateCoupon, createOrder) and unit tests can call it directly.

export type CouponRow = {
  code: string;
  discount_type: string | null;
  discount_value: number | null;
  min_order_amount: number | null;
  max_discount: number | null;
  expires_at: string | null;
  usage_limit: number | null;
  used_count: number | null;
  is_active: boolean | null;
};

export type CouponEvalOk = {
  ok: true;
  code: string;
  discount: number;
  discountType: "percent" | "flat";
  discountValue: number;
};

export type CouponEvalErr = {
  ok: false;
  reason:
    | "not_found"
    | "inactive"
    | "expired"
    | "usage_limit"
    | "below_minimum"
    | "invalid_config"
    | "no_discount";
  message: string;
};

export type CouponEvalResult = CouponEvalOk | CouponEvalErr;

export function evaluateCoupon(
  cp: CouponRow | null | undefined,
  subtotal: number,
  now: Date = new Date(),
): CouponEvalResult {
  if (!cp) return { ok: false, reason: "not_found", message: "Invalid coupon code" };
  if (!cp.is_active) return { ok: false, reason: "inactive", message: "Invalid coupon code" };

  const type = cp.discount_type === "percent" ? "percent" : cp.discount_type === "flat" ? "flat" : null;
  if (!type) return { ok: false, reason: "invalid_config", message: "Coupon is misconfigured" };

  const value = Number(cp.discount_value ?? 0);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, reason: "invalid_config", message: "Coupon is misconfigured" };
  }
  if (type === "percent" && value > 100) {
    return { ok: false, reason: "invalid_config", message: "Coupon is misconfigured" };
  }

  if (cp.expires_at) {
    const exp = new Date(cp.expires_at);
    if (!isNaN(exp.getTime()) && exp.getTime() <= now.getTime()) {
      return { ok: false, reason: "expired", message: "This coupon has expired" };
    }
  }

  const used = Number(cp.used_count ?? 0);
  if (cp.usage_limit != null && used >= cp.usage_limit) {
    return { ok: false, reason: "usage_limit", message: "This coupon has reached its usage limit" };
  }

  const sub = Number.isFinite(subtotal) ? Math.max(0, Math.floor(subtotal)) : 0;
  const min = Math.max(0, cp.min_order_amount ?? 0);
  if (sub < min) {
    return {
      ok: false,
      reason: "below_minimum",
      message: `Add more to reach the minimum order of ${min} for this coupon`,
    };
  }

  let discount = type === "percent" ? Math.floor((sub * value) / 100) : Math.floor(value);
  if (cp.max_discount != null && cp.max_discount >= 0) {
    discount = Math.min(discount, cp.max_discount);
  }
  discount = Math.max(0, Math.min(discount, sub));

  if (discount <= 0) {
    return { ok: false, reason: "no_discount", message: "Coupon has no discount to apply" };
  }

  return { ok: true, code: cp.code, discount, discountType: type, discountValue: value };
}
