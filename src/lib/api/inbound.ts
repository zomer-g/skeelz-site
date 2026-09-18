import { writeAudit } from "@/lib/audit";
import { touchKey, verifyKey, type VerifiedKey } from "@/lib/connect/keys";
import { firstInWindow, hit, secondsLeft } from "./rate-limit";
import { API_LIMITS, type Scope } from "./spec";
import { clientIp } from "./tokens";
import { logError } from "@/lib/log";

/**
 * The gate every keyed /api/v1 route goes through (docs/connect-api.md §1, §3).
 * These routes are for the other SKEELZ apps, not people: a key issued at
 * /admin/api stands in for the sign-in, and `withApiKey` for `requireUser`.
 */

const ACTOR = "api:inbound";
const MIN = 60_000;

export function apiJson(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export const apiError = (status: number, code: string, message: string, headers: Record<string, string> = {}) =>
  apiJson({ error: { code, message } }, status, headers);

type Handler = (req: Request, key: VerifiedKey) => Promise<Response>;

/**
 * In order: the address is not locked out, no key in the URL, a Bearer key that
 * is known, not revoked and not expired, the route's scope, then the rate limits
 * (per address, and per key id). `scope` null = any valid key.
 */
export function withApiKey(route: string, scope: Scope | null, handler: Handler): (req: Request) => Promise<Response> {
  return async (req) => {
    if (process.env.API_DISABLED === "true") return apiError(503, "disabled", "The API is switched off on this server.");

    const ip = clientIp(req.headers);
    // C5: an address we can't see is never locked out and gets only the per-key limits.
    const knownIp = ip !== "unknown";

    // C4: the named parameters, and any value that looks like one of our keys.
    const params = new URL(req.url).searchParams;
    if (["token", "api_key", "apikey", "access_token", "key"].some((k) => params.has(k)) || [...params.values()].some((v) => v.startsWith("sk_"))) {
      return apiError(400, "token_in_url", "Send the key in the Authorization header, never in the URL.");
    }

    // C5: the key is checked first; a valid key is never refused because its address is locked out.
    const bearer = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get("authorization") ?? "");
    const check = bearer ? await verifyKey(bearer[1]!) : null;
    if (!check?.ok) {
      const lockKey = `lock:${ip}`;
      if (knownIp) {
        const locked = secondsLeft(lockKey);
        if (locked) return apiError(429, "locked_out", "Too many failed authentication attempts.", { "Retry-After": String(locked) });
      }
      const failures = knownIp ? hit(`fail:${ip}`, API_LIMITS.authFailures, API_LIMITS.authFailureWindowMin * MIN) : { ok: true };
      if (!failures.ok) hit(lockKey, 1, API_LIMITS.lockoutMin * MIN);
      if (firstInWindow(`denied:${ip}`, 10 * MIN)) {
        await writeAudit(ACTOR, "api.denied", route, { ip, reason: check ? check.reason : "missing_key", lockedOut: !failures.ok });
      }
      return apiError(401, "unauthorized", "A valid key is required: Authorization: Bearer <key>.", { "WWW-Authenticate": 'Bearer realm="skeelz-site"' });
    }
    const key = check.key;

    if (scope && !key.scopes.includes(scope)) {
      if (firstInWindow(`scope:${key.id}:${route}`, 10 * MIN)) {
        await writeAudit(ACTOR, "api.denied", route, { ip, reason: "insufficient_scope", key: key.name, needs: scope });
      }
      return apiError(403, "insufficient_scope", `This key lacks the "${scope}" scope.`);
    }

    const limits = [
      ...(knownIp ? [hit(`ip:${ip}`, API_LIMITS.perIpPerMinute, MIN)] : []),
      hit(`key:${key.id}`, API_LIMITS.perKeyPerHour, 60 * MIN),
    ];
    const tightest = limits.reduce((a, b) => (b.remaining < a.remaining ? b : a));
    const rateHeaders = {
      "X-RateLimit-Limit": String(tightest.limit),
      "X-RateLimit-Remaining": String(tightest.remaining),
      "X-RateLimit-Reset": String(Math.ceil(tightest.resetAt / 1000)),
    };
    const blocked = limits.find((l) => !l.ok);
    if (blocked) {
      const retry = Math.max(1, Math.ceil((blocked.resetAt - Date.now()) / 1000));
      return apiError(429, "rate_limited", "Rate limit exceeded.", { ...rateHeaders, "Retry-After": String(retry) });
    }

    await touchKey(key, ip);
    // First use per hour per key: the log shows the API is in use without a row per request.
    if (firstInWindow(`used:${key.id}`, 60 * MIN)) void writeAudit(ACTOR, "api.used", route, { ip, key: key.name });

    try {
      const res = await handler(req, key);
      for (const [name, value] of Object.entries(rateHeaders)) res.headers.set(name, value);
      return res;
    } catch (err) {
      logError(`api: ${route}`, err);
      return apiError(500, "internal_error", "Something went wrong.", rateHeaders);
    }
  };
}

/** A whole number within [min, max], the fallback when absent, or null when invalid. */
export function intParam(params: URLSearchParams, name: string, fallback: number, min: number, max: number): number | null {
  const raw = params.get(name);
  if (raw === null || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= min && n <= max ? n : null;
}
