import { and, asc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { cache } from "react";
import { writeAudit } from "@/lib/audit";
import { getDb } from "@/lib/db/client";
import { accessRequests, auditLog, invites, users } from "@/lib/db/schema";
import { logError } from "@/lib/log";
import { hasRole, type Role } from "./roles";
import { verifiedIdentity, type Identity } from "./xhost";

/**
 * The admin app's model (docs/connect-api.md §5). Authentication is not
 * authorisation: a verified Google identity still needs one of three ways in —
 * ADMIN_EMAILS (the bootstrap super-admins), an active user row, or an open
 * invitation redeemed on first sign-in. Everything else is refused and kept as
 * an access request. While the site is a preview, no role = no site at all.
 */

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  /** Admin by ADMIN_EMAILS; the UI can't demote or deactivate these. */
  envAdmin: boolean;
}

export type Session =
  | { status: "anonymous" }
  | { status: "refused"; identity: Identity }
  | { status: "ok"; identity: Identity; user: SessionUser };

export function envAdmins(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// cache() dedupes the verification and user lookup across one server render.
export const getSession = cache(async (): Promise<Session> => {
  const identity = await verifiedIdentity();
  if (!identity) return { status: "anonymous" };
  let user: SessionUser | null;
  try {
    user = await resolveUser(identity);
  } catch (err) {
    // C7: an uncaught drizzle error would be printed by Next with its SQL parameters (emails).
    logError("auth: session lookup", err);
    throw new Error("session lookup failed");
  }
  if (!user) return { status: "refused", identity };
  return { status: "ok", identity, user };
});

async function resolveUser(identity: Identity): Promise<SessionUser | null> {
  const db = getDb();
  const email = identity.email;
  const isEnvAdmin = envAdmins().includes(email);

  let [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (isEnvAdmin) {
    if (!row) {
      [row] = await db.insert(users).values({ email, sub: identity.sub, name: identity.name, role: "admin" }).onConflictDoNothing().returning();
      if (row) await writeAudit(email, "user.bootstrap_admin", email);
      // Parallel first requests race here; the loser reads the winner's row.
      row ??= (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    }
    if (row && (row.role !== "admin" || !row.active)) {
      // The configuration is the stronger statement; a row that disagrees is stale.
      const stale = row;
      const [restored] = await db
        .update(users)
        .set({ role: "admin", active: true })
        .where(and(eq(users.id, stale.id), or(ne(users.role, "admin"), eq(users.active, false))))
        .returning();
      if (restored) await writeAudit(email, "user.env_admin_restored", email, { from: { role: stale.role, active: stale.active } });
      row = restored ?? (await db.select().from(users).where(eq(users.id, stale.id)).limit(1))[0];
    }
  }

  if (!row) {
    const [invite] = await db
      .select()
      .from(invites)
      .where(and(eq(invites.email, email), isNull(invites.acceptedAt), isNull(invites.revokedAt), gt(invites.expiresAt, new Date())))
      .limit(1);
    if (!invite) {
      await recordAccessRequest(identity);
      return null;
    }
    [row] = await db.insert(users).values({ email, sub: identity.sub, name: identity.name, role: invite.role }).onConflictDoNothing().returning();
    row ??= (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    await db.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite.id));
    await db.delete(accessRequests).where(eq(accessRequests.email, email));
    await writeAudit(email, "invite.accepted", email, { role: invite.role });
  }

  if (!row || !row.active) return null;

  // An email is bound to the Google account that first used it.
  if (row.sub && row.sub !== identity.sub && identity.sub !== "dev-local") {
    console.warn("[auth] a user presented a different Google subject; refused (see the audit log)");
    await auditSubjectMismatch(email, identity.sub);
    return null;
  }

  // Throttled: a login per session is enough.
  const lastLogin = row.lastLoginAt?.getTime() ?? 0;
  if (!row.sub || Date.now() - lastLogin > 5 * 60_000) {
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), sub: row.sub ?? identity.sub, name: identity.name ?? row.name })
      .where(eq(users.id, row.id));
    if (Date.now() - lastLogin > 6 * 3600_000) await writeAudit(email, "login", email);
  }

  return { id: row.id, email: row.email, name: identity.name ?? row.name, role: row.role, envAdmin: isEnvAdmin };
}

async function auditSubjectMismatch(email: string, presentedSub: string): Promise<void> {
  const [recent] = await getDb()
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(and(eq(auditLog.actor, email), eq(auditLog.action, "auth.subject_mismatch"), gt(auditLog.at, new Date(Date.now() - 6 * 3600_000))))
    .limit(1);
  if (!recent) await writeAudit(email, "auth.subject_mismatch", email, { presentedSub });
}

// Anyone with a Google account can sign in and be refused; cap how many distinct refused emails are kept.
const MAX_ACCESS_REQUESTS = 1000;

async function recordAccessRequest(identity: Identity): Promise<void> {
  const db = getDb();
  const [existing] = await db.select({ lastAt: accessRequests.lastAt }).from(accessRequests).where(eq(accessRequests.email, identity.email)).limit(1);
  if (existing && Date.now() - existing.lastAt.getTime() < 10 * 60_000) return;
  if (!existing) {
    const [{ n }] = (await db.select({ n: sql<number>`count(*)::int` }).from(accessRequests)) as [{ n: number }];
    if (n >= MAX_ACCESS_REQUESTS) {
      const oldest = db.select({ email: accessRequests.email }).from(accessRequests).orderBy(asc(accessRequests.lastAt)).limit(n - MAX_ACCESS_REQUESTS + 1);
      await db.delete(accessRequests).where(inArray(accessRequests.email, oldest));
    }
  }
  await db
    .insert(accessRequests)
    .values({ email: identity.email, name: identity.name })
    .onConflictDoUpdate({
      target: accessRequests.email,
      set: {
        name: sql`coalesce(excluded.name, ${accessRequests.name})`,
        attempts: sql`${accessRequests.attempts} + case when ${accessRequests.lastAt} < now() - interval '10 minutes' then 1 else 0 end`,
        lastAt: sql`now()`,
      },
    });
}

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

/** For server actions and route handlers: returns the user or throws AuthError. */
export async function requireUser(minimum: Role): Promise<SessionUser> {
  const session = await getSession();
  if (session.status === "anonymous") throw new AuthError(401, "יש להתחבר");
  if (session.status === "refused") throw new AuthError(403, `החשבון ${session.identity.email} אינו מורשה`);
  if (!hasRole(session.user.role, minimum)) throw new AuthError(403, "אין לך הרשאה לפעולה הזו");
  return session.user;
}
