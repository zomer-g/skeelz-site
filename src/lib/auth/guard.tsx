import type { ReactNode } from "react";
import { Forbidden } from "@/components/Forbidden";
import { SignInScreen } from "@/components/SignInScreen";
import { getSession, type SessionUser } from "./session";

export type PageAuth = { ok: true; user: SessionUser } | { ok: false; render: ReactNode };

/**
 * Every page checks for itself rather than trusting a layout: layouts are not
 * re-rendered on client navigation, so a check that lives only there can be
 * skipped. Anonymous visitors get the sign-in screen with a 200, which also
 * keeps xhostd's readiness probe on GET / green. While the site is a preview
 * this covers every page, the public-looking ones included.
 */
export async function pageAuth(returnTo: string): Promise<PageAuth> {
  const session = await getSession();
  if (session.status === "anonymous") return { ok: false, render: <SignInScreen returnTo={returnTo} /> };
  if (session.status === "refused") return { ok: false, render: <Forbidden email={session.identity.email} /> };
  return { ok: true, user: session.user };
}
