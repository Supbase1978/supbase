/**
 * Spot-térkép (MapLibre GL) — F1.4 UI. KIZÁRÓLAG kliens-oldalon inicializálódik
 * (a `maplibre-gl` DOM/WebGL-t igényel): SSR alatt és az első kliens-render
 * alatt (mountolás előtt) egy token-színezett placeholder jelenik meg, a
 * térkép csak `useEffect`-ben, dinamikus importtal épül fel.
 *
 * A jelölők NEM csak színnel különböznek (2. fejezet 3. pont,
 * színtévesztő-biztos forma): safe/caution/danger/forbidden/stale mindegyike
 * saját ikon-geometriát kap (lásd `markerIconMarkup`). A `forbidden`
 * státusz — az F1.3-reviewer m5 átadási feltétele szerint — mindig
 * "Tilos"-ként jelenik meg, SOHA nem "Veszélyes"-ként (lásd `statusLabelText`,
 * a `spots` namespace saját `status.*` kulcsaiból, nem a weather-modulból —
 * 1.3 modul-szerződés).
 */
import { useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import "maplibre-gl/dist/maplibre-gl.css";

import { cx } from "@core/ui";

import type { SpotStatus } from "../types";

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** Magyarország középpontja/áttekintő zoom — alapérték, ha nincs center/zoom prop. */
const DEFAULT_CENTER = { lat: 47.1625, lng: 19.5033 };
const DEFAULT_ZOOM = 6.3;

export interface SpotMapMarker {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  /** `null` = nincs kiértékelhető mérés — a jelölő --stale szürkével jelenik meg. */
  status: SpotStatus | null;
  stale: boolean;
  protectedArea: boolean;
}

export interface SpotMapProps {
  spots: readonly SpotMapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  /** A popup "Adatlap" linkjének kattintása — ha adott, felülírja a natív navigációt (SPA-routing). */
  onSelect?: (slug: string) => void;
  /** `false`: pan/zoom-interakció kikapcsolva (pl. adatlap mini-térkép, nem interaktív fókusz). */
  interactive?: boolean;
  className?: string;
}

type EffectiveVisual = "safe" | "caution" | "danger" | "forbidden" | "stale";

function effectiveVisual(spot: Pick<SpotMapMarker, "status" | "stale">): EffectiveVisual {
  if (spot.stale || spot.status === null) return "stale";
  return spot.status;
}

function statusLabelText(spot: Pick<SpotMapMarker, "status" | "stale">, t: TFunction): string {
  if (spot.stale) return t("stale.label");
  if (spot.status === null) return t("status.unknown");
  return t(`status.${spot.status}`);
}

/** Pin-kontextusú ikon (a jelölő MAGA a színes/fehér "pill") — önmagában színezett, nem `currentColor`. */
function pinIconMarkup(visual: EffectiveVisual): string {
  switch (visual) {
    case "safe":
      return (
        '<svg width="13" height="13" viewBox="0 0 12 12" aria-hidden="true" focusable="false">' +
        '<circle cx="6" cy="6" r="5.5" fill="var(--safe)"/>' +
        '<path d="M3.3 6.1 L5.1 7.9 L8.5 4.1" stroke="var(--surface)" stroke-width="1.6" ' +
        'stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
      );
    case "caution":
      return (
        '<svg width="13" height="13" viewBox="0 0 12 12" aria-hidden="true" focusable="false">' +
        '<circle cx="6" cy="6" r="5" fill="none" stroke="var(--caution)" stroke-width="2"/>' +
        '<rect x="5.25" y="2.8" width="1.5" height="3.8" fill="var(--caution)"/>' +
        '<rect x="5.25" y="7.6" width="1.5" height="1.5" fill="var(--caution)"/></svg>'
      );
    case "danger":
      return (
        '<svg width="14" height="13" viewBox="0 0 13 12" aria-hidden="true" focusable="false">' +
        '<path d="M6.5 0.5 L12.5 11.5 L0.5 11.5 Z" fill="var(--surface)"/>' +
        '<rect x="5.75" y="4" width="1.5" height="3.6" fill="var(--danger)"/>' +
        '<rect x="5.75" y="8.6" width="1.5" height="1.5" fill="var(--danger)"/></svg>'
      );
    case "forbidden":
      // "tiltás-jelleg": KÖR + ÁTLÓS SÁV (nemzetközi behajtani tilos-jel) — más
      // geometria, mint a danger háromszöge, szándékosan (m5: forbidden ≠ danger).
      return (
        '<svg width="13" height="13" viewBox="0 0 12 12" aria-hidden="true" focusable="false">' +
        '<circle cx="6" cy="6" r="5" fill="var(--surface)"/>' +
        '<circle cx="6" cy="6" r="5" fill="none" stroke="var(--danger)" stroke-width="1.6"/>' +
        '<line x1="2.4" y1="9.6" x2="9.6" y2="2.4" stroke="var(--danger)" stroke-width="1.8" ' +
        'stroke-linecap="round"/></svg>'
      );
    case "stale":
      return (
        '<svg width="13" height="13" viewBox="0 0 12 12" aria-hidden="true" focusable="false">' +
        '<circle cx="6" cy="6" r="5" fill="none" stroke="var(--stale)" stroke-width="1.4"/>' +
        '<path d="M6 3.2 L6 6.2 L8.2 7.5" stroke="var(--stale)" stroke-width="1.4" ' +
        'stroke-linecap="round" fill="none"/></svg>'
      );
    default: {
      const exhaustive: never = visual;
      return exhaustive;
    }
  }
}

/** Világos "-bg" hátterű, StatusBadge-stílusú ikon (popup-kontextus) — `currentColor`-t használ. */
function badgeIconMarkup(visual: EffectiveVisual): string {
  switch (visual) {
    case "safe":
      return (
        '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">' +
        '<circle cx="6" cy="6" r="5.5" fill="currentColor"/>' +
        '<path d="M3.3 6.1 L5.1 7.9 L8.5 4.1" stroke="var(--surface)" stroke-width="1.6" ' +
        'stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
      );
    case "caution":
      return (
        '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">' +
        '<circle cx="6" cy="6" r="5.5" fill="currentColor"/>' +
        '<rect x="5.25" y="2.8" width="1.5" height="3.8" fill="var(--surface)"/>' +
        '<rect x="5.25" y="7.6" width="1.5" height="1.5" fill="var(--surface)"/></svg>'
      );
    case "danger":
      return (
        '<svg width="13" height="12" viewBox="0 0 13 12" aria-hidden="true" focusable="false">' +
        '<path d="M6.5 0.5 L12.5 11.5 L0.5 11.5 Z" fill="currentColor"/>' +
        '<rect x="5.75" y="4" width="1.5" height="3.6" fill="var(--surface)"/>' +
        '<rect x="5.75" y="8.6" width="1.5" height="1.5" fill="var(--surface)"/></svg>'
      );
    case "forbidden":
      return (
        '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">' +
        '<circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
        '<line x1="2.4" y1="9.6" x2="9.6" y2="2.4" stroke="currentColor" stroke-width="1.8" ' +
        'stroke-linecap="round"/></svg>'
      );
    case "stale":
      return (
        '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">' +
        '<circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
        '<path d="M6 3.2 L6 6.2 L8.2 7.5" stroke="currentColor" stroke-width="1.4" ' +
        'stroke-linecap="round" fill="none"/></svg>'
      );
    default: {
      const exhaustive: never = visual;
      return exhaustive;
    }
  }
}

const LEAF_ICON_MARKUP =
  '<svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" focusable="false">' +
  '<path d="M5 1 L6.2 3.8 L9 4 L7 6 L7.6 9 L5 7.5 L2.4 9 L3 6 L1 4 L3.8 3.8 Z" fill="currentColor"/></svg>';

function pinTokens(visual: EffectiveVisual): { bg: string; text: string; stem: string } {
  switch (visual) {
    case "danger":
    case "forbidden":
      return { bg: "var(--danger)", text: "var(--surface)", stem: "var(--danger)" };
    case "caution":
      return { bg: "var(--surface)", text: "var(--text)", stem: "var(--caution)" };
    case "stale":
      return { bg: "var(--surface)", text: "var(--stale)", stem: "var(--stale)" };
    case "safe":
      return { bg: "var(--surface)", text: "var(--text)", stem: "var(--safe)" };
    default: {
      const exhaustive: never = visual;
      return exhaustive;
    }
  }
}

function badgeTokens(visual: EffectiveVisual): { bg: string; text: string } {
  switch (visual) {
    case "safe":
      return { bg: "var(--safe-bg)", text: "var(--safe-text)" };
    case "caution":
      return { bg: "var(--caution-bg)", text: "var(--caution-text)" };
    case "danger":
    case "forbidden":
      return { bg: "var(--danger-bg)", text: "var(--danger-text)" };
    case "stale":
      return { bg: "var(--mist)", text: "var(--stale)" };
    default: {
      const exhaustive: never = visual;
      return exhaustive;
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createMarkerElement(
  spot: SpotMapMarker,
  showProtected: boolean,
  t: TFunction,
): HTMLDivElement {
  const visual = effectiveVisual(spot);
  const tokens = pinTokens(visual);
  const label = statusLabelText(spot, t);

  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "2px";
  wrapper.style.cursor = "pointer";

  const badge = document.createElement("div");
  badge.setAttribute("role", "img");
  badge.setAttribute("aria-label", `${spot.name} — ${label}`);
  badge.style.display = "inline-flex";
  badge.style.alignItems = "center";
  badge.style.gap = "6px";
  badge.style.borderRadius = "999px";
  badge.style.padding = "6px 11px";
  badge.style.fontSize = "12px";
  badge.style.fontWeight = "700";
  badge.style.whiteSpace = "nowrap";
  badge.style.boxShadow = "0 2px 8px rgba(14,59,67,.22)";
  badge.style.background = tokens.bg;
  badge.style.color = tokens.text;
  badge.innerHTML = `${pinIconMarkup(visual)}<span>${escapeHtml(spot.name)}</span>`;
  wrapper.appendChild(badge);

  if (spot.protectedArea && showProtected) {
    const ring = document.createElement("div");
    ring.setAttribute("role", "img");
    ring.setAttribute("aria-label", t("map.layerProtected"));
    ring.style.display = "inline-flex";
    ring.style.alignItems = "center";
    ring.style.gap = "4px";
    ring.style.background = "var(--petrol)";
    ring.style.color = "var(--surface)";
    ring.style.borderRadius = "999px";
    ring.style.padding = "2px 8px";
    ring.style.fontSize = "10px";
    ring.style.fontWeight = "700";
    ring.innerHTML = `${LEAF_ICON_MARKUP}<span>${escapeHtml(t("map.layerProtected"))}</span>`;
    wrapper.appendChild(ring);
  }

  const stem = document.createElement("div");
  stem.style.width = "2px";
  stem.style.height = "8px";
  stem.style.background = tokens.stem;
  wrapper.appendChild(stem);

  return wrapper;
}

function createPopupContent(
  spot: SpotMapMarker,
  t: TFunction,
  onSelect?: (slug: string) => void,
): HTMLElement {
  const visual = effectiveVisual(spot);
  const tokens = badgeTokens(visual);

  const root = document.createElement("div");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = "6px";
  root.style.minWidth = "160px";
  root.style.fontFamily = "var(--font-body)";

  const title = document.createElement("div");
  title.textContent = spot.name;
  title.style.fontWeight = "600";
  title.style.color = "var(--ink-deep)";
  title.style.fontSize = "14px";
  root.appendChild(title);

  const badge = document.createElement("div");
  badge.style.display = "inline-flex";
  badge.style.width = "fit-content";
  badge.style.alignItems = "center";
  badge.style.gap = "6px";
  badge.style.borderRadius = "999px";
  badge.style.padding = "3px 9px";
  badge.style.fontSize = "12px";
  badge.style.fontWeight = "700";
  badge.style.background = tokens.bg;
  badge.style.color = tokens.text;
  badge.innerHTML = `${badgeIconMarkup(visual)}<span>${escapeHtml(statusLabelText(spot, t))}</span>`;
  root.appendChild(badge);

  const link = document.createElement("a");
  link.href = `/spotok/${spot.slug}`;
  link.textContent = t("map.openDetail");
  link.style.color = "var(--petrol-text)";
  link.style.fontWeight = "600";
  link.style.fontSize = "13px";
  link.style.textDecoration = "underline";
  if (onSelect) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      onSelect(spot.slug);
    });
  }
  root.appendChild(link);

  return root;
}

function LayerToggle({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "min-h-[var(--tap-min)] rounded-full px-3 text-xs font-semibold shadow-sm transition-colors",
        active ? "bg-ink-deep text-surface" : "bg-surface text-text-2",
      )}
    >
      {label}
    </button>
  );
}

export function SpotMap({
  spots,
  center,
  zoom,
  onSelect,
  interactive = true,
  className,
}: SpotMapProps) {
  const { t } = useTranslation("spots");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  // A tényleges MapLibre-példány `unknown`-ként tárolva — a típus csak a
  // dinamikus import felbontása UTÁN áll rendelkezésre, statikus import
  // nélkül szándékosan (SSR-biztonság, lásd fájl-fejléc).
  const [map, setMap] = useState<InstanceType<
    typeof import("maplibre-gl").Map
  > | null>(null);
  const [showSpots, setShowSpots] = useState(true);
  const [showProtected, setShowProtected] = useState(true);

  // Csak a kliensen "mountoljuk" a térképet — SSR alatt ez az effekt nem fut
  // le, tehát a render placeholdert ad (lásd a komponens végi feltételt).
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;
    let cancelled = false;
    let instance: InstanceType<typeof import("maplibre-gl").Map> | undefined;

    void (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      instance = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: [center?.lng ?? DEFAULT_CENTER.lng, center?.lat ?? DEFAULT_CENTER.lat],
        zoom: zoom ?? DEFAULT_ZOOM,
        // Alapértelmezetten bekapcsolva marad (OSM-attribúció kötelező) —
        // explicit `{}` a típus miatt (nem `boolean`), lásd MapOptions.
        attributionControl: {},
        interactive,
      });
      if (cancelled) {
        instance.remove();
        return;
      }
      setMap(instance);
    })();

    return () => {
      cancelled = true;
      instance?.remove();
      setMap(null);
    };
    // A center/zoom csak a KEZDŐ nézetet adja — a térképet nem inicializáljuk
    // újra minden prop-változáskor (elveszne a felhasználó pan/zoom állapota).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Jelölők — a map-példány vagy a megjelenítendő adatok/rétegkapcsolók
  // változásakor újraépülnek.
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const markers: Array<InstanceType<typeof import("maplibre-gl").Marker>> = [];

    void (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !showSpots) return;

      for (const spot of spots) {
        const popup = new maplibregl.Popup({ closeButton: true, offset: 18 }).setDOMContent(
          createPopupContent(spot, t, onSelect),
        );
        const marker = new maplibregl.Marker({ element: createMarkerElement(spot, showProtected, t) })
          .setLngLat([spot.lng, spot.lat])
          .setPopup(popup)
          .addTo(map);
        markers.push(marker);
      }
    })();

    return () => {
      cancelled = true;
      for (const marker of markers) marker.remove();
    };
  }, [map, spots, showSpots, showProtected, onSelect, t]);

  if (!mounted) {
    return (
      <div
        role="img"
        aria-label={t("map.title")}
        className={cx(
          // Nincs `h-full`: a magasságot MINDIG a hívó `className`-je adja
          // (explicit érték), különben tartalom-magasságú szülőben 0-ra
          // oldódna — a `min-h` csak alsó korlát (lásd az adatlap mini-térképét).
          "flex min-h-[220px] w-full items-center justify-center rounded-[var(--radius-card)] bg-mist text-sm text-text-3",
          className,
        )}
      >
        {t("map.title")}
      </div>
    );
  }

  return (
    <div
      className={cx(
        "relative min-h-[220px] w-full overflow-hidden rounded-[var(--radius-card)] bg-mist",
        className,
      )}
    >
      <div ref={containerRef} className="h-full w-full" />
      {interactive ? (
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
          <LayerToggle
            active={showSpots}
            label={t("map.layerSpots")}
            onClick={() => setShowSpots((value) => !value)}
          />
          <LayerToggle
            active={showProtected}
            label={t("map.layerProtected")}
            onClick={() => setShowProtected((value) => !value)}
          />
        </div>
      ) : null}
    </div>
  );
}
