import Link from "next/link";
import { RichText } from "@/components/RichText";
import { Banners } from "@/components/site/Banners";
import { JobCard } from "@/components/site/JobCard";
import { JobFilters } from "@/components/site/JobFilters";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { buttonClass } from "@/components/ui";
import { pageAuth } from "@/lib/auth/guard";
import { loadPinnedKeys } from "@/lib/cms";
import { getJobs } from "@/lib/jobs/feed";
import { cityOptions, filtersQuery, hasFilters, listJobs, readFilters, scopeOptions } from "@/lib/jobs/list";
import { fmtInt } from "@/lib/format";
import { loadText } from "@/lib/texts/store";

export const dynamic = "force-dynamic";

const PAGE = 30;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const search = await searchParams;
  const filters = readFilters(search);
  const auth = await pageAuth(`/${filtersQuery(filters)}`);
  if (!auth.ok) return auth.render;

  const [{ jobs, source }, pinned, hero] = await Promise.all([getJobs(), loadPinnedKeys(), loadText("home_hero")]);
  const list = listJobs(jobs, filters, pinned);
  const pinnedSet = new Set(pinned);
  const showRaw = Number(Array.isArray(search.show) ? search.show[0] : search.show);
  const show = Number.isSafeInteger(showRaw) && showRaw > PAGE ? Math.min(showRaw, 1000) : PAGE;
  const shown = list.slice(0, show);

  return (
    <>
      <SiteHeader intro={<RichText body={hero.body} />}>
        <JobFilters filters={filters} cities={cityOptions(jobs)} scopes={scopeOptions(jobs)} />
      </SiteHeader>
      <Banners />
      <main id="main" className="w-full flex-1">
        <div className="mx-auto w-full max-w-[75.375rem] px-4">
          {source === "fixture" ? (
            <p className="mt-6 rounded-card bg-hot/30 px-4 py-2 text-center text-sm text-[#93370d]">
              פיתוח מקומי: המשרות מקובץ דוגמה (ADMIN_API_URL לא מוגדר).
            </p>
          ) : null}
          {source === "stale" ? (
            <p className="mt-6 text-center text-sm text-muted">הרשימה אולי לא מעודכנת לגמרי — עדכון המשרות האחרון נכשל, ומוצג העותק האחרון.</p>
          ) : null}

          <p role="status" className="mt-6 text-center text-sm text-muted">
            {source === "unavailable" ? "" : hasFilters(filters) ? `נמצאו ${fmtInt(list.length)} משרות` : `${fmtInt(list.length)} משרות פעילות`}
          </p>

          {source === "unavailable" ? (
            <div className="mx-auto my-12 max-w-xl text-center">
              <h2 className="text-2xl font-bold">המשרות לא זמינות כרגע</h2>
              <p className="mt-2 text-muted">לא הצלחנו לטעון את רשימת המשרות. אפשר לנסות שוב בעוד כמה דקות.</p>
            </div>
          ) : list.length === 0 ? (
            <div className="mx-auto my-12 max-w-xl text-center">
              <h2 className="text-2xl font-bold">לא מצאנו משרות שמתאימות לחיפוש שלך</h2>
              <p className="mt-2 text-muted">אבל שינוי של מילות החיפוש יכול לעזור לך למצוא עוד משרות</p>
              <Link href="/" className={`${buttonClass("secondary")} mt-6`}>
                לכל המשרות
              </Link>
            </div>
          ) : (
            <div className="mx-auto max-w-[60.75rem]">
              {shown.map((job, i) => (
                <JobCard key={job.id} job={job} index={i} pinned={pinnedSet.has(job.id)} />
              ))}
              {list.length > shown.length ? (
                <p className="mt-8 text-center">
                  <Link href={`/${filtersQuery(filters, { show: String(show + PAGE) })}`} scroll={false} className={buttonClass("secondary")}>
                    הצגת משרות נוספות
                    <span className="sr-only"> · מוצגות {fmtInt(shown.length)} מתוך {fmtInt(list.length)}</span>
                  </Link>
                </p>
              ) : null}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
