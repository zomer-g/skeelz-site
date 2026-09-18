import { apiJson } from "@/lib/api/inbound";
import { appVersion, openApiDocument } from "@/lib/api/spec";

export const dynamic = "force-dynamic";

/** No key: the document describes the API and holds no data. The server URL is relative (the app can't know its public host). */
export async function GET() {
  return apiJson(openApiDocument("/", appVersion()));
}
