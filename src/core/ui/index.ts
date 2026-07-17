/**
 * Core UI-primitívek (F1.1) — kizárólag a `tokens.css` tokenjeiből építve,
 * a 2. fejezet "kőbe vésett" komponens-szabályai szerint. Modul-szerződés:
 * ez a barrel a `@core/ui` belépési pontja (modulok innen importálhatnak).
 */

export { Button } from "./Button";
export type { ButtonProps, ButtonVariant } from "./Button";

export { Card } from "./Card";
export type { CardProps } from "./Card";

export { StatusBadge } from "./StatusBadge";
export type { StatusBadgeProps, StatusSeverity } from "./StatusBadge";

export { Waterline } from "./Waterline";
export type { WaterlineProps, WaterlineState } from "./Waterline";

export { Gauge, DEFAULT_GAUGE_THRESHOLDS } from "./Gauge";
export type { GaugeProps, GaugeThresholds } from "./Gauge";

export { DataAge } from "./DataAge";
export type { DataAgeProps } from "./DataAge";

export { isStale, minutesSince, STALE_THRESHOLD_MINUTES } from "./data-age";

export { cx } from "./cx";
