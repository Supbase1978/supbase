/**
 * Biztonsági tudnivaló — ÁLLANDÓ érvényű tanács, NEM aktuális állapotjelzés.
 *
 * MIÉRT NEM StatusBadge/Waterline-szerű megjelenés: a `--safe/--caution/--danger`
 * család a MÉRT, ÉPPEN FENNÁLLÓ állapotot jelöli (2. fejezet 3.). Egy mindig
 * érvényes szabály (pl. „folyón más póráz kell") ezekben a színekben
 * felhígítaná a státusz-szemantikát: a felhasználó megszokná a sárga/piros
 * sávot ott, ahol nincs is friss veszély. Ezért a természetvédelmi blokk
 * bevált mintáját követi: semleges `sand` kiemelés, saját ikonnal.
 *
 * A szöveg a hívótól jön (i18n), a komponens nem tartalmaz hardcode feliratot.
 */
import type { ReactNode } from "react";

import { cx } from "./cx";

export interface SafetyNoteProps {
  title: string;
  children: ReactNode;
  className?: string;
}

function LifeRingIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <circle cx="10" cy="10" r="8" fill="none" stroke="var(--ink-deep)" strokeWidth="2" />
      <circle cx="10" cy="10" r="3" fill="none" stroke="var(--ink-deep)" strokeWidth="2" />
      <path
        d="M10 2 L10 7 M10 13 L10 18 M2 10 L7 10 M13 10 L18 10"
        stroke="var(--ink-deep)"
        strokeWidth="2"
      />
    </svg>
  );
}

export function SafetyNote({ title, children, className }: SafetyNoteProps) {
  return (
    <section
      aria-label={title}
      className={cx("flex flex-col gap-1 rounded-[var(--radius-card)] bg-sand p-4", className)}
    >
      <span className="flex items-center gap-2 text-sm font-bold text-ink-deep">
        <LifeRingIcon />
        {title}
      </span>
      <div className="text-sm leading-relaxed text-text-2">{children}</div>
    </section>
  );
}
