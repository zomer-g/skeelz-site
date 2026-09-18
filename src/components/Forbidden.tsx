import Link from "next/link";
import { logoutUrl } from "@/lib/auth/urls";
import { buttonClass } from "./ui";

/** No role at all (the preview stays invisible), or a role too low for an admin screen. */
export function Forbidden({ email, reason = "no_role" }: { email: string; reason?: "no_role" | "role" }) {
  if (reason === "role") {
    return (
      <main id="main" className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">אין הרשאה לעמוד הזה</h1>
        <p className="text-muted">העמוד דורש הרשאת אדמין. אפשר לבקש שינוי הרשאה מאדמין האתר.</p>
        <Link href="/admin" className={buttonClass("secondary")}>
          לניהול האתר
        </Link>
      </main>
    );
  }
  return (
    <main id="main" className="flex min-h-[calc(100dvh-var(--preview-bar))] flex-col items-center justify-center gap-10 px-4 py-12">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo.svg" alt="SKEELZ" width={128} height={72} />
      <div className="w-full max-w-md overflow-hidden rounded-modal border-2 border-line">
        <h1 className="bg-accent px-8 py-6 text-center text-2xl font-medium text-white">הגישה טרם אושרה</h1>
        <div className="flex flex-col items-center gap-6 bg-surface px-8 py-8 text-center">
          <p className="text-muted">
            החשבון <span dir="ltr" className="font-medium text-ink">{email}</span> אינו מורשה.
            <br />
            עד להשקה האתר גלוי רק למשתמשים שהוזמנו. הבקשה נרשמה, ואדמין יכול לאשר אותה.
          </p>
          <a href={logoutUrl("/")} className={`${buttonClass("secondary")} w-full`}>
            התחברות עם חשבון אחר
          </a>
        </div>
      </div>
    </main>
  );
}
