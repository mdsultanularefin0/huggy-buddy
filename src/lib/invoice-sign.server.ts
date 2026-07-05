import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string {
  const s = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) {
    throw new Error(
      "Invoice signing secret is not configured (INTEGRATION_ENCRYPTION_KEY missing)",
    );
  }
  return s;
}

export function signInvoiceId(orderId: string): string {
  return createHmac("sha256", getSecret()).update(orderId).digest("hex").slice(0, 32);
}

export function verifyInvoiceToken(orderId: string, token: string | undefined | null): boolean {
  if (!token) return false;
  try {
    const expected = signInvoiceId(orderId);
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
