import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The live site's header: logo at the start, "המשרות שלנו" centred (under the
 * logo row on phones), the account link at the end, the search and filters
 * below, and a 2px black rule. The account link is "ניהול" here.
 * `titleIsHeading` — only the job list's (or the map's) title is the page's h1.
 */
export function SiteHeader({
  children,
  titleIsHeading = true,
  intro,
  title = "המשרות שלנו",
}: {
  children?: ReactNode;
  titleIsHeading?: boolean;
  intro?: ReactNode;
  title?: string;
}) {
  const Title = titleIsHeading ? "h1" : "p";
  return (
    <header className="flex flex-col items-center border-b-2 border-black pt-3 pb-5">
      <div className="relative mx-auto flex w-full max-w-[75.375rem] items-center justify-between px-4 py-1">
        <Link href="/" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.svg" alt="SKEELZ — לכל המשרות" width={96} height={48} className="h-12 w-auto" />
        </Link>
        <Title className="absolute start-1/2 hidden translate-x-1/2 text-center text-4xl font-medium md:block">{title}</Title>
        <nav aria-label="חשבון" className="flex items-center gap-1">
          <Link href="/map" className="rounded-full px-3 py-2 text-sm font-medium text-brand hover:bg-brand/5">
            מפת משרות
          </Link>
          <Link href="/signup" className="rounded-full px-3 py-2 text-sm font-medium text-brand hover:bg-brand/5">
            הרשמה
          </Link>
          <Link href="/admin" className="rounded-full px-3 py-2 text-sm font-medium text-brand hover:bg-brand/5">
            ניהול
          </Link>
        </nav>
      </div>
      <Title className="mt-1 text-[1.875rem] font-medium md:hidden">
        {title}
      </Title>
      {intro ? <div className="mt-1 max-w-[62.25rem] px-4 text-center text-muted">{intro}</div> : null}
      {children ? <div className="mt-4 w-full max-w-[62.25rem] px-3">{children}</div> : null}
    </header>
  );
}
