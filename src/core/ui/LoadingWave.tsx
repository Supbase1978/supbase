/**
 * Betöltés-jelző: felirat + alatta animált hullám-SVG.
 *
 * MIÉRT HULLÁM: a design nyelvének központi motívuma a vízfelszín-vonal
 * (lásd `Waterline`), ezért a betöltés-animáció is ebből épül — nem egy
 * általános „pörgő karika", ami idegen lenne a felülettől.
 *
 * SZÍNEK: kizárólag a semleges paletta (`--petrol`, `--line`). A biztonsági
 * tokenek (`--safe*`, `--caution*`, `--danger*`, `--stale`) itt TILOSAK: a
 * betöltés nem állapot-információ a vízről, és félrevezető lenne, ha a
 * felhasználó egy pillanatra „zöld/piros" jelzést látna, aminek semmi köze a
 * tényleges körülményekhez (2. fejezet).
 *
 * MOZGÁSCSÖKKENTÉS: a `prefers-reduced-motion` beállítást a `wave-drift`
 * animáció tiszteletben tartja (lásd `tokens.css`) — vesztibuláris panasznál
 * a hullám állóképként marad, a felirat viszont továbbra is tájékoztat.
 *
 * A11Y: `role="status"` + `aria-live="polite"` → a képernyőolvasó bemondja a
 * betöltést; az SVG dekoratív (`aria-hidden`), az információt a felirat hordozza.
 */
import { cx } from "./cx";

export interface LoadingWaveProps {
  /** A betöltés felirata (pl. „Térkép betöltése…"). Kötelező: az SVG néma. */
  label: string;
  className?: string;
}

/**
 * Hullám-VONAL (nem kitöltött forma) — a `Waterline` komponens vizuális
 * nyelvét követi, ami szintén vonallal jelzi a vízfelszínt. A kitöltött
 * változat vizuálisan túl nehéz volt egy átmeneti állapothoz.
 *
 * A path a viewBox KÉTSZERESÉN fut végig (0–160 a 80 széles nézetben), és a
 * `wave-drift` pontosan egy nézetnyit (80 egységet, azaz két teljes
 * hullámperiódust) csúsztat — így a ciklus varrat nélkül ismétlődik.
 */
const WAVE_PATH = "M0 12 Q 10 5, 20 12 T 40 12 T 60 12 T 80 12 T 100 12 T 120 12 T 140 12 T 160 12";

export function LoadingWave({ label, className }: LoadingWaveProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx("flex flex-col items-center justify-center gap-3", className)}
    >
      <span className="text-sm font-medium text-text-2">{label}</span>
      <svg aria-hidden="true" viewBox="0 0 80 26" className="h-7 w-28 overflow-hidden">
        {/* Hátsó vonal: halványabb és lassabb — mélységérzetet ad.
            A függőleges eltolás CSOPORTON van, nem a path inline stílusán: a
            `wave-drift` animáció a `transform`-ot animálja, tehát felülírná az
            inline `translateY`-t, és a két hullám egymásra csúszna. */}
        <g transform="translate(0 6)">
          <path
            d={WAVE_PATH}
            fill="none"
            stroke="var(--petrol)"
            strokeOpacity={0.3}
            strokeWidth={2}
            strokeLinecap="round"
            className="wave-drift"
            style={{ animationDuration: "3.4s" }}
          />
        </g>
        {/* Elülső vonal: telített petrol, gyorsabb, ellenfázisban indítva. */}
        <path
          d={WAVE_PATH}
          fill="none"
          stroke="var(--petrol)"
          strokeWidth={2.5}
          strokeLinecap="round"
          className="wave-drift"
          style={{ animationDuration: "2.2s", animationDelay: "-1.1s" }}
        />
      </svg>
    </div>
  );
}
