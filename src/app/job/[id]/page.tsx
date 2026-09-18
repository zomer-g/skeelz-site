import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BagIcon, ClockIcon, DocIcon, PinIcon } from "@/components/icons";
import { ApplyForm } from "@/components/site/ApplyForm";
import { Banners } from "@/components/site/Banners";
import { Detail, HotBadge, SponsoredBadge } from "@/components/site/JobCard";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { buttonClass } from "@/components/ui";
import { pageAuth } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/session";
import { getJob } from "@/lib/jobs/feed";
import { fmtJobDate, jobCity } from "@/lib/jobs/list";
import { scopeLabel, skillName } from "@/lib/jobs/ref";
import { descriptionText, sanitizeDescription } from "@/lib/jobs/sanitize";
import { isJobKey } from "@/lib/jobs/types";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

/** Only admins may see anything, so the title and description are given only to a signed-in admin. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  if ((await getSession()).status !== "ok") return { title: "משרה" };
  const { job } = await getJob(id);
  if (!job) return { title: "המשרה לא נמצאה" };
  return { title: job.title ?? "משרה", description: descriptionText(job.description_html) || undefined };
}

/**
 * /job/<24-hex key> — the same URL as the live site, so links and search
 * results carry over at launch. The live site opens the job as a dialog over
 * the list; here it is its own page with the same parts: title band, details,
 * description, skills and the apply form.
 */
export default async function JobPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!isJobKey(id)) notFound();
  const auth = await pageAuth("editor", `/job/${id}`);
  if (!auth.ok) return auth.render;

  const { job, source } = await getJob(id);

  if (!job) {
    return (
      <>
        <SiteHeader titleIsHeading={false} />
        <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-4 px-4 py-16 text-center">
          <h1 className="text-3xl font-bold">{source === "unavailable" ? "המשרות לא זמינות כרגע" : "המשרה לא נמצאה"}</h1>
          <p className="text-muted">
            {source === "unavailable" ? "לא הצלחנו לטעון את פרטי המשרה. אפשר לנסות שוב בעוד כמה דקות." : "ייתכן שהמשרה כבר אוישה או שאינה פעילה עוד."}
          </p>
          <Link href="/" className={buttonClass("primary")}>
            לכל המשרות
          </Link>
        </main>
        <SiteFooter />
      </>
    );
  }

  const description = sanitizeDescription(job.description_html);
  const skills = job.skill_ids.map(skillName).filter((s): s is string => Boolean(s));
  const title = job.title ?? "משרה";

  return (
    <>
      <SiteHeader titleIsHeading={false} />
      <Banners />
      <main id="main" className="w-full flex-1">
        <div className="mx-auto w-full max-w-[70.875rem] px-4 py-6">
          <p className="mb-4">
            <Link href="/" className="text-sm font-medium text-accent-dark underline underline-offset-4">
              <span aria-hidden>→</span> לכל המשרות
            </Link>
          </p>

          <article aria-labelledby="job-title" className="overflow-hidden rounded-modal border-2 border-line bg-white">
            <header className="flex flex-col items-center gap-3 bg-accent px-6 py-5 text-center sm:py-6">
              <h1 id="job-title" className="text-2xl font-medium text-white sm:text-[1.875rem]">
                {title}
              </h1>
              {job.hot || job.sponsored ? (
                <div className="flex items-center gap-2">
                  {job.sponsored ? (
                    <span className="rounded-full bg-white">
                      <SponsoredBadge />
                    </span>
                  ) : null}
                  {job.hot ? <HotBadge /> : null}
                </div>
              ) : null}
            </header>

            <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-2">
              <div className="min-w-0">
                <section aria-labelledby="details-title">
                  <h2 id="details-title" className="text-xl font-bold">
                    פרטי משרה
                  </h2>
                  <div className="mt-2">
                    <Detail icon={<PinIcon />} label="מיקום">
                      {jobCity(job) ?? "—"}
                    </Detail>
                    <Detail icon={<DocIcon />} label="היקף משרה">
                      {job.job_scope.map(scopeLabel).join(" · ") || "—"}
                    </Detail>
                    <Detail icon={<ClockIcon />} label="פרסום משרה">
                      {fmtJobDate(job.published_at)}
                    </Detail>
                    <Detail icon={<BagIcon />} label="חברה">
                      {job.company ?? "—"}
                    </Detail>
                  </div>
                </section>

                <hr className="my-6 border-line" />

                <section aria-labelledby="description-title">
                  <h2 id="description-title" className="text-xl font-bold">
                    תיאור המשרה
                  </h2>
                  {description ? (
                    // Sanitized with an allow-list in lib/jobs/sanitize.ts: no scripts, styles or attributes but a link's href.
                    <div className="job-description mt-2" dangerouslySetInnerHTML={{ __html: description }} />
                  ) : (
                    <p className="mt-2 text-muted">אין תיאור למשרה הזו.</p>
                  )}
                </section>

                {skills.length ? (
                  <section aria-labelledby="skills-title" className="mt-6">
                    <h2 id="skills-title" className="text-xl font-bold">
                      כישורים
                    </h2>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {skills.map((s) => (
                        <li key={s} className="rounded-full bg-black/[0.08] px-3 py-1 text-[#4d4d4d]">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>

              <section aria-labelledby="apply-title" className="min-w-0 self-start rounded-card bg-surface p-5 sm:p-6">
                <h2 id="apply-title" className="mb-4 text-xl font-bold">
                  הגש/י מועמדות למשרה
                </h2>
                {job.self_apply ? (
                  <p className="mb-4 text-sm text-muted">
                    לידיעת האדמין: באתר הנוכחי זו משרה בהגשה עצמאית (המועמד פונה ישירות לחברה). בתצוגה המקדימה הטופס מוצג בכל המשרות.
                  </p>
                ) : null}
                <ApplyForm jobKey={job.id} siteApplicationId={randomUUID()} />
              </section>
            </div>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
