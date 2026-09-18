/**
 * The site's inbound API (docs/connect-api.md §3–4), described once. The OpenAPI
 * document (/api/v1/openapi.json) and the docs page (/api-docs) are both generated
 * from this object; a new endpoint is added here first.
 *
 * Personal data rule: nothing here returns profile fields (names, emails, phones)
 * and nothing can return a CV — the site never has one.
 */

export const SITE_SCOPES = ["content:read", "applications:read"] as const;
export type Scope = (typeof SITE_SCOPES)[number];

export const SCOPE_LABELS: Record<Scope, string> = {
  "content:read": "תוכן האתר: טקסטים ערוכים, משרות מוצמדות והודעות פעילות",
  "applications:read": "הגשות מהאתר: מזהים, משרה, מועד ומצב ההעברה ל-CRM, בלי פרטים אישיים",
};

export const API_LIMITS = {
  perIpPerMinute: 60,
  perKeyPerHour: 1000,
  authFailures: 10,
  authFailureWindowMin: 10,
  lockoutMin: 15,
  defaultPageSize: 50,
  maxPageSize: 200,
};

export interface Param {
  name: string;
  in: "query";
  description: string;
  schema: Record<string, unknown>;
}

export interface Endpoint {
  method: "GET";
  path: string;
  summary: string;
  description: string;
  /** null = any valid key; "none" = no key needed. */
  scope: Scope | null | "none";
  params?: Param[];
  example: unknown;
}

const LIST_PARAMS: Param[] = [
  { name: "limit", in: "query", description: "1–200, default 50", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
  { name: "cursor", in: "query", description: "Opaque; the next_cursor of the previous page", schema: { type: "string" } },
];

export const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/v1/ping",
    summary: "Who am I talking to",
    description: "Any valid key. The app, its version, the time, and the calling key's name and scopes.",
    scope: null,
    example: { app: "site", version: "433c53f", time: "2026-09-18T09:00:00.000Z", key: { name: "admin → site", scopes: ["content:read"] } },
  },
  {
    method: "GET",
    path: "/api/v1/openapi.json",
    summary: "This API as OpenAPI 3.1",
    description: "No key needed: it holds no data.",
    scope: "none",
    example: { openapi: "3.1.0" },
  },
  {
    method: "GET",
    path: "/api/v1/content",
    summary: "The site's editable content",
    description: "The current editable texts (built-in text until someone edits it), the pinned job keys in order, and the banners showing now.",
    scope: "content:read",
    example: {
      texts: [{ key: "home_hero", title: "פתיח בעמוד המשרות", body: "חפשו את התפקיד הבא שלכם…", updated_at: null }],
      pins: [{ job_key: "6a950c13e1c91fd6d1b64b54", position: 1 }],
      banners: [{ id: 3, text: "יריד תעסוקה ביום חמישי", link_url: "/about", link_label: "פרטים", starts_at: null, ends_at: "2026-09-30T21:00:00.000Z" }],
      generated_at: "2026-09-18T09:00:00.000Z",
    },
  },
  {
    method: "GET",
    path: "/api/v1/applications",
    summary: "Applications made on the site",
    description:
      "Oldest first. `since` (ISO time) returns applications created at or after it. Only ids, the job, the time and the forwarding status — no profile fields and no CV (the site never stores one).",
    scope: "applications:read",
    params: [{ name: "since", in: "query", description: "ISO 8601 time", schema: { type: "string", format: "date-time" } }, ...LIST_PARAMS],
    example: {
      data: [
        {
          site_application_id: "ef916320-bb40-4758-aded-3998f8423824",
          job_key: "69e4b382e487b0e287818cca",
          created_at: "2026-09-18T08:41:00.000Z",
          status: "forwarded",
          crm_application_id: "app_8e09ad18",
        },
      ],
      next_cursor: null,
    },
  },
];

export const ERROR_CODES: [status: number, code: string, meaning: string][] = [
  [400, "invalid", "A parameter is wrong"],
  [400, "token_in_url", "The key was sent in the URL; send it only in the Authorization header"],
  [401, "unauthorized", "No key, an unknown key, or a revoked or expired one"],
  [403, "insufficient_scope", "The key is valid but lacks this route's scope"],
  [404, "not_found", "No such route or record"],
  [429, "rate_limited", "Too many requests (see Retry-After); also locked_out after repeated bad keys"],
  [503, "disabled", "The API is switched off on this server"],
];

export function openApiDocument(serverUrl: string, version: string) {
  const errorSchema = {
    type: "object",
    required: ["error"],
    properties: { error: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } } },
  };
  const paths: Record<string, unknown> = {};
  for (const e of ENDPOINTS) {
    const responses: Record<string, unknown> = {
      "200": { description: "OK", content: { "application/json": { example: e.example } } },
    };
    if (e.scope !== "none") {
      responses["400"] = { $ref: "#/components/responses/Error" };
      responses["401"] = { $ref: "#/components/responses/Error" };
      if (e.scope) responses["403"] = { $ref: "#/components/responses/Error" };
      responses["429"] = { $ref: "#/components/responses/Error" };
    }
    paths[e.path] = {
      get: {
        summary: e.summary,
        description: e.description + (e.scope && e.scope !== "none" ? ` Scope: \`${e.scope}\`.` : ""),
        security: e.scope === "none" ? [] : [{ bearer: [] }],
        ...(e.scope && e.scope !== "none" ? { "x-scope": e.scope } : {}),
        parameters: e.params ?? [],
        responses,
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: { title: "SKEELZ site API", version, description: "SKEELZ Connect (docs/connect-api.md). Keys: `Authorization: Bearer sk_site_…`." },
    servers: [{ url: serverUrl }],
    paths,
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "An sk_site_ key issued at /admin/api" } },
      schemas: { Error: errorSchema },
      responses: { Error: { description: "Error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } } },
    },
  };
}

/** The deployed version: xhostd's sha when it provides one, else "dev". */
export function appVersion(): string {
  const sha = process.env.XHOST_SHA ?? process.env.XHOST_GIT_SHA ?? process.env.GIT_SHA ?? "";
  return sha ? sha.slice(0, 7) : "dev";
}
