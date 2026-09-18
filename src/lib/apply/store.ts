import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { applications, profiles, type ApplicationStatus, type ProfileSource } from "@/lib/db/schema";
import type { ProfileInput } from "./validate";

/**
 * The site keeps the basic profile and one row per application attempt.
 * M2: the forms are unauthenticated, so nothing a visitor submits may rewrite
 * what someone else submitted under the same email. A profile is insert-only
 * (the first submission for an email stays as it was), and every application
 * row carries its own snapshot of the submitted fields — the admin view shows that.
 * CV RULE: nothing here takes a file, a file name or a hash.
 */

/** Creates the profile for this email if there is none; never changes an existing one. Returns its id. */
export async function ensureProfile(p: ProfileInput, source: ProfileSource): Promise<{ id: string; created: boolean }> {
  const db = getDb();
  const [created] = await db
    .insert(profiles)
    .values({ email: p.email, firstName: p.firstName, lastName: p.lastName, phone: p.phone, city: p.city, consentAt: new Date(), source })
    .onConflictDoNothing({ target: profiles.email })
    .returning({ id: profiles.id });
  if (created) return { id: created.id, created: true };
  const [existing] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.email, p.email)).limit(1);
  return { id: existing!.id, created: false };
}

export async function findApplication(id: string) {
  const [row] = await getDb().select().from(applications).where(eq(applications.id, id)).limit(1);
  return row ?? null;
}

export async function recordApplication(a: {
  id: string;
  jobKey: string;
  jobTitle: string;
  profileId: string | null;
  profile: ProfileInput;
  status: ApplicationStatus;
  crmApplicationId?: string | null;
  crmCandidateId?: string | null;
  errorCode?: string | null;
}): Promise<void> {
  const snapshot = {
    firstName: a.profile.firstName,
    lastName: a.profile.lastName,
    email: a.profile.email,
    phone: a.profile.phone,
    city: a.profile.city,
    consentAt: new Date(),
  };
  const outcome = {
    profileId: a.profileId,
    status: a.status,
    crmApplicationId: a.crmApplicationId ?? null,
    crmCandidateId: a.crmCandidateId ?? null,
    errorCode: a.errorCode ?? null,
  };
  // A retry of a failed attempt reuses its id (the CRM's idempotency key) and updates that row;
  // the action never gets here for an id that was already forwarded.
  await getDb()
    .insert(applications)
    .values({ id: a.id, jobKey: a.jobKey, jobTitle: a.jobTitle, ...snapshot, ...outcome })
    .onConflictDoUpdate({ target: applications.id, set: { ...snapshot, ...outcome } });
}
