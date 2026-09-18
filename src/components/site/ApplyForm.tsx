"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { applyToJob, type ApplyState } from "@/app/job/[id]/actions";
import { buttonClass } from "../ui";
import { Field, inputClass } from "./fields";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * The sandbox apply form. The file goes to the server action in the request
 * body, is checked in memory and forwarded to the CRM; see the CV rule in CLAUDE.md.
 * Submitted by hand (not as a form action) so an error keeps what was typed.
 */
export function ApplyForm({ jobKey, siteApplicationId }: { jobKey: string; siteApplicationId: string }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(applyToJob, { status: "idle" });
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const fields = state.status === "error" ? (state.fields ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const cvError = fileError ?? fields.cv;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileName(file?.name ?? null);
    if (file && file.size > MAX_BYTES) {
      setFileError("הקובץ גדול מ-5MB");
      e.target.value = "";
      setFileName(null);
    } else setFileError(null);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (fileError) return;
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  }

  if (state.status === "success") {
    return (
      <div role="status" tabIndex={-1} autoFocus className="flex flex-col gap-3 rounded-card border-2 border-success bg-success-soft p-6 text-center focus:outline-hidden">
        <p className="text-2xl font-bold text-success">המועמדות הוגשה</p>
        <p>{state.message}</p>
        <p className="text-sm text-muted">
          סביבת בדיקה: ההגשה נשלחה למערכת הבדיקה בלבד
          {state.crmApplicationId ? (
            <>
              {" "}
              (מזהה במערכת: <span dir="ltr">{state.crmApplicationId}</span>)
            </>
          ) : null}
          .
        </p>
      </div>
    );
  }

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-describedby="apply-sandbox">
      <p id="apply-sandbox" className="rounded-2xl bg-hot/30 px-4 py-2 text-sm font-medium text-[#93370d]">
        סביבת בדיקה — ההגשה נשלחת למערכת הבדיקה בלבד
      </p>
      <input type="hidden" name="job_key" value={jobKey} />
      <input type="hidden" name="site_application_id" value={siteApplicationId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="first_name" label="שם פרטי" required error={fields.first_name}>
          <input id="first_name" name="first_name" autoComplete="given-name" required maxLength={60} defaultValue={values.first_name} className={inputClass} />
        </Field>
        <Field id="last_name" label="שם משפחה" required error={fields.last_name}>
          <input id="last_name" name="last_name" autoComplete="family-name" required maxLength={60} defaultValue={values.last_name} className={inputClass} />
        </Field>
      </div>
      <Field id="email" label="כתובת מייל" required error={fields.email}>
        <input id="email" name="email" type="email" dir="ltr" autoComplete="email" required maxLength={254} defaultValue={values.email} className={`${inputClass} text-end`} />
      </Field>
      <Field id="phone" label="טלפון" required error={fields.phone}>
        <input id="phone" name="phone" type="tel" dir="ltr" autoComplete="tel" required maxLength={20} defaultValue={values.phone} className={`${inputClass} text-end`} />
      </Field>
      <Field id="city" label="עיר מגורים" error={fields.city}>
        <input id="city" name="city" autoComplete="address-level2" maxLength={60} defaultValue={values.city} className={inputClass} />
      </Field>

      <div className="flex flex-col gap-1">
        <span id="cv-label" className="font-bold">
          צירוף קורות חיים <span aria-hidden className="text-danger">*</span>
          <span className="sr-only"> (חובה)</span>
        </span>
        <label
          htmlFor="cv"
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed ${cvError ? "border-danger" : "border-field"} bg-white px-4 py-5 text-center focus-within:ring-2 focus-within:ring-accent`}
        >
          <span className="font-medium text-accent-dark underline underline-offset-4">{fileName ? "החלפת הקובץ" : "בחירת קובץ"}</span>
          <span className="text-sm break-all text-ink">{fileName ?? "לא נבחר קובץ"}</span>
          <input
            id="cv"
            name="cv"
            type="file"
            accept={ACCEPT}
            required
            onChange={onFile}
            aria-labelledby="cv-label"
            aria-describedby="cv-hint cv-error"
            aria-invalid={cvError ? true : undefined}
            className="sr-only"
          />
        </label>
        <p id="cv-hint" className="text-sm text-muted">
          גודל מקסימלי לקובץ: 5MB. פורמטים נתמכים: PDF, DOC, DOCX.
        </p>
        <p id="cv-error" className="text-sm font-medium text-danger">
          {cvError ?? ""}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="consent"
            required
            aria-describedby="consent-error"
            aria-invalid={fields.consent ? true : undefined}
            className="mt-1 size-5 shrink-0 accent-accent-dark"
          />
          <span>
            קראתי ואני מסכים/ה ל
            <a href="/privacy" target="_blank" rel="noopener" className="font-medium text-accent-dark underline underline-offset-4">
              מדיניות הפרטיות
              <span className="sr-only"> (נפתח בלשונית חדשה)</span>
            </a>
            , ולהעברת הפרטים וקורות החיים למערכת הגיוס של SKEELZ. <span aria-hidden className="text-danger">*</span>
          </span>
        </label>
        <p id="consent-error" className="text-sm font-medium text-danger">
          {fields.consent ?? ""}
        </p>
      </div>

      {/* Always mounted, so the result is announced when it arrives. */}
      <p role="status" className={`text-sm font-medium ${state.status === "error" ? "text-danger" : ""}`}>
        {pending ? "שולח…" : state.status === "error" ? state.message : ""}
      </p>

      <button type="submit" disabled={pending} className={`${buttonClass("primary")} w-full`}>
        {pending ? "שולח…" : "הגש מועמדות"}
      </button>
    </form>
  );
}
