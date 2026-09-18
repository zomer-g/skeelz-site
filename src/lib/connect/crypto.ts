import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Keys that other apps issued to us are stored encrypted (docs/connect-api.md §2, amendment C3):
 * AES-256-GCM with CONNECT_SECRET_KEY (64 hex = 32 bytes, an xhostd secret), the peer's
 * name as additional authenticated data (a ciphertext can't be moved to another peer),
 * stored as `v2:<iv b64url>:<tag b64url>:<ct b64url>` with a 12-byte IV and a 16-byte tag.
 * Anything else (including v1) is invalid and means "re-enter the key".
 */

const IV_BYTES = 12;
const TAG_BYTES = 16;

function secretKey(): Buffer {
  const hex = process.env.CONNECT_SECRET_KEY?.trim() ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("CONNECT_SECRET_KEY must be 64 hex characters");
  return Buffer.from(hex, "hex");
}

export function hasSecretKey(): boolean {
  return /^[0-9a-fA-F]{64}$/.test(process.env.CONNECT_SECRET_KEY?.trim() ?? "");
}

export function encryptSecret(plain: string, peer: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(peer, "utf8"));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v2:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ct.toString("base64url")}`;
}

export function decryptSecret(stored: string, peer: string): string {
  const [v, ivText, tagText, ctText, extra] = stored.split(":");
  if (v !== "v2" || !ivText || !tagText || ctText === undefined || extra !== undefined) throw new Error("unknown ciphertext format");
  const iv = Buffer.from(ivText, "base64url");
  const tag = Buffer.from(tagText, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new Error("bad iv or tag length");
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(Buffer.from(peer, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(ctText, "base64url")), decipher.final()]).toString("utf8");
}
