import { peerFetch, PeerError } from "@/lib/connect/client";
import type { CheckedCv, ProfileInput } from "./validate";

/**
 * Forwards one application to the CRM, in memory, as multipart, through
 * peerFetch("crm", "/api/v1/intake/applications") — the connection set at
 * /admin/connections, or CRM_URL + CRM_INTAKE_TOKEN when none is set. A CRM that
 * answers 404 there (not yet on the v1 path) gets the same request at its older
 * alias /api/intake/applications; site_application_id makes the repeat harmless.
 * 201 (created) or 200 (an idempotent repeat) → {application_id, candidate_id}.
 * Errors → {error:{code,message}}.
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
  | { ok: true; applicationId: string | null; candidateId: string | null }
  | { ok: false; code: string; status: number | null };

export async function forwardApplication(input: ForwardInput): Promise<ForwardResult> {
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

  const post = (path: string) => peerFetch<Record<string, unknown>>("crm", path, { method: "POST", body, timeoutMs: TIMEOUT_MS });
  try {
    let json: Record<string, unknown>;
    try {
      json = await post("/api/v1/intake/applications");
    } catch (err) {
      if (!(err instanceof PeerError && err.code === "http" && err.status === 404)) throw err;
      json = await post("/api/intake/applications");
    }
    const id = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, 100) : null);
    return { ok: true, applicationId: id(json.application_id), candidateId: id(json.candidate_id) };
  } catch (err) {
    if (!(err instanceof PeerError)) throw err;
    const code = err.code === "http" ? (err.peerCode ?? `http_${err.status}`) : err.code;
    console.error(`[apply] CRM ${err.code}${err.status ? ` HTTP ${err.status}` : ""} ${code}`);
    return { ok: false, code, status: err.status };
  }
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
  if (result.code === "not_configured" || result.code === "disabled") return `מערכת הגיוס אינה מחוברת לאתר עדיין. ${notKept}`;
  if (result.code === "timeout") return `מערכת הגיוס לא ענתה בזמן. ${notKept} אפשר לנסות שוב בעוד כמה דקות.`;
  return `מערכת הגיוס אינה זמינה כרגע. ${notKept} אפשר לנסות שוב בעוד כמה דקות.`;
}
