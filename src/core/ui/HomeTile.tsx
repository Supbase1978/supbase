import type { ReactNode } from "react";
import { Link } from "react-router";

import type { TileIcon } from "../module-contract";
import { cx } from "./cx";

export interface HomeTileProps {
  /** Cél-útvonal (már locale-happy, a hívó localizeol — lásd `AppNav`). */
  to: string;
  icon: TileIcon;
  title: string;
  description: string;
  className?: string;
}

const ICON_PATHS: Record<TileIcon, ReactNode> = {
  // SUP-deszka: kontúros kapszula-forma + középvonal.
  board: (
    <>
      <ellipse cx="12" cy="12" rx="9" ry="4" />
      <line x1="4.5" y1="12" x2="19.5" y2="12" />
    </>
  ),
  // Evező: hosszú nyél, két lapáttal.
  gear: (
    <>
      <line x1="12" y1="3.5" x2="12" y2="20.5" />
      <ellipse cx="12" cy="4.5" rx="3" ry="1.4" />
      <ellipse cx="12" cy="19.5" rx="3" ry="1.4" />
    </>
  ),
  // Vízfelszín-hullámok — a spot-kártyák Waterline-motívumára rímel.
  spot: (
    <>
      <path d="M2.5 10c2-2.6 3.8-2.6 5.8 0s3.8 2.6 5.8 0 3.8-2.6 5.8 0" />
      <path d="M2.5 15.5c2-2.6 3.8-2.6 5.8 0s3.8 2.6 5.8 0 3.8-2.6 5.8 0" />
    </>
  ),
  // Helyszín-jelölő: iskolák/kölcsönzők/túrák megtalálása.
  provider: (
    <>
      <path d="M12 20.5S5.5 13.7 5.5 9a6.5 6.5 0 1 1 13 0c0 4.7-6.5 11.5-6.5 11.5z" />
      <circle cx="12" cy="9" r="2.3" />
    </>
  ),
  // Info-jelvény: szabályok/biztonság.
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="7.7" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
};

/**
 * Ikon-doboz pasztell-párok, csempénként (variant B, 2026-09-29 felhasználói
 * döntés 3 makett közül) — kizárólag az ikon-dobozon, a cím SOSEM kap színt.
 * Literális osztálynevek kellenek (Tailwind csak a forrásban ténylegesen
 * megjelenő class-t generálja le), ezért `Record<TileIcon, string>`, nem
 * string-összefűzés. Az árnyalatok tudatosan távol vannak a biztonsági
 * tokenektől (2. fejezet) — ez navigáció, nem státusz.
 */
const ICON_BOX_CLASSES: Record<TileIcon, string> = {
  board: "bg-tile-board-bg text-tile-board-ink",
  gear: "bg-tile-gear-bg text-tile-gear-ink",
  spot: "bg-tile-spot-bg text-tile-spot-ink",
  provider: "bg-tile-provider-bg text-tile-provider-ink",
  info: "bg-tile-info-bg text-tile-info-ink",
};

function TileIconGraphic({ icon }: { icon: TileIcon }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[icon]}
    </svg>
  );
}

/**
 * Kezdőlap navigációs csempe (F2.6-utó: csemperács a hero alatt). Ez
 * NAVIGÁCIÓ, nem státusz — a biztonsági tokenek (safe/caution/danger/stale
 * családok) itt SOSEM jelennek meg (2. fejezet).
 *
 * Reszponzív: mobilon nagy, függőleges elrendezés (ikon fent, cím + leírás
 * lent); `lg`-től kompakt, egysoros változat (ikon a cím mellett, a leírás
 * egy sorra vágva), hogy asztalin ne tolja le az élő adatokat. Egy
 * komponens, csak Tailwind-breakpointtal, JS-ág nélkül.
 */
export function HomeTile({ to, icon, title, description, className }: HomeTileProps) {
  return (
    <Link
      to={to}
      className={cx(
        "flex h-full min-h-[var(--tap-min)] flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-sm",
        "transition-shadow hover:shadow-md",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol",
        "lg:flex-row lg:items-start lg:gap-3 lg:p-3",
        className,
      )}
    >
      <span
        className={cx(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg lg:h-9 lg:w-9",
          ICON_BOX_CLASSES[icon],
        )}
      >
        <TileIconGraphic icon={icon} />
      </span>
      <span className="flex min-w-0 flex-col gap-1 lg:flex-1">
        <span
          className="font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </span>
        <span className="text-sm text-text-3 lg:line-clamp-2">{description}</span>
      </span>
    </Link>
  );
}
