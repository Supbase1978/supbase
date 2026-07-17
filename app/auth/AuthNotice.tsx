/**
 * Nem-interaktív visszajelző sáv az auth-formokhoz (hibák, "elküldve"
 * állapotok). A 2. fejezet szabálya szerint az állapotot SOHA nem csak
 * színnel jelezzük: ikon + szöveg + szín hármas. A `--danger` család
 * interakciós elemen tilos — ez itt statikus `role="alert"`/`role="status"`
 * sáv, nem gomb/link, így megengedett; a semantics-hoz a biztonsági
 * token-blokk szín/háttér párosait használjuk (nincs új token).
 */
import type { ReactNode } from "react";

import { cx } from "@core/ui";

export type AuthNoticeVariant = "success" | "warning" | "info";

export interface AuthNoticeProps {
  variant: AuthNoticeVariant;
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<AuthNoticeVariant, string> = {
  success: "bg-safe-bg text-safe-text",
  warning: "bg-caution-bg text-caution-text",
  info: "border border-line bg-mist text-text-2",
};

function NoticeIcon({ variant }: { variant: AuthNoticeVariant }) {
  if (variant === "success") {
    return (
      <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true" focusable="false" className="mt-0.5 shrink-0">
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
  }
  if (variant === "warning") {
    return (
      <svg width="15" height="14" viewBox="0 0 12 12" aria-hidden="true" focusable="false" className="mt-0.5 shrink-0">
        <circle cx="6" cy="6" r="5.5" fill="currentColor" />
        <rect x="5.25" y="2.8" width="1.5" height="3.8" fill="var(--surface)" />
        <rect x="5.25" y="7.6" width="1.5" height="1.5" fill="var(--surface)" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true" focusable="false" className="mt-0.5 shrink-0">
      <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="5.25" y="5" width="1.5" height="3.8" fill="currentColor" />
      <rect x="5.25" y="3.2" width="1.5" height="1.5" fill="currentColor" />
    </svg>
  );
}

export function AuthNotice({ variant, children, className }: AuthNoticeProps) {
  return (
    <div
      role={variant === "warning" ? "alert" : "status"}
      className={cx(
        "flex items-start gap-2 rounded-[var(--radius-card)] px-3 py-2.5 text-sm",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      <NoticeIcon variant={variant} />
      <span>{children}</span>
    </div>
  );
}
