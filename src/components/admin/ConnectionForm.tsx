"use client";

import { useActionState } from "react";
import { checkConnection, saveConnection, type ConnState } from "@/app/admin/connections/actions";
import { buttonClass, fieldClass } from "../ui";

/** One peer's connection. The stored key is never sent here — only its last four characters. */
export function ConnectionForm({ peer, baseUrl, last4, enabled }: { peer: string; baseUrl: string; last4: string | null; enabled: boolean }) {
  const [saved, save, saving] = useActionState<ConnState, FormData>(saveConnection, null);
  const [checked, check, checking] = useActionState<ConnState, FormData>(checkConnection, null);

  return (
    <div className="flex flex-col gap-4">
      <form action={save} className="flex flex-col gap-4">
        <input type="hidden" name="peer" value={peer} />
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">כתובת בסיס (https, בלי נתיב)</span>
          <input name="base_url" required dir="ltr" defaultValue={baseUrl} placeholder="https://example.xhostd.app" className={`${fieldClass} text-start`} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">
            המפתח ש{peer === "admin" ? "מערכת הניהול" : "מערכת הגיוס"} הנפיקה לאתר {last4 ? <span dir="ltr">(שמור: ••••{last4} — ריק = להשאיר)</span> : null}
          </span>
          <input name="key" type="password" autoComplete="off" dir="ltr" className={`${fieldClass} text-start font-mono`} />
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="enabled" defaultChecked={enabled} className="size-5 accent-accent-dark" />
          <span>החיבור פעיל</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={saving} className={buttonClass("primary")}>
            {saving ? "שומר…" : "שמירה"}
          </button>
          <p role="status" className={`text-sm ${saved && !saved.ok ? "text-danger" : "text-success"}`}>
            {saved?.message ?? ""}
          </p>
        </div>
      </form>
      <form action={check} className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <input type="hidden" name="peer" value={peer} />
        <button disabled={checking} className={buttonClass("secondary")}>
          {checking ? "בודק…" : "בדיקת חיבור"}
        </button>
        <p role="status" className={`text-sm ${checked && !checked.ok ? "text-danger" : "text-success"}`}>
          {checked?.message ?? ""}
        </p>
      </form>
    </div>
  );
}
