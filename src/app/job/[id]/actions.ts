"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { hit } from "@/lib/api/rate-limit";
import { clientIp } from "@/lib/api/tokens";
import { failureMessage, forwardApplication } from "@/lib/apply/crm";
import { ensureProfile, findApplication, recordApplication } from "@/lib/apply/store";
import { checkCv, readProfile, type FieldErrors } from "@/lib/apply/validate";
import { AuthError, requireUser } from "@/lib/auth/session";
import { getJob } from "@/lib/jobs/feed";
import { isJobKey } from "@/lib/jobs/types";
import { logError } from "@/lib/log";

/**
 * The sandbox apply flow. CV RULE (CLAUDE.md): the CV is read into memory,
 * checked, forwarded to the CRM and dropped with the request. It is never
 * written to the database, the disk or a log — only the basic profile and an
 * `applications` row (ids and status) are kept.
 */

export type ApplyState =
  | { status: "idle" }
  | { status: "error"; message: string; fields?: FieldErrors; values?: Record<string, string> }
  | { status: "success"; message: string; crmApplicationId: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Per address: enough for a person retrying, not for a script.
const APPLY_LIMIT = 10;
const APPLY_WINDOW_MS = 10 * 60_000;

/** What the visitor typed, so the form can show it again after an error. Never the file. */
function echo(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ["first_name", "last_name", "email", "phone", "city"]) {
    const v = form.get(k);
    if (typeof v === "string") out[k] = v.slice(0, 254);
  }
  return out;
}

export async function applyToJob(_prev: ApplyState, form: FormData): Promise<ApplyState> {
  try {
    await requireUser("editor");
  } catch (err) {
    if (err instanceof AuthError) return { status: "error", message: err.message };
    // The database is unreachable (already logged without its details). Nothing was sent or kept.
    return { status: "error", message: "תקלה זמנית באתר. לא נשלח ולא נשמר דבר — אפשר לנסות שוב בעוד כמה דקות." };
  }

  const ip = clientIp(await headers());
  if (!hit(`ip:${ip}:apply`, APPLY_LIMIT, APPLY_WINDOW_MS).ok) {
    return { status: "error", message: "נשלחו יותר מדי הגשות מהכתובת הזו. אפשר לנסות שוב בעוד כמה דקות.", values: echo(form) };
  }

  const jobKey = String(form.get("job_key") ?? "");
  if (!isJobKey(jobKey)) return { status: "error", message: "המשרה לא זוהתה." };
  const rawId = String(form.get("site_application_id") ?? "");
  const siteApplicationId = UUID.test(rawId) ? rawId : randomUUID();

  // The same form submitted again after a success (a double click, a reload) is not sent twice.
  const existing = await findApplication(siteApplicationId).catch(() => null);
  if (existing?.status === "forwarded") {
    return { status: "success", message: "המועמדות כבר הוגשה.", crmApplicationId: existing.crmApplicationId };
  }

  const { profile, errors } = readProfile(form);
  const { cv, error: cvError } = await checkCv(form.get("cv"));
  if (cvError) errors.cv = cvError;
  if (!profile || !cv) {
    return { status: "error", message: "יש לתקן את השדות המסומנים.", fields: errors, values: echo(form) };
  }

  const { job } = await getJob(jobKey);
  if (!job) return { status: "error", message: "המשרה כבר לא פעילה, ולכן אי אפשר להגיש אליה מועמדות." };
  const jobTitle = job.title ?? "";

  const result = await forwardApplication({ siteApplicationId, jobKey, jobTitle, profile, cv });

  // Only now, and only the basic profile and the outcome. The CV is not passed on from here.
  try {
    const { id: profileId } = await ensureProfile(profile, "apply");
    await recordApplication({
      id: siteApplicationId,
      jobKey,
      jobTitle,
      profileId,
      profile,
      status: result.ok ? "forwarded" : "failed",
      crmApplicationId: result.ok ? result.applicationId : null,
      crmCandidateId: result.ok ? result.candidateId : null,
      errorCode: result.ok ? null : result.code,
    });
  } catch (err) {
    logError("apply: record", err);
  }

  if (!result.ok) return { status: "error", message: failureMessage(result), values: echo(form) };
  return {
    status: "success",
    message: "בקרוב ניצור איתך קשר להמשך תהליך.",
    crmApplicationId: result.applicationId,
  };
}
