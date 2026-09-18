import type { Role } from "@/lib/db/schema";

export type { Role };

/**
 * Roles are ranked: each can do everything the one below it can.
 *   editor — texts, pinned jobs, banners (and sees the whole preview site)
 *   admin  — also users, API keys, connections, the applications view and the audit log
 * Anyone without a role sees nothing but the sign-in / refusal screen.
 */
export const ROLES = ["editor", "admin"] as const satisfies readonly Role[];

const RANK: Record<Role, number> = { editor: 0, admin: 1 };

export const ROLE_LABELS: Record<Role, string> = {
  editor: "עורך תוכן",
  admin: "אדמין",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function hasRole(actual: Role, minimum: Role): boolean {
  return RANK[actual] >= RANK[minimum];
}
