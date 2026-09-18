import { getDb } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";

/** Records an admin change. Never pass a CV, a file name or a secret in `details`. */
export async function writeAudit(
  actor: string,
  action: string,
  target?: string | null,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await getDb().insert(auditLog).values({ actor, action, target: target ?? null, details: details ?? null });
  } catch (err) {
    // An audit write must never take down the operation it describes.
    console.error("[audit] write failed:", (err as Error).message, { actor, action, target });
  }
}
