import type { ReactNode } from "react";

import { cx } from "./cx";

export interface CardProps {
  children: ReactNode;
  /**
   * Opcionális beágyazott vízfelszín-vonal sáv (`Waterline`) — kártyákon ez
   * a signature vizualizáció (2. fejezet 1. pont). A kártya csak elhelyezi,
   * a vizuális állapotot a `Waterline` maga adja.
   */
  waterline?: ReactNode;
  /** Kompakt padding sűrűbb listákhoz (pl. spot-kártyák egymás alatt). */
  padding?: "default" | "compact";
  className?: string;
}

const PADDING_CLASSES: Record<NonNullable<CardProps["padding"]>, string> = {
  default: "p-4",
  compact: "p-3",
};

/** Alap kártya-primitíva: surface háttér, `--radius-card`, alap padding. */
export function Card({
  children,
  waterline,
  padding = "default",
  className,
}: CardProps) {
  return (
    <div
      className={cx(
        "flex flex-col gap-2.5 rounded-[var(--radius-card)] bg-surface shadow-sm",
        PADDING_CLASSES[padding],
        className,
      )}
    >
      {children}
      {waterline ? <div className="mt-1">{waterline}</div> : null}
    </div>
  );
}
