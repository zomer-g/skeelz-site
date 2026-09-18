import { loadActiveBanners } from "@/lib/cms";
import { NewTabNote } from "../ui";

/** Admin announcements (/admin/banners) that are active today, as strips under the header. */
export async function Banners() {
  const banners = await loadActiveBanners();
  if (!banners.length) return null;
  return (
    <section aria-label="הודעות" className="flex flex-col">
      {banners.map((b) => {
        const external = b.linkUrl?.startsWith("https://");
        return (
          <p key={b.id} className="border-b border-line bg-accent-light/40 px-4 py-3 text-center text-ink">
            {b.text}
            {b.linkUrl ? (
              <>
                {" "}
                <a
                  href={b.linkUrl}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="font-medium text-accent-dark underline underline-offset-4"
                >
                  {b.linkLabel || "לפרטים"}
                  {external ? <NewTabNote /> : null}
                </a>
              </>
            ) : null}
          </p>
        );
      })}
    </section>
  );
}
