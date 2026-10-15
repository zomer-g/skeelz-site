import type { Metadata } from "next";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { JobsMap, type MapJob } from "@/components/site/JobsMap";
import { pageAuth } from "@/lib/auth/guard";
import { loadPinnedKeys } from "@/lib/cms";
import { getJobs } from "@/lib/jobs/feed";
import { coordsOf, placeOptions } from "@/lib/jobs/geo";
import { jobCity } from "@/lib/jobs/list";
import { SKILLS } from "@/lib/jobs/ref";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "מפת משרות" };

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Jobs on a map: the visitor picks a centre (a locality, their own location, or a point on
 * the map) and a radius, and filters by the skills a job asks for. Distances are worked out
 * in the browser, so a visitor's own location never reaches the server or the URL; only a
 * chosen locality, the radius and the skills go in the URL.
 */
export default async function MapPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const search = await searchParams;
  const q = new URLSearchParams();
  for (const k of ["city", "radius", "skills", "remote"]) if (first(search[k])) q.set(k, first(search[k]));
  const auth = await pageAuth("editor", `/map${q.size ? `?${q}` : ""}`);
  if (!auth.ok) return auth.render;

  const [{ jobs, source }, pinned] = await Promise.all([getJobs(), loadPinnedKeys()]);
  const pinRank = new Map(pinned.map((k, i) => [k, i]));
  const mapJobs: MapJob[] = jobs.map((j) => {
    const ll = coordsOf(j.city_symbol);
    return {
      id: j.id,
      title: j.title ?? "משרה",
      company: j.company,
      city: jobCity(j),
      lat: ll?.[0] ?? null,
      lng: ll?.[1] ?? null,
      nationwide: j.city_symbol != null && j.city_symbol < 0,
      skills: j.skill_ids,
      scopes: j.job_scope,
      hot: j.hot,
      sponsored: j.sponsored,
      pin: pinRank.get(j.id) ?? null,
      published: j.published_at,
    };
  });

  return (
    <>
      <SiteHeader title="משרות על המפה" />
      <main id="main" className="w-full flex-1">
        <div className="mx-auto w-full max-w-[75.375rem] px-4 py-6">
          {source === "fixture" ? (
            <p className="mb-4 rounded-card bg-hot/30 px-4 py-2 text-center text-sm text-[#93370d]">
              פיתוח מקומי: המשרות מקובץ דוגמה (ADMIN_API_URL לא מוגדר).
            </p>
          ) : null}
          {source === "stale" ? (
            <p className="mb-4 text-center text-sm text-muted">הרשימה אולי לא מעודכנת לגמרי — עדכון המשרות האחרון נכשל, ומוצג העותק האחרון.</p>
          ) : null}
          {source === "unavailable" ? (
            <div className="mx-auto my-12 max-w-xl text-center">
              <h2 className="text-2xl font-bold">המשרות לא זמינות כרגע</h2>
              <p className="mt-2 text-muted">לא הצלחנו לטעון את רשימת המשרות. אפשר לנסות שוב בעוד כמה דקות.</p>
            </div>
          ) : (
            <JobsMap
              jobs={mapJobs}
              places={placeOptions()}
              skills={SKILLS}
              initial={{
                city: Number(first(search.city)) || null,
                radius: Number(first(search.radius)) || null,
                skills: first(search.skills).split(",").filter(Boolean),
                remote: first(search.remote) !== "0",
              }}
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
