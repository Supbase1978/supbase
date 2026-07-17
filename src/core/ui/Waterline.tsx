export type WaterlineState = "calm" | "choppy" | "broken" | "stale";

export interface WaterlineProps {
  state: WaterlineState;
  /**
   * Kötelező aria-label (pl. "Kiváló — nyugodt vízfelszín, SUP-index 8,4").
   * A vonal `role="img"`, tehát a `label` az egyetlen szöveges leírás.
   */
  label: string;
  className?: string;
}

const VIEWBOX_WIDTH = 200;
const BASELINE = 13;

/**
 * Sima, szinuszos hullám-útvonal `Q`/`T` parancsokkal — a `segmentWidth` a
 * hullámhossz, az `amplitude` a kilengés. Ugyanaz a technika, mint amit egy
 * sima vízfelszín rajzolásához bármely vektorgrafikus eszköz használna;
 * itt saját, a komponens szükségletéhez illesztett paraméterekkel.
 */
function smoothWavePath(segmentWidth: number, amplitude: number): string {
  const half = segmentWidth / 2;
  let d = `M0 ${BASELINE} Q${half} ${BASELINE - amplitude} ${segmentWidth} ${BASELINE}`;
  for (let x = segmentWidth * 2; x < VIEWBOX_WIDTH; x += segmentWidth) {
    d += ` T${x} ${BASELINE}`;
  }
  // Mindig a viewBox jobb szélén záruljon, függetlenül attól, hogy a
  // hullámhossz osztója-e a szélességnek.
  d += ` T${VIEWBOX_WIDTH} ${BASELINE}`;
  return d;
}

/** Szögletes, törött vonal — a "töredezett" (danger) állapot saját geometriája. */
function jaggedWavePath(): string {
  const segment = 10;
  const highs = [-6, 6, -7, 5, -8, 5, -6, 6, -7, 5, -6, 4, -7, 5, -6, 6, -7, 5, -6, 1];
  let d = `M0 ${BASELINE}`;
  let x = 0;
  for (const offset of highs) {
    x += segment;
    d += ` L${x} ${BASELINE + offset}`;
  }
  return d;
}

// A négy állapot GEOMETRIÁJA egymástól eltérő (nem csak a szín) —
// színtévesztő-biztos, 2. fejezet 1. pont.
const CALM_PATH = smoothWavePath(30, 4);
const CHOPPY_PATH = smoothWavePath(14, 7);
const BROKEN_PATH = jaggedWavePath();
// "Elavult": lapított, tompított hullám (a forma is jelzi, hogy az adat
// hangulata már nem megbízható) + szaggatott vonalstílus.
const STALE_PATH = smoothWavePath(26, 1.5);

const STATE_CONFIG: Record<
  WaterlineState,
  { d: string; strokeClass: string; dashed: boolean; linejoin: "round" | "miter" }
> = {
  calm: { d: CALM_PATH, strokeClass: "stroke-safe", dashed: false, linejoin: "round" },
  choppy: { d: CHOPPY_PATH, strokeClass: "stroke-caution", dashed: false, linejoin: "round" },
  broken: { d: BROKEN_PATH, strokeClass: "stroke-danger", dashed: false, linejoin: "miter" },
  stale: { d: STALE_PATH, strokeClass: "stroke-stale", dashed: true, linejoin: "round" },
};

/**
 * Vízfelszín-vonal — signature vizualizáció kártyákon/kompakt nézetekben
 * (2. fejezet 1. pont). Négy állapot, mindegyik ELTÉRŐ vonalgeometriával,
 * hogy színtévesztéssel is megkülönböztethető legyen; elavult adatnál a
 * vonal szaggatottra vált.
 */
export function Waterline({ state, label, className }: WaterlineProps) {
  const config = STATE_CONFIG[state];

  return (
    <svg
      role="img"
      aria-label={label}
      data-waterline-state={state}
      width="100%"
      height="26"
      viewBox={`0 0 ${VIEWBOX_WIDTH} 26`}
      preserveAspectRatio="none"
      className={className}
    >
      <path
        d={config.d}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin={config.linejoin}
        strokeDasharray={config.dashed ? "7 7" : undefined}
        className={config.strokeClass}
      />
    </svg>
  );
}
