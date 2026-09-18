import Link from "next/link";
import { RichText } from "../RichText";
import { loadText } from "@/lib/texts/store";

/**
 * The live site's black footer: the white logo and large light links. Privacy
 * and accessibility are fixed (the law wants them on every page); the rest of
 * the links are the admin-edited "footer" text, one "- [text](link)" per link.
 */
export async function SiteFooter() {
  const footer = await loadText("footer");
  const link = "text-2xl font-light text-white underline underline-offset-4 hover:text-accent-light";
  return (
    <footer className="mt-12 bg-black text-white">
      <div className="mx-auto grid min-h-56 max-w-[75.375rem] items-center gap-8 px-6 py-10 md:grid-cols-[1fr_3fr]">
        <Link href="/" className="justify-self-start md:justify-self-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/whiteLogo.svg" alt="SKEELZ — לכל המשרות" width={96} height={56} className="h-14 w-auto" />
        </Link>
        <nav aria-label="קישורים בתחתית העמוד" className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-12">
          <Link href="/privacy" className={link}>
            מדיניות פרטיות
          </Link>
          <Link href="/accessibility" className={link}>
            הצהרת נגישות
          </Link>
          <div className="contents [&_a]:text-2xl [&_a]:font-light [&_a]:text-white! [&_a]:underline [&_a]:underline-offset-4 [&_li]:list-none [&_p]:contents [&_ul]:contents">
            <RichText body={footer.body} />
          </div>
        </nav>
      </div>
    </footer>
  );
}
