/**
 * Feliratozott beviteli mező az auth-formokhoz. UI-szöveg (label) propból,
 * i18n-kulcsból jön — hardcode tilos. A tokenekből épül (line, surface,
 * petrol fókusz), új token nélkül.
 */
import type { InputHTMLAttributes } from "react";

export interface AuthFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id"> {
  id: string;
  label: string;
}

export function AuthField({ id, label, ...rest }: AuthFieldProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text-2">{label}</span>
      <input
        id={id}
        className="min-h-[var(--tap-min)] rounded-[var(--radius-cta)] border border-line bg-surface px-3 text-base text-ink-deep outline-none focus-visible:border-petrol focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-petrol"
        {...rest}
      />
    </label>
  );
}
