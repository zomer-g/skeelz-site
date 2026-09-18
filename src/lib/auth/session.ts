import { cache } from "react";
import { verifiedIdentity, type Identity } from "./xhost";

/**
 * While the site is a preview, the only people allowed in are ADMIN_EMAILS.
 * Authentication is not authorisation: a verified Google identity outside that
 * list is refused.
 */

export interface SessionUser {
  email: string;
  name: string | null;
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

// cache() dedupes the verification across one server render.
export const getSession = cache(async (): Promise<Session> => {
  const identity = await verifiedIdentity();
  if (!identity) return { status: "anonymous" };
  if (!envAdmins().includes(identity.email)) return { status: "refused", identity };
  return { status: "ok", identity, user: { email: identity.email, name: identity.name } };
});

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

/** For server actions and route handlers: returns the admin or throws AuthError. */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession();
  if (session.status === "anonymous") throw new AuthError(401, "יש להתחבר");
  if (session.status === "refused") throw new AuthError(403, `החשבון ${session.identity.email} אינו מורשה`);
  return session.user;
}
