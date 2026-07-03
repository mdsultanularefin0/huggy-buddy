import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RoleReader = {
  from: (table: "user_roles") => {
    select: (columns: "id") => {
      eq: (column: "user_id", value: string) => {
        eq: (column: "role", value: "admin") => {
          maybeSingle: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
        };
      };
    };
  };
};

async function assertAdmin(userId: string, supabase: unknown) {
  const r = supabase as RoleReader;
  const { data, error } = await r.from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error || !data) throw new Error("Forbidden");
}

const couponInputSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  code: z.string().trim().min(1).max(40).transform((s) => s.toUpperCase()),
  discount_type: z.enum(["percent", "flat"]),
  discount_value: z.number().finite(),
  min_order_amount: z.number().finite(),
  max_discount: z.number().finite().nullable(),
  usage_limit: z.number().finite().nullable(),
  expires_at: z.string().nullable(),
  is_active: z.boolean(),
});

export type CouponInput = z.input<typeof couponInputSchema>;
export type CouponSaveResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string> };

function validate(data: z.infer<typeof couponInputSchema>): Record<string, string> {
  const errors: Record<string, string> = {};

  if (data.discount_type === "percent") {
    if (data.discount_value <= 0 || data.discount_value > 100) {
      errors.discount_value = "Percent discount must be between 1 and 100.";
    }
  } else if (data.discount_value < 0) {
    errors.discount_value = "Flat discount cannot be negative.";
  }

  if (data.min_order_amount < 0) errors.min_order_amount = "Minimum order cannot be negative.";

  if (data.max_discount !== null) {
    if (data.max_discount < 0) errors.max_discount = "Max discount cannot be negative.";
  }

  if (data.usage_limit !== null) {
    if (!Number.isInteger(data.usage_limit) || data.usage_limit <= 0) {
      errors.usage_limit = "Usage limit must be a positive integer.";
    }
  }

  if (data.expires_at) {
    const exp = new Date(data.expires_at);
    if (isNaN(exp.getTime())) errors.expires_at = "Invalid expiry date.";
    else if (exp.getTime() <= Date.now()) errors.expires_at = "Expiry must be in the future.";
  }

  return errors;
}

export const saveCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => couponInputSchema.parse(data))
  .handler(async ({ data, context }): Promise<CouponSaveResult> => {
    await assertAdmin(context.userId, context.supabase);

    const errors = validate(data);
    if (Object.keys(errors).length > 0) return { ok: false, errors };

    const payload = {
      code: data.code,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      min_order_amount: data.min_order_amount,
      max_discount: data.max_discount,
      usage_limit: data.usage_limit,
      expires_at: data.expires_at,
      is_active: data.is_active,
    };

    const sb = context.supabase as unknown as {
      from: (t: "coupons") => {
        update: (p: typeof payload) => { eq: (c: "id", v: string) => { select: (c: "id") => { single: () => Promise<{ data: { id: string } | null; error: { message: string; code?: string } | null }> } } };
        insert: (p: typeof payload) => { select: (c: "id") => { single: () => Promise<{ data: { id: string } | null; error: { message: string; code?: string } | null }> } };
      };
    };

    const res = data.id
      ? await sb.from("coupons").update(payload).eq("id", data.id).select("id").single()
      : await sb.from("coupons").insert(payload).select("id").single();

    if (res.error || !res.data) {
      if (res.error?.code === "23505") return { ok: false, errors: { code: "This code is already in use." } };
      throw new Error(res.error?.message ?? "Failed to save coupon");
    }
    return { ok: true, id: res.data.id };
  });
