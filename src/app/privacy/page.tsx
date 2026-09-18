import type { Metadata } from "next";
import { TextPage } from "@/components/site/TextPage";
import { pageAuth } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "מדיניות פרטיות" };
// Edited at /admin/texts; must show as soon as it is saved.
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const auth = await pageAuth("editor", "/privacy");
  if (!auth.ok) return auth.render;
  return <TextPage textKey="privacy" showUpdated={true} />;
}
