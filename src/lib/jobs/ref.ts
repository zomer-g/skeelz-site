import ref from "@/data/ref.json";

/**
 * Skills and locations from the live site, committed as src/data/ref.json and
 * refreshed with `npm run snapshot:ref`. The feed carries skill ids and a city
 * symbol; this names the skills and puts the city in a district.
 */

export interface Location {
  citySymbol: number;
  city: string;
  district: string | null;
}

/** "כל הארץ": national and work-from-home jobs (city symbols -1 and -2). */
export const NATIONWIDE = "כל הארץ";

const skillNames = new Map(ref.skills.map((s) => [s.id, s.name]));
const bySymbol = new Map<number, Location>((ref.locations as Location[]).map((l) => [l.citySymbol, l]));
const byCity = new Map<string, Location>((ref.locations as Location[]).map((l) => [normalizeCity(l.city), l]));

function normalizeCity(city: string): string {
  return city.trim().replace(/[\s־–-]+/g, " ");
}

export const SKILLS: { id: string; name: string }[] = [...ref.skills].sort((a, b) => a.name.localeCompare(b.name, "he"));

/** The districts a visitor can filter by, in the live site's order ("כל הארץ" is not one of them). */
export const DISTRICTS: string[] = ref.districts.filter((d) => d !== NATIONWIDE);

export const skillName = (id: string): string | null => skillNames.get(id) ?? null;

/** Where a job is: by city symbol, else by city name. */
export function locate(citySymbol: number | null, city: string | null): Location | null {
  if (citySymbol != null && bySymbol.has(citySymbol)) return bySymbol.get(citySymbol)!;
  if (city) return byCity.get(normalizeCity(city)) ?? null;
  return null;
}

/** Job scope codes as the live site names them; an unknown value is shown as it came. */
const SCOPE_LABELS: Record<string, string> = {
  FullTime: "משרה מלאה",
  PartialTime: "משרה חלקית",
};

export const scopeLabel = (code: string): string => SCOPE_LABELS[code] ?? code;
