"use client";

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type * as L from "leaflet";
import { buttonClass, fieldClass } from "../ui";

/** One job as the map page needs it (no description). */
export interface MapJob {
  id: string;
  title: string;
  company: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  /** "עבודה מהבית" / "פריסה ארצית": open to anyone, wherever they live. */
  nationwide: boolean;
  skills: string[];
  scopes: string[];
  hot: boolean;
  sponsored: boolean;
  /** Position among the admin's pinned jobs, or null. */
  pin: number | null;
  published: string | null;
}

type Place = [symbol: number, name: string, lat: number, lng: number];

interface Center {
  lat: number;
  lng: number;
  label: string;
  /** Set when the centre is a locality — only that goes in the URL. */
  symbol: number | null;
}

const RADII = [5, 10, 20, 30, 50, 75, 100, 150];
const DEFAULT_RADIUS = 20;
const PAGE = 30;
// Israel, for the first view.
const ISRAEL: L.LatLngBoundsExpression = [
  [29.45, 34.25],
  [33.35, 35.9],
];

const SCOPE_LABELS: Record<string, string> = { FullTime: "משרה מלאה", PartialTime: "משרה חלקית" };

/** Great-circle distance in km. */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const jobsCount = (n: number) => (n === 1 ? "משרה אחת" : `${n} משרות`);
const fmtKm = (km: number) => (km < 1 ? "פחות מק״מ" : `${Math.round(km)} ק״מ`);
const time = (iso: string | null) => (iso ? Date.parse(iso) || 0 : 0);
const fmtDate = (iso: string | null) =>
  iso && time(iso)
    ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Asia/Jerusalem" }).format(time(iso))
    : "—";

interface Row {
  job: MapJob;
  km: number | null;
}

export function JobsMap({
  jobs,
  places,
  skills,
  initial,
}: {
  jobs: MapJob[];
  places: Place[];
  skills: { id: string; name: string }[];
  initial: { city: number | null; radius: number | null; skills: string[]; remote: boolean };
}) {
  const ids = useId();
  const byName = useMemo(() => new Map(places.map((p) => [p[1], p])), [places]);
  const bySymbol = useMemo(() => new Map(places.map((p) => [p[0], p])), [places]);
  const skillName = useMemo(() => new Map(skills.map((s) => [s.id, s.name])), [skills]);

  const initialPlace = initial.city != null ? bySymbol.get(initial.city) : undefined;
  const [center, setCenter] = useState<Center | null>(
    initialPlace ? { lat: initialPlace[2], lng: initialPlace[3], label: initialPlace[1], symbol: initialPlace[0] } : null,
  );
  const [placeText, setPlaceText] = useState(initialPlace?.[1] ?? "");
  const [placeError, setPlaceError] = useState("");
  const [radius, setRadius] = useState(initial.radius && RADII.includes(initial.radius) ? initial.radius : DEFAULT_RADIUS);
  const [chosenSkills, setChosenSkills] = useState<string[]>(initial.skills.filter((s) => skillName.has(s)));
  const [remote, setRemote] = useState(initial.remote);
  const [geoState, setGeoState] = useState<"idle" | "busy" | "error" | "denied">("idle");
  const [show, setShow] = useState(PAGE);

  // Skills that appear in at least one job, so the filter offers only what can match.
  const skillOptions = useMemo(() => {
    const used = new Set(jobs.flatMap((j) => j.skills));
    return skills.filter((s) => used.has(s.id) || chosenSkills.includes(s.id));
  }, [jobs, skills, chosenSkills]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const job of jobs) {
      if (chosenSkills.length && !job.skills.some((s) => chosenSkills.includes(s))) continue;
      if (job.nationwide) {
        if (remote) out.push({ job, km: null });
        continue;
      }
      if (!center) {
        out.push({ job, km: null });
        continue;
      }
      if (job.lat == null || job.lng == null) continue;
      const km = distanceKm(center, { lat: job.lat, lng: job.lng });
      if (km <= radius) out.push({ job, km });
    }
    return out.sort((a, b) => {
      // With a centre: nearest first, nationwide jobs after the local ones. Without: pinned, then newest.
      if (center && a.km !== b.km) return (a.km ?? Infinity) - (b.km ?? Infinity);
      const pa = a.job.pin ?? Infinity;
      const pb = b.job.pin ?? Infinity;
      if (pa !== pb) return pa - pb;
      return time(b.job.published) - time(a.job.published);
    });
  }, [jobs, chosenSkills, remote, center, radius]);

  const local = rows.filter((r) => !r.job.nationwide).length;
  const unplaced = center ? 0 : rows.filter((r) => !r.job.nationwide && r.job.lat == null).length;

  // Keep the shareable part of the state in the URL (never a visitor's own location).
  useEffect(() => {
    const q = new URLSearchParams();
    if (center?.symbol != null) q.set("city", String(center.symbol));
    if (center && radius !== DEFAULT_RADIUS) q.set("radius", String(radius));
    if (chosenSkills.length) q.set("skills", chosenSkills.join(","));
    if (!remote) q.set("remote", "0");
    const url = `/map${q.size ? `?${q}` : ""}`;
    if (url !== `${location.pathname}${location.search}`) history.replaceState(history.state, "", url);
  }, [center, radius, chosenSkills, remote]);

  useEffect(() => setShow(PAGE), [center, radius, chosenSkills, remote]);

  function choosePlace(text: string) {
    setPlaceText(text);
    const p = byName.get(text.trim());
    if (p) {
      setPlaceError("");
      setCenter({ lat: p[2], lng: p[3], label: p[1], symbol: p[0] });
    }
  }

  function confirmPlace() {
    if (!placeText.trim()) {
      setPlaceError("");
      return;
    }
    if (!byName.has(placeText.trim())) setPlaceError("לא מצאנו יישוב בשם הזה. בחרו יישוב מהרשימה.");
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setGeoState("error");
      return;
    }
    setGeoState("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoState("idle");
        setPlaceText("");
        setPlaceError("");
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "המיקום שלי", symbol: null });
      },
      (err) => setGeoState(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 },
    );
  }

  function toggleSkill(id: string) {
    setChosenSkills((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]));
  }

  function reset() {
    setCenter(null);
    setPlaceText("");
    setPlaceError("");
    setRadius(DEFAULT_RADIUS);
    setChosenSkills([]);
    setRemote(true);
  }

  const status = center
    ? `${jobsCount(local)} במרחק עד ${radius} ק״מ מ${center.label}${remote && rows.length > local ? `, ועוד ${rows.length - local} מהבית או בפריסה ארצית` : ""}`
    : `${jobsCount(rows.length)}${chosenSkills.length ? " שמתאימות לכישורים שנבחרו" : ""} — בחרו מקום ורדיוס כדי לראות משרות בקרבתכם`;

  return (
    <div>
      <section aria-labelledby={`${ids}-controls`} className="rounded-card border-2 border-line bg-surface p-4 sm:p-6">
        <h2 id={`${ids}-controls`} className="sr-only">
          חיפוש לפי מיקום וכישורים
        </h2>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
          <div className="min-w-0">
            <label htmlFor={`${ids}-place`} className="mb-1 block font-medium">
              מאיפה למדוד?
            </label>
            <input
              id={`${ids}-place`}
              list={`${ids}-places`}
              value={placeText}
              onChange={(e) => choosePlace(e.target.value)}
              onBlur={confirmPlace}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmPlace();
                }
              }}
              placeholder="הקלידו יישוב, למשל באר שבע"
              autoComplete="off"
              aria-invalid={placeError ? true : undefined}
              aria-describedby={`${ids}-place-help${placeError ? ` ${ids}-place-err` : ""}`}
              className={`${fieldClass} w-full`}
            />
            <datalist id={`${ids}-places`}>
              {places.map((p) => (
                <option key={p[0]} value={p[1]} />
              ))}
            </datalist>
            <p id={`${ids}-place-help`} className="mt-1 text-sm text-muted">
              או השתמשו במיקום שלכם, או לחצו על נקודה במפה.
            </p>
            {placeError ? (
              <p id={`${ids}-place-err`} className="mt-1 text-sm text-danger">
                {placeError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <button type="button" onClick={useMyLocation} disabled={geoState === "busy"} className={buttonClass("secondary")}>
              {geoState === "busy" ? "מאתרים…" : "המיקום שלי"}
            </button>
            <p className="text-sm text-muted lg:max-w-56" role={geoState === "denied" || geoState === "error" ? "alert" : undefined}>
              {geoState === "denied"
                ? "הדפדפן לא אישר גישה למיקום. אפשר לבחור יישוב במקום."
                : geoState === "error"
                  ? "לא הצלחנו לאתר את המיקום. אפשר לבחור יישוב במקום."
                  : "המיקום נשאר בדפדפן ולא נשלח אלינו."}
            </p>
          </div>

          <div>
            <label htmlFor={`${ids}-radius`} className="mb-1 block font-medium">
              רדיוס: <span className="text-accent-dark">{radius} ק״מ</span>
            </label>
            <input
              id={`${ids}-radius`}
              type="range"
              min={0}
              max={RADII.length - 1}
              step={1}
              value={RADII.indexOf(radius)}
              onChange={(e) => setRadius(RADII[Number(e.target.value)])}
              aria-valuetext={`${radius} קילומטרים`}
              className="h-12 w-full accent-accent-dark"
            />
            <div className="flex justify-between text-xs text-muted" aria-hidden="true">
              <span>{RADII[0]}</span>
              <span>{RADII[RADII.length - 1]} ק״מ</span>
            </div>
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="mb-2 font-medium">כישורים נדרשים במשרה</legend>
          <div className="flex flex-wrap gap-2">
            {skillOptions.map((s) => {
              const on = chosenSkills.includes(s.id);
              return (
                <label
                  key={s.id}
                  className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm has-focus-visible:ring-2 has-focus-visible:ring-accent ${
                    on ? "border-accent-dark bg-accent-dark text-white" : "border-field bg-white text-ink hover:bg-panel"
                  }`}
                >
                  <input type="checkbox" checked={on} onChange={() => toggleSkill(s.id)} className="sr-only" />
                  {s.name}
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-muted">משרה מוצגת אם היא דורשת לפחות אחד מהכישורים שבחרתם.</p>
        </fieldset>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-h-10 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} className="size-5 accent-accent-dark" />
            להציג גם משרות מהבית ובפריסה ארצית
          </label>
          <button type="button" onClick={reset} className={buttonClass("quiet", "sm")}>
            נקה הכל
          </button>
        </div>
      </section>

      <LeafletMap rows={rows} center={center} radius={radius} onPick={(c) => (setPlaceText(""), setPlaceError(""), setCenter(c))} />
      <p className="mt-1 text-xs text-muted">
        מפה: ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">
          OpenStreetMap
          <span className="sr-only"> (נפתח בחלון חדש)</span>
        </a>{" "}
        · כל משרה מוצגת במרכז היישוב שלה, לא בכתובת המדויקת.
      </p>

      <h2 className="mt-8 text-2xl font-bold">המשרות</h2>
      <p role="status" className="mt-1 text-muted">
        {status}
      </p>
      {unplaced ? <p className="mt-1 text-sm text-muted">{jobsCount(unplaced)} ברשימה לא מופיעות על המפה כי אין להן יישוב מוכר.</p> : null}

      {rows.length === 0 ? (
        <div className="my-10 text-center">
          <p className="text-lg font-medium">לא מצאנו משרות שמתאימות לחיפוש</p>
          <p className="mt-1 text-muted">נסו להגדיל את הרדיוס או לבחור פחות כישורים.</p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {rows.slice(0, show).map((r) => (
            <JobItem key={r.job.id} row={r} skillName={skillName} chosen={chosenSkills} />
          ))}
        </ul>
      )}
      {rows.length > show ? (
        <p className="mt-6 text-center">
          <button type="button" onClick={() => setShow((n) => n + PAGE)} className={buttonClass("secondary")}>
            הצגת משרות נוספות
            <span className="sr-only">
              {" "}
              · מוצגות {show} מתוך {rows.length}
            </span>
          </button>
        </p>
      ) : null}
    </div>
  );
}

function JobItem({ row, skillName, chosen }: { row: Row; skillName: Map<string, string>; chosen: string[] }) {
  const { job, km } = row;
  const names = job.skills.map((s) => [s, skillName.get(s)] as const).filter((x): x is readonly [string, string] => Boolean(x[1]));
  return (
    <li className="flex flex-col overflow-hidden rounded-card border-2 border-line bg-surface">
      <div className="flex items-start justify-between gap-3 bg-accent px-5 py-3 text-white">
        <h3 className="text-lg leading-snug font-medium">{job.title}</h3>
        {job.hot ? <span className="shrink-0 rounded-full bg-hot px-2 py-0.5 text-xs font-medium text-[#5c3a00]">משרה חמה</span> : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-5">
        <p>
          <span className="text-muted">חברה - </span>
          <span className="font-medium">{job.company ?? "—"}</span>
        </p>
        <p>
          <span className="text-muted">מיקום - </span>
          <span className="font-medium">{job.city ?? "—"}</span>
          {km != null ? <span className="ms-2 rounded-full bg-accent/10 px-2 py-0.5 text-sm font-medium text-accent-dark">{fmtKm(km)}</span> : null}
        </p>
        <p className="text-sm text-muted">
          {job.scopes.map((s) => SCOPE_LABELS[s] ?? s).join(" · ") || null}
          {job.scopes.length ? " · " : ""}פורסמה {fmtDate(job.published)}
        </p>
        {names.length ? (
          <ul className="mt-2 flex flex-wrap gap-1" aria-label="כישורים נדרשים">
            {names.map(([id, name]) => (
              <li
                key={id}
                className={`rounded-full px-2 py-0.5 text-xs ${chosen.includes(id) ? "bg-accent-dark text-white" : "bg-panel text-muted"}`}
              >
                {name}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto pt-3">
          <Link href={`/job/${job.id}`} className={`${buttonClass("primary", "sm")} w-full`}>
            פרטים והגשת מועמדות<span className="sr-only"> · {job.title}</span>
          </Link>
        </div>
      </div>
    </li>
  );
}

/**
 * The Leaflet map. Tiles come from this site (/api/tiles, see the route), so the CSP stays
 * same-origin. Jobs in the same locality share one marker; its popup lists them. Popups
 * are built with DOM text nodes — job titles come from the feed and are never parsed as HTML.
 */
function LeafletMap({
  rows,
  center,
  radius,
  onPick,
}: {
  rows: Row[];
  center: Center | null;
  radius: number;
  onPick: (c: Center) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const lib = useRef<typeof L | null>(null);
  const jobsLayer = useRef<L.LayerGroup | null>(null);
  const centerLayer = useRef<L.LayerGroup | null>(null);
  const pick = useRef(onPick);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      if (cancelled || !el.current || map.current) return;
      const Lf = (mod.default ?? mod) as typeof L;
      lib.current = Lf;
      const m = Lf.map(el.current, { minZoom: 7, maxZoom: 17, maxBounds: [[28.8, 33.3], [34.0, 36.8]], attributionControl: false });
      m.fitBounds(ISRAEL);
      Lf.tileLayer("/api/tiles/{z}/{x}/{y}.png", { minZoom: 7, maxZoom: 17 }).addTo(m);
      jobsLayer.current = Lf.layerGroup().addTo(m);
      centerLayer.current = Lf.layerGroup().addTo(m);
      m.on("click", (e: L.LeafletMouseEvent) =>
        pick.current({ lat: e.latlng.lat, lng: e.latlng.lng, label: "הנקודה שנבחרה במפה", symbol: null }),
      );
      map.current = m;
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Job markers, one per locality.
  useEffect(() => {
    const Lf = lib.current;
    const layer = jobsLayer.current;
    if (!ready || !Lf || !layer) return;
    layer.clearLayers();
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      if (r.job.lat == null || r.job.lng == null) continue;
      const key = `${r.job.lat},${r.job.lng}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    for (const group of groups.values()) {
      const { lat, lng, city } = group[0].job;
      const n = group.length;
      const marker = Lf.circleMarker([lat!, lng!], {
        radius: Math.min(8 + Math.sqrt(n) * 3, 22),
        color: "#ffffff",
        weight: 2,
        fillColor: "#cd0077",
        fillOpacity: 0.9,
      });
      marker.bindTooltip(`${city ?? ""} · ${jobsCount(n)}`, { direction: "top" });
      marker.bindPopup(() => popupFor(group), { maxWidth: 280 });
      marker.addTo(layer);
    }
  }, [rows, ready]);

  // The centre and the radius circle.
  useEffect(() => {
    const Lf = lib.current;
    const layer = centerLayer.current;
    const m = map.current;
    if (!ready || !Lf || !layer || !m) return;
    layer.clearLayers();
    if (!center) {
      m.fitBounds(ISRAEL);
      return;
    }
    const circle = Lf.circle([center.lat, center.lng], {
      radius: radius * 1000,
      color: "#005e5c",
      weight: 2,
      fillColor: "#218283",
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(layer);
    Lf.circleMarker([center.lat, center.lng], { radius: 7, color: "#ffffff", weight: 3, fillColor: "#005e5c", fillOpacity: 1, interactive: false })
      .bindTooltip(center.label, { permanent: false })
      .addTo(layer);
    m.fitBounds(circle.getBounds(), { padding: [20, 20] });
  }, [center, radius, ready]);

  return (
    <div className="relative mt-6">
      <div
        ref={el}
        dir="ltr"
        role="region"
        aria-label="מפת המשרות. אותן משרות מופיעות ברשימה שמתחת למפה."
        className="z-0 h-[22rem] w-full overflow-hidden rounded-card border-2 border-line bg-panel sm:h-[30rem]"
      />
      {!ready ? <p className="absolute inset-0 flex items-center justify-center text-muted">טוענים את המפה…</p> : null}
    </div>
  );
}

function popupFor(group: Row[]): HTMLElement {
  const root = document.createElement("div");
  root.dir = "rtl";
  root.style.fontFamily = "inherit";
  const head = document.createElement("p");
  head.style.fontWeight = "600";
  head.style.margin = "0 0 6px";
  head.textContent = `${group[0].job.city ?? ""} · ${jobsCount(group.length)}`;
  root.append(head);
  const list = document.createElement("ul");
  list.style.margin = "0";
  list.style.paddingInlineStart = "16px";
  for (const r of group.slice(0, 8)) {
    const li = document.createElement("li");
    li.style.margin = "2px 0";
    const a = document.createElement("a");
    a.href = `/job/${r.job.id}`;
    a.textContent = r.job.title;
    li.append(a);
    if (r.job.company) li.append(` — ${r.job.company}`);
    list.append(li);
  }
  root.append(list);
  if (group.length > 8) {
    const more = document.createElement("p");
    more.style.margin = "6px 0 0";
    more.textContent = `ועוד ${group.length - 8} ברשימה שמתחת למפה`;
    root.append(more);
  }
  return root;
}
