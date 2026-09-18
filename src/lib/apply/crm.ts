import { envBaseUrl, envSecret } from "@/lib/api/tokens";
import type { CheckedCv, ProfileInput } from "./validate";

/**
 * Forwards one application to the CRM, in memory, as multipart:
 *   POST ${CRM_URL}/api/intake/applications   Authorization: Bearer ${CRM_INTAKE_TOKEN}
 * 201 (created) or 200 (an idempotent repeat of the same site_application_id)
 * → {application_id, candidate_id}. Errors → {error:{code,message}}.
 *
 * CV RULE: the file is appended to the outgoing body and nothing else. It is
 * never written to disk, the database or a log, and error handling below logs
 * only status codes.
 */

const TIMEOUT_MS = 20_000;

export interface ForwardInput {
  siteApplicationId: string;
  jobKey: string;
  jobTitle: string;
  profile: ProfileInput;
  cv: CheckedCv;
}

export type ForwardResult =
  | { ok: true; applicationId: string | null; candidateId: string | null; repeat: boolean }
  | { ok: false; code: string; status: number | null };

export async function forwardApplication(input: ForwardInput): Promise<ForwardResult> {
  const base = envBaseUrl("CRM_URL");
  const token = envSecret("CRM_INTAKE_TOKEN");
  if (!base || !token) return { ok: false, code: "not_configured", status: null };

  const body = new FormData();
  body.set("site_application_id", input.siteApplicationId);
  body.set("job_key", input.jobKey);
  body.set("job_title", input.jobTitle);
  body.set("first_name", input.profile.firstName);
  body.set("last_name", input.profile.lastName);
  body.set("email", input.profile.email);
  body.set("phone", input.profile.phone);
  body.set("city", input.profile.city ?? "");
  body.set("consent", "true");
  body.set("cv", new Blob([input.cv.bytes as BlobPart], { type: input.cv.contentType }), input.cv.filename);

  let res: Response;
  try {
    res = await fetch(`${base}/api/intake/applications`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const name = (err as Error).name;
    const code = name === "TimeoutError" || name === "AbortError" ? "timeout" : "unreachable";
    console.error(`[apply] CRM ${code}`);
    return { ok: false, code, status: null };
  }

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.status === 201 || res.status === 200) {
    const id = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, 100) : null);
    return { ok: true, applicationId: id(json?.application_id), candidateId: id(json?.candidate_id), repeat: res.status === 200 };
  }

  const error = json?.error as { code?: unknown } | undefined;
  const code = typeof error?.code === "string" && /^[\w.-]{1,40}$/.test(error.code) ? error.code : `http_${res.status}`;
  console.error(`[apply] CRM refused: HTTP ${res.status} ${code}`);
  return { ok: false, code, status: res.status };
}

/** What the visitor reads when the CRM did not take the application. Nothing about it was kept. */
export function failureMessage(result: Extract<ForwardResult, { ok: false }>): string {
  const notKept = "ההגשה לא נשלחה, וקובץ קורות החיים לא נשמר.";
  switch (result.status) {
    case 400:
      return `חלק מהפרטים לא התקבלו במערכת הגיוס. כדאי לבדוק אותם ולנסות שוב. ${notKept}`;
    case 413:
      return `הקובץ גדול מדי עבור מערכת הגיוס (עד 5MB). ${notKept}`;
    case 415:
      return `מערכת הגיוס לא קיבלה את סוג הקובץ. אפשר לצרף PDF, DOC או DOCX. ${notKept}`;
    case 429:
      return `נשלחו יותר מדי הגשות בזמן קצר. אפשר לנסות שוב בעוד כמה דקות. ${notKept}`;
    case 401:
    case 403:
      return `תקלה בחיבור למערכת הגיוס. ${notKept} אפשר לנסות שוב מאוחר יותר.`;
  }
  if (result.code === "not_configured") return `מערכת הגיוס אינה מחוברת לאתר עדיין. ${notKept}`;
  if (result.code === "timeout") return `מערכת הגיוס לא ענתה בזמן. ${notKept} אפשר לנסות שוב בעוד כמה דקות.`;
  return `מערכת הגיוס אינה זמינה כרגע. ${notKept} אפשר לנסות שוב בעוד כמה דקות.`;
}
