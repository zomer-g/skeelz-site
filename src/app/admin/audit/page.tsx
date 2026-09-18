import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, Table } from "@/components/ui";
import { pageAuth } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "יומן שינויים" };
export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  "text.updated": "עדכון טקסט",
  "text.restored": "שחזור גרסת טקסט",
  "pin.added": "הצמדת משרה",
  "pin.removed": "ביטול הצמדה",
  "pin.moved": "שינוי סדר הצמדה",
  "banner.created": "הודעה חדשה",
  "banner.activated": "הפעלת הודעה",
  "banner.deactivated": "השבתת הודעה",
  "banner.deleted": "מחיקת הודעה",
  login: "כניסה",
  "user.bootstrap_admin": "אדמין ראשוני נוצר",
  "user.env_admin_restored": "אדמין מהגדרות השרת שוחזר",
  "invite.created": "הזמנה נוצרה",
  "invite.accepted": "הזמנה מומשה",
  "invite.revoked": "הזמנה בוטלה",
  "user.role_changed": "שינוי תפקיד",
  "user.deactivated": "משתמש הושבת",
  "user.reactivated": "משתמש הופעל מחדש",
  "access_request.approved": "בקשת גישה אושרה",
  "access_request.dismissed": "בקשת גישה הוסרה",
  "auth.subject_mismatch": "חשבון Google לא תואם",
  "api_key.created": "מפתח API נוצר",
  "api_key.revoked": "מפתח API בוטל",
  "api.denied": "בקשת API נדחתה",
  "api.used": "שימוש ב-API",
  "connection.saved": "עדכון חיבור",
  "connection.cleared": "הסרת חיבור",
  "connection.checked": "בדיקת חיבור",
};

export default async function AuditPage() {
  const auth = await pageAuth("admin", "/admin/audit");
  if (!auth.ok) return auth.render;
  const events = await getDb().select().from(auditLog).orderBy(desc(auditLog.at)).limit(500);

  return (
    <AdminShell email={auth.user.email} title="יומן שינויים" subtitle="שינויים באתר (טקסטים, הצמדות, הודעות), משתמשים והרשאות, מפתחות API, חיבורים ושימוש ב-API.">
      <Card title="500 השינויים האחרונים">
        <Table head={["מתי", "מי", "פעולה", "פרטים"]} empty={events.length === 0 ? "עוד אין שינויים" : undefined}>
          {events.map((e) => (
            <tr key={e.id}>
              <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(e.at)}</td>
              <td className="px-3 py-2" dir="ltr">
                {e.actor}
              </td>
              <td className="px-3 py-2">{ACTION_LABELS[e.action] ?? e.action}</td>
              <td className="px-3 py-2 text-xs break-all text-muted">
                <span dir="ltr">
                  {e.target ?? ""}
                  {e.details ? ` ${JSON.stringify(e.details)}` : ""}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </AdminShell>
  );
}
