"use server";

import { headers } from "next/headers";
import { hit } from "@/lib/api/rate-limit";
import { clientIp } from "@/lib/api/tokens";
import { upsertProfile } from "@/lib/apply/store";
import { readProfile, type FieldErrors } from "@/lib/apply/validate";
import { AuthError, requireUser } from "@/lib/auth/session";

/** Sandbox sign-up: the basic profile only. There is no CV here at all. */

export type SignupState =
  | { status: "idle" }
  | { status: "error"; message: string; fields?: FieldErrors; values?: Record<string, string> }
  | { status: "success"; message: string };

export async function signUp(_prev: SignupState, form: FormData): Promise<SignupState> {
  try {
    await requireUser("editor");
  } catch (err) {
    if (err instanceof AuthError) return { status: "error", message: err.message };
    throw err;
  }
  const values: Record<string, string> = {};
  for (const k of ["first_name", "last_name", "email", "phone", "city"]) {
    const v = form.get(k);
    if (typeof v === "string") values[k] = v.slice(0, 254);
  }
  if (!hit(`ip:${clientIp(await headers())}:signup`, 10, 10 * 60_000).ok) {
    return { status: "error", message: "יותר מדי ניסיונות. אפשר לנסות שוב בעוד כמה דקות.", values };
  }
  const { profile, errors } = readProfile(form);
  if (!profile) return { status: "error", message: "יש לתקן את השדות המסומנים.", fields: errors, values };
  try {
    await upsertProfile(profile, "signup");
  } catch (err) {
    console.error("[signup] could not save:", (err as Error).message);
    return { status: "error", message: "ההרשמה לא נשמרה בגלל תקלה. אפשר לנסות שוב בעוד כמה דקות.", values };
  }
  return { status: "success", message: "נרשמת בהצלחה. נעדכן אותך במשרות שמתאימות לך." };
}
