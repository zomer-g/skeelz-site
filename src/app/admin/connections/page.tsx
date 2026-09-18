import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { ConnectionForm } from "@/components/admin/ConnectionForm";
import { Badge, buttonClass, Card } from "@/components/ui";
import { pageAuth } from "@/lib/auth/guard";
import { envNames, PEER_LABELS, PEERS, resolveConnection } from "@/lib/connect/client";
import { hasSecretKey } from "@/lib/connect/crypto";
import { getDb } from "@/lib/db/client";
import { connections } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/format";
import { clearConnection } from "./actions";

export const metadata: Metadata = { title: "חיבורים" };
export const dynamic = "force-dynamic";

const USE: Record<string, string> = {
  admin: "פיד המשרות: GET /api/v1/site/jobs (הרשאה site-feed:read)",
  crm: "העברת הגשות: POST /api/v1/intake/applications (הרשאה intake:write)",
};

/** Outbound connections (docs/connect-api.md §2): a row here wins; without one, the env wiring is used. */
export default async function ConnectionsPage() {
  const auth = await pageAuth("admin", "/admin/connections");
  if (!auth.ok) return auth.render;
  const rows = new Map((await getDb().select().from(connections)).map((r) => [r.peer, r]));
  const resolved = await Promise.all(PEERS.map((p) => resolveConnection(p).catch(() => null)));

  return (
    <AdminShell email={auth.user.email} title="חיבורים" subtitle="לאן האתר פונה, ועם איזה מפתח. המפתחות נשמרים מוצפנים ולא מוצגים שוב.">
      {!hasSecretKey() ? <p className="mb-6 rounded-card bg-danger-soft px-4 py-3 text-danger">CONNECT_SECRET_KEY לא מוגדר בשרת: אי אפשר לשמור מפתחות חדשים.</p> : null}
      <div className="flex flex-col gap-8">
        {PEERS.map((peer, i) => {
          const row = rows.get(peer);
          const conn = resolved[i];
          const env = envNames(peer);
          return (
            <Card key={peer} title={PEER_LABELS[peer]}>
              <div className="mb-4 flex flex-col gap-1 text-sm">
                <p className="text-muted">{USE[peer]}</p>
                <p className="flex flex-wrap items-center gap-2">
                  {row ? (
                    <Badge tone="accent">מוגדר כאן</Badge>
                  ) : conn ? (
                    <Badge tone="warning">מהגדרות השרת (env): {env.url} + {env.key}</Badge>
                  ) : (
                    <Badge>לא מוגדר</Badge>
                  )}
                  {conn ? (
                    <span dir="ltr" className="text-muted">
                      {conn.baseUrl}
                    </span>
                  ) : null}
                  {conn && !conn.enabled ? <Badge>כבוי</Badge> : null}
                </p>
                {row?.lastCheckAt ? (
                  <p className={row.lastCheckOk ? "text-success" : "text-danger"}>
                    בדיקה אחרונה {formatDateTime(row.lastCheckAt)}: {row.lastCheckDetail}
                  </p>
                ) : null}
                {row ? (
                  <p className="text-xs text-muted">
                    עודכן {formatDateTime(row.updatedAt)} · <span dir="ltr">{row.updatedBy}</span>
                  </p>
                ) : null}
              </div>
              <ConnectionForm peer={peer} baseUrl={row?.baseUrl ?? conn?.baseUrl ?? ""} last4={row?.keyLast4 ?? null} enabled={row?.enabled ?? true} />
              {row ? (
                <form action={clearConnection} className="mt-4 border-t border-line pt-4">
                  <input type="hidden" name="peer" value={peer} />
                  <button className={buttonClass("danger", "sm")}>
                    הסרת ההגדרה וחזרה להגדרות השרת<span className="sr-only"> · {PEER_LABELS[peer]}</span>
                  </button>
                </form>
              ) : null}
            </Card>
          );
        })}
      </div>
    </AdminShell>
  );
}
