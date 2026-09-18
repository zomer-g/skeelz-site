import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, Table } from "@/components/ui";
import { API_LIMITS, ENDPOINTS, ERROR_CODES, SCOPE_LABELS, SITE_SCOPES } from "@/lib/api/spec";
import { pageAuth } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "תיעוד API" };
export const dynamic = "force-dynamic";

const BASE = "https://skeelz-site-zomerg.xhostd.app";

function Code({ children }: { children: string }) {
  return (
    <pre dir="ltr" className="relative overflow-x-auto rounded-2xl bg-ink p-4 text-start text-sm leading-relaxed text-white" tabIndex={0}>
      <code>{children}</code>
    </pre>
  );
}

/** Human docs from the same spec object as /api/v1/openapi.json (src/lib/api/spec.ts). */
export default async function ApiDocsPage() {
  const auth = await pageAuth("editor", "/api-docs");
  if (!auth.ok) return auth.render;

  return (
    <AdminShell email={auth.user.email} title="תיעוד API" subtitle="ה-API של האתר לפי התקן המשותף של SKEELZ (docs/connect-api.md). מסמך OpenAPI: /api/v1/openapi.json">
      <div className="flex flex-col gap-8">
        <Card title="איך מתחברים">
          <ul className="flex list-disc flex-col gap-2 ps-6">
            <li>
              מפתח מסוג <code dir="ltr">sk_site_…</code> מונפק במסך “API ומפתחות” (אדמין), מוצג פעם אחת בלבד, ונשלח רק בכותרת{" "}
              <code dir="ltr">Authorization: Bearer &lt;KEY&gt;</code>. מפתח בכתובת נדחה (400 token_in_url).
            </li>
            <li>
              כל התשובות JSON, <code dir="ltr">Cache-Control: no-store</code>, ושגיאות תמיד בצורה <code dir="ltr">{`{"error":{"code","message"}}`}</code>.
            </li>
            <li>
              מגבלות: {API_LIMITS.perIpPerMinute} בקשות לדקה לכתובת, {API_LIMITS.perKeyPerHour} לשעה למפתח; אחרי {API_LIMITS.authFailures} מפתחות שגויים ב-
              {API_LIMITS.authFailureWindowMin} דקות הכתובת נחסמת ל-{API_LIMITS.lockoutMin} דקות. כותרות <code dir="ltr">X-RateLimit-*</code> ו-
              <code dir="ltr">Retry-After</code>.
            </li>
            <li>רשימות: <code dir="ltr">?limit=</code> (1–200, ברירת מחדל 50) ו-<code dir="ltr">?cursor=</code>, ותשובה <code dir="ltr">{`{data:[…], next_cursor}`}</code>.</li>
            <li>שום נתיב לא מחזיר פרטים אישיים של מועמדים, ואין אף נתיב לקורות חיים — האתר לא שומר אותם.</li>
          </ul>
        </Card>

        <Card title="הרשאות (scopes)" tone="accent-light">
          <Table head={["הרשאה", "מה היא פותחת"]}>
            {SITE_SCOPES.map((s) => (
              <tr key={s}>
                <td className="px-3 py-2 font-mono" dir="ltr">
                  {s}
                </td>
                <td className="px-3 py-2">{SCOPE_LABELS[s]}</td>
              </tr>
            ))}
          </Table>
        </Card>

        {ENDPOINTS.map((e) => (
          <Card key={e.path} title={<span dir="ltr">{`${e.method} ${e.path}`}</span>}>
            <div className="flex flex-col gap-3">
              <p className="font-medium">{e.summary}</p>
              <p className="text-muted" dir="ltr">
                {e.description}
              </p>
              <p className="text-sm">
                הרשאה:{" "}
                <code dir="ltr">{e.scope === "none" ? "ללא מפתח" : e.scope === null ? "כל מפתח תקף" : e.scope}</code>
              </p>
              {e.params?.length ? (
                <ul className="flex list-disc flex-col gap-1 ps-6 text-sm" dir="ltr">
                  {e.params.map((p) => (
                    <li key={p.name}>
                      <code>{p.name}</code> — {p.description}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Code>{`curl ${e.scope === "none" ? "" : '-H "Authorization: Bearer <KEY>" '}${BASE}${e.path}`}</Code>
              <Code>{JSON.stringify(e.example, null, 2)}</Code>
            </div>
          </Card>
        ))}

        <Card title="קודי שגיאה" tone="accent-light">
          <Table head={["סטטוס", "קוד", "משמעות"]}>
            {ERROR_CODES.map(([status, code, meaning]) => (
              <tr key={code}>
                <td className="px-3 py-2 tabular-nums">{status}</td>
                <td className="px-3 py-2 font-mono" dir="ltr">
                  {code}
                </td>
                <td className="px-3 py-2" dir="ltr">
                  {meaning}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </AdminShell>
  );
}
