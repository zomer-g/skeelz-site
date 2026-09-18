import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { CreateKeyForm } from "@/components/admin/CreateKeyForm";
import { Badge, buttonClass, Card, Table } from "@/components/ui";
import { SCOPE_LABELS, SITE_SCOPES } from "@/lib/api/spec";
import { pageAuth } from "@/lib/auth/guard";
import { getDb } from "@/lib/db/client";
import { apiKeys } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { revokeKey } from "./actions";

export const metadata: Metadata = { title: "API ומפתחות" };
export const dynamic = "force-dynamic";

/** Inbound keys (docs/connect-api.md §1). The site has no legacy env tokens, so every key is listed here. */
export default async function ApiKeysPage() {
  const auth = await pageAuth("admin", "/admin/api");
  if (!auth.ok) return auth.render;
  const rows = await getDb().select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  const now = new Date();

  return (
    <AdminShell email={auth.user.email} title="API ומפתחות" subtitle="מפתחות שהאתר מנפיק למערכות האחרות של SKEELZ (admin, crm). נשמר רק ה-hash של כל מפתח.">
      <div className="flex flex-col gap-8">
        <Card title="מפתח חדש">
          <CreateKeyForm scopes={SITE_SCOPES.map((s) => ({ value: s, label: SCOPE_LABELS[s] }))} />
          <p className="mt-4 text-sm text-muted">
            נתיבים, הרשאות ודוגמאות:{" "}
            <Link href="/api-docs" className="font-medium text-accent-dark underline underline-offset-4">
              תיעוד ה-API
            </Link>
            .
          </p>
        </Card>

        <Card title={`מפתחות · ${rows.length}`} tone="accent-light">
          <Table head={["מפתח", "הרשאות", "נוצר", "שימוש אחרון", "מצב", ""]} empty={rows.length === 0 ? "עוד לא נוצרו מפתחות" : undefined}>
            {rows.map((k) => {
              const expired = k.expiresAt && k.expiresAt <= now;
              return (
                <tr key={k.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{k.name}</p>
                    <p className="font-mono text-xs text-muted" dir="ltr">
                      sk_site_{k.prefix}…
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1" dir="ltr">
                      {k.scopes.map((s) => (
                        <Badge key={s} tone="accent">
                          {s}
                        </Badge>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {formatDateTime(k.createdAt)}
                    <p className="text-xs text-muted" dir="ltr">
                      {k.createdBy}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {k.lastUsedAt ? formatDateTime(k.lastUsedAt) : "טרם נעשה שימוש"}
                    {k.lastUsedIp ? (
                      <p className="text-xs text-muted" dir="ltr">
                        {k.lastUsedIp}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {k.revokedAt ? (
                      <Badge>בוטל</Badge>
                    ) : expired ? (
                      <Badge tone="warning">פג תוקף</Badge>
                    ) : (
                      <span className="flex flex-col items-start gap-1">
                        <Badge tone="success">פעיל</Badge>
                        {k.expiresAt ? <span className="text-xs text-muted">עד {formatDateTime(k.expiresAt)}</span> : null}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-end">
                    {k.revokedAt ? null : (
                      <form action={revokeKey}>
                        <input type="hidden" name="id" value={k.id} />
                        <button className={buttonClass("danger", "sm")}>
                          ביטול<span className="sr-only"> · {k.name}</span>
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
          <p className="mt-3 text-xs text-muted">מפתח מהגדרות השרת (env): אין לאתר מפתחות נכנסים כאלה, ולכן כל המפתחות מנוהלים כאן.</p>
        </Card>
      </div>
    </AdminShell>
  );
}
