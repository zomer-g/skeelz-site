"use client";

import { useActionState } from "react";
import { pinJob, type PinState } from "@/app/admin/pins/actions";
import { buttonClass, fieldClass } from "../ui";

/** Pins a job by its key, or (with `jobKey`) a single "pin" button for a row. */
export function PinForm({ jobKey, label }: { jobKey?: string; label?: string }) {
  const [state, action, pending] = useActionState<PinState, FormData>(pinJob, null);
  if (jobKey) {
    return (
      <form action={action} className="flex flex-col items-end gap-1">
        <input type="hidden" name="key" value={jobKey} />
        <button disabled={pending} className={buttonClass("secondary", "sm")}>
          הצמדה<span className="sr-only"> · {label}</span>
        </button>
        <span role="status" className={`text-xs ${state && !state.ok ? "text-danger" : "text-success"}`}>
          {state?.message ?? ""}
        </span>
      </form>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="pin-key" className="text-sm font-medium">
        הצמדה לפי מזהה משרה (24 תווים, מהכתובת <span dir="ltr">/job/…</span>)
      </label>
      <div className="flex flex-wrap gap-2">
        <input id="pin-key" name="key" dir="ltr" required pattern="[0-9a-fA-F]{24}" maxLength={24} className={`${fieldClass} min-w-0 flex-1 font-mono`} />
        <button disabled={pending} className={buttonClass("primary")}>
          הצמדה
        </button>
      </div>
      <p role="status" className={`text-sm ${state && !state.ok ? "text-danger" : "text-success"}`}>
        {state?.message ?? ""}
      </p>
    </form>
  );
}
