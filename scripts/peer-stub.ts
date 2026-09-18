/**
 * A local stand-in for the other SKEELZ apps, for testing the site's outbound calls:
 *   crm   POST /api/v1/intake/applications (and the older /api/intake/applications)  Bearer $CRM_INTAKE_TOKEN
 *   admin GET  /api/v1/site/jobs  (serves src/data/fixture-jobs.json)               Bearer $SITE_FEED_TOKEN
 *   both  GET  /api/v1/ping       (answers as "crm" or "admin" by which token it got)
 * It answers like the real apps and keeps nothing: it logs field names and the file's size
 * only. Run `npm run stub:peers` and point CRM_URL / ADMIN_API_URL at http://127.0.0.1:3299.
 * STUB_FAIL=503 makes every intake call fail.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT ?? 3299);
const TOKEN = process.env.CRM_INTAKE_TOKEN ?? "local-crm-token";
const FEED_TOKEN = process.env.SITE_FEED_TOKEN ?? "local-feed-token";
const FAIL = Number(process.env.STUB_FAIL ?? 0);
const seen = new Map<string, { application_id: string; candidate_id: string }>();

const REQUIRED = ["site_application_id", "job_key", "job_title", "first_name", "last_name", "email", "phone", "consent"];

createServer(async (req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const error = (status: number, code: string, message: string) => send(status, { error: { code, message } });

  const auth = req.headers.authorization;
  if (req.method === "GET" && req.url === "/api/v1/ping") {
    const app = auth === `Bearer ${TOKEN}` ? "crm" : auth === `Bearer ${FEED_TOKEN}` ? "admin" : null;
    if (!app) return error(401, "unauthorized", "bad token");
    return send(200, { app, version: "stub", time: new Date().toISOString(), key: { name: `stub ${app} key`, scopes: app === "crm" ? ["intake:write"] : ["site-feed:read"] } });
  }
  if (req.method === "GET" && req.url === "/api/v1/site/jobs") {
    if (auth !== `Bearer ${FEED_TOKEN}`) return error(401, "unauthorized", "bad token");
    const fixture = JSON.parse(readFileSync("src/data/fixture-jobs.json", "utf8")) as { data: unknown[] };
    console.log(`[peer-stub] feed served (${fixture.data.length} jobs)`);
    return send(200, { data: fixture.data, total: fixture.data.length, generated_at: new Date().toISOString() });
  }
  if (req.method !== "POST" || (req.url !== "/api/v1/intake/applications" && req.url !== "/api/intake/applications")) return error(404, "not_found", "no such route");
  if (auth !== `Bearer ${TOKEN}`) return error(401, "unauthorized", "bad token");
  if (FAIL) return error(FAIL, "stub_failure", "STUB_FAIL is set");

  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const form = await new Request("http://stub", { method: "POST", headers: { "content-type": req.headers["content-type"] ?? "" }, body: Buffer.concat(chunks) })
    .formData()
    .catch(() => null);
  if (!form) return error(400, "bad_request", "not multipart");

  const missing = REQUIRED.filter((k) => !form.get(k));
  const cv = form.get("cv");
  if (missing.length) return error(400, "missing_fields", `missing: ${missing.join(",")}`);
  if (form.get("consent") !== "true") return error(400, "no_consent", "consent must be true");
  if (!(cv instanceof Blob) || cv.size === 0) return error(400, "missing_cv", "cv is required");
  if (cv.size > 5 * 1024 * 1024) return error(413, "too_large", "cv over 5MB");

  const id = String(form.get("site_application_id"));
  console.log(`[peer-stub] ${id} job=${form.get("job_key")} fields=[${[...form.keys()].join(",")}] cv=${cv.type} ${cv.size}B`);
  const prior = seen.get(id);
  if (prior) return send(200, prior);
  const created = { application_id: `app_${randomUUID().slice(0, 8)}`, candidate_id: `cand_${randomUUID().slice(0, 8)}` };
  seen.set(id, created);
  send(201, created);
}).listen(PORT, "127.0.0.1", () => console.log(`[peer-stub] listening on http://127.0.0.1:${PORT}`));
