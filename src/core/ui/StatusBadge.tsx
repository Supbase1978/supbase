import { cx } from "./cx";

export type StatusSeverity = "safe" | "caution" | "danger" | "stale";

export interface StatusBadgeProps {
  status: StatusSeverity;
  /**
   * Kötelező, látható felirat (pl. "Kiváló · 8,4"). A státusz 2. fejezet 3.
   * pontja szerint SOSE jelenhet meg csak színnel — szín + ikon + szöveg
   * hármasban kötelező, ezért ez a prop nem opcionális.
   */
  label: string;
  className?: string;
}

const CONTAINER_CLASSES: Record<StatusSeverity, string> = {
  safe: "bg-safe-bg text-safe-text",
  caution: "bg-caution-bg text-caution-text",
  danger: "bg-danger-bg text-danger-text",
  // Nincs önálló --stale-bg token (a biztonsági blokk FIX) — a semleges
  // --mist hátteret párosítjuk a --stale szöveg/ikon színnel, --line
  // szegéllyel a jobb elkülönítésért.
  stale: "border border-line bg-mist text-stale",
};

function StatusIcon({ status }: { status: StatusSeverity }) {
  switch (status) {
    case "safe":
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
          <circle cx="6" cy="6" r="5.5" fill="currentColor" />
          <path
            d="M3.3 6.1 L5.1 7.9 L8.5 4.1"
            stroke="var(--surface)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case "caution":
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
          <circle cx="6" cy="6" r="5.5" fill="currentColor" />
          <rect x="5.25" y="2.8" width="1.5" height="3.8" fill="var(--surface)" />
          <rect x="5.25" y="7.6" width="1.5" height="1.5" fill="var(--surface)" />
        </svg>
      );
    case "danger":
      return (
        <svg width="13" height="12" viewBox="0 0 13 12" aria-hidden="true" focusable="false">
          <path d="M6.5 0.5 L12.5 11.5 L0.5 11.5 Z" fill="currentColor" />
          <rect x="5.75" y="4" width="1.5" height="3.6" fill="var(--surface)" />
          <rect x="5.75" y="8.6" width="1.5" height="1.5" fill="var(--surface)" />
        </svg>
      );
    case "stale":
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
          <circle
            cx="6"
            cy="6"
            r="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M6 3.2 L6 6.2 L8.2 7.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

/**
 * Státusz-jelvény — 2. fejezet 3. pont: mindig szín + ikon + szöveg hármasban
 * (színtévesztő-biztos forma). A négy szemantika a biztonsági token-blokkot
 * (`--safe*`, `--caution*`, `--danger*`, `--stale`) tükrözi 1:1.
 */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
        CONTAINER_CLASSES[status],
        className,
      )}
    >
      <StatusIcon status={status} />
      {label}
    </span>
  );
}
