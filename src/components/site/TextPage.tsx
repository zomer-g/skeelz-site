import Link from "next/link";
import { RichText } from "../RichText";
import { fmtDate } from "@/lib/format";
import { findText } from "@/lib/texts/registry";
import { loadText } from "@/lib/texts/store";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/** A page that is one admin-edited text (about, privacy, accessibility) in the site's chrome. */
export async function TextPage({ textKey, showUpdated = true }: { textKey: string; showUpdated?: boolean }) {
  const def = findText(textKey)!;
  const text = await loadText(textKey);
  return (
    <>
      <SiteHeader titleIsHeading={false} />
      <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <p>
          <Link href="/" className="text-sm font-medium text-accent-dark underline underline-offset-4">
            <span aria-hidden>→</span> לכל המשרות
          </Link>
        </p>
        <header>
          <h1 className="text-3xl font-bold">{def.title}</h1>
          {showUpdated ? <p className="mt-2 text-sm text-muted">עודכן לאחרונה ב-{text.updatedAt ? fmtDate(text.updatedAt) : def.defaultUpdated}</p> : null}
        </header>
        <div className="flex flex-col gap-4 leading-relaxed">
          <RichText body={text.body} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
