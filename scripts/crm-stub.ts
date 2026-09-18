/**
 * A local stand-in for the CRM's intake endpoint, for testing the apply form:
 *   POST /api/intake/applications   (multipart, Authorization: Bearer $CRM_INTAKE_TOKEN)
 * It checks the fields and the token, answers like the CRM (201, 200 on a repeated
 * site_application_id, {error:{code,message}} otherwise) and keeps nothing: it logs
 * the field names and the file's size only. Run `npm run stub:crm` and set
 * CRM_URL=http://127.0.0.1:3299 in .env.local. STUB_FAIL=503 makes every call fail.
 */
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT ?? 3299);
const TOKEN = process.env.CRM_INTAKE_TOKEN ?? "local-crm-token";
const FAIL = Number(process.env.STUB_FAIL ?? 0);
const seen = new Map<string, { application_id: string; candidate_id: string }>();

const REQUIRED = ["site_application_id", "job_key", "job_title", "first_name", "last_name", "email", "phone", "consent"];

createServer(async (req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const error = (status: number, code: string, message: string) => send(status, { error: { code, message } });

  if (req.method !== "POST" || req.url !== "/api/intake/applications") return error(404, "not_found", "no such route");
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return error(401, "unauthorized", "bad token");
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
  console.log(`[crm-stub] ${id} job=${form.get("job_key")} fields=[${[...form.keys()].join(",")}] cv=${cv.type} ${cv.size}B`);
  const prior = seen.get(id);
  if (prior) return send(200, prior);
  const created = { application_id: `app_${randomUUID().slice(0, 8)}`, candidate_id: `cand_${randomUUID().slice(0, 8)}` };
  seen.set(id, created);
  send(201, created);
}).listen(PORT, "127.0.0.1", () => console.log(`[crm-stub] listening on http://127.0.0.1:${PORT}`));
