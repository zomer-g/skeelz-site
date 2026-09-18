"use client";

import { useActionState, useRef, useEffect } from "react";
import { createBanner, type BannerState } from "@/app/admin/banners/actions";
import { buttonClass } from "../ui";

const input =
  "h-12 w-full rounded-full border border-field bg-white px-5 text-base text-ink shadow-field focus:outline-hidden focus:ring-2 focus:ring-accent";

export function BannerForm() {
  const [state, action, pending] = useActionState<BannerState, FormData>(createBanner, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor="banner-text" className="text-sm font-medium">
          נוסח ההודעה <span className="text-muted">(עד 300 תווים)</span>
        </label>
        <input id="banner-text" name="text" required maxLength={300} className={input} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="banner-link" className="text-sm font-medium">
          קישור <span className="text-muted">(לא חובה · https://… או /עמוד)</span>
        </label>
        <input id="banner-link" name="link_url" dir="ltr" className={input} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="banner-label" className="text-sm font-medium">
          טקסט הקישור <span className="text-muted">(ברירת מחדל: “לפרטים”)</span>
        </label>
        <input id="banner-label" name="link_label" maxLength={60} className={input} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="banner-start" className="text-sm font-medium">
          מתאריך <span className="text-muted">(ריק: מיד)</span>
        </label>
        <input id="banner-start" name="starts_on" type="date" className={input} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="banner-end" className="text-sm font-medium">
          עד תאריך, כולל <span className="text-muted">(ריק: ללא הגבלה)</span>
        </label>
        <input id="banner-end" name="ends_on" type="date" className={input} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={pending} className={buttonClass("primary")}>
          {pending ? "שומר…" : "הוספת הודעה"}
        </button>
        <p role="status" className={`text-sm ${state && !state.ok ? "text-danger" : "text-success"}`}>
          {state?.message ?? ""}
        </p>
      </div>
    </form>
  );
}
