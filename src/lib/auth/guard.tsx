import type { ReactNode } from "react";
import { Forbidden } from "@/components/Forbidden";
import { SignInScreen } from "@/components/SignInScreen";
import { hasRole, type Role } from "./roles";
import { getSession, type SessionUser } from "./session";

export type PageAuth = { ok: true; user: SessionUser } | { ok: false; render: ReactNode };

/**
 * Every page checks for itself rather than trusting a layout: layouts are not
 * re-rendered on client navigation. Anonymous visitors get the sign-in screen
 * with a 200 (xhostd's readiness probe on GET / stays green). While the site is
 * a preview every page needs at least "editor" — no role, no site.
 */
export async function pageAuth(minimum: Role, returnTo: string): Promise<PageAuth> {
  const session = await getSession();
  if (session.status === "anonymous") return { ok: false, render: <SignInScreen returnTo={returnTo} /> };
  if (session.status === "refused") return { ok: false, render: <Forbidden email={session.identity.email} /> };
  if (!hasRole(session.user.role, minimum)) return { ok: false, render: <Forbidden email={session.user.email} reason="role" /> };
  return { ok: true, user: session.user };
}
