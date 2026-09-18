import Link from "next/link";
import type { ReactNode } from "react";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { logoutUrl } from "@/lib/auth/urls";
import { AdminTabs } from "./AdminTabs";

/** The CMS frame: its own plain header (not the public site's), tabs, and the page. */
export async function AdminShell({ email, title, subtitle, children }: { email: string; title: string; subtitle?: string; children: ReactNode }) {
  const session = await getSession();
  const role = session.status === "ok" ? session.user.role : "editor";
  return (
    <>
      <header className="border-b-2 border-black">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo.svg" alt="SKEELZ — לאתר" width={80} height={40} className="h-10 w-auto" />
            </Link>
            <span className="text-lg font-medium">ניהול האתר</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-muted">
              <span dir="ltr">{email}</span> · {ROLE_LABELS[role]}
            </span>
            <Link href="/" className="font-medium text-accent-dark underline underline-offset-4">
              לאתר
            </Link>
            <a href={logoutUrl("/")} className="font-medium text-accent-dark underline underline-offset-4">
              יציאה
            </a>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle ? <p className="mt-1 text-muted">{subtitle}</p> : null}
        </div>
        <AdminTabs role={role} />
        {children}
      </main>
    </>
  );
}
