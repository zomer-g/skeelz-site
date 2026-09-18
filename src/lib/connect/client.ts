import { eq } from "drizzle-orm";
import { envBaseUrl, envSecret } from "@/lib/api/tokens";
import { getDb } from "@/lib/db/client";
import { connections, type Peer } from "@/lib/db/schema";
import { decryptSecret } from "./crypto";

/**
 * Every call to another SKEELZ app goes through peerFetch (docs/connect-api.md §2).
 * The connection comes from the `connections` row (set at /admin/connections); with
 * no row, from the env this app was wired with before:
 *   admin: ADMIN_API_URL + SITE_FEED_TOKEN
 *   crm:   CRM_URL + CRM_INTAKE_TOKEN
 * The key is sent as a Bearer header and never logged; errors carry codes and statuses only.
 */

export type SitePeer = Extract<Peer, "admin" | "crm">;
export const PEERS: SitePeer[] = ["admin", "crm"];

export const PEER_LABELS: Record<SitePeer, string> = { admin: "מערכת הניהול (admin)", crm: "מערכת הגיוס (crm)" };

const ENV: Record<SitePeer, { url: "ADMIN_API_URL" | "CRM_URL"; key: "SITE_FEED_TOKEN" | "CRM_INTAKE_TOKEN" }> = {
  admin: { url: "ADMIN_API_URL", key: "SITE_FEED_TOKEN" },
  crm: { url: "CRM_URL", key: "CRM_INTAKE_TOKEN" },
};

export const envNames = (peer: SitePeer) => ENV[peer];

export interface ResolvedConnection {
  peer: SitePeer;
  source: "db" | "env";
  baseUrl: string;
  key: string;
  enabled: boolean;
}

export class PeerError extends Error {
  constructor(
    /** not_configured | disabled | timeout | unreachable | http | bad_response */
    public readonly code: string,
    public readonly status: number | null = null,
    /** The peer's own error code from {error:{code}}, when it sent one. */
    public readonly peerCode: string | null = null,
  ) {
    super(`peer ${code}${status ? ` ${status}` : ""}${peerCode ? ` ${peerCode}` : ""}`);
  }
}

/** DB first, then env; null when neither is set. A disabled row stays disabled (it doesn't fall back to env). */
export async function resolveConnection(peer: SitePeer): Promise<ResolvedConnection | null> {
  let row: typeof connections.$inferSelect | undefined;
  try {
    [row] = await getDb().select().from(connections).where(eq(connections.peer, peer)).limit(1);
  } catch (err) {
    // A database hiccup must not cut the job feed off: the env wiring still works.
    console.error("[connect] connection lookup failed, using env:", (err as Error).message);
  }
  if (row) {
    let key = "";
    try {
      key = row.keyCiphertext ? decryptSecret(row.keyCiphertext) : "";
    } catch {
      console.error(`[connect] the stored ${peer} key cannot be decrypted (CONNECT_SECRET_KEY changed?)`);
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
}

/**
 * Calls `path` on the peer and returns its parsed JSON body (2xx). Anything else
 * throws a PeerError: not configured, disabled, timeout, unreachable, or the
 * peer's HTTP status with its error code.
 */
export async function peerFetch<T = unknown>(peer: SitePeer, path: string, init: PeerInit = {}): Promise<T> {
  const conn = await resolveConnection(peer);
  if (!conn || !conn.key) throw new PeerError("not_configured");
  if (!conn.enabled) throw new PeerError("disabled");
  return fetchWith<T>(conn, path, init);
}

export async function fetchWith<T>(conn: ResolvedConnection, path: string, init: PeerInit = {}): Promise<T> {
  const { timeoutMs = 15_000, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${conn.baseUrl}${path}`, {
      ...rest,
      headers: { Accept: "application/json", ...(headers as Record<string, string> | undefined), Authorization: `Bearer ${conn.key}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const name = (err as Error).name;
    throw new PeerError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "unreachable");
  }
  const body = (await res.json().catch(() => undefined)) as unknown;
  if (!res.ok) {
    const code = (body as { error?: { code?: unknown } } | undefined)?.error?.code;
    throw new PeerError("http", res.status, typeof code === "string" && /^[\w.:-]{1,60}$/.test(code) ? code : null);
  }
  if (body === undefined) throw new PeerError("bad_response", res.status);
  return body as T;
}

/**
 * base_url rules (anti-SSRF): https:// — or http://localhost / 127.0.0.1 in development —
 * with no path, query, fragment or credentials. Returns the origin, or null.
 */
export function cleanBaseUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const httpOk = url.protocol === "http:" && local && process.env.NODE_ENV === "development";
  if (url.protocol !== "https:" && !httpOk) return null;
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return null;
  return url.origin;
}
