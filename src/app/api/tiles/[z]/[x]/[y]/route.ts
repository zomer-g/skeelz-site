import { AuthError, requireUser } from "@/lib/auth/session";
import { logError } from "@/lib/log";

/**
 * Map tiles for /map, served from this origin so the CSP stays same-origin and a visitor's
 * browser never talks to a third party: the server fetches the OpenStreetMap tile and keeps
 * it in memory. Only tiles over Israel and zoom 7–17 are served, so this is not an open relay.
 * The page shows the "© OpenStreetMap" attribution the tile licence requires.
 */

const UPSTREAM = "https://tile.openstreetmap.org";
// OSM's tile policy asks for a User-Agent that identifies the app.
const USER_AGENT = "skeelz-site/0.1 (job map preview; guy@skeelz.co.il)";
const MIN_Z = 7;
const MAX_Z = 17;
// Israel with a margin — the map's maxBounds (JobsMap) plus a tile's worth: lat 28.5–34.3, lng 33.0–37.1.
const BOUNDS = { south: 28.5, north: 34.3, west: 33.0, east: 37.1 };
const MAX_CACHED = 1500;
const TTL_MS = 7 * 24 * 3600_000;

interface Tile {
  body: ArrayBuffer;
  at: number;
}

const g = globalThis as typeof globalThis & { __skeelzTiles?: Map<string, Tile> };
const cache = (g.__skeelzTiles ??= new Map());

const lngToX = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);
const latToY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

function inBounds(z: number, x: number, y: number): boolean {
  if (!Number.isSafeInteger(z) || z < MIN_Z || z > MAX_Z) return false;
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return false;
  return x >= lngToX(BOUNDS.west, z) && x <= lngToX(BOUNDS.east, z) && y >= latToY(BOUNDS.north, z) && y <= latToY(BOUNDS.south, z);
}

const png = (body: ArrayBuffer) =>
  new Response(body, { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" } });

export async function GET(_req: Request, ctx: RouteContext<"/api/tiles/[z]/[x]/[y]">) {
  try {
    await requireUser("editor");
  } catch (err) {
    if (err instanceof AuthError) return Response.json({ error: "unauthorized" }, { status: err.status });
    throw err;
  }

  const { z: zs, x: xs, y: ys } = await ctx.params;
  const z = Number(zs);
  const x = Number(xs);
  const y = Number(ys.replace(/\.png$/, ""));
  if (!inBounds(z, x, y)) return new Response(null, { status: 404 });

  const key = `${z}/${x}/${y}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    // Re-insert so the map's order is least-recently-used first.
    cache.delete(key);
    cache.set(key, hit);
    return png(hit.body);
  }

  try {
    const res = await fetch(`${UPSTREAM}/${key}.png`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) return new Response(null, { status: 502 });
    const body = await res.arrayBuffer();
    if (body.byteLength > 1024 * 1024) return new Response(null, { status: 502 });
    cache.set(key, { body, at: Date.now() });
    while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
    return png(body);
  } catch (err) {
    logError("tiles: upstream", err);
    if (hit) return png(hit.body);
    return new Response(null, { status: 502 });
  }
}
