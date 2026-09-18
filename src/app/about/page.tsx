import type { Metadata } from "next";
import { TextPage } from "@/components/site/TextPage";
import { pageAuth } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "אודות" };
// Edited at /admin/texts; must show as soon as it is saved.
export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const auth = await pageAuth("/about");
  if (!auth.ok) return auth.render;
  return <TextPage textKey="about" showUpdated={false} />;
}
