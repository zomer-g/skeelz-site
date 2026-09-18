import { and, desc, gt, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { InviteForm } from "@/components/admin/InviteForm";
import { Badge, buttonClass, Card, smallFieldClass, Table } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { pageAuth } from "@/lib/auth/guard";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/auth/roles";
import { envAdmins } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { accessRequests, invites, users } from "@/lib/db/schema";
import { approveRequest, changeRole, dismissRequest, revokeInvite, setActive } from "./actions";

export const metadata: Metadata = { title: "משתמשים והרשאות" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const auth = await pageAuth("admin", "/admin/users");
  if (!auth.ok) return auth.render;

  const db = getDb();
  const [userRows, inviteRows, requestRows] = await Promise.all([
    db.select().from(users).orderBy(desc(users.lastLoginAt)),
    db
      .select()
      .from(invites)
      .where(and(isNull(invites.acceptedAt), isNull(invites.revokedAt), gt(invites.expiresAt, new Date())))
      .orderBy(desc(invites.createdAt)),
    db.select().from(accessRequests).orderBy(desc(accessRequests.lastAt)).limit(100),
  ]);
  const configuredAdmins = envAdmins();

  return (
    <AdminShell email={auth.user.email} title="משתמשים והרשאות" subtitle="מי רואה את האתר ובאיזו הרשאה. בלי תפקיד — לא רואים כלום.">

      <div className="flex flex-col gap-8">
        <Card title="הזמנת משתמש">
          <InviteForm />
          <p className="mt-4 text-xs text-muted">
            עורך תוכן: כל האתר, וגם טקסטים, משרות מוצמדות והודעות · אדמין: גם משתמשים, מפתחות API, חיבורים, הגשות ויומן השינויים
          </p>
        </Card>

        {requestRows.length > 0 ? (
          <Card title={`בקשות גישה (${requestRows.length})`} tone="accent-light">
            <Table head={["אימייל", "שם", "ניסיונות", "ניסיון אחרון", ""]}>
              {requestRows.map((r) => (
                <tr key={r.email}>
                  <td className="px-3 py-3" dir="ltr">
                    {r.email}
                  </td>
                  <td className="px-3 py-3">{r.name ?? "—"}</td>
                  <td className="px-3 py-3">{r.attempts}</td>
                  <td className="px-3 py-3">{formatDateTime(r.lastAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <form action={approveRequest} className="flex items-center gap-2">
                        <input type="hidden" name="email" value={r.email} />
                        <RoleSelect defaultValue="editor" who={r.email} />
                        <button className={buttonClass("primary", "sm")}>
                          אישור<span className="sr-only"> · {r.email}</span>
                        </button>
                      </form>
                      <form action={dismissRequest}>
                        <input type="hidden" name="email" value={r.email} />
                        <button className={buttonClass("quiet", "sm")}>
                          הסרה<span className="sr-only"> · {r.email}</span>
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        ) : null}

        <Card title={`משתמשים (${userRows.length})`}>
          <Table head={["משתמש", "תפקיד", "סטטוס", "כניסה אחרונה", ""]}>
            {userRows.map((u) => {
              const isSelf = u.id === auth.user.id;
              const isConfigured = configuredAdmins.includes(u.email);
              const locked = isSelf || isConfigured;
              return (
                <tr key={u.id} className={u.active ? "" : "bg-panel"}>
                  <td className="px-3 py-3">
                    <p className="font-medium">{u.name ?? "—"}</p>
                    <p className="text-xs text-muted" dir="ltr">
                      {u.email}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    {locked ? (
                      <div className="flex items-center gap-2">
                        <Badge tone={u.role === "admin" ? "brand" : "accent"}>{ROLE_LABELS[u.role]}</Badge>
                        {isConfigured ? <span className="text-xs text-muted">מוגדר בהגדרות השרת</span> : null}
                        {isSelf && !isConfigured ? <span className="text-xs text-muted">(את/ה)</span> : null}
                      </div>
                    ) : (
                      <form action={changeRole} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={u.id} />
                        <RoleSelect defaultValue={u.role} who={u.email} />
                        <button className={buttonClass("secondary", "sm")}>
                          עדכון<span className="sr-only"> · {u.email}</span>
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {u.active ? <Badge tone="success">פעיל</Badge> : <Badge>מושבת</Badge>}
                    {!u.sub ? <span className="ms-2 text-xs text-muted">טרם התחבר</span> : null}
                  </td>
                  <td className="px-3 py-3">{formatDateTime(u.lastLoginAt)}</td>
                  <td className="px-3 py-3 text-end">
                    {locked ? null : (
                      <form action={setActive}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="active" value={String(!u.active)} />
                        <button className={buttonClass(u.active ? "danger" : "secondary", "sm")}>
                          {u.active ? "השבתה" : "הפעלה מחדש"}
                          <span className="sr-only"> · {u.email}</span>
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>

        <Card title={`הזמנות פתוחות (${inviteRows.length})`} tone="accent-light">
          <Table
            head={["אימייל", "תפקיד", "הוזמן ע״י", "בתוקף עד", ""]}
            empty={inviteRows.length === 0 ? "אין הזמנות פתוחות" : undefined}
          >
            {inviteRows.map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-3" dir="ltr">
                  {i.email}
                </td>
                <td className="px-3 py-3">{ROLE_LABELS[i.role]}</td>
                <td className="px-3 py-3" dir="ltr">
                  {i.invitedBy}
                </td>
                <td className="px-3 py-3">{formatDateTime(i.expiresAt)}</td>
                <td className="px-3 py-3 text-end">
                  <form action={revokeInvite}>
                    <input type="hidden" name="id" value={i.id} />
                    <button className={buttonClass("danger", "sm")}>
                      ביטול<span className="sr-only"> · {i.email}</span>
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </AdminShell>
  );
}

function RoleSelect({ defaultValue, who }: { defaultValue: Role; who: string }) {
  return (
    <select name="role" defaultValue={defaultValue} className={smallFieldClass} aria-label={`תפקיד · ${who}`}>
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}
