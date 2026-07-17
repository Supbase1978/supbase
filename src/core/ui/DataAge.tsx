import { cx } from "./cx";

export interface DataAgeProps {
  /**
   * A hívó adja a kész, formázott feliratot (pl. "frissítve 4 perce") —
   * ez a komponens nem formáz szöveget és nem tartalmaz i18n-importot.
   */
  label: string;
  /** Elavult adat (`isStale` a `data-age.ts`-ből): --stale szín + ikon. */
  stale?: boolean;
  className?: string;
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6 3.2 L6 6.2 L8.2 7.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * Adatkor-felirat: friss állapotban semleges (`--text-3`), elavult
 * állapotban `--stale` szín + óra-ikon (2. fejezet 5. pont). A feliratot
 * mindig a hívó adja — lásd `isStale`/`minutesSince` a `data-age.ts`-ben.
 */
export function DataAge({ label, stale = false, className }: DataAgeProps) {
  if (stale) {
    return (
      <span
        className={cx(
          "inline-flex items-center gap-1 text-xs font-semibold text-stale",
          className,
        )}
      >
        <ClockIcon />
        {label}
      </span>
    );
  }

  return <span className={cx("text-xs text-text-3", className)}>{label}</span>;
}
