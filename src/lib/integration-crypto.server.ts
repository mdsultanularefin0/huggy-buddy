import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) throw new Error("INTEGRATION_ENCRYPTION_KEY is not set");
  // Derive a 32-byte key from whatever length the secret is.
  return createHash("sha256").update(raw).digest();
}

export function encryptJson(payload: unknown): { encrypted_data: string; iv: string; auth_tag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const plain = Buffer.from(JSON.stringify(payload), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return {
    encrypted_data: enc.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptJson<T = unknown>(row: { encrypted_data: string; iv: string; auth_tag: string }): T {
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(dec.toString("utf8")) as T;
}
