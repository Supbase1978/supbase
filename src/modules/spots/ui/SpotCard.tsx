/**
 * Spot-kártya a listához (2. fejezet signature-vizualizáció: kártyán a
 * VÍZFELSZÍN-VONAL, nem a mérce — a mérce kizárólag a részletező nézetben
 * jár, lásd `SpotDetailRoute`). Minden felirat a `spots` (és a core)
 * namespace-ből jön — a `SpotStatus` szóhasználata (Kiváló/Óvatosan/
 * Veszélyes/Tilos) a `spots.json` saját `status.*` kulcsaiból, NEM a
 * weather-modulból (1.3 modul-szerződés).
 */
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import {
  Card,
  cx,
  DataAge,
  minutesSince,
  StatusBadge,
  Waterline,
  type StatusSeverity,
  type WaterlineState,
} from "@core/ui";

import type { Difficulty, SpotStatus, WaterType } from "../types";

export interface SpotCardSpot {
  id: string;
  name: string;
  slug: string;
  region: string | null;
  waterType: WaterType;
  difficulty: Difficulty | null;
}

export interface SpotCardEvaluation {
  index: number;
  status: SpotStatus;
  stale: boolean;
  fetchedAt: string;
  flags: { offshoreWind: boolean; neoprene: boolean };
}

export interface SpotCardProps {
  spot: SpotCardSpot;
  evaluation: SpotCardEvaluation | null;
  className?: string;
}

const STATUS_SEVERITY: Record<SpotStatus, StatusSeverity> = {
  safe: "safe",
  caution: "caution",
  danger: "danger",
  // F1.3-reviewer m5: a "forbidden" mindig danger-SZÍNŰ, de a felirata "Tilos"
  // marad (lásd lent, statusLabel a `status.forbidden` kulcsból) — SOHA nem
  // "Veszélyes".
  forbidden: "danger",
};

const WATERLINE_STATE: Record<SpotStatus, WaterlineState> = {
  safe: "calm",
  caution: "choppy",
  danger: "broken",
  forbidden: "broken",
};

export function SpotCard({ spot, evaluation, className }: SpotCardProps) {
  const { t, i18n } = useTranslation("spots");

  const stale = evaluation?.stale ?? false;
  const formattedIndex = evaluation
    ? new Intl.NumberFormat(i18n.language, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(evaluation.index)
    : null;
  const statusWord = evaluation ? t(`status.${evaluation.status}`) : null;
  const statusLabel = evaluation ? `${statusWord} · ${formattedIndex}` : null;
  const waterlineState: WaterlineState | null = evaluation
    ? stale
      ? "stale"
      : WATERLINE_STATE[evaluation.status]
    : null;

  const dataAgeLabel = evaluation
    ? stale
      ? t("stale.label")
      : t("dataAge.updatedMinutesAgo", {
          ns: "core",
          minutes: Math.max(0, Math.round(minutesSince(evaluation.fetchedAt))),
        })
    : null;

  return (
    <Card
      className={className}
      waterline={
        waterlineState ? (
          <Waterline
            state={waterlineState}
            label={`${t("detail.supIndex")} — ${statusLabel ?? t("status.unknown")}`}
          />
        ) : undefined
      }
    >
      <Link to={`/spotok/${spot.slug}`} className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          <span className="text-lg font-semibold text-ink-deep">{spot.name}</span>
          {evaluation && statusLabel ? (
            <StatusBadge status={STATUS_SEVERITY[evaluation.status]} label={statusLabel} />
          ) : null}
        </div>

        <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-text-2">
          {spot.region ? <span>{spot.region}</span> : null}
          <span>{t(`waterType.${spot.waterType}`)}</span>
          {spot.difficulty ? <span>· {t(`difficulty.${spot.difficulty}`)}</span> : null}
        </div>

        {evaluation ? (
          <div className="flex flex-wrap items-center gap-2">
            {stale ? <StatusBadge status="stale" label={t("stale.label")} /> : null}
            {dataAgeLabel ? <DataAge label={dataAgeLabel} stale={stale} /> : null}
            {evaluation.flags.offshoreWind ? (
              <span
                className={cx(
                  "inline-flex items-center rounded-full bg-caution-bg px-2.5 py-1 text-xs font-semibold text-caution-text",
                )}
              >
                {t("flag.offshoreWind")}
              </span>
            ) : null}
            {evaluation.flags.neoprene ? (
              <span className="inline-flex items-center rounded-full border border-line bg-mist px-2.5 py-1 text-xs font-semibold text-text-2">
                {t("flag.neoprene")}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-text-3">{t("detail.noSnapshot")}</p>
        )}
      </Link>
    </Card>
  );
}
