import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET_ENV = () =>
  process.env.INTEGRATION_ENCRYPTION_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "invoice-fallback-secret";

export function signInvoiceId(orderId: string): string {
  return createHmac("sha256", SECRET_ENV()).update(orderId).digest("hex").slice(0, 32);
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
