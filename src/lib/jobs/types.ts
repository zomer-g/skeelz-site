/** One job as the admin feed (GET /api/v1/site/jobs) returns it. `id` is the 24-hex site key. */
export interface FeedJob {
  id: string;
  case_id: string | null;
  case_number: string | null;
  title: string | null;
  company: string | null;
  /** Untrusted HTML: render only through sanitizeDescription(). */
  description_html: string | null;
  city: string | null;
  city_symbol: number | null;
  job_scope: string[];
  skill_ids: string[];
  hot: boolean;
  sponsored: boolean;
  self_apply: boolean;
  published_at: string | null;
  updated_at: string | null;
}

export const JOB_KEY = /^[0-9a-f]{24}$/;

export const isJobKey = (value: unknown): value is string => typeof value === "string" && JOB_KEY.test(value);
