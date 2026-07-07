import { describe, it, expect } from "vitest";
import { evaluateCoupon, type CouponRow } from "../coupon-eval";

const base: CouponRow = {
  code: "SAVE10",
  discount_type: "percent",
  discount_value: 10,
  min_order_amount: 0,
  max_discount: null,
  expires_at: null,
  usage_limit: null,
  used_count: 0,
  is_active: true,
};

const NOW = new Date("2026-07-07T00:00:00Z");

describe("evaluateCoupon", () => {
  it("rejects missing coupon", () => {
    const r = evaluateCoupon(null, 1000, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_found");
  });

  it("rejects inactive coupon", () => {
    const r = evaluateCoupon({ ...base, is_active: false }, 1000, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("inactive");
  });

  it("rejects expired coupon", () => {
    const r = evaluateCoupon({ ...base, expires_at: "2026-01-01T00:00:00Z" }, 1000, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expired");
  });

  it("accepts coupon with future expiry", () => {
    const r = evaluateCoupon({ ...base, expires_at: "2027-01-01T00:00:00Z" }, 1000, NOW);
    expect(r.ok).toBe(true);
  });

  it("rejects when usage limit reached", () => {
    const r = evaluateCoupon({ ...base, usage_limit: 5, used_count: 5 }, 1000, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("usage_limit");
  });

  it("allows when under usage limit", () => {
    const r = evaluateCoupon({ ...base, usage_limit: 5, used_count: 4 }, 1000, NOW);
    expect(r.ok).toBe(true);
  });

  it("rejects when subtotal below min_order_amount", () => {
    const r = evaluateCoupon({ ...base, min_order_amount: 2000 }, 1000, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("below_minimum");
  });

  it("computes percent discount", () => {
    const r = evaluateCoupon({ ...base, discount_value: 10 }, 1000, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discount).toBe(100);
  });

  it("computes flat discount", () => {
    const r = evaluateCoupon({ ...base, discount_type: "flat", discount_value: 250 }, 1000, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discount).toBe(250);
  });

  it("caps discount at max_discount", () => {
    const r = evaluateCoupon({ ...base, discount_value: 50, max_discount: 200 }, 1000, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discount).toBe(200);
  });

  it("clamps discount to subtotal", () => {
    const r = evaluateCoupon({ ...base, discount_type: "flat", discount_value: 5000 }, 1000, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discount).toBe(1000);
  });

  it("rejects percent > 100", () => {
    const r = evaluateCoupon({ ...base, discount_value: 150 }, 1000, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_config");
  });

  it("rejects zero or negative discount_value", () => {
    expect(evaluateCoupon({ ...base, discount_value: 0 }, 1000, NOW).ok).toBe(false);
    expect(evaluateCoupon({ ...base, discount_value: -10 }, 1000, NOW).ok).toBe(false);
  });

  it("rejects unknown discount_type", () => {
    const r = evaluateCoupon({ ...base, discount_type: "bogus" }, 1000, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_config");
  });

  it("rejects when computed discount rounds to zero", () => {
    const r = evaluateCoupon({ ...base, discount_value: 1 }, 50, NOW);
    // floor(50 * 1 / 100) = 0
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_discount");
  });
});
