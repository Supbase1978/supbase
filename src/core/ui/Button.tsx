import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";

/**
 * A `--danger` család interakciós elemen (gomb, link) TILOS — ezért a
 * variáns-típusban szándékosan nincs "danger" opció. Veszély jelzésére a
 * `StatusBadge` szolgál, nem a `Button`.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  /**
   * `primary` — amber CTA, mindig sötét (`--text`) felirattal, `--cta-height`
   * magassággal (2. fejezet 7. pont — amber CTA-n sötét felirat kötelező).
   * `secondary` — petrol, `secondary`/harmadlagos súlyú cselekvésekhez.
   * `ghost` — kontúros, alacsony vizuális súlyú cselekvésekhez.
   */
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
}

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-cta)] px-6 text-sm font-semibold " +
  "min-h-[var(--tap-min)] transition-colors focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-petrol disabled:cursor-not-allowed disabled:opacity-50";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Elsődleges CTA: amber háttér, MINDIG sötét szöveg (2. fejezet 7. pont).
  primary: "h-[var(--cta-height)] bg-amber text-text font-bold hover:brightness-95",
  secondary: "bg-petrol text-surface hover:brightness-110",
  ghost: "border border-line bg-transparent text-ink-deep hover:bg-mist",
};

/** Alap gomb-primitíva a tokenekből — lásd 2. fejezet "kőbe vésett" szabályai. */
export function Button({
  variant = "primary",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx(BASE_CLASSES, VARIANT_CLASSES[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
