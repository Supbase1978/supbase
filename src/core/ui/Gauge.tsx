import { cx } from "./cx";

export interface GaugeThresholds {
  /** Ez alatt danger sáv (kizárólagos felső határ). */
  caution: number;
  /** Ez fölött (vagy egyenlő) safe sáv; caution és safe között caution sáv. */
  safe: number;
}

/**
 * Ésszerű alapértelmezés az F1.1-hez — a végleges sávhatárokat az F1.3
 * SUP-index adja majd, propként felülírható.
 */
export const DEFAULT_GAUGE_THRESHOLDS: GaugeThresholds = {
  caution: 4,
  safe: 6.5,
};

const SEGMENT_COUNT = 10;

export interface GaugeProps {
  /** SUP-index 0–10 skálán. */
  value: number;
  /**
   * Kötelező, hozzáférhető felirat (pl. "SUP-index 8,4, kiváló"). A látható
   * számértéket a hívó jeleníti meg a mérce mellett (2. fejezet: kártya =
   * vonal, adatlap = mérce + pontos érték) — ez a komponens csak a
   * szegmens-sávot rajzolja.
   */
  label: string;
  thresholds?: GaugeThresholds;
  /** Elavult adat: a kitöltött szegmensek csíkozott mintát kapnak. */
  stale?: boolean;
  className?: string;
}

function severityFor(
  value: number,
  thresholds: GaugeThresholds,
): "safe" | "caution" | "danger" {
  if (value >= thresholds.safe) return "safe";
  if (value >= thresholds.caution) return "caution";
  return "danger";
}

const FILLED_CLASSES: Record<"safe" | "caution" | "danger", string> = {
  safe: "bg-safe",
  caution: "bg-caution",
  danger: "bg-danger",
};

/** Csíkozott minta elavult adathoz — csak megengedett tokenekből (--stale + --surface). */
const STALE_STRIPE_STYLE = {
  backgroundImage:
    "repeating-linear-gradient(45deg, var(--stale) 0 3px, var(--surface) 3px 6px)",
};

/**
 * Vízmérce (10 szegmens) — KIZÁRÓLAG részletező nézetekben (2. fejezet 2.
 * pont). Ugyanazt az indexet mutatja, mint a kártyák `Waterline`-ja, csak
 * pontosabb bontásban.
 */
export function Gauge({
  value,
  label,
  thresholds = DEFAULT_GAUGE_THRESHOLDS,
  stale = false,
  className,
}: GaugeProps) {
  const clamped = Number.isFinite(value)
    ? Math.min(SEGMENT_COUNT, Math.max(0, value))
    : 0;
  const filledCount = Math.round(clamped);
  const severity = severityFor(clamped, thresholds);

  const segments = Array.from({ length: SEGMENT_COUNT }, (_, index) => {
    const filled = index < filledCount;
    return (
      <div
        key={index}
        data-filled={filled}
        className={cx(
          "h-4 rounded-sm",
          filled && !stale && FILLED_CLASSES[severity],
          filled && stale && "bg-stale",
          !filled && "bg-line/50",
        )}
        style={filled && stale ? STALE_STRIPE_STYLE : undefined}
      />
    );
  });

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={SEGMENT_COUNT}
      aria-valuenow={clamped}
      data-severity={stale ? "stale" : severity}
      className={cx("grid grid-cols-10 gap-[3px]", className)}
    >
      {segments}
    </div>
  );
}
