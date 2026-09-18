import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/site/SignupForm";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { pageAuth } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "הרשמה" };
export const dynamic = "force-dynamic";

/** Sandbox sign-up: a basic profile, no password and no CV. */
export default async function SignupPage() {
  const auth = await pageAuth("editor", "/signup");
  if (!auth.ok) return auth.render;
  return (
    <>
      <SiteHeader titleIsHeading={false} />
      <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
        <p>
          <Link href="/" className="text-sm font-medium text-accent-dark underline underline-offset-4">
            <span aria-hidden>→</span> לכל המשרות
          </Link>
        </p>
        <div className="overflow-hidden rounded-modal border-2 border-line">
          <h1 className="bg-accent px-6 py-5 text-center text-2xl font-medium text-white">הרשמה לאתר</h1>
          <div className="bg-surface p-6">
            <p className="mb-4 text-muted">פרטים בסיסיים בלבד. קורות חיים מצרפים רק בהגשת מועמדות למשרה, והם לא נשמרים באתר.</p>
            <SignupForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
