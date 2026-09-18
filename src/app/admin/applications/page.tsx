import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { Badge, Card, Table } from "@/components/ui";
import { pageAuth } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { applications, profiles } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "הגשות (בדיקה)" };
export const dynamic = "force-dynamic";

/**
 * The sandbox's applications and sign-ups: the basic profile fields and the
 * CRM's ids only. There is no CV to show — the site never holds one.
 */
export default async function ApplicationsPage() {
  const auth = await pageAuth("/admin/applications");
  if (!auth.ok) return auth.render;

  const db = getDb();
  const [apps, people] = await Promise.all([
    db
      .select({
        id: applications.id,
        createdAt: applications.createdAt,
        jobKey: applications.jobKey,
        jobTitle: applications.jobTitle,
        status: applications.status,
        crmApplicationId: applications.crmApplicationId,
        errorCode: applications.errorCode,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        email: profiles.email,
        phone: profiles.phone,
        city: profiles.city,
      })
      .from(applications)
      .leftJoin(profiles, eq(profiles.id, applications.profileId))
      .orderBy(desc(applications.createdAt))
      .limit(200),
    db.select().from(profiles).orderBy(desc(profiles.updatedAt)).limit(200),
  ]);

  return (
    <AdminShell email={auth.user.email} title="הגשות (סביבת בדיקה)" subtitle="פרטים בסיסיים בלבד. קורות חיים לא נשמרים באתר בשום צורה — הם מועברים ישירות למערכת הגיוס (CRM).">
      <div className="flex flex-col gap-8">
        <Card title={`הגשות · ${apps.length}`}>
          <Table head={["מועמד/ת", "משרה", "מתי", "מצב", "מזהה ב-CRM"]} empty={apps.length === 0 ? "עוד אין הגשות" : undefined}>
            {apps.map((a) => (
              <tr key={a.id}>
                <td className="px-3 py-2">
                  <p className="font-medium">{a.firstName ? `${a.firstName} ${a.lastName}` : "—"}</p>
                  <p className="text-xs text-muted" dir="ltr">
                    {a.email ?? ""}
                  </p>
                  <p className="text-xs text-muted" dir="ltr">
                    {a.phone ?? ""}
                    {a.city ? <span dir="rtl"> · {a.city}</span> : null}
                  </p>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/job/${a.jobKey}`} className="text-accent-dark underline underline-offset-4">
                    {a.jobTitle || a.jobKey}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                <td className="px-3 py-2">
                  {a.status === "forwarded" ? (
                    <Badge tone="success">הועברה</Badge>
                  ) : (
                    <span className="flex flex-col items-start gap-1">
                      <Badge tone="warning">נכשלה</Badge>
                      {a.errorCode ? (
                        <span className="text-xs text-muted" dir="ltr">
                          {a.errorCode}
                        </span>
                      ) : null}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                  {a.crmApplicationId ?? "—"}
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title={`פרופילים · ${people.length}`} tone="accent-light">
          <Table head={["שם", "מייל", "טלפון", "עיר", "מקור", "עודכן"]} empty={people.length === 0 ? "עוד אין פרופילים" : undefined}>
            {people.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 font-medium">
                  {p.firstName} {p.lastName}
                </td>
                <td className="px-3 py-2" dir="ltr">
                  {p.email}
                </td>
                <td className="px-3 py-2" dir="ltr">
                  {p.phone}
                </td>
                <td className="px-3 py-2">{p.city ?? "—"}</td>
                <td className="px-3 py-2">{p.source === "apply" ? "הגשה" : "הרשמה"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(p.updatedAt)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </AdminShell>
  );
}
