import { and, gte, sql, type SQL } from "drizzle-orm";
import { apiError, apiJson, intParam, withApiKey } from "@/lib/api/inbound";
import { API_LIMITS } from "@/lib/api/spec";
import { getDb } from "@/lib/db/client";
import { applications } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The cursor is opaque to callers: base64url of "<created_at ISO>|<id>" of the last row served. */
function readCursor(raw: string | null): { at: Date; id: string } | null | "invalid" {
  if (!raw) return null;
  try {
    const [iso, id] = Buffer.from(raw, "base64url").toString("utf8").split("|");
    const at = new Date(iso ?? "");
    if (Number.isNaN(at.getTime()) || !id || !UUID.test(id)) return "invalid";
    return { at, id };
  } catch {
    return "invalid";
  }
}

/**
 * applications:read — applications made on the site, oldest first. Ids, job, time and
 * forwarding status only: no profile fields, and no CV (the site never stores one).
 */
export const GET = withApiKey("GET /api/v1/applications", "applications:read", async (req) => {
  const params = new URL(req.url).searchParams;
  const limit = intParam(params, "limit", API_LIMITS.defaultPageSize, 1, API_LIMITS.maxPageSize);
  if (limit === null) return apiError(400, "invalid", `limit must be a whole number from 1 to ${API_LIMITS.maxPageSize}.`);
  const sinceRaw = params.get("since");
  const since = sinceRaw ? new Date(sinceRaw) : null;
  if (since && Number.isNaN(since.getTime())) return apiError(400, "invalid", "since must be an ISO 8601 time.");
  const cursor = readCursor(params.get("cursor"));
  if (cursor === "invalid") return apiError(400, "invalid", "cursor is not valid.");

  const where: SQL[] = [];
  if (since) where.push(gte(applications.createdAt, since));
  // Postgres keeps microseconds and the cursor milliseconds, so both sides compare at millisecond precision.
  const at = sql`date_trunc('milliseconds', ${applications.createdAt})`;
  if (cursor) where.push(sql`(${at}, ${applications.id}) > (${cursor.at.toISOString()}::timestamptz, ${cursor.id}::uuid)`);

  const rows = await getDb()
    .select({
      id: applications.id,
      jobKey: applications.jobKey,
      createdAt: applications.createdAt,
      status: applications.status,
      crmApplicationId: applications.crmApplicationId,
    })
    .from(applications)
    .where(where.length ? and(...where) : undefined)
    .orderBy(at, applications.id)
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const next = rows.length > limit && last ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString("base64url") : null;
  return apiJson({
    data: page.map((r) => ({
      site_application_id: r.id,
      job_key: r.jobKey,
      created_at: r.createdAt.toISOString(),
      status: r.status,
      crm_application_id: r.crmApplicationId,
    })),
    next_cursor: next,
  });
});
