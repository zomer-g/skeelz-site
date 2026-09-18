"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";
import { checkBaseUrl, fetchWith, PEERS, PeerError, resolveConnection, type SitePeer } from "@/lib/connect/client";
import { encryptSecret, hasSecretKey } from "@/lib/connect/crypto";
import { getDb } from "@/lib/db/client";
import { connections } from "@/lib/db/schema";

// Every action re-checks the caller: a server action is a public endpoint.

export type ConnState = { ok: boolean; message: string } | null;

const isPeer = (v: unknown): v is SitePeer => typeof v === "string" && (PEERS as string[]).includes(v);
const PATH = "/admin/connections";

/** Saves base URL, key (empty = keep the stored one) and on/off. The key is encrypted and never sent back. */
export async function saveConnection(_prev: ConnState, form: FormData): Promise<ConnState> {
  const admin = await requireUser("admin");
  const peer = form.get("peer");
  if (!isPeer(peer)) return { ok: false, message: "חיבור לא מוכר" };
  const checked = checkBaseUrl(String(form.get("base_url") ?? ""));
  if (!checked.ok) {
    return {
      ok: false,
      message:
        checked.code === "blocked_address"
          ? "הכתובת חסומה: אסור להפנות לכתובת IP, ל-localhost או לשם פנימי (‎.local, ‎.internal, ‎.lan). יש להזין שם מארח ציבורי ב-https."
          : "כתובת בסיס: https:// ושם מארח בלבד, בלי נתיב, פרמטרים או פרטי התחברות",
    };
  }
  const baseUrl = checked.origin;
  const key = String(form.get("key") ?? "").trim();
  const enabled = form.get("enabled") === "on";
  if (key && (key.length > 500 || /\s/.test(key))) return { ok: false, message: "המפתח לא תקין" };
  if (key && !hasSecretKey()) return { ok: false, message: "CONNECT_SECRET_KEY לא מוגדר בשרת, ולכן אי אפשר לשמור מפתח" };

  const db = getDb();
  const [existing] = await db.select().from(connections).where(eq(connections.peer, peer)).limit(1);
  if (!key && !existing?.keyCiphertext) return { ok: false, message: "יש להדביק את המפתח שהמערכת השנייה הנפיקה לאתר" };
  // C2: a stored key is never kept for a new address.
  if (!key && existing && existing.baseUrl !== baseUrl) return { ok: false, message: "כתובת השתנתה — יש להזין את המפתח מחדש" };

  const keyFields = key ? { keyCiphertext: encryptSecret(key, peer), keyLast4: key.slice(-4) } : {};
  const now = new Date();
  await db
    .insert(connections)
    .values({ peer, baseUrl, enabled, updatedBy: admin.email, updatedAt: now, ...keyFields })
    .onConflictDoUpdate({ target: connections.peer, set: { baseUrl, enabled, updatedBy: admin.email, updatedAt: now, ...keyFields } });
  await writeAudit(admin.email, "connection.saved", peer, { baseUrl, enabled, keyChanged: Boolean(key) });
  revalidatePath(PATH);
  return { ok: true, message: "נשמר. כדאי ללחוץ על “בדיקת חיבור”." };
}

/** Removes the stored row, so the connection falls back to the env wiring. */
export async function clearConnection(form: FormData): Promise<void> {
  const admin = await requireUser("admin");
  const peer = form.get("peer");
  if (!isPeer(peer)) return;
  const [row] = await getDb().delete(connections).where(eq(connections.peer, peer)).returning({ peer: connections.peer });
  if (row) await writeAudit(admin.email, "connection.cleared", peer);
  revalidatePath(PATH);
}

/** GET <peer>/api/v1/ping with a 5 s timeout; the result is stored on the row (when there is one). */
export async function checkConnection(_prev: ConnState, form: FormData): Promise<ConnState> {
  const admin = await requireUser("admin");
  const peer = form.get("peer");
  if (!isPeer(peer)) return { ok: false, message: "חיבור לא מוכר" };
  const conn = await resolveConnection(peer).catch(() => null);
  if (!conn || !conn.key) return { ok: false, message: "אין חיבור מוגדר (לא כאן ולא בהגדרות השרת), או שהמפתח השמור לא ניתן לפענוח — יש להזין אותו מחדש" };

  let ok = false;
  let detail: string;
  try {
    const pong = await fetchWith<{ app?: unknown; version?: unknown; key?: { name?: unknown; scopes?: unknown } }>(conn, "/api/v1/ping", { timeoutMs: 5000 });
    const scopes = Array.isArray(pong.key?.scopes) ? pong.key.scopes.map(String).join(", ") : "—";
    ok = pong.app === peer;
    detail = `${String(pong.app ?? "?")} · גרסה ${String(pong.version ?? "?")} · מפתח “${String(pong.key?.name ?? "?")}” · הרשאות: ${scopes || "—"}`;
    if (!ok) detail = `ענתה מערכת אחרת מהצפוי: ${detail}`;
  } catch (err) {
    const e = err instanceof PeerError ? err : new PeerError("unreachable");
    detail =
      e.code === "timeout"
        ? "אין תשובה תוך 5 שניות"
        : e.code === "blocked_address" || e.code === "invalid_base_url"
          ? "הכתובת חסומה (כתובת פנימית או לא תקינה)"
          : e.code === "too_large"
            ? "התשובה גדולה מדי"
        : e.code === "unreachable"
          ? "לא ניתן להתחבר לכתובת"
          : e.status === 401
            ? "המפתח נדחה (401)"
            : e.status === 404
              ? "אין שם /api/v1/ping (404) — ייתכן שהמערכת עוד לא עודכנה לתקן"
              : `שגיאה ${e.status ?? ""} ${e.peerCode ?? e.code}`.trim();
  }
  if (!conn.enabled) detail += " (החיבור כבוי)";
  if (conn.source === "db") {
    await getDb().update(connections).set({ lastCheckAt: new Date(), lastCheckOk: ok, lastCheckDetail: detail.slice(0, 500) }).where(eq(connections.peer, peer));
  }
  await writeAudit(admin.email, "connection.checked", peer, { ok, source: conn.source });
  revalidatePath(PATH);
  return { ok, message: detail };
}
