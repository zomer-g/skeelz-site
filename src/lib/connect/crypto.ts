import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Keys that other apps issued to us are stored encrypted (docs/connect-api.md §2):
 * AES-256-GCM with CONNECT_SECRET_KEY (64 hex = 32 bytes, an xhostd secret),
 * as `v1:<iv b64url>:<tag b64url>:<ct b64url>`.
 */

function secretKey(): Buffer {
  const hex = process.env.CONNECT_SECRET_KEY?.trim() ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("CONNECT_SECRET_KEY must be 64 hex characters");
  return Buffer.from(hex, "hex");
}

export function hasSecretKey(): boolean {
  return /^[0-9a-fA-F]{64}$/.test(process.env.CONNECT_SECRET_KEY?.trim() ?? "");
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ct.toString("base64url")}`;
}

export function decryptSecret(stored: string): string {
  const [v, iv, tag, ct] = stored.split(":");
  if (v !== "v1" || !iv || !tag || ct === undefined) throw new Error("unknown ciphertext format");
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
