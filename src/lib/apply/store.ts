import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { applications, profiles, type ApplicationStatus, type ProfileSource } from "@/lib/db/schema";
import type { ProfileInput } from "./validate";

/**
 * The site keeps the basic profile (upserted by email) and one row per
 * application attempt. CV RULE: nothing here takes a file, a file name or a hash.
 */

export async function upsertProfile(p: ProfileInput, source: ProfileSource): Promise<string> {
  const now = new Date();
  const [row] = await getDb()
    .insert(profiles)
    .values({ email: p.email, firstName: p.firstName, lastName: p.lastName, phone: p.phone, city: p.city, consentAt: now, source })
    .onConflictDoUpdate({
      target: profiles.email,
      set: {
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        city: sql`coalesce(excluded.city, ${profiles.city})`,
        consentAt: now,
        updatedAt: now,
      },
    })
    .returning({ id: profiles.id });
  return row!.id;
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
  status: ApplicationStatus;
  crmApplicationId?: string | null;
  crmCandidateId?: string | null;
  errorCode?: string | null;
}): Promise<void> {
  const values = {
    id: a.id,
    jobKey: a.jobKey,
    jobTitle: a.jobTitle,
    profileId: a.profileId,
    status: a.status,
    crmApplicationId: a.crmApplicationId ?? null,
    crmCandidateId: a.crmCandidateId ?? null,
    errorCode: a.errorCode ?? null,
  };
  // A retry of a failed attempt reuses its id (the CRM's idempotency key) and updates the row.
  await getDb()
    .insert(applications)
    .values(values)
    .onConflictDoUpdate({
      target: applications.id,
      set: {
        profileId: values.profileId,
        status: values.status,
        crmApplicationId: values.crmApplicationId,
        crmCandidateId: values.crmCandidateId,
        errorCode: values.errorCode,
      },
    });
}
