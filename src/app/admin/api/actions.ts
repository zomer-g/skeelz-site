"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { generateKey, isScope } from "@/lib/connect/keys";
import { getDb } from "@/lib/db/client";
import { apiKeys } from "@/lib/db/schema";

// Every action re-checks the caller: a server action is a public endpoint.

export type CreateKeyState = { ok: false; message: string } | { ok: true; message: string; key: string } | null;

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function createKey(_prev: CreateKeyState, form: FormData): Promise<CreateKeyState> {
  const admin = await requireUser("admin");
  const name = String(form.get("name") ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const scopes = [...new Set(form.getAll("scopes").map(String))];
  const days = String(form.get("expires_days") ?? "").trim();

  if (!name) return { ok: false, message: "יש לתת למפתח שם (למי הוא מיועד, למשל “admin → site”)" };
  if (name.length > 80) return { ok: false, message: "השם ארוך מדי (עד 80 תווים)" };
  if (!scopes.length) return { ok: false, message: "יש לבחור לפחות הרשאה אחת" };
  if (!scopes.every(isScope)) return { ok: false, message: "הרשאה לא מוכרת" };
  let expiresAt: Date | null = null;
  if (days) {
    if (!/^\d{1,4}$/.test(days) || Number(days) < 1) return { ok: false, message: "תוקף בימים: מספר שלם חיובי, או ריק ללא תפוגה" };
    expiresAt = new Date(Date.now() + Number(days) * 86_400_000);
  }

  const { key, prefix, hash } = generateKey();
  const [row] = await getDb().insert(apiKeys).values({ name, prefix, hash, scopes, createdBy: admin.email, expiresAt }).returning({ id: apiKeys.id });
  // The audit entry names the key by id and prefix; the key itself is never written anywhere.
  await writeAudit(admin.email, "api_key.created", row!.id, { name, prefix, scopes, expiresAt: expiresAt?.toISOString() ?? null });
  revalidatePath("/admin/api");
  return { ok: true, message: `המפתח “${name}” נוצר. זו הפעם היחידה שהוא מוצג — העתיקו אותו עכשיו.`, key };
}

export async function revokeKey(form: FormData): Promise<void> {
  const admin = await requireUser("admin");
  const id = String(form.get("id") ?? "");
  if (!UUID_RE.test(id)) throw new Error("invalid id");
  const [row] = await getDb()
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
    .returning({ name: apiKeys.name, prefix: apiKeys.prefix });
  if (row) await writeAudit(admin.email, "api_key.revoked", id, { name: row.name, prefix: row.prefix });
  revalidatePath("/admin/api");
}
