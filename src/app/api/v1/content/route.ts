import { apiJson, withApiKey } from "@/lib/api/inbound";
import { loadActiveBanners, loadPins } from "@/lib/cms";
import { TEXTS } from "@/lib/texts/registry";
import { loadText } from "@/lib/texts/store";

export const dynamic = "force-dynamic";

/** content:read — the editable texts as they show now, the pinned job keys in order, and the banners showing now. */
export const GET = withApiKey("GET /api/v1/content", "content:read", async () => {
  const [texts, pins, banners] = await Promise.all([
    Promise.all(TEXTS.map(async (t) => ({ t, stored: await loadText(t.key) }))),
    loadPins(),
    loadActiveBanners(),
  ]);
  return apiJson({
    texts: texts.map(({ t, stored }) => ({ key: t.key, title: t.title, path: t.path, body: stored.body, updated_at: stored.updatedAt?.toISOString() ?? null })),
    pins: pins.map((p) => ({ job_key: p.jobKey, position: p.position })),
    banners: banners.map((b) => ({
      id: b.id,
      text: b.text,
      link_url: b.linkUrl,
      link_label: b.linkLabel,
      starts_at: b.startsAt?.toISOString() ?? null,
      ends_at: b.endsAt?.toISOString() ?? null,
    })),
    generated_at: new Date().toISOString(),
  });
});
