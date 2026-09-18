/**
 * Refreshes src/data/ref.json — the skills and locations the live site
 * (jobs.skeelz.co.il) uses, so the replica can name a job's skills and put its
 * city in a district. Run with `npm run snapshot:ref` and commit the result.
 *
 *   /api/skills                   → {data:{skills:[{_id,name}]}}
 *   /api/locations-and-districts  → {data:{locations:[{citySymbol,city}], districts:[…]}}
 *   /api/locations                → {data:[{citySymbol,city,district,…}]}  (the only one with each city's district)
 */
import { writeFileSync } from "node:fs";

const BASE = "https://jobs.skeelz.co.il/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function main() {
  const skills = await get<{ data: { skills: { _id: string; name: string }[] } }>("skills");
  const both = await get<{ data: { locations: { citySymbol: number; city: string }[]; districts: string[] } }>("locations-and-districts");
  const withDistrict = await get<{ data: { citySymbol: number; city: string; district?: string }[] }>("locations");

  const districtBySymbol = new Map(withDistrict.data.map((l) => [l.citySymbol, l.district ?? null]));
  const locations = both.data.locations
    .map((l) => ({ citySymbol: l.citySymbol, city: l.city.trim(), district: districtBySymbol.get(l.citySymbol) ?? null }))
    .sort((a, b) => a.citySymbol - b.citySymbol);

  const out = {
    source: "https://jobs.skeelz.co.il",
    generated_at: new Date().toISOString(),
    skills: skills.data.skills.map((s) => ({ id: s._id, name: s.name.trim() })),
    districts: both.data.districts,
    locations,
  };
  writeFileSync("src/data/ref.json", JSON.stringify(out, null, 1) + "\n");
  const missing = locations.filter((l) => !l.district).length;
  console.log(`[snapshot:ref] ${out.skills.length} skills, ${out.districts.length} districts, ${locations.length} locations (${missing} without a district)`);
}

main().catch((err: Error) => {
  console.error("[snapshot:ref] FAILED:", err.message);
  process.exit(1);
});
