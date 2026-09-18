import { logoutUrl } from "@/lib/auth/urls";
import { buttonClass } from "./ui";

export function Forbidden({ email }: { email: string }) {
  return (
    <main id="main" className="flex min-h-[calc(100dvh-var(--preview-bar))] flex-col items-center justify-center gap-10 px-4 py-12">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo.svg" alt="SKEELZ" width={128} height={72} />
      <div className="w-full max-w-md overflow-hidden rounded-modal border-2 border-line">
        <h1 className="bg-accent px-8 py-6 text-center text-2xl font-medium text-white">אין גישה לתצוגה המקדימה</h1>
        <div className="flex flex-col items-center gap-6 bg-surface px-8 py-8 text-center">
          <p className="text-muted">
            החשבון <span dir="ltr" className="font-medium text-ink">{email}</span> אינו ברשימת האדמינים.
            <br />
            עד להשקה האתר גלוי לאדמינים בלבד.
          </p>
          <a href={logoutUrl("/")} className={`${buttonClass("secondary")} w-full`}>
            התחברות עם חשבון אחר
          </a>
        </div>
      </div>
    </main>
  );
}
