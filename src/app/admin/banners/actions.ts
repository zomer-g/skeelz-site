"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { safeLink } from "@/lib/cms";
import { getDb } from "@/lib/db/client";
import { banners } from "@/lib/db/schema";

// Every action re-checks the caller: a server action is a public endpoint.

export type BannerState = { ok: boolean; message: string } | null;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Midnight in Israel at the start of `day` (YYYY-MM-DD), whatever the server's time zone. */
function israelMidnight(day: string): Date {
  const utc = new Date(`${day}T00:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", timeZoneName: "shortOffset" })
    .formatToParts(utc)
    .find((p) => p.type === "timeZoneName")?.value;
  const hours = Number(offset?.match(/GMT([+-]\d+)/)?.[1] ?? 0);
  return new Date(utc.getTime() - hours * 3600_000);
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/admin/banners");
}

export async function createBanner(_prev: BannerState, form: FormData): Promise<BannerState> {
  const admin = await requireAdmin();
  const text = String(form.get("text") ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const rawLink = String(form.get("link_url") ?? "").trim();
  const linkLabel = String(form.get("link_label") ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  const start = String(form.get("starts_on") ?? "");
  const end = String(form.get("ends_on") ?? "");

  if (!text) return { ok: false, message: "יש לכתוב את נוסח ההודעה" };
  if (text.length > 300) return { ok: false, message: "ההודעה ארוכה מדי (עד 300 תווים)" };
  const linkUrl = rawLink ? safeLink(rawLink) : null;
  if (rawLink && !linkUrl) return { ok: false, message: "קישור צריך להתחיל ב-https:// או ב-/ (עמוד באתר)" };
  if ((start && !DAY.test(start)) || (end && !DAY.test(end))) return { ok: false, message: "תאריך לא תקין" };
  const startsAt = start ? israelMidnight(start) : null;
  // The end day is included: the banner comes down at the midnight after it.
  const endsAt = end ? new Date(israelMidnight(end).getTime() + 24 * 3600_000) : null;
  if (startsAt && endsAt && endsAt <= startsAt) return { ok: false, message: "תאריך הסיום לפני תאריך ההתחלה" };

  const [row] = await getDb()
    .insert(banners)
    .values({ text, linkUrl, linkLabel: linkUrl ? linkLabel || null : null, startsAt, endsAt, active: true, createdBy: admin.email })
    .returning({ id: banners.id });
  await writeAudit(admin.email, "banner.created", String(row!.id), { text, linkUrl, start: start || null, end: end || null });
  refresh();
  return { ok: true, message: "ההודעה נוספה" };
}

export async function toggleBanner(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return;
  const active = form.get("active") === "true";
  const [row] = await getDb().update(banners).set({ active, updatedAt: new Date() }).where(eq(banners.id, id)).returning({ id: banners.id });
  if (row) {
    await writeAudit(admin.email, active ? "banner.activated" : "banner.deactivated", String(id));
    refresh();
  }
}

export async function deleteBanner(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(form.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return;
  const [row] = await getDb().delete(banners).where(eq(banners.id, id)).returning();
  if (row) {
    await writeAudit(admin.email, "banner.deleted", String(id), { text: row.text });
    refresh();
  }
}
