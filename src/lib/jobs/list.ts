import { locate, NATIONWIDE, skillName } from "./ref";
import type { FeedJob } from "./types";

/**
 * The job list's search and filters. They live in the URL with the live site's
 * parameter names (searchValue, district, city, skills, scope), comma-separated
 * there; a GET form sends repeated parameters, and both are accepted.
 */

export interface JobFilters {
  searchValue: string;
  districts: string[];
  cities: number[];
  skills: string[];
  scopes: string[];
}

type Search = Record<string, string | string[] | undefined>;

const values = (v: string | string[] | undefined): string[] =>
  (Array.isArray(v) ? v : v ? [v] : [])
    .flatMap((s) => s.split(","))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

export function readFilters(search: Search): JobFilters {
  const q = Array.isArray(search.searchValue) ? search.searchValue[0] : search.searchValue;
  return {
    searchValue: (q ?? "").trim().slice(0, 100),
    districts: values(search.district),
    cities: values(search.city)
      .map(Number)
      .filter((n) => Number.isSafeInteger(n)),
    skills: values(search.skills),
    scopes: values(search.scope),
  };
}

export const hasFilters = (f: JobFilters) =>
  Boolean(f.searchValue || f.districts.length || f.cities.length || f.skills.length || f.scopes.length);

/** The URL for a set of filters, comma-joined as on the live site. */
export function filtersQuery(f: JobFilters, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  if (f.searchValue) q.set("searchValue", f.searchValue);
  if (f.scopes.length) q.set("scope", f.scopes.join(","));
  if (f.cities.length) q.set("city", f.cities.join(","));
  if (f.districts.length) q.set("district", f.districts.join(","));
  if (f.skills.length) q.set("skills", f.skills.join(","));
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function jobDistrict(job: FeedJob): string | null {
  if (job.city_symbol != null && job.city_symbol < 0) return NATIONWIDE;
  return locate(job.city_symbol, job.city)?.district ?? null;
}

export function jobCity(job: FeedJob): string | null {
  return job.city ?? locate(job.city_symbol, null)?.city ?? null;
}

const fold = (s: string) => s.toLocaleLowerCase("he").replace(/["'״׳.\-־]/g, "");

function matches(job: FeedJob, f: JobFilters): boolean {
  if (f.searchValue) {
    const needle = fold(f.searchValue);
    const hay = [job.title, job.company, jobCity(job), ...job.skill_ids.map(skillName)].filter(Boolean).map((s) => fold(s!));
    if (!hay.some((h) => h.includes(needle))) return false;
  }
  if (f.districts.length || f.cities.length) {
    const district = jobDistrict(job);
    // A national or work-from-home job is open to every district.
    const inDistrict = district != null && (district === NATIONWIDE ? f.districts.length > 0 : f.districts.includes(district));
    const inCity = job.city_symbol != null && f.cities.includes(job.city_symbol);
    if (!inDistrict && !inCity) return false;
  }
  if (f.skills.length && !job.skill_ids.some((s) => f.skills.includes(s))) return false;
  if (f.scopes.length && !job.job_scope.some((s) => f.scopes.includes(s))) return false;
  return true;
}

const time = (iso: string | null) => (iso ? Date.parse(iso) || 0 : 0);

/** Filtered jobs: the admin's pinned jobs first (in pin order), then the newest first. */
export function listJobs(jobs: FeedJob[], f: JobFilters, pinned: string[]): FeedJob[] {
  const pinRank = new Map(pinned.map((k, i) => [k, i]));
  return jobs
    .filter((j) => matches(j, f))
    .sort((a, b) => {
      const pa = pinRank.get(a.id) ?? Infinity;
      const pb = pinRank.get(b.id) ?? Infinity;
      if (pa !== pb) return pa - pb;
      return time(b.published_at) - time(a.published_at);
    });
}

/** Scope codes present in the feed, so the filter offers only values that can match. */
export function scopeOptions(jobs: FeedJob[]): string[] {
  const set = new Set<string>(["FullTime", "PartialTime"]);
  for (const j of jobs) for (const s of j.job_scope) set.add(s);
  return [...set];
}

/** Cities that have jobs, grouped under their district, for the location filter. */
export function cityOptions(jobs: FeedJob[]): Map<string, { symbol: number; city: string }[]> {
  const byDistrict = new Map<string, Map<number, string>>();
  for (const j of jobs) {
    if (j.city_symbol == null || j.city_symbol < 0) continue;
    const loc = locate(j.city_symbol, j.city);
    const district = loc?.district ?? "אחר";
    const city = j.city ?? loc?.city;
    if (!city) continue;
    if (!byDistrict.has(district)) byDistrict.set(district, new Map());
    byDistrict.get(district)!.set(j.city_symbol, city);
  }
  const out = new Map<string, { symbol: number; city: string }[]>();
  for (const [d, m] of byDistrict)
    out.set(
      d,
      [...m].map(([symbol, city]) => ({ symbol, city })).sort((a, b) => a.city.localeCompare(b.city, "he")),
    );
  return out;
}

export function fmtJobDate(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!t) return "—";
  // dd/mm/yy, as on the live site.
  const parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Asia/Jerusalem" }).format(t);
  return parts;
}
