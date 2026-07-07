import { describe, it, expect } from "vitest";
import { evaluateReferral, type ReferralRow } from "../referral-eval";

const base: ReferralRow = {
  code: "FRIEND",
  discount_amount: 100,
  discount_type: "flat",
  is_active: true,
};

describe("evaluateReferral", () => {
  it("rejects missing referral", () => {
    const r = evaluateReferral(null, 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_found");
  });

  it("rejects inactive referral", () => {
    const r = evaluateReferral({ ...base, is_active: false }, 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("inactive");
  });

  it("rejects self-referral (case-insensitive)", () => {
    const r = evaluateReferral(base, 1000, { ownCode: "friend" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("self_referral");
  });

  it("rejects previously used code", () => {
    const r = evaluateReferral(base, 1000, { previouslyUsedCodes: [" FRIEND "] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("already_used");
  });

  it("allows when ownCode differs", () => {
    const r = evaluateReferral(base, 1000, { ownCode: "MYCODE" });
    expect(r.ok).toBe(true);
  });

  it("rejects unknown discount_type", () => {
    const r = evaluateReferral({ ...base, discount_type: "bogus" }, 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_config");
  });

  it("rejects non-positive discount_amount", () => {
    expect(evaluateReferral({ ...base, discount_amount: 0 }, 1000).ok).toBe(false);
    expect(evaluateReferral({ ...base, discount_amount: -5 }, 1000).ok).toBe(false);
  });

  it("computes flat discount and clamps to subtotal", () => {
    const r = evaluateReferral({ ...base, discount_amount: 5000 }, 1000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discount).toBe(1000);
  });

  it("computes percent discount", () => {
    const r = evaluateReferral({ ...base, discount_type: "percent", discount_amount: 20 }, 1000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discount).toBe(200);
  });

  it("caps percent at 100", () => {
    const r = evaluateReferral({ ...base, discount_type: "percent", discount_amount: 250 }, 1000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discount).toBe(1000);
  });

  it("rejects when computed discount rounds to zero", () => {
    const r = evaluateReferral({ ...base, discount_type: "percent", discount_amount: 1 }, 50);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_discount");
  });
});
