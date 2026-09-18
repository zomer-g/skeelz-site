/**
 * The one way to log a caught error (security fix C7). A drizzle/pg error's
 * `.message` holds the SQL *and its parameter values* — applicant names, emails,
 * phones — so it is never printed. This logs where it happened and a code:
 *   - our own typed errors (PeerError etc.): their `code` (and HTTP status)
 *   - database errors: the pg SQLSTATE from `err.cause.code` (or `err.code`)
 *   - anything else: `err.name`
 * Never pass request bodies, FormData or files to a log.
 */
export function errorCode(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { name?: unknown; code?: unknown; status?: unknown; cause?: { code?: unknown } };
    const pg = e.cause && typeof e.cause === "object" && typeof e.cause.code === "string" ? e.cause.code : null;
    if (pg) return /^[0-9A-Z]{5}$/.test(pg) ? `sqlstate ${pg}` : pg;
    if (typeof e.code === "string" && /^[\w.:-]{1,60}$/.test(e.code)) {
      return typeof e.status === "number" ? `${e.code} ${e.status}` : e.code;
    }
    if (typeof e.name === "string") return e.name;
  }
  return "unknown";
}

export function logError(where: string, err: unknown): void {
  console.error(`[${where}] failed: ${errorCode(err)}`);
}
