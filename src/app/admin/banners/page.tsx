import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { BannerForm } from "@/components/admin/BannerForm";
import { Badge, buttonClass, Card, Table } from "@/components/ui";
import { pageAuth } from "@/lib/auth/guard";
import { loadAllBanners } from "@/lib/cms";
import { fmtDate } from "@/lib/format";
import { deleteBanner, toggleBanner } from "./actions";

export const metadata: Metadata = { title: "הודעות באתר" };
export const dynamic = "force-dynamic";

function state(b: { active: boolean; startsAt: Date | null; endsAt: Date | null }, now: Date) {
  if (!b.active) return <Badge>מושבתת</Badge>;
  if (b.startsAt && b.startsAt > now) return <Badge tone="accent">מתוזמנת</Badge>;
  if (b.endsAt && b.endsAt <= now) return <Badge>הסתיימה</Badge>;
  return <Badge tone="success">מוצגת עכשיו</Badge>;
}

export default async function BannersPage() {
  const auth = await pageAuth("/admin/banners");
  if (!auth.ok) return auth.render;
  const rows = await loadAllBanners();
  const now = new Date();

  return (
    <AdminShell email={auth.user.email} title="הודעות באתר" subtitle="פס הודעה מתחת לכותרת, בעמוד המשרות ובעמודי המשרה. עד שלוש הודעות פעילות מוצגות, החדשה ראשונה.">
      <div className="flex flex-col gap-8">
        <Card title="הודעה חדשה">
          <BannerForm />
        </Card>
        <Card title={`כל ההודעות · ${rows.length}`} tone="accent-light">
          <Table head={["הודעה", "תאריכים", "מצב", ""]} empty={rows.length === 0 ? "אין הודעות" : undefined}>
            {rows.map((b) => (
              <tr key={b.id}>
                <td className="px-3 py-2">
                  <p>{b.text}</p>
                  {b.linkUrl ? (
                    <p className="text-xs text-muted">
                      {b.linkLabel || "לפרטים"} → <span dir="ltr">{b.linkUrl}</span>
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-sm whitespace-nowrap">
                  {b.startsAt ? fmtDate(b.startsAt) : "מיד"} – {b.endsAt ? fmtDate(new Date(b.endsAt.getTime() - 1)) : "ללא הגבלה"}
                </td>
                <td className="px-3 py-2">{state(b, now)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    <form action={toggleBanner}>
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="active" value={String(!b.active)} />
                      <button className={buttonClass("secondary", "sm")}>
                        {b.active ? "השבתה" : "הפעלה"}
                        <span className="sr-only"> · {b.text}</span>
                      </button>
                    </form>
                    <form action={deleteBanner}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className={buttonClass("danger", "sm")}>
                        מחיקה<span className="sr-only"> · {b.text}</span>
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </AdminShell>
  );
}
