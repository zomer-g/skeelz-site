/**
 * Refreshes src/data/fixture-jobs.json — a few live jobs mapped to the admin
 * feed's shape, used only when ADMIN_API_URL is unset (local dev without the
 * feed token). Contact names, phones and emails in the live payload are dropped.
 * Run with `npm run snapshot:fixture` and commit the result.
 */
import { writeFileSync } from "node:fs";

const URL_ACTIVE =
  "https://jobs.skeelz.co.il/api/jobs/active?filterOptions[includeRandomSponsoredJobs]=true&filterOptions[jobStatus][0]=Active&filterOptions[inputValue]=";
const COUNT = 16;

interface LiveJob {
  _id: string;
  jobId?: number;
  title?: string;
  companyName?: string;
  description?: string;
  citySymbol?: number;
  location?: { city?: string };
  jobScope?: string[];
  requiredSkills?: string[];
  isMarked?: boolean;
  isSponsored?: boolean;
  isSelfApply?: boolean;
  publishDate?: string;
  updatedAt?: string;
}

async function main() {
  const res = await fetch(URL_ACTIVE, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { data: { jobs: LiveJob[] } };
  const jobs = body.data.jobs.slice(0, COUNT).map((j) => ({
    id: j._id,
    case_id: null,
    case_number: j.jobId != null ? String(j.jobId) : null,
    title: j.title?.trim() ?? null,
    company: j.companyName?.trim() ?? null,
    description_html: j.description ?? null,
    city: j.location?.city ?? null,
    city_symbol: j.citySymbol ?? null,
    job_scope: j.jobScope ?? [],
    skill_ids: j.requiredSkills ?? [],
    hot: j.isMarked === true,
    sponsored: j.isSponsored === true,
    self_apply: j.isSelfApply === true,
    published_at: j.publishDate ?? null,
    updated_at: j.updatedAt ?? null,
  }));
  const out = { data: jobs, total: jobs.length, generated_at: new Date().toISOString(), fixture: true };
  writeFileSync("src/data/fixture-jobs.json", JSON.stringify(out, null, 1) + "\n");
  console.log(`[snapshot:fixture] ${jobs.length} jobs`);
}

main().catch((err: Error) => {
  console.error("[snapshot:fixture] FAILED:", err.message);
  process.exit(1);
});
