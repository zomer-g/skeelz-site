"use server";

import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { pinnedJobs } from "@/lib/db/schema";
import { getJob } from "@/lib/jobs/feed";
import { isJobKey } from "@/lib/jobs/types";

// Every action re-checks the caller: a server action is a public endpoint.

const MAX_PINS = 20;

export type PinState = { ok: boolean; message: string } | null;

function refresh() {
  revalidatePath("/");
  revalidatePath("/admin/pins");
}

export async function pinJob(_prev: PinState, form: FormData): Promise<PinState> {
  const admin = await requireAdmin();
  const key = String(form.get("key") ?? "")
    .trim()
    .toLowerCase();
  if (!isJobKey(key)) return { ok: false, message: "מזהה משרה הוא 24 תווים הקסדצימליים (כמו בכתובת /job/…)" };
  const db = getDb();
  const [{ n }] = (await db.select({ n: sql<number>`count(*)::int` }).from(pinnedJobs)) as [{ n: number }];
  if (n >= MAX_PINS) return { ok: false, message: `אפשר להצמיד עד ${MAX_PINS} משרות` };
  const { job } = await getJob(key);
  const [{ max }] = (await db.select({ max: sql<number>`coalesce(max(${pinnedJobs.position}), 0)::int` }).from(pinnedJobs)) as [{ max: number }];
  const [row] = await db
    .insert(pinnedJobs)
    .values({ jobKey: key, position: max + 1, title: job?.title ?? null, pinnedBy: admin.email })
    .onConflictDoNothing()
    .returning();
  if (!row) return { ok: true, message: "המשרה כבר מוצמדת" };
  await writeAudit(admin.email, "pin.added", key, { title: job?.title ?? null, inFeed: Boolean(job) });
  refresh();
  return { ok: true, message: job ? `“${job.title}” הוצמדה לראש הרשימה` : "הוצמדה. שימו לב: המשרה לא נמצאת כרגע בפיד, ולכן לא תוצג עד שתחזור." };
}

export async function unpinJob(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const key = String(form.get("key") ?? "");
  if (!isJobKey(key)) return;
  const [row] = await getDb().delete(pinnedJobs).where(eq(pinnedJobs.jobKey, key)).returning();
  if (row) {
    await writeAudit(admin.email, "pin.removed", key, { title: row.title });
    refresh();
  }
}

/** Swaps a pinned job with its neighbour above or below. */
export async function movePin(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const key = String(form.get("key") ?? "");
  const dir = form.get("dir") === "up" ? -1 : 1;
  if (!isJobKey(key)) return;
  await getDb().transaction(async (tx) => {
    const rows = await tx.select().from(pinnedJobs).orderBy(asc(pinnedJobs.position));
    const i = rows.findIndex((r) => r.jobKey === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= rows.length) return;
    // Renumber the whole list so positions stay 1..n even after deletions.
    const order = rows.map((r) => r.jobKey);
    [order[i], order[j]] = [order[j]!, order[i]!];
    for (const [pos, k] of order.entries()) await tx.update(pinnedJobs).set({ position: pos + 1 }).where(eq(pinnedJobs.jobKey, k));
  });
  await writeAudit(admin.email, "pin.moved", key, { dir: dir < 0 ? "up" : "down" });
  refresh();
}
