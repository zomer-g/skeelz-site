import { sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui";
import { pageAuth } from "@/lib/auth/guard";
import { loadActiveBanners, loadPinnedKeys } from "@/lib/cms";
import { getDb } from "@/lib/db/client";
import { applications, profiles } from "@/lib/db/schema";
import { fmtInt, formatDateTime } from "@/lib/format";
import { getJobs, type FeedSource } from "@/lib/jobs/feed";

export const metadata: Metadata = { title: "ניהול" };
export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<FeedSource, string> = {
  feed: "מחובר לפיד של מערכת הניהול",
  stale: "העדכון האחרון נכשל — מוצג העותק האחרון",
  fixture: "פיתוח מקומי — קובץ דוגמה (ADMIN_API_URL לא מוגדר)",
  unavailable: "הפיד לא זמין",
};

function Stat({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="flex overflow-hidden rounded-card border-2 border-line bg-surface hover:border-accent">
      <span className="w-2 shrink-0 bg-accent" aria-hidden />
      <span className="flex flex-col gap-1 px-5 py-4">
        <span className="text-sm font-medium text-muted">{label}</span>
        <span className="text-3xl font-bold">{value}</span>
      </span>
    </Link>
  );
}

export default async function AdminHome() {
  const auth = await pageAuth("editor", "/admin");
  if (!auth.ok) return auth.render;

  const db = getDb();
  const [{ jobs, source, generatedAt }, pins, banners, countRows] = await Promise.all([
    getJobs(),
    loadPinnedKeys(),
    loadActiveBanners(),
    db.execute(sql`
      SELECT (SELECT count(*)::int FROM ${applications}) AS apps,
             (SELECT count(*)::int FROM ${applications} WHERE ${applications.status} = 'forwarded') AS forwarded,
             (SELECT count(*)::int FROM ${profiles}) AS people`),
  ]);
  const counts = countRows.rows[0] as { apps: number; forwarded: number; people: number } | undefined;

  return (
    <AdminShell email={auth.user.email} title="ניהול האתר" subtitle="אתר המשרות החדש, בתצוגה מקדימה לאדמינים בלבד.">
      <div className="flex flex-col gap-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="משרות בפיד" value={fmtInt(jobs.length)} href="/admin/pins" />
          <Stat label="משרות מוצמדות" value={fmtInt(pins.length)} href="/admin/pins" />
          <Stat label="הודעות מוצגות" value={fmtInt(banners.length)} href="/admin/banners" />
          <Stat label="הגשות (הועברו)" value={`${fmtInt(counts?.apps ?? 0)} (${fmtInt(counts?.forwarded ?? 0)})`} href="/admin/applications" />
        </div>
        <Card title="מקור המשרות">
          <p>{SOURCE_LABELS[source]}</p>
          {generatedAt ? <p className="mt-1 text-sm text-muted">הפיד הופק: {formatDateTime(new Date(generatedAt))}</p> : null}
          <p className="mt-1 text-sm text-muted">הרשימה נשמרת בזיכרון לשתי דקות, כך ששינוי במערכת הניהול מופיע כאן תוך שתי דקות לכל היותר.</p>
        </Card>
        <Card title="כלל קורות החיים" tone="accent-light">
          <p>
            האתר שומר רק פרטים בסיסיים (שם, מייל, טלפון, עיר) ורשומת הגשה. <strong>קובץ קורות חיים לא נשמר כאן לעולם</strong> — לא במסד הנתונים, לא בדיסק
            ולא ביומנים. הוא נבדק בזיכרון ומועבר ישירות למערכת הגיוס. {fmtInt(counts?.people ?? 0)} פרופילים שמורים.
          </p>
        </Card>
      </div>
    </AdminShell>
  );
}
