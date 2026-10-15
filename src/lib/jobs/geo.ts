import geo from "@/data/geo.json";
import ref from "@/data/ref.json";
import type { Location } from "./ref";

/**
 * Where each locality is, for the job map. src/data/geo.json holds the CBS point layer
 * (one point per locality symbol, WGS84) — the feed's city_symbol is that same symbol.
 * Industrial parks the CBS layer has no point for are added by hand below when a live
 * job uses one. Regional councils, "עבודה מהבית" and "פריסה ארצית" have no point: the
 * map lists those jobs under a separate toggle instead.
 */

export type LatLng = [lat: number, lng: number];

// Not in the CBS point layer. Approximate centre of the park.
const EXTRA: Record<number, LatLng> = {
  1729: [31.9895, 34.9365], // פארק תעשיה חבל מודיעים (by Shoham)
};

const points = new Map<number, LatLng>();
for (const p of geo.points.split(";")) {
  const [code, ll] = p.split(":");
  const [lat, lng] = ll.split(",").map(Number);
  points.set(Number(code), [lat, lng]);
}
for (const [code, ll] of Object.entries(EXTRA)) points.set(Number(code), ll);

export function coordsOf(citySymbol: number | null): LatLng | null {
  return citySymbol != null && citySymbol > 0 ? (points.get(citySymbol) ?? null) : null;
}

/** Localities a visitor can pick as the centre, by name: [symbol, name, lat, lng]. */
export function placeOptions(): [number, string, number, number][] {
  const seen = new Set<string>();
  const out: [number, string, number, number][] = [];
  for (const l of ref.locations as Location[]) {
    const ll = coordsOf(l.citySymbol);
    const name = l.city.trim();
    if (!ll || seen.has(name)) continue;
    seen.add(name);
    out.push([l.citySymbol, name, ll[0], ll[1]]);
  }
  return out.sort((a, b) => a[1].localeCompare(b[1], "he"));
}
