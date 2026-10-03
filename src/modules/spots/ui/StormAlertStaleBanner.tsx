/**
 * Elavult viharjelzés-figyelmeztetés — a `StormAlertScreen` (teljes
 * képernyős, AKTUÁLIS riasztás) STALE testvére. Felhasználói döntés
 * (2026-10-02, lásd `SUP_PLATFORM_FEJLESZTESI_DOKUMENTACIO.md` 2. fejezet):
 * ha az utolsó ismert snapshot `forbidden` státuszú, de 30 percnél régebbi
 * (`evaluation.stale`), a figyelmeztetés NEM tűnhet el (az adat szerint
 * SÚLYOS állapot volt), de NEM állíthatja, hogy MOST is érvényes:
 *
 *   - MÚLT IDŐBEN fogalmaz ("volt érvényben", nem "érvényben van");
 *   - `--stale` szín + óra-ikon + szöveg (NEM `--danger`, 2. fejezet 4./7.
 *     pont: a danger család NEM kerülhet interakciós elemre, és itt maga a
 *     jelentés sem "most aktuális veszély");
 *   - nincs `role="alertdialog"`/`aria-modal` — ez NEM a figyelem-elrablós,
 *     nem eldugható modal (az a `StormAlertScreen` szerepe), hanem egy
 *     teljes szélességű, eldugható-mentes, de a dokumentum-folyásban élő
 *     sáv;
 *   - link a hivatalos forrásra (`officialStormSourceUrl`), hogy a
 *     felhasználó indulás előtt maga ellenőrizze az AKTUÁLIS állapotot.
 *
 * A friss (NEM stale) `forbidden` eset változatlanul a `StormAlertScreen`-t
 * kapja — ennek a komponensnek a hívója (`app/routes/spotok.$slug.tsx`)
 * dönt `evaluation.stale` alapján, melyiket rendereli.
 */
import { useTranslation } from "react-i18next";

import { cx, StatusBadge } from "@core/ui";

export interface StormAlertStaleBannerProps {
  /** A `describeAge`-ből számolt, már feloldott kor-felirat ("38 perce"). */
  ageLabel: string;
  /** A hivatalos forrás URL-je (`officialStormSourceUrl`). */
  sourceUrl: string;
  className?: string;
}

export function StormAlertStaleBanner({
  ageLabel,
  sourceUrl,
  className,
}: StormAlertStaleBannerProps) {
  const { t } = useTranslation("spots");

  return (
    <div
      className={cx(
        "flex w-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-mist p-4",
        className,
      )}
    >
      <StatusBadge status="stale" label={t("staleAlert.title")} />
      <p className="text-sm leading-relaxed text-text-2">
        {t("staleAlert.body", { age: ageLabel })}
      </p>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="self-start text-sm font-semibold text-petrol-text underline"
      >
        {t("staleAlert.sourceLink")}
        <span className="sr-only"> ({t("sources.newTab")})</span>
      </a>
    </div>
  );
}
