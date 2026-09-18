import fixture from "@/data/fixture-jobs.json";
import { peerFetch, resolveConnection } from "@/lib/connect/client";
import { isJobKey, type FeedJob } from "./types";
import { logError } from "@/lib/log";

/**
 * Jobs come from the admin app's feed, fetched on the server only, through
 * peerFetch("admin", "/api/v1/site/jobs") — the connection set at /admin/connections,
 * or ADMIN_API_URL + SITE_FEED_TOKEN when none is set (docs/connect-api.md §2).
 * Kept in memory for two minutes. When a refresh fails the last good copy keeps
 * serving; only a process that never got one shows "no jobs". With no admin
 * connection at all (local dev) the committed fixture stands in.
 */

const TTL_MS = 2 * 60_000;
const TIMEOUT_MS = 15_000;
// C6: the feed response, the number of jobs and each description are capped.
const MAX_FEED_BYTES = 10 * 1024 * 1024;
const MAX_JOBS = 5000;
const MAX_DESCRIPTION_CHARS = 100_000;

export type FeedSource = "feed" | "stale" | "fixture" | "unavailable";

export interface JobsResult {
  jobs: FeedJob[];
  source: FeedSource;
  /** When the feed generated this copy (or the fixture was captured). */
  generatedAt: string | null;
}

interface CacheState {
  jobs: FeedJob[];
  generatedAt: string | null;
  fetchedAt: number;
}

const g = globalThis as typeof globalThis & {
  __skeelzSiteFeed?: CacheState;
  __skeelzSiteFeedInflight?: Promise<CacheState>;
  __skeelzSiteFeedLastError?: number;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean) : [];

/** Validates one row; anything without a 24-hex key is dropped. */
function toJob(row: unknown): FeedJob | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (!isJobKey(r.id)) return null;
  const symbol = typeof r.city_symbol === "number" ? r.city_symbol : Number(r.city_symbol);
  return {
    id: r.id,
    case_id: str(r.case_id),
    case_number: r.case_number == null ? null : String(r.case_number),
    title: str(r.title),
    company: str(r.company),
    description_html: typeof r.description_html === "string" ? r.description_html.slice(0, MAX_DESCRIPTION_CHARS) : null,
    city: str(r.city),
    city_symbol: r.city_symbol == null || !Number.isFinite(symbol) ? null : symbol,
    job_scope: strList(r.job_scope),
    skill_ids: strList(r.skill_ids),
    hot: r.hot === true,
    sponsored: r.sponsored === true,
    self_apply: r.self_apply === true,
    published_at: str(r.published_at),
    updated_at: str(r.updated_at),
  };
}

function parse(body: unknown): { jobs: FeedJob[]; generatedAt: string | null } {
  const b = body as { data?: unknown; generated_at?: unknown };
  if (!b || !Array.isArray(b.data)) throw new Error("feed: no data array");
  const seen = new Set<string>();
  const jobs: FeedJob[] = [];
  for (const row of b.data) {
    if (jobs.length >= MAX_JOBS) break;
    const job = toJob(row);
    if (job && !seen.has(job.id)) {
      seen.add(job.id);
      jobs.push(job);
    }
  }
  return { jobs, generatedAt: str(b.generated_at) };
}

async function fetchFeed(): Promise<CacheState> {
  const { jobs, generatedAt } = parse(await peerFetch("admin", "/api/v1/site/jobs", { timeoutMs: TIMEOUT_MS, maxBytes: MAX_FEED_BYTES }));
  return { jobs, generatedAt, fetchedAt: Date.now() };
}

export async function getJobs(): Promise<JobsResult> {
  if (!(await resolveConnection("admin"))) {
    const { jobs, generatedAt } = parse(fixture);
    return { jobs, source: "fixture", generatedAt };
  }

  const cached = g.__skeelzSiteFeed;
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return { jobs: cached.jobs, source: "feed", generatedAt: cached.generatedAt };

  // After a failure, wait 30 seconds before asking again rather than on every request.
  const lastError = g.__skeelzSiteFeedLastError ?? 0;
  if (cached && Date.now() - lastError < 30_000) return { jobs: cached.jobs, source: "stale", generatedAt: cached.generatedAt };

  try {
    g.__skeelzSiteFeedInflight ??= fetchFeed().finally(() => {
      g.__skeelzSiteFeedInflight = undefined;
    });
    const fresh = await g.__skeelzSiteFeedInflight;
    g.__skeelzSiteFeed = fresh;
    return { jobs: fresh.jobs, source: "feed", generatedAt: fresh.generatedAt };
  } catch (err) {
    if (Date.now() - lastError > 5 * 60_000) logError("feed: refresh", err);
    g.__skeelzSiteFeedLastError = Date.now();
    if (cached) return { jobs: cached.jobs, source: "stale", generatedAt: cached.generatedAt };
    return { jobs: [], source: "unavailable", generatedAt: null };
  }
}

export async function getJob(key: string): Promise<{ job: FeedJob | null; source: FeedSource }> {
  if (!isJobKey(key)) return { job: null, source: "feed" };
  const { jobs, source } = await getJobs();
  return { job: jobs.find((j) => j.id === key) ?? null, source };
}
