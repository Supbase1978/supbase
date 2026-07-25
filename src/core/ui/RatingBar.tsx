/**
 * Értékelő-sáv (10 szegmenses vízszintes mérce) — vélemény-átlagok megjelenítésére.
 *
 * CORE-primitíva: két modul is használja (reviews „Közös nevező"-blokk, advisor
 * eredmény-kártya), ezért a modul-szerződés (1.3) szerint a közös igény a
 * core-ba kerül — modul→modul import tilos lenne.
 *
 * FONTOS (2. fejezet, token-szabály): ez NEM a biztonsági `Gauge` (az
 * veszély-szemantikájú, safe/caution/DANGER küszöbökkel). Egy vélemény-átlag
 * nem „veszély", ezért itt a `--danger` (piros) TILOS. A kitöltés színe
 * küszöb-alapú: érték ≥ 7 → `--safe` (zöld), alatta `--caution` (amber),
 * SOHA danger. A számértéket a hívó (`ReviewSummary`) mindig a sáv mellé teszi
 * (szín + szöveg, sosem csak szín).
 */
import { cx } from "./cx";

const SEGMENTS = 10;

export interface RatingBarProps {
  /** 0–10 skálájú érték, vagy null (nincs adat → üres sáv). */
  value: number | null;
  /** Sáv-magasság: `lg` az összesítetthez (designban 14px), `sm` a dimenziókhoz. */
  size?: "sm" | "lg";
  /** Hozzáférhető felirat (a hívó a dimenzió-nevet + értéket adja). */
  ariaLabel?: string;
  className?: string;
}

export function RatingBar({ value, size = "sm", ariaLabel, className }: RatingBarProps) {
  const filled = value === null ? 0 : Math.max(0, Math.min(SEGMENTS, Math.round(value)));
  // Küszöb-szín — SOHA nem danger (lásd fájl-fejléc).
  const tone = value !== null && value >= 7 ? "bg-safe" : "bg-caution";
  const height = size === "lg" ? "h-3.5" : "h-2.5";

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cx("grid grid-cols-10 gap-[3px]", className)}
    >
      {Array.from({ length: SEGMENTS }).map((_, i) => (
        <span
          key={i}
          className={cx("rounded-sm", height, i < filled ? tone : "bg-line")}
        />
      ))}
    </div>
  );
}
