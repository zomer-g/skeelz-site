"use client";

import { useActionState, useState } from "react";
import { createKey, type CreateKeyState } from "@/app/admin/api/actions";
import { buttonClass, fieldClass } from "../ui";

/** Creates a key and shows it exactly once, with a copy button. It is not kept anywhere in the browser. */
export function CreateKeyForm({ scopes }: { scopes: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<CreateKeyState, FormData>(createKey, null);
  const [copied, setCopied] = useState(false);
  const failed = Boolean(state && !state.ok);

  async function copy(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4" onSubmit={() => setCopied(false)}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[min(16rem,100%)] flex-1 flex-col gap-2">
            <span className="text-sm font-medium text-muted">שם — למי המפתח מיועד</span>
            <input name="name" required maxLength={80} placeholder="admin → site" aria-describedby="key-result" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-muted">תוקף בימים (ריק: ללא תפוגה)</span>
            <input name="expires_days" inputMode="numeric" pattern="\d*" maxLength={4} className={`${fieldClass} w-40`} />
          </label>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-muted">הרשאות (scopes)</legend>
          {scopes.map((s) => (
            <label key={s.value} className="flex items-start gap-3">
              <input type="checkbox" name="scopes" value={s.value} className="mt-1 size-5 shrink-0 accent-accent-dark" />
              <span>
                <code dir="ltr" className="font-mono text-sm">
                  {s.value}
                </code>{" "}
                <span className="text-sm text-muted">— {s.label}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div>
          <button type="submit" disabled={pending} className={buttonClass("primary")}>
            {pending ? "יוצר…" : "יצירת מפתח"}
          </button>
        </div>
      </form>

      <p id="key-result" role="status" className={`text-sm font-medium ${failed ? "text-danger" : "text-success"}`}>
        {state?.message ?? ""}
      </p>
      {state?.ok ? (
        <div className="flex flex-col gap-2 rounded-card border-2 border-success bg-success-soft p-4">
          <label htmlFor="new-key" className="text-sm font-medium">
            המפתח החדש
          </label>
          <div className="flex flex-wrap gap-2">
            <input id="new-key" readOnly value={state.key} dir="ltr" onFocus={(e) => e.currentTarget.select()} className={`${fieldClass} min-w-0 flex-1 font-mono text-sm`} />
            <button type="button" onClick={() => copy(state.key)} className={buttonClass("secondary")}>
              {copied ? "הועתק" : "העתקה"}
            </button>
          </div>
          <p className="text-xs text-muted">שולחים אותו רק בכותרת Authorization: Bearer. אחרי שעוזבים את העמוד אי אפשר לראות אותו שוב — רק לבטל וליצור חדש.</p>
        </div>
      ) : null}
    </div>
  );
}
