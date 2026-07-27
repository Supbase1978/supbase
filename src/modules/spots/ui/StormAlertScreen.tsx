/**
 * Teljes képernyős, NEM eldugható riasztás (2. fejezet
 * 4. pont; a `_design-source` "II. fokú viharjelzés riasztás" képernyője az
 * etalon, TOKENEKBŐL újraépítve — a design mélyvörös háttérszíne (#5C1610)
 * NEM token, ezért `--danger`-t használunk teljes képernyős háttérként; ez
 * megengedett, mert a háttér maga NEM interakciós elem. A CTA-k (vízimentő-
 * hívás) emiatt SOSEM `--danger`-színűek — amber, sötét (`--text`) felirattal,
 * a 2. fejezet 7. pontja szerint.
 *
 * Nincs bezárás-gomb és nincs Escape/kattintás-kezelő — a komponens
 * szándékosan nem eldugható, amíg a szülő (a route) ki nem veszi a fából.
 *
 * KÉT OK, KÉT SZÖVEG (`variant`): II. fokú viharjelzés VAGY III. fokú árvízi
 * készültség. Ezt élő teszt kényszerítette ki: árvíznél a viharjelzés-szöveg
 * jelent meg („másodfokú viharjelzés", „várható széllökés: 10 km/h") szélcsend
 * mellett — és a menekülési tanács is szél-specifikus volt („csökkentsd a
 * szélfelületet"), ami áradó folyón félrevezető. A veszély más, a teendő is
 * más; a keret (ikon, vízimentő-CTA, forrás-sor) közös.
 */
import { useTranslation } from "react-i18next";

import { cx } from "@core/ui";

const RESCUE_TEL = "+36303838383";
const RESCUE_TEL_DISPLAY = "+36 30 383 8383";

const STEP_KEYS = ["1", "2", "3"] as const;

/** A riasztás OKA — ettől függ a teljes szöveg (eyebrow, body, teendők). */
export type AlertVariant = "storm" | "flood";

export interface StormAlertScreenProps {
  /**
   * A riasztás oka. Ha MINDKETTŐ fennáll, a hívó a viharjelzést adja meg:
   * a szél az azonnal ható tényező, a menekülési tanács is ahhoz igazodik.
   */
  variant?: AlertVariant;
  /** A spot neve — a riasztás-szöveg kontextusához (`body` interpolál). */
  spotName: string;
  /** A viharjelzés forrása (pl. `weather_snapshots.source`). */
  source: string;
  /** A mérés/jelzés rögzítésének időbélyege (ISO) — a "Frissítve" sorhoz. */
  updatedAt: string;
  /** Széllökés km/h, ha van mérés — csak a viharjelzés-változatban. */
  gustKmh?: number | null;
  /** Vízállás cm, ha van mérés — csak az árvíz-változatban. */
  waterLevelCm?: number | null;
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
  variant = "storm",
  spotName,
  source,
  updatedAt,
  gustKmh,
  waterLevelCm,
  className,
}: StormAlertScreenProps) {
  const { t, i18n } = useTranslation("spots");
  // A két változat i18n-blokkja azonos ALAKÚ, csak a tartalom más.
  const ns = variant === "flood" ? "floodAlert" : "stormAlert";

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
            {t(`${ns}.eyebrow`)}
          </span>
          <h1
            id={titleId}
            className="text-3xl leading-tight font-bold text-surface"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t(`${ns}.headline`)}
          </h1>
        </div>
        <p id={descId} className="text-[15px] leading-relaxed text-surface">
          {t(`${ns}.body`, { spotName })}
          {variant === "storm" && gustKmh != null
            ? ` ${t("stormAlert.bodyGust", { gust: gustKmh })}`
            : ""}
          {variant === "flood" && waterLevelCm != null
            ? ` ${t("floodAlert.bodyLevel", { level: waterLevelCm })}`
            : ""}
        </p>
      </div>

      <div className="mx-6 mt-6 flex flex-col gap-3 rounded-2xl bg-surface/10 p-4">
        <span className="text-xs font-bold tracking-wide text-surface">
          {t(`${ns}.whatToDo`)}
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
              {t(`${ns}.steps.${step}`)}
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
          {t(`${ns}.callRescue`)} · {RESCUE_TEL_DISPLAY}
        </a>
        <span className="text-center text-xs text-surface">
          {t(`${ns}.source`)}: {source}
          {formattedTime ? ` · ${t(`${ns}.updated`)}: ${formattedTime}` : ""}
        </span>
      </div>
    </div>
  );
}
