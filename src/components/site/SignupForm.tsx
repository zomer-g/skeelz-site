"use client";

import { useActionState } from "react";
import { signUp, type SignupState } from "@/app/signup/actions";
import { buttonClass } from "../ui";
import { Field, inputClass } from "./fields";

export function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(signUp, { status: "idle" });
  const fields = state.status === "error" ? (state.fields ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  if (state.status === "success") {
    return (
      <div role="status" tabIndex={-1} autoFocus className="rounded-card border-2 border-success bg-success-soft p-6 text-center focus:outline-hidden">
        <p className="text-2xl font-bold text-success">תודה!</p>
        <p className="mt-2">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <p className="rounded-2xl bg-hot/30 px-4 py-2 text-sm font-medium text-[#93370d]">סביבת בדיקה — ההרשמה נשמרת באתר הבדיקה בלבד</p>
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
        <label className="flex items-start gap-3">
          <input type="checkbox" name="consent" required aria-describedby="consent-error" aria-invalid={fields.consent ? true : undefined} className="mt-1 size-5 shrink-0 accent-accent-dark" />
          <span>
            קראתי ואני מסכים/ה ל
            <a href="/privacy" target="_blank" rel="noopener" className="font-medium text-accent-dark underline underline-offset-4">
              מדיניות הפרטיות
              <span className="sr-only"> (נפתח בלשונית חדשה)</span>
            </a>
            . <span aria-hidden className="text-danger">*</span>
          </span>
        </label>
        <p id="consent-error" className="text-sm font-medium text-danger">
          {fields.consent ?? ""}
        </p>
      </div>
      <p role="status" className="text-sm font-medium text-danger">
        {state.status === "error" ? state.message : ""}
      </p>
      <button type="submit" disabled={pending} className={`${buttonClass("primary")} w-full`}>
        {pending ? "שומר…" : "הרשמה"}
      </button>
    </form>
  );
}
