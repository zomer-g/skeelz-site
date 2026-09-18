import { apiJson, withApiKey } from "@/lib/api/inbound";
import { appVersion } from "@/lib/api/spec";
import { APP } from "@/lib/connect/keys";

export const dynamic = "force-dynamic";

/** Any valid key: which app this is, its version, and what the calling key may do. */
export const GET = withApiKey("GET /api/v1/ping", null, async (_req, key) =>
  apiJson({ app: APP, version: appVersion(), time: new Date().toISOString(), key: { name: key.name, scopes: key.scopes } }),
);
