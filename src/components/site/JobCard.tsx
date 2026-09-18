import Link from "next/link";
import type { ReactNode } from "react";
import { fmtJobDate, jobCity } from "@/lib/jobs/list";
import { scopeLabel } from "@/lib/jobs/ref";
import type { FeedJob } from "@/lib/jobs/types";
import { BagIcon, ClockIcon, CrownIcon, PinIcon, StarIcon } from "../icons";
import { buttonClass } from "../ui";

export function Detail({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-2">
      <span className="text-muted">{icon}</span>
      <span className="text-muted">{label} -</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

/** The yellow crown circle of a "משרה חמה". */
export function HotBadge() {
  return (
    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-hot text-white" title="משרה חמה">
      <CrownIcon className="size-6 text-[#7a4a00]" />
      <span className="sr-only">משרה חמה</span>
    </span>
  );
}

export function SponsoredBadge() {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full bg-brand/10 px-3 text-sm font-medium text-brand-hover">
      <StarIcon className="size-4" />
      משרה מקודמת
    </span>
  );
}

/**
 * One job in the list, as on the live site: a teal title panel (dark and light
 * teal alternate) beside a grey body — stacked on phones, side by side from lg.
 */
export function JobCard({ job, index, pinned }: { job: FeedJob; index: number; pinned?: boolean }) {
  const dark = index % 2 === 0;
  const title = job.title ?? "משרה";
  const titleId = `job-${job.id}`;
  return (
    <article aria-labelledby={titleId} className="my-6 flex flex-col justify-center lg:flex-row">
      <div
        className={`${dark ? "bg-accent text-white" : "bg-accent-light text-ink"} flex shrink-0 items-start rounded-t-card px-6 py-6 lg:w-[23.25rem] lg:rounded-none lg:rounded-s-card lg:pe-12`}
      >
        <h2 id={titleId} className="text-xl leading-snug font-medium lg:text-[2rem]">
          {title}
        </h2>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-b-card border-2 border-t-0 border-line bg-surface p-6 lg:max-w-[37.5rem] lg:rounded-none lg:rounded-e-card lg:border-t-2 lg:border-s-0">
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg font-medium text-accent-dark">{job.job_scope.map(scopeLabel).join(" · ") || " "}</p>
          <div className="flex shrink-0 items-center gap-2">
            {pinned ? <span className="sr-only">משרה מוצמדת</span> : null}
            {job.sponsored ? <SponsoredBadge /> : null}
            {job.hot ? <HotBadge /> : null}
          </div>
        </div>
        <div className="grid gap-x-6 lg:grid-cols-2 lg:items-end">
          <div className="lg:col-span-2">
            <Detail icon={<BagIcon />} label="חברה">
              {job.company ?? "—"}
            </Detail>
          </div>
          <div>
            <Detail icon={<ClockIcon />} label="פרסום משרה">
              {fmtJobDate(job.published_at)}
            </Detail>
            <Detail icon={<PinIcon />} label="מיקום">
              {jobCity(job) ?? "—"}
            </Detail>
          </div>
          <div className="mt-3 lg:mt-0 lg:self-end">
            <Link href={`/job/${job.id}`} className={`${buttonClass("primary")} w-full`}>
              פרטים והגשת מועמדות<span className="sr-only"> · {title}</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
