/**
 * Vízállás-blokk a folyó-spotokhoz (5.1/6).
 *
 * MIT MUTAT: a mért vízállást cm-ben, a tendenciát, és — ha van — a HIVATALOS
 * árvízvédelmi készültségi fokot. A fokozat nem a mi becslésünk: a küszöb-
 * vízállásokat az OVF állapítja meg mércénként, mi csak összehasonlítjuk.
 *
 * TOKEN-SZABÁLYOK (2. fejezet 3.): a készültség státusz-jelzés, ezért
 * StatusBadge-dzsel jelenik meg — szín + ikon + szöveg hármasban, sosem csak
 * színnel. A tendencia NEM státusz (az emelkedő vízállás önmagában nem
 * veszély), ezért semleges, nem-biztonsági megjelenést kap.
 *
 * ADATKOR: a mércék óránként jelentenek, ezért a mérés SAJÁT időbélyegét
 * mutatjuk. A 30 perces stale-küszöb ide NEM alkalmazható — óránkénti forrásnál
 * minden adat „elavult" lenne, ami kiüresítené a jelzést. Külön, a forráshoz
 * illő küszöböt használunk (lásd WATER_STALE_MINUTES).
 */
import { DataAge, StatusBadge } from "@core/ui";

import type { RiverAlertLevel, WaterTrend } from "../types";

/**
 * Ennyi perc után jelöljük elavultnak a vízállást. A mércék ÓRÁNKÉNT
 * jelentenek (Szeged 15 percenként), tehát a 30 perces általános küszöb itt
 * hamis riasztás lenne; a 150 perc két kimaradt jelentést tűr el.
 */
export const WATER_STALE_MINUTES = 150;

export interface WaterLevelProps {
  levelCm: number;
  trend: WaterTrend | null;
  /** null = nincs adat a fokozatról (pl. a mércének nincs hivatalos küszöbe). */
  alertLevel: RiverAlertLevel | null;
  /** A MÉRÉS ideje (ISO) — nem a mi lekérésünké. */
  observedAt: string | null;
  /** Feloldott feliratok (i18n a route-rétegből, hardcode tilos). */
  labels: {
    title: string;
    level: string;
    trend: Record<WaterTrend, string>;
    alert: Record<1 | 2 | 3, string>;
    /** pl. „Mérve: 14:00" */
    observed: string;
    stale: boolean;
    /** A mérce megnevezése (állomás neve), ha ismert. */
    station?: string;
  };
}

const TREND_ARROW: Record<WaterTrend, string> = {
  rising: "↑",
  falling: "↓",
  stable: "→",
};

/** A készültségi fok súlyossága — a III. fok „Tilos", ezért danger. */
const ALERT_SEVERITY: Record<1 | 2 | 3, "caution" | "danger"> = {
  1: "caution",
  2: "danger",
  3: "danger",
};

export function WaterLevel({ levelCm, trend, alertLevel, observedAt, labels }: WaterLevelProps) {
  const alert = alertLevel !== null && alertLevel > 0 ? (alertLevel as 1 | 2 | 3) : null;

  return (
    <section
      aria-label={labels.title}
      className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm font-bold text-ink-deep">{labels.title}</span>
        {alert !== null ? (
          <StatusBadge status={ALERT_SEVERITY[alert]} label={labels.alert[alert]} />
        ) : null}
      </div>

      <p className="text-2xl font-bold text-ink-deep">
        {levelCm} cm
        {trend !== null ? (
          <span className="ml-2 text-base font-semibold text-text-2">
            <span aria-hidden="true">{TREND_ARROW[trend]}</span> {labels.trend[trend]}
          </span>
        ) : null}
      </p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {labels.station ? (
          <span className="text-xs text-text-3">{labels.station}</span>
        ) : null}
        {observedAt !== null ? <DataAge label={labels.observed} stale={labels.stale} /> : null}
      </div>

      <p className="text-xs text-text-3">{labels.level}</p>
    </section>
  );
}
