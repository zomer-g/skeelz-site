import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { eq } from "drizzle-orm";
import { envBaseUrl, envSecret } from "@/lib/api/tokens";
import { getDb } from "@/lib/db/client";
import { connections, type Peer } from "@/lib/db/schema";
import { logError } from "@/lib/log";
import { decryptSecret } from "./crypto";

/**
 * Every call to another SKEELZ app goes through peerFetch (docs/connect-api.md §2).
 * The connection comes from the `connections` row (set at /admin/connections); with
 * no row, from the env this app was wired with before:
 *   admin: ADMIN_API_URL + SITE_FEED_TOKEN
 *   crm:   CRM_URL + CRM_INTAKE_TOKEN
 * The key is sent as a Bearer header and never logged; errors carry codes and statuses only.
 * Amendments: C1 (no internal addresses, checked again before every request), C6
 * (response size cap), L3 (a failed lookup of the crm connection fails closed).
 */

export type SitePeer = Extract<Peer, "admin" | "crm">;
export const PEERS: SitePeer[] = ["admin", "crm"];

export const PEER_LABELS: Record<SitePeer, string> = { admin: "מערכת הניהול (admin)", crm: "מערכת הגיוס (crm)" };

const ENV: Record<SitePeer, { url: "ADMIN_API_URL" | "CRM_URL"; key: "SITE_FEED_TOKEN" | "CRM_INTAKE_TOKEN" }> = {
  admin: { url: "ADMIN_API_URL", key: "SITE_FEED_TOKEN" },
  crm: { url: "CRM_URL", key: "CRM_INTAKE_TOKEN" },
};

export const envNames = (peer: SitePeer) => ENV[peer];

/** Default response cap (C6); the job feed passes 10 MB. */
export const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

export interface ResolvedConnection {
  peer: SitePeer;
  source: "db" | "env";
  baseUrl: string;
  key: string;
  enabled: boolean;
}

export class PeerError extends Error {
  constructor(
    /** not_configured | disabled | lookup_failed | invalid_base_url | blocked_address | timeout | unreachable | too_large | http | bad_response */
    public readonly code: string,
    public readonly status: number | null = null,
    /** The peer's own error code from {error:{code}}, when it sent one. */
    public readonly peerCode: string | null = null,
  ) {
    super(`peer ${code}${status ? ` ${status}` : ""}${peerCode ? ` ${peerCode}` : ""}`);
    this.name = "PeerError";
  }
}

/**
 * DB first, then env; null when neither is set. A disabled row stays disabled (no env fallback).
 * If the lookup itself fails: the admin feed falls back to env (public job data only), but the
 * crm connection — the path a CV travels — fails closed, so a peer an admin switched off can't
 * be reached through env because the database hiccuped.
 */
export async function resolveConnection(peer: SitePeer): Promise<ResolvedConnection | null> {
  let row: typeof connections.$inferSelect | undefined;
  try {
    [row] = await getDb().select().from(connections).where(eq(connections.peer, peer)).limit(1);
  } catch (err) {
    logError(`connect: ${peer} connection lookup`, err);
    if (peer === "crm") throw new PeerError("lookup_failed");
  }
  if (row) {
    let key = "";
    try {
      key = row.keyCiphertext ? decryptSecret(row.keyCiphertext, peer) : "";
    } catch {
      console.error(`[connect] the stored ${peer} key cannot be decrypted; re-enter it at /admin/connections`);
    }
    return { peer, source: "db", baseUrl: row.baseUrl, key, enabled: row.enabled };
  }
  const baseUrl = envBaseUrl(ENV[peer].url);
  const key = envSecret(ENV[peer].key);
  if (!baseUrl || !key) return null;
  return { peer, source: "env", baseUrl, key, enabled: true };
}

export interface PeerInit extends Omit<RequestInit, "signal"> {
  timeoutMs?: number;
  maxBytes?: number;
}

/**
 * Calls `path` on the peer and returns its parsed JSON body (2xx). Anything else
 * throws a PeerError: not configured, disabled, blocked address, timeout, unreachable,
 * too large, or the peer's HTTP status with its error code.
 */
export async function peerFetch<T = unknown>(peer: SitePeer, path: string, init: PeerInit = {}): Promise<T> {
  const conn = await resolveConnection(peer);
  if (!conn || !conn.key) throw new PeerError("not_configured");
  if (!conn.enabled) throw new PeerError("disabled");
  return fetchWith<T>(conn, path, init);
}

export async function fetchWith<T>(conn: ResolvedConnection, path: string, init: PeerInit = {}): Promise<T> {
  // C1 again at request time, so rows stored before the rule (and env URLs) are covered too.
  const checked = checkBaseUrl(conn.baseUrl);
  if (!checked.ok) throw new PeerError(checked.code);
  await assertPublicHost(new URL(checked.origin).hostname);

  const { timeoutMs = 15_000, maxBytes = DEFAULT_MAX_BYTES, headers, ...rest } = init;
  const signal = AbortSignal.timeout(timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${checked.origin}${path}`, {
      ...rest,
      headers: { Accept: "application/json", ...(headers as Record<string, string> | undefined), Authorization: `Bearer ${conn.key}` },
      cache: "no-store",
      redirect: "error",
      signal,
    });
  } catch (err) {
    const name = (err as Error).name;
    throw new PeerError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "unreachable");
  }
  const text = await readCapped(res, maxBytes);
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  if (!res.ok) {
    const code = (body as { error?: { code?: unknown } } | undefined)?.error?.code;
    throw new PeerError("http", res.status, typeof code === "string" && /^[\w.:-]{1,60}$/.test(code) ? code : null);
  }
  if (body === undefined) throw new PeerError("bad_response", res.status);
  return body as T;
}

/** C6: refuse a declared oversize body, and count bytes while streaming the rest. */
async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel().catch(() => {});
    throw new PeerError("too_large", res.status);
  }
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new PeerError("too_large", res.status);
      }
      chunks.push(value);
    }
  } catch (err) {
    if (err instanceof PeerError) throw err;
    const name = (err as Error).name;
    throw new PeerError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "unreachable");
  }
  return Buffer.concat(chunks).toString("utf8");
}

const isDev = () => process.env.NODE_ENV === "development";

/**
 * C1 base_url rules. Production: https only; no IP literals; no localhost, *.localhost, *.local,
 * *.internal, *.lan or single-label names; no credentials, path, query or fragment.
 * Development also allows http://localhost:<port> and http://127.0.0.1:<port>.
 */
export function checkBaseUrl(raw: string): { ok: true; origin: string } | { ok: false; code: "invalid_base_url" | "blocked_address" } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, code: "invalid_base_url" };
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return { ok: false, code: "invalid_base_url" };
  const host = url.hostname.toLowerCase();
  if (isDev() && url.protocol === "http:" && (host === "localhost" || host === "127.0.0.1")) return { ok: true, origin: url.origin };
  if (url.protocol !== "https:") return { ok: false, code: "invalid_base_url" };
  const bare = host.replace(/^\[|\]$/g, "");
  if (isIP(bare)) return { ok: false, code: "blocked_address" };
  if (host === "localhost" || /\.(localhost|local|internal|lan)\.?$/.test(host) || !host.includes(".")) return { ok: false, code: "blocked_address" };
  return { ok: true, origin: url.origin };
}

/** The origin for a valid base URL, or null (kept for the save form). */
export function cleanBaseUrl(raw: string): string | null {
  const r = checkBaseUrl(raw);
  return r.ok ? r.origin : null;
}

/** C1 at fetch time (production): every address the name resolves to must be public. */
async function assertPublicHost(hostname: string): Promise<void> {
  if (isDev() && (hostname === "localhost" || hostname === "127.0.0.1")) return;
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new PeerError("unreachable");
  }
  if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) throw new PeerError("blocked_address");
}

function v4Blocked(ip: string): boolean {
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    a === 0 || // 0.0.0.0/8 unspecified
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast and reserved
  );
}

export function isBlockedAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return v4Blocked(ip);
  if (kind !== 6) return true;
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return v4Blocked(mapped[1]!);
  if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(v6)) return true; // mapped, hex form: refuse
  if (v6 === "::" || v6 === "::1") return true;
  const first = parseInt(v6.split(":")[0] || "0", 16);
  return (
    (first & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (first & 0xfe00) === 0xfc00 || // ULA fc00::/7
    (first & 0xff00) === 0xff00 // multicast
  );
}
