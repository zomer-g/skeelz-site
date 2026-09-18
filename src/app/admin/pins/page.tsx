import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { PinForm } from "@/components/admin/PinForm";
import { Badge, buttonClass, Card, Table } from "@/components/ui";
import { pageAuth } from "@/lib/auth/guard";
import { loadPins } from "@/lib/cms";
import { formatDateTime } from "@/lib/format";
import { getJobs } from "@/lib/jobs/feed";
import { fmtJobDate } from "@/lib/jobs/list";
import { movePin, unpinJob } from "./actions";

export const metadata: Metadata = { title: "משרות מוצמדות" };
export const dynamic = "force-dynamic";

export default async function PinsPage() {
  const auth = await pageAuth("editor", "/admin/pins");
  if (!auth.ok) return auth.render;

  const [pins, { jobs, source }] = await Promise.all([loadPins(), getJobs()]);
  const byKey = new Map(jobs.map((j) => [j.id, j]));
  const pinnedKeys = new Set(pins.map((p) => p.jobKey));
  const unpinned = [...jobs].sort((a, b) => (Date.parse(b.published_at ?? "") || 0) - (Date.parse(a.published_at ?? "") || 0)).filter((j) => !pinnedKeys.has(j.id));

  return (
    <AdminShell email={auth.user.email} title="משרות מוצמדות" subtitle="משרות שמוצגות בראש רשימת המשרות, בסדר שנקבע כאן, לפני כל השאר.">
      <div className="flex flex-col gap-8">
        <Card title={`מוצמדות · ${pins.length}`}>
          <Table head={["משרה", "בפיד", "הוצמדה", ""]} empty={pins.length === 0 ? "אין משרות מוצמדות. הרשימה מוצגת מהחדשה לישנה." : undefined}>
            {pins.map((p, i) => {
              const job = byKey.get(p.jobKey);
              const title = job?.title ?? p.title ?? p.jobKey;
              return (
                <tr key={p.jobKey}>
                  <td className="px-3 py-2">
                    <Link href={`/job/${p.jobKey}`} className="font-medium text-accent-dark underline underline-offset-4">
                      {title}
                    </Link>
                    <p className="font-mono text-xs text-muted" dir="ltr">
                      {p.jobKey}
                    </p>
                  </td>
                  <td className="px-3 py-2">{job ? <Badge tone="success">פעילה</Badge> : <Badge tone="warning">לא בפיד — לא מוצגת</Badge>}</td>
                  <td className="px-3 py-2 text-sm">
                    {formatDateTime(p.pinnedAt)}
                    <p className="text-xs text-muted" dir="ltr">
                      {p.pinnedBy}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      <form action={movePin}>
                        <input type="hidden" name="key" value={p.jobKey} />
                        <input type="hidden" name="dir" value="up" />
                        <button disabled={i === 0} className={buttonClass("quiet", "sm")}>
                          <span aria-hidden>↑</span> למעלה<span className="sr-only"> · {title}</span>
                        </button>
                      </form>
                      <form action={movePin}>
                        <input type="hidden" name="key" value={p.jobKey} />
                        <input type="hidden" name="dir" value="down" />
                        <button disabled={i === pins.length - 1} className={buttonClass("quiet", "sm")}>
                          <span aria-hidden>↓</span> למטה<span className="sr-only"> · {title}</span>
                        </button>
                      </form>
                      <form action={unpinJob}>
                        <input type="hidden" name="key" value={p.jobKey} />
                        <button className={buttonClass("danger", "sm")}>
                          ביטול הצמדה<span className="sr-only"> · {title}</span>
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
          <div className="mt-6 max-w-xl">
            <PinForm />
          </div>
        </Card>

        <Card title={`כל המשרות בפיד · ${unpinned.length}`} tone="accent-light">
          {source === "fixture" ? <p className="mb-3 text-sm text-muted">פיתוח מקומי: משרות מקובץ הדוגמה.</p> : null}
          {source === "unavailable" ? <p className="mb-3 text-sm text-danger">הפיד לא זמין כרגע. אפשר עדיין להצמיד לפי מזהה.</p> : null}
          <Table head={["משרה", "חברה", "פורסמה", ""]} empty={unpinned.length === 0 ? "אין משרות נוספות" : undefined}>
            {unpinned.map((j) => (
              <tr key={j.id}>
                <td className="px-3 py-2">
                  <Link href={`/job/${j.id}`} className="font-medium text-accent-dark underline underline-offset-4">
                    {j.title ?? j.id}
                  </Link>
                  {j.hot || j.sponsored ? (
                    <span className="ms-2 inline-flex gap-1">
                      {j.hot ? <Badge tone="warning">חמה</Badge> : null}
                      {j.sponsored ? <Badge tone="brand">מקודמת</Badge> : null}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">{j.company ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{fmtJobDate(j.published_at)}</td>
                <td className="px-3 py-2 text-end">
                  <PinForm jobKey={j.id} label={j.title ?? j.id} />
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </AdminShell>
  );
}
