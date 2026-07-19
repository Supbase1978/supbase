/**
 * II. fokú viharjelzés — teljes képernyős, NEM eldugható riasztás (2. fejezet
 * 4. pont; a `_design-source` "II. fokú viharjelzés riasztás" képernyője az
 * etalon, TOKENEKBŐL újraépítve — a design mélyvörös háttérszíne (#5C1610)
 * NEM token, ezért `--danger`-t használunk teljes képernyős háttérként; ez
 * megengedett, mert a háttér maga NEM interakciós elem. A CTA-k (vízimentő-
 * hívás) emiatt SOSEM `--danger`-színűek — amber, sötét (`--text`) felirattal,
 * a 2. fejezet 7. pontja szerint.
 *
 * Nincs bezárás-gomb és nincs Escape/kattintás-kezelő — a komponens
 * szándékosan nem eldugható, amíg a szülő (a route) ki nem veszi a fából.
 */
import { useTranslation } from "react-i18next";

import { cx } from "@core/ui";

const RESCUE_TEL = "+36303838383";
const RESCUE_TEL_DISPLAY = "+36 30 383 8383";

const STEP_KEYS = ["1", "2", "3"] as const;

export interface StormAlertScreenProps {
  /** A spot neve — a riasztás-szöveg kontextusához (`stormAlert.body` interpolál). */
  spotName: string;
  /** A viharjelzés forrása (pl. `weather_snapshots.source`). */
  source: string;
  /** A mérés/jelzés rögzítésének időbélyege (ISO) — a "Frissítve" sorhoz. */
  updatedAt: string;
  /** Széllökés km/h, ha van mérés — opcionális kiegészítő mondat. */
  gustKmh?: number | null;
  className?: string;
}

function WarningIcon() {
  return (
    <svg width="72" height="64" viewBox="0 0 12 11" aria-hidden="true" focusable="false">
      <path d="M6 0.5 L11.5 10.5 L0.5 10.5 Z" fill="var(--surface)" />
      <rect x="5.3" y="3.6" width="1.4" height="3.4" fill="var(--danger)" />
      <rect x="5.3" y="8" width="1.4" height="1.4" fill="var(--danger)" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M3 13 C3 9 6 8 8 8 C10 8 13 9 13 13 M8 8 C9.7 8 11 6.7 11 5 C11 3.3 9.7 2 8 2 C6.3 2 5 3.3 5 5 C5 6.7 6.3 8 8 8 Z"
        fill="none"
        stroke="var(--text)"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/**
 * Teljes képernyős II. fokú viharjelzés-riasztás. `role="alertdialog"` +
 * `aria-modal` — a hívó route feladata, hogy a tartalom FÖLÉ, a fa tetején
 * rendereljen (lásd `app/routes/spotok.$slug.tsx`).
 */
export function StormAlertScreen({
  spotName,
  source,
  updatedAt,
  gustKmh,
  className,
}: StormAlertScreenProps) {
  const { t, i18n } = useTranslation("spots");

  const updatedDate = new Date(updatedAt);
  const formattedTime = Number.isNaN(updatedDate.getTime())
    ? null
    : new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" }).format(
        updatedDate,
      );

  const titleId = "storm-alert-title";
  const descId = "storm-alert-desc";

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className={cx(
        "fixed inset-0 z-50 flex flex-col overflow-y-auto bg-danger text-surface",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4 px-6 pb-2 pt-10 text-center">
        <WarningIcon />
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold tracking-[0.2em] text-surface uppercase">
            {t("stormAlert.eyebrow")}
          </span>
          <h1
            id={titleId}
            className="text-3xl leading-tight font-bold text-surface"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("stormAlert.headline")}
          </h1>
        </div>
        <p id={descId} className="text-[15px] leading-relaxed text-surface">
          {t("stormAlert.body", { spotName })}
          {gustKmh != null ? ` ${t("stormAlert.bodyGust", { gust: gustKmh })}` : ""}
        </p>
      </div>

      <div className="mx-6 mt-6 flex flex-col gap-3 rounded-2xl bg-surface/10 p-4">
        <span className="text-xs font-bold tracking-wide text-surface">
          {t("stormAlert.whatToDo")}
        </span>
        {STEP_KEYS.map((step) => (
          <div key={step} className="flex items-start gap-3">
            <span
              className="w-5 shrink-0 text-base font-bold text-surface"
              style={{ fontFamily: "var(--font-display)" }}
              aria-hidden="true"
            >
              {step}
            </span>
            <span className="text-sm leading-relaxed text-surface">
              {t(`stormAlert.steps.${step}`)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3 p-6">
        {/* Vízimentő-hívó CTA — amber háttér, MINDIG sötét (--text) felirat,
            SOHA nem --danger-színű (2. fejezet 7. pont). */}
        <a
          href={`tel:${RESCUE_TEL}`}
          className="inline-flex min-h-[var(--cta-height)] items-center justify-center gap-2 rounded-[var(--radius-cta)] bg-amber px-6 text-base font-bold text-text"
        >
          <PhoneIcon />
          {t("stormAlert.callRescue")} · {RESCUE_TEL_DISPLAY}
        </a>
        <span className="text-center text-xs text-surface">
          {t("stormAlert.source")}: {source}
          {formattedTime ? ` · ${t("stormAlert.updated")}: ${formattedTime}` : ""}
        </span>
      </div>
    </div>
  );
}
