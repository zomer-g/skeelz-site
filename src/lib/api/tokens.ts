/**
 * Outbound credentials (the admin feed token, the CRM intake token) come only
 * from the environment (xhostd `set_env(secret=true)`). They are sent in an
 * Authorization header and never logged, returned or rendered.
 */
export function envSecret(name: "SITE_FEED_TOKEN" | "CRM_INTAKE_TOKEN"): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/** A configured base URL without its trailing slash, or null. Only http(s). */
export function envBaseUrl(name: "ADMIN_API_URL" | "CRM_URL"): string | null {
  const value = process.env[name]?.trim().replace(/\/+$/, "");
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

/** The caller's address as xhostd's proxy reports it (first X-Forwarded-For entry), for rate limits only. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
