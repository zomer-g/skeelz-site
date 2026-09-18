# SKEELZ Connect — one API standard across the three apps

Apps:
- **admin**: `skeelz`, https://skeelz-zomerg.xhostd.app, repo `Skeelz`. Salesforce mirror and dashboard.
- **crm**: `skeelz-crm`, https://skeelz-crm-zomerg.xhostd.app.
- **site**: `skeelz-site`, https://skeelz-site-zomerg.xhostd.app.

Every app implements the same five parts. Copy this file into each repo as `docs/connect-api.md`, adapted where it says "per app".

> **This copy: site** (`skeelz-site`). Where the site sits in each part, and the readings chosen where the spec leaves room:
> - §1 Keys are `sk_site_…`, issued at `/admin/api`. The site has no legacy env tokens of its own. Code: `src/lib/connect/keys.ts`, gate `src/lib/api/inbound.ts` (`withApiKey`).
> - §2 Peers: `admin` (job feed, `GET /api/v1/site/jobs`) and `crm` (apply, `POST /api/v1/intake/applications`, retried once at the older `/api/intake/applications` if the CRM answers 404). A connection row that is switched off does not fall back to env. `/admin/connections` can remove a row to go back to env. Code: `src/lib/connect/client.ts` (`peerFetch`), `crypto.ts`.
> - §3 `GET /api/v1/ping`, `GET /api/v1/openapi.json` (relative server URL `/`), docs at `/api-docs` (any signed-in role). Spec object: `src/lib/api/spec.ts`. `version` = `XHOST_SHA` (or `XHOST_GIT_SHA` / `GIT_SHA`) short, else `dev`. `503 disabled` when env `API_DISABLED=true`.
> - §4 `GET /api/v1/content` (`content:read`): one object `{texts, pins, banners, generated_at}` — not a list, so no cursor. `GET /api/v1/applications?since=&limit=&cursor=` (`applications:read`): oldest first; the cursor is base64url of `created_at|id`.
> - §5 Roles editor < admin; users have `active` (true/false) as in the admin app, which is what "status" means here. No "view as" (optional, skipped).

## 1. API keys, issued in the UI (inbound)
- **Screen:** new admin screen `/admin/api` ("API ומפתחות"), admin role only. It creates, lists and revokes keys.
- **Table `api_keys`:**
  - id (uuid)
  - name — who it is for, e.g. "site → crm"
  - `prefix` — the first 8 characters after `sk_<app>_`, shown in lists
  - `hash` — sha256 of the full key, hex
  - `scopes text[]`
  - created_by, created_at
  - expires_at (nullable), last_used_at, last_used_ip, revoked_at
- **Key format:** `sk_<app>_<43 chars base64url of 32 random bytes>`.
  - Shown exactly once on creation, with a copy button.
  - Never stored in plain text and never logged.
- **Verification:**
  - Read from `Authorization: Bearer <key>` only. A key in the URL gets 400 `token_in_url`.
  - Look up by sha256 hash.
  - Compare in constant time.
  - Reject revoked or expired keys.
  - Check the route's scope: 403 `insufficient_scope`.
  - Update last_used at most once a minute.
- **Env tokens that already exist keep working as legacy keys**, so nothing breaks:
  - admin: `API_TOKEN` / `API_TOKEN_PREVIOUS` get scopes `jobs:read metrics:read`; `SITE_FEED_TOKEN` gets `site-feed:read`.
  - crm: `CRM_INTAKE_TOKEN` (+ `_PREVIOUS`) gets `intake:write`.
  - The screen lists them as "מפתח מהגדרות השרת (env)" and they cannot be revoked in the UI.
- **Rate limits and lockout:** the in-memory limits each app already has, now per key (bucket = key id).
- **Audit:** `api_key.created`, `api_key.revoked`, `api.denied` (throttled), `api.used` (first use per hour per key).

## 2. Connections to the other apps (outbound)
- **Screen:** `/admin/connections` ("חיבורים"), admin only. One row per peer app: base URL, the key that peer issued to us, enabled on/off.
- **Table `connections`:**
  - peer (`admin` | `crm` | `site`), base_url
  - key_ciphertext, key_last4
  - enabled, updated_by, updated_at
  - last_check_at, last_check_ok, last_check_detail
- **Key storage:** encrypted with AES-256-GCM.
  - The encryption key is env `CONNECT_SECRET_KEY` (secret, 64 hex = 32 bytes, already set on all three apps).
  - Format `v1:<iv b64url>:<tag b64url>:<ct b64url>`.
  - Never sent back to the browser. The form shows only `••••last4`; an empty field means "keep".
- **base_url:** must be `https://` (or `http://localhost` in dev) with no path, query or credentials, to avoid SSRF.
- **"בדיקת חיבור" button:** calls the peer's `GET /api/v1/ping` with a 5s timeout. Shows the peer app, its version and the scopes our key has there, and stores last_check_*.
- **Fallback:** when no DB row exists for a peer, the connection comes from the existing env, so today's wiring keeps working:
  - site → admin: `ADMIN_API_URL` + `SITE_FEED_TOKEN`
  - site → crm: `CRM_URL` + `CRM_INTAKE_TOKEN`
- **One helper:** `src/lib/connect/client.ts` → `peerFetch(peer, path, init)`. It resolves the connection (DB first, then env), sets the Bearer header, applies the timeout, returns parsed JSON or throws a typed error, and never logs the key. Every cross-app call goes through it.

## 3. Common API contract
- **Paths:** all under `/api/v1/`. JSON UTF-8, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
- **Errors:** always `{"error":{"code":"snake_case","message":"..."}}`. Codes:
  - 400 invalid / token_in_url
  - 401 unauthorized
  - 403 insufficient_scope
  - 404 not_found
  - 413, 415, 429 (with Retry-After)
  - 503 disabled
- **Lists:** `?limit=` (1–200, default 50) and `?cursor=` (opaque), returning `{data:[...], next_cursor|null}`. Existing endpoints keep their current shape (additive only).
- **Rate limit headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- **`GET /api/v1/ping`:** any valid key. Returns `{"app":"admin|crm|site","version":"<git sha short or XHOST_SHA>","time":ISO,"key":{"name","scopes"}}`.
- **`GET /api/v1/openapi.json`:** no auth needed (it holds no data). An OpenAPI 3.1 document of that app's endpoints, generated from one TS spec object, the same source as the docs page.
- **Docs page** `/api-docs` (signed-in staff): human docs from the same spec, including the scopes table and curl examples with `<KEY>` placeholders.
- **Personal data:** no endpoint returns candidate names, emails, phones or files unless this spec lists the scope explicitly. The admin app's rule (jobs, statuses, ids, aggregates only) stays.

## 4. Scopes per app
**admin**
- `jobs:read` — existing /api/v1/jobs, /jobs/:id
- `metrics:read` — existing /api/v1/metrics
- `site-feed:read` — existing /api/v1/site/jobs

**crm**
- `intake:write` — existing POST /api/v1/intake/applications. Also keep the current path `/api/intake/applications` as an alias.
- `jobs:read` — GET /api/v1/jobs: jobs with status, site_job_key, flags; no contacts.
- `applications:read` — GET /api/v1/applications?since=ISO: id, job id, site_job_key, status, status_changed_at, source, site_application_id. No candidate personal data.
- `applications:status:read` — GET /api/v1/applications/by-site-id/:site_application_id. The status of one application the site forwarded, so the site can show "נשלחה / בטיפול".

**site**
- `content:read` — GET /api/v1/content: current editable texts, pins and active banners.
- `applications:read` — GET /api/v1/applications?since=: site_application_id, job_key, created_at, forward status, crm_application_id. No profile fields.

## 5. User management (crm and site; admin already has it)
- **Copy the admin app's model and screens:**
  - Tables `users` (sub, email, name, role, status), `invites` (email, role, expires, created_by) and `access_requests` (refused sign-ins).
  - Invite redeemed on first sign-in, keyed by `sub`.
  - `ADMIN_EMAILS` stays the bootstrap super-admin and cannot be demoted or removed in the UI.
  - Screens `/admin/users`: list, invite, change role, suspend, reactivate, pending access requests with approve/dismiss.
  - Audit of every change.
  - Reference implementation: the admin app `src/lib/auth/session.ts`, `src/lib/auth/roles.ts`, `src/app/(app)/admin/users/*`.
- **Roles:**
  - **crm:** viewer (read everything) < recruiter (edit records, change statuses, tasks) < admin (users, API keys, connections, seed).
  - **site:** editor (texts, pins, banners) < admin (users, API keys, connections, applications view).
  - Every page and action checks the role on the server.
- **Admin "view as" a lower role** (like the admin app): nice to have, only if cheap.
- The site stays invisible to anyone without a role, as before.

## Amendments (security review, all three apps)
- **C1 base_url / SSRF:** production allows `https:` only; development also `http://localhost:<port>` and `http://127.0.0.1:<port>`. Refused: IP-literal hosts (checked with `net.isIP` after parsing, so `0x7f000001` etc. count; bracketed IPv6 too), `localhost`, `*.localhost`, `*.local`, `*.internal`, `*.lan`, single-label names, credentials, any path but `/`, a query or a fragment. Checked on save and again before every request; in production each request also resolves the host (`dns.lookup`, all addresses) and refuses loopback, private, link-local, CGNAT, unspecified, ULA, multicast and IPv4-mapped forms of those. Codes `invalid_base_url` / `blocked_address`. `redirect: "error"` and the timeout stay.
- **C2:** saving a new origin requires the key again; the old ciphertext is never kept for a new address.
- **C3:** AES-256-GCM with `authTagLength: 16`, a 12-byte IV and a 16-byte tag enforced, the peer name as AAD, format `v2:`. `v1` values are invalid ("re-enter the key").
- **C4:** besides the named parameters, any query value starting with `sk_` gets 400 `token_in_url`.
- **C5:** the key is checked first; a valid key is never refused by an address lockout. `locked_out` applies only to a missing or invalid key. The address `unknown` is never locked out or counted; it gets only the per-key limits.
- **C6:** peer responses are capped (Content-Length checked, then a counted stream): 5 MB by default. Site: the job feed may use 10 MB, and `parse()` also caps it at 5,000 jobs and 100,000 characters of `description_html` each.
- **C7:** no drizzle/pg `.message` (it carries SQL parameters: names, emails, phones) is ever logged. One helper, `logError(where, err)` (`src/lib/log.ts` here), logs the place and a code only: our typed error's code, the pg SQLSTATE, or `err.name`. Never log request bodies or FormData.
- **Site only:** M2 — the apply/sign-up forms are unauthenticated, so profiles are insert-only and each application row keeps a snapshot of what that submission said (shown at `/admin/applications`). L3 — a failed lookup of the `crm` connection fails closed (no env fallback on the CV path). L6 — Word files with `vbaProject.bin` or a `macroEnabled` content type are refused (a renamed `.docm` too). L7 — RichText site paths use `/^\/(?![\/\])/`.
