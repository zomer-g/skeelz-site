import { and, asc, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { banners, pinnedJobs } from "@/lib/db/schema";
import { logError } from "@/lib/log";

/** Pinned job keys in order. The list must render even if the database is down, so a failure pins nothing. */
export async function loadPinnedKeys(): Promise<string[]> {
  try {
    const rows = await getDb().select({ key: pinnedJobs.jobKey }).from(pinnedJobs).orderBy(asc(pinnedJobs.position));
    return rows.map((r) => r.key);
  } catch (err) {
    logError("cms: pinned jobs", err);
    return [];
  }
}

export async function loadPins() {
  return getDb().select().from(pinnedJobs).orderBy(asc(pinnedJobs.position));
}

export interface ShownBanner {
  id: number;
  text: string;
  linkUrl: string | null;
  linkLabel: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
}

/** Banners that are active and within their dates, newest first. */
export async function loadActiveBanners(now = new Date()): Promise<ShownBanner[]> {
  try {
    return await getDb()
      .select({ id: banners.id, text: banners.text, linkUrl: banners.linkUrl, linkLabel: banners.linkLabel, startsAt: banners.startsAt, endsAt: banners.endsAt })
      .from(banners)
      .where(
        and(
          eq(banners.active, true),
          or(isNull(banners.startsAt), lte(banners.startsAt, now)),
          or(isNull(banners.endsAt), gt(banners.endsAt, now)),
        ),
      )
      .orderBy(desc(banners.id))
      .limit(3);
  } catch (err) {
    logError("cms: banners", err);
    return [];
  }
}

export async function loadAllBanners() {
  return getDb().select().from(banners).orderBy(desc(banners.id));
}

/** A banner link: https:// or a path on this site, nothing else. */
export function safeLink(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\/(?![\/\\])[^\s\\]*$/.test(v)) return v;
  try {
    const url = new URL(v);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
