import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { apiKeys } from "@/lib/db/schema";
import { SITE_SCOPES, type Scope } from "@/lib/api/spec";

/**
 * Inbound API keys (docs/connect-api.md §1): `sk_site_<43 chars base64url of 32 random bytes>`.
 * Only the sha256 (hex) is stored; the key is shown once and never logged.
 * The site has no legacy env tokens of its own, so every key lives in `api_keys`.
 */

export const APP = "site" as const;
const KEY_PREFIX = `sk_${APP}_`;
const KEY_RE = new RegExp(`^${KEY_PREFIX}[A-Za-z0-9_-]{43}$`);

export const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");

export function generateKey(): { key: string; prefix: string; hash: string } {
  const key = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { key, prefix: key.slice(KEY_PREFIX.length, KEY_PREFIX.length + 8), hash: sha256Hex(key) };
}

export const isScope = (v: unknown): v is Scope => typeof v === "string" && (SITE_SCOPES as readonly string[]).includes(v);

export interface VerifiedKey {
  id: string;
  name: string;
  scopes: string[];
  lastUsedAt: Date | null;
}

export type KeyCheck = { ok: true; key: VerifiedKey } | { ok: false; reason: "malformed" | "unknown" | "revoked" | "expired" };

/** Looks the key up by its hash, compares the hash in constant time, and refuses revoked or expired keys. */
export async function verifyKey(presented: string): Promise<KeyCheck> {
  if (!KEY_RE.test(presented)) return { ok: false, reason: "malformed" };
  const hash = sha256Hex(presented);
  const [row] = await getDb().select().from(apiKeys).where(eq(apiKeys.hash, hash)).limit(1);
  // Compare even on a miss, so a lookup miss and a mismatch take the same path.
  const stored = Buffer.from(row?.hash ?? "0".repeat(64), "hex");
  const same = timingSafeEqual(stored, Buffer.from(hash, "hex"));
  if (!row || !same) return { ok: false, reason: "unknown" };
  if (row.revokedAt) return { ok: false, reason: "revoked" };
  if (row.expiresAt && row.expiresAt <= new Date()) return { ok: false, reason: "expired" };
  return { ok: true, key: { id: row.id, name: row.name, scopes: row.scopes, lastUsedAt: row.lastUsedAt } };
}

/** At most once a minute per key. */
export async function touchKey(key: VerifiedKey, ip: string): Promise<void> {
  if (key.lastUsedAt && Date.now() - key.lastUsedAt.getTime() < 60_000) return;
  try {
    await getDb().update(apiKeys).set({ lastUsedAt: new Date(), lastUsedIp: ip }).where(eq(apiKeys.id, key.id));
  } catch (err) {
    console.error("[api] could not record key use:", (err as Error).message);
  }
}
