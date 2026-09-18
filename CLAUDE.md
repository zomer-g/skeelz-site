# SKEELZ site (skeelz-site)

A replica of the public job board https://jobs.skeelz.co.il (Hebrew, RTL), built with its own admin/CMS so it can one day
replace the current site. **For now the whole app is an admin-only preview.** The admin/dashboard app is a separate repo
(`C:\Users\zomer\CLAUDE CODE\Skeelz`); this app reads its job feed and never writes to it.

## CV RULE — the owner's explicit requirement (do not weaken)
The site keeps **only basic user details**. **A CV is never stored by this app — not in the DB, not on disk, not in S3 /
blob storage, not in logs, not in the audit log.** It is only forwarded to the CRM. If this app were breached, no CV could
be reached.
- The apply action (`src/app/job/[id]/actions.ts`) reads the file into memory, checks it (`src/lib/apply/validate.ts`:
  pdf/doc/docx by magic bytes, ≤ 5 MB), forwards it as multipart (`src/lib/apply/crm.ts`) and lets it go with the request.
  The part is sent as `cv.<ext>`; the visitor's file name is not kept or forwarded.
- Stored: the profile (`profiles`, upsert by email: name, email, phone, city, consent time) and one `applications` row
  (site_application_id, job_key, job_title, profile, status forwarded/failed, CRM ids, error code). **No file name, no
  hash, no size, no content.** Don't add columns that describe the file.
- Logs carry status codes only. Never log a FormData, a File, or the action's arguments.
- The admin view (`/admin/applications`) shows those fields only. There is no CV view and there must not be one.
- No blob storage, no temp files, no upload route. `serverActions.bodySizeLimit` (6mb) exists only for this form.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Drizzle ORM + pg · jose · sanitize-html. Same patterns as the
admin app. Hosted on xhostd (template `app`: `install.sh` builds, `launch.sh` migrates + `next start`; no worker).
Exact-pinned dependencies.

## Commands
- `npm run db:local` — PGlite on 127.0.0.1:**5435** (leave running) · `npm run db:migrate:local`
- `npm run dev` — `next dev -p 3202` (`.env.local`: `DATABASE_URL`, `DEV_AUTH_EMAIL`, `ADMIN_EMAILS`). One dev server per
  `.next`; don't run tsx scripts against PGlite while dev is up.
- `npm run stub:crm` — a local CRM intake stub on :3299 (set `CRM_URL=http://127.0.0.1:3299`, `CRM_INTAKE_TOKEN=local-crm-token`)
- `npm run typecheck` · `npm run build`
- `npm run db:generate` after editing `src/lib/db/schema.ts` (commit `drizzle/`)
- `npm run snapshot:ref` refreshes `src/data/ref.json` (skills, locations + districts from the live site's API);
  `npm run snapshot:fixture` refreshes `src/data/fixture-jobs.json`. Commit both.

## Rules that matter
- **Access:** identity = xhostd SSO cookie `__Host-xhost_id` verified in `src/lib/auth/xhost.ts` (audiences from
  `XHOST_AUTH_AUDIENCES`). While in preview, **every page** — the public-looking ones, privacy and accessibility
  included — calls `pageAuth(path)` and only `ADMIN_EMAILS` get in; everyone else gets the sign-in / refusal screen (200).
  Every server action calls `requireAdmin()`. `src/proxy.ts` only 401s `/api/*` (except `/api/health`). Never rely on a layout.
  At launch: drop the gate on the public pages (list, job, about, privacy, accessibility, signup, apply) and keep it on `/admin`.
- **Preview markers:** fixed bar "תצוגה מקדימה — גלוי לאדמין בלבד" on every page (`PreviewBar` in the root layout);
  `robots.txt` disallows all; `<meta name="robots" content="noindex">` and `X-Robots-Tag`. **No GA, no GTM.**
- **CSP same-origin** (`next.config.ts`): fonts (next/font Rubik), logos and icons are self-hosted; the feed and the CRM are
  called from the server only. Keep it that way.
- **Jobs** come from the admin app's feed: `GET ${ADMIN_API_URL}/api/v1/site/jobs`, `Authorization: Bearer ${SITE_FEED_TOKEN}`
  (`src/lib/jobs/feed.ts`): server-side only, in memory for 2 minutes, the last good copy on error. Without `ADMIN_API_URL`
  the committed fixture is used (local dev only). `id` is the 24-hex site key; `/job/<id>` keeps the live URLs for SEO.
- **`description_html` is untrusted.** Render it only through `sanitizeDescription()` (`src/lib/jobs/sanitize.ts`,
  allow-list p, br, ul, ol, li, strong, b, em, u, h2–h4, a[href https|mailto]).
- **Filters** use the live site's URL parameters (`searchValue`, `district`, `city`, `skills`, `scope`; comma lists).
  District comes from `city_symbol` via `ref.json`; national/remote jobs (symbols -1/-2, "כל הארץ") match any district.
  Order: admin-pinned jobs first, then newest.
- **Apply → CRM:** `POST ${CRM_URL}/api/intake/applications`, Bearer `CRM_INTAKE_TOKEN`, multipart fields exactly
  `site_application_id` (uuid, the idempotency key — rendered with the form so a retry reuses it), `job_key`, `job_title`,
  `first_name`, `last_name`, `email`, `phone`, `city`, `consent`="true", `cv`. 201/200 → `{application_id, candidate_id}`;
  errors `{error:{code,message}}`. Timeout 20 s. Any failure → a Hebrew error, nothing about the CV kept. Rate limit per IP
  (10 / 10 min, in memory). The form says "סביבת בדיקה — ההגשה נשלחת למערכת הבדיקה בלבד".
- **CMS (`/admin`):** editable texts (`src/lib/texts/registry.ts`: home hero, about, footer links, privacy, accessibility) with
  versions and restore, rendered by `<RichText>` — a small safe format, never raw HTML; pinned jobs; banners (text,
  optional https or /path link, date range, active); sandbox applications; audit log of every admin change (`writeAudit`).
- **Design:** tokens in `src/app/globals.css` (brand magenta `#CD0077` CTAs, teal `#218283` title panels alternating with
  light teal `#84C2C1`, hot `#FEC84B`, pill controls 48px, cards 20px, modal 30px, black footer). Rubik only — **not EzerLoft**
  (the live site's display font). Logical CSS only (`ms-*`, `start-*`, `text-start`), never left/right.
- **Accessibility (IS 5568 = WCAG 2.1 AA, legally required):** text ≥ 4.5:1, field borders ≥ 3:1 (`field` token, not the live
  site's lighter grey), one h1 per page, labelled fields with errors in `aria-describedby`, results in an always-mounted
  `role="status"`, repeated link text gets sr-only context, new-tab links say so, skip link.
- **Mobile:** every page works at 320–375px with no sideways page scroll; tables become cards on phones (`Table`).
- Secrets only via xhostd `set_env(secret=true)`; never log them or send them to the client.
- No server-side redirects to absolute URLs (behind xhostd the server doesn't know its public host).

@AGENTS.md
