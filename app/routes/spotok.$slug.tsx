/**
 * /spotok/:slug — spot-részletező (F1.4 váz). VÉKONY loader/action: a
 * spots-adatréteg + a weather-modul SUP-index kiértékelésének összekötése
 * KIZÁRÓLAG itt, a route-rétegben történik (1.3 modul-szerződés, lásd
 * `src/modules/spots/module.ts` és a spotok.tsx testvér-route azonos
 * kommentjét — a `evaluateSpotSnapshot` helper szándékosan duplikált a két
 * route-fájl között, hogy a spots-modul ne kelljen weathert importálnia és a
 * weather-modul se spots-ot).
 *
 * A komponens F1.4-vázként natív form-elemekkel (select+textarea) + a
 * core/ui `Button`/`StatusBadge`/`Card` primitívekkel épül — a ui-builder
 * cseréli Gauge/StormAlert-re és finomítja a réteget (TODO-k jelölik a
 * helyeket).
 */
import { useTranslation } from "react-i18next";
import { data, Form, Link } from "react-router";

import { getUser, requireUser } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { isEmailConfirmed } from "@core/auth/email-confirmed";
import { getLocaleFromPath, pickTranslated } from "@core/i18n";
import { Button, Card, DataAge, Gauge, minutesSince, StatusBadge } from "@core/ui";
import { SpotMap } from "@modules/spots/ui/SpotMap";
import { StormAlertScreen } from "@modules/spots/ui/StormAlertScreen";
import {
  getLatestSnapshot,
  getSpotBySlug,
  insertReport,
  listReports,
} from "@modules/spots/data/spots.server";
import { pointFromGeom } from "@modules/spots/data/wkb";
import {
  isReportConditions,
  REPORT_CONDITIONS,
  type SpotRow,
  type SpotStatus,
  type WeatherSnapshotRow,
} from "@modules/spots/types";
import type { SupIndexConfig } from "@modules/weather/sup-index/config";
import { loadSupIndexConfig } from "@modules/weather/sup-index/config.server";
import { evaluateSnapshot } from "@modules/weather/sup-index/reading";
import type { SupIndexInput } from "@modules/weather/sup-index/types";

import type { Route } from "./+types/spotok.$slug";

interface SpotDetailEvaluation {
  index: number;
  status: SpotStatus;
  stale: boolean;
  fetchedAt: string;
  flags: { offshoreWind: boolean; neoprene: boolean };
  /** Indoklás i18n-kulcsként (weather namespace) + interpolációs paraméterek. */
  reason: { key: string; params: Record<string, string | number> };
}

/** Lásd a spotok.tsx azonos nevű helperének kommentjét — szándékos duplikáció. */
function evaluateSpotSnapshot(
  spot: Pick<SpotRow, "shore_bearing_deg" | "water_type">,
  snapshot: WeatherSnapshotRow,
  config: SupIndexConfig,
): SpotDetailEvaluation | null {
  const { wind_kmh, gust_kmh, wind_dir_deg } = snapshot;
  if (wind_kmh === null || gust_kmh === null || wind_dir_deg === null) {
    return null;
  }

  const input: SupIndexInput = {
    wind_kmh,
    gust_kmh,
    wind_dir_deg,
    water_temp_c: snapshot.water_temp_c,
    storm_level: snapshot.storm_level,
    shore_bearing_deg: spot.shore_bearing_deg,
    water_type: spot.water_type,
  };

  const reading = evaluateSnapshot({ input, fetchedAt: snapshot.fetched_at, config });
  const status: SpotStatus = snapshot.storm_level === 2 ? "forbidden" : reading.result.status;

  return {
    index: reading.result.index,
    status,
    stale: reading.stale,
    fetchedAt: snapshot.fetched_at,
    flags: {
      offshoreWind: reading.result.flags.offshoreWind,
      neoprene: reading.result.flags.neoprene,
    },
    reason: reading.result.reason,
  };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  const locale = getLocaleFromPath(new URL(request.url).pathname);
  const { supabase } = createSupabaseServerClient(request);

  const spotRow = await getSpotBySlug(supabase, slug);
  if (!spotRow) {
    throw new Response("Not Found", { status: 404 });
  }

  const [snapshotRow, config, reportRows, user] = await Promise.all([
    getLatestSnapshot(supabase, spotRow.id),
    loadSupIndexConfig(supabase),
    listReports(supabase, spotRow.id),
    getUser(request),
  ]);

  const point = pointFromGeom(spotRow.geom);
  const evaluation = snapshotRow ? evaluateSpotSnapshot(spotRow, snapshotRow, config) : null;

  return {
    spot: {
      id: spotRow.id,
      slug: pickTranslated(spotRow.slug, locale),
      name: spotRow.name,
      region: spotRow.region,
      country: spotRow.country,
      waterType: spotRow.water_type,
      difficulty: spotRow.difficulty,
      stormWarningRegion: spotRow.storm_warning_region,
      seasonInfo: pickTranslated(spotRow.season_info, locale) || null,
      accessInfo: pickTranslated(spotRow.access_info, locale) || null,
      safetyNotes: pickTranslated(spotRow.safety_notes, locale) || null,
      protectedAreaName: spotRow.protected_area?.name
        ? pickTranslated(spotRow.protected_area.name, locale)
        : null,
      protectedAreaRules: spotRow.protected_area?.rules
        ? pickTranslated(spotRow.protected_area.rules, locale)
        : null,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
    },
    snapshot: snapshotRow
      ? {
          fetchedAt: snapshotRow.fetched_at,
          windKmh: snapshotRow.wind_kmh,
          gustKmh: snapshotRow.gust_kmh,
          waterTempC: snapshotRow.water_temp_c,
          airTempC: snapshotRow.air_temp_c,
          waveCm: snapshotRow.wave_cm,
          stormLevel: snapshotRow.storm_level,
          source: snapshotRow.source,
        }
      : null,
    evaluation,
    // A Gauge sávhatárai a supindex.* konfigból (F1.1-jegyzet szerint bekötve).
    gaugeThresholds: { caution: config.threshold.caution, safe: config.threshold.excellent },
    reports: reportRows.map((report) => ({
      id: report.id,
      conditions: report.conditions,
      note: report.note,
      createdAt: report.created_at,
    })),
    reportForm: {
      isLoggedIn: Boolean(user),
      isEmailConfirmed: isEmailConfirmed(user),
    },
  };
}

type ActionResult =
  | { ok: true }
  | {
      ok: false;
      errorKey:
        | "reports.confirmPrompt"
        | "reports.invalidConditions"
        | "reports.error";
    };

export async function action({ request, params }: Route.ActionArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  // requireUser-guard (kijelentkezes.tsx/belepes.tsx mintája): nincs session
  // → redirect a locale-helyes belépőre, redirectTo-val az aktuális útvonalra.
  const user = await requireUser(request);

  const { supabase, headers } = createSupabaseServerClient(request);

  if (!isEmailConfirmed(user)) {
    return data<ActionResult>({ ok: false, errorKey: "reports.confirmPrompt" }, { headers });
  }

  const spotRow = await getSpotBySlug(supabase, slug);
  if (!spotRow) {
    throw new Response("Not Found", { status: 404 });
  }

  const formData = await request.formData();
  const conditions = String(formData.get("conditions") ?? "");
  const noteRaw = formData.get("note");
  const note = typeof noteRaw === "string" && noteRaw.trim().length > 0 ? noteRaw.trim() : null;

  if (!isReportConditions(conditions)) {
    return data<ActionResult>({ ok: false, errorKey: "reports.invalidConditions" }, { headers });
  }

  const result = await insertReport(supabase, {
    spot_id: spotRow.id,
    user_id: user.id,
    conditions,
    note,
  });

  if (!result.ok) {
    return data<ActionResult>({ ok: false, errorKey: result.errorKey }, { headers });
  }

  return data<ActionResult>({ ok: true }, { headers });
}

export const meta: Route.MetaFunction = ({ data: loaderData }) => {
  return [{ title: `[APPNÉV] — ${loaderData?.spot.name ?? "Spot"}` }];
};

const STATUS_SEVERITY: Record<SpotStatus, "safe" | "caution" | "danger"> = {
  safe: "safe",
  caution: "caution",
  danger: "danger",
  // m5: a "forbidden" danger-SZÍNŰ, de a felirata mindig "Tilos" (status.forbidden).
  forbidden: "danger",
};

export default function SpotDetailRoute({ loaderData, actionData }: Route.ComponentProps) {
  const { t, i18n } = useTranslation("spots");
  const { spot, snapshot, evaluation, gaugeThresholds, reports, reportForm } = loaderData;

  const formattedIndex = evaluation
    ? new Intl.NumberFormat(i18n.language, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(evaluation.index)
    : null;
  const statusLabel = evaluation ? t(`status.${evaluation.status}`) : null;

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      {/* II. fokú viharjelzés: teljes képernyős, NEM eldugható riasztás a
          tartalom FÖLÉ (2. fejezet 4. pont; F1.3-reviewer m5). */}
      {evaluation?.status === "forbidden" && snapshot ? (
        <StormAlertScreen
          spotName={spot.name}
          source={snapshot.source}
          updatedAt={snapshot.fetchedAt}
          gustKmh={snapshot.gustKmh}
        />
      ) : null}

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1
            className="text-3xl font-semibold text-ink-deep"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {spot.name}
          </h1>
          {evaluation && statusLabel ? (
            <StatusBadge
              status={STATUS_SEVERITY[evaluation.status]}
              label={`${statusLabel} · ${formattedIndex}`}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-2">
          {spot.region ? <span>{[spot.region, spot.country].filter(Boolean).join(" · ")}</span> : null}
          <span>· {t(`waterType.${spot.waterType}`)}</span>
          {spot.difficulty ? <span>· {t(`difficulty.${spot.difficulty}`)}</span> : null}
        </div>
        {evaluation ? (
          <DataAge
            label={
              evaluation.stale
                ? t("stale.label")
                : t("dataAge.updatedMinutesAgo", {
                    ns: "core",
                    minutes: Math.max(0, Math.round(minutesSince(evaluation.fetchedAt))),
                  })
            }
            stale={evaluation.stale}
          />
        ) : null}
      </header>

      <Card>
        <h2 className="text-lg font-semibold text-ink-deep">{t("detail.supIndex")}</h2>
        {evaluation ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <span
                className="text-5xl font-bold text-ink-deep"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {formattedIndex}
              </span>
              <span className="text-sm text-text-3">/ 10</span>
            </div>
            <Gauge
              value={evaluation.index}
              thresholds={gaugeThresholds}
              stale={evaluation.stale}
              label={`${t("detail.supIndex")} ${formattedIndex}, ${statusLabel}`}
            />
            <p className="text-sm text-text-2">
              {t(evaluation.reason.key, { ns: "weather", ...evaluation.reason.params })}
            </p>
            {evaluation.stale ? (
              <div className="flex flex-col gap-1 rounded-[var(--radius-card)] bg-mist p-3">
                <StatusBadge status="stale" label={t("stale.label")} />
                <p className="text-sm text-text-2">{t("stale.hint")}</p>
              </div>
            ) : null}
            {evaluation.flags.offshoreWind ? (
              <div className="flex flex-col gap-1 rounded-[var(--radius-card)] bg-caution-bg p-3">
                <span className="text-sm font-bold text-caution-text">
                  {t("flag.offshoreWind")}
                </span>
                <p className="text-sm text-caution-text">{t("flag.offshoreWindHint")}</p>
              </div>
            ) : null}
            {evaluation.flags.neoprene ? (
              <div className="rounded-[var(--radius-card)] border border-line bg-mist p-3 text-sm font-semibold text-text-2">
                {t("flag.neoprene")}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-text-2">{t("detail.noSnapshot")}</p>
        )}
        {snapshot ? (
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-text-2">
            {snapshot.windKmh !== null ? (
              <div>
                <dt className="inline font-semibold">{t("detail.wind")}: </dt>
                <dd className="inline">{snapshot.windKmh} km/h</dd>
              </div>
            ) : null}
            {snapshot.gustKmh !== null ? (
              <div>
                <dt className="inline font-semibold">{t("detail.gust")}: </dt>
                <dd className="inline">{snapshot.gustKmh} km/h</dd>
              </div>
            ) : null}
            {snapshot.waterTempC !== null ? (
              <div>
                <dt className="inline font-semibold">{t("detail.waterTemp")}: </dt>
                <dd className="inline">{snapshot.waterTempC} °C</dd>
              </div>
            ) : null}
            {snapshot.airTempC !== null ? (
              <div>
                <dt className="inline font-semibold">{t("detail.airTemp")}: </dt>
                <dd className="inline">{snapshot.airTempC} °C</dd>
              </div>
            ) : null}
            {snapshot.waveCm !== null ? (
              <div>
                <dt className="inline font-semibold">{t("detail.wave")}: </dt>
                <dd className="inline">{snapshot.waveCm} cm</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </Card>

      {spot.protectedAreaName ? (
        // Természetvédelmi blokk — kiemelt, de NEM danger-jellegű sáv (sand).
        <div className="flex flex-col gap-1 rounded-[var(--radius-card)] bg-sand p-4">
          <span className="text-sm font-bold text-ink-deep">
            {t("detail.protectedArea")}: {spot.protectedAreaName}
          </span>
          {spot.protectedAreaRules ? (
            <p className="text-sm text-text-2">
              <span className="font-semibold">{t("detail.protectedRules")}: </span>
              {spot.protectedAreaRules}
            </p>
          ) : null}
        </div>
      ) : null}

      <Card>
        <dl className="flex flex-col gap-3 text-sm text-text-2">
          {spot.stormWarningRegion ? (
            <div>
              <dt className="inline font-semibold text-ink-deep">{t("detail.stormRegion")}: </dt>
              <dd className="inline">{spot.stormWarningRegion}</dd>
            </div>
          ) : null}
          {spot.seasonInfo ? (
            <div>
              <dt className="font-semibold text-ink-deep">{t("detail.season")}</dt>
              <dd>{spot.seasonInfo}</dd>
            </div>
          ) : null}
          {spot.accessInfo ? (
            <div>
              <dt className="font-semibold text-ink-deep">{t("detail.access")}</dt>
              <dd>{spot.accessInfo}</dd>
            </div>
          ) : null}
          {spot.safetyNotes ? (
            <div>
              <dt className="font-semibold text-ink-deep">{t("detail.safety")}</dt>
              <dd>{spot.safetyNotes}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      {spot.lat !== null && spot.lng !== null ? (
        <section aria-label={t("map.focusMap")} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-ink-deep">{t("detail.map")}</h2>
          <SpotMap
            spots={[
              {
                id: spot.id,
                name: spot.name,
                slug: spot.slug,
                lat: spot.lat,
                lng: spot.lng,
                status: evaluation?.status ?? null,
                stale: evaluation?.stale ?? false,
                protectedArea: spot.protectedAreaName !== null,
              },
            ]}
            center={{ lat: spot.lat, lng: spot.lng }}
            zoom={12}
            interactive={false}
            className="h-[240px]"
          />
        </section>
      ) : null}

      <Card>
        <h2 className="text-lg font-semibold text-ink-deep">{t("reports.title")}</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-text-2">{t("reports.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reports.map((report) => (
              <li key={report.id} className="text-sm text-text-2">
                <span className="font-semibold">
                  {t(`reports.conditions.${report.conditions}`)}
                </span>
                {report.note ? <span> — {report.note}</span> : null}
              </li>
            ))}
          </ul>
        )}

        {reportForm.isLoggedIn ? (
          reportForm.isEmailConfirmed ? (
            <Form method="post" className="mt-2 flex flex-col gap-3">
              <h3 className="font-semibold text-ink-deep">{t("reports.formTitle")}</h3>
              <label htmlFor="conditions" className="text-sm font-semibold text-text-2">
                {t("reports.conditionsLabel")}
              </label>
              <select
                id="conditions"
                name="conditions"
                required
                defaultValue={REPORT_CONDITIONS[0]}
                className="rounded-[var(--radius-card)] border border-line px-3 py-2 text-sm"
              >
                {REPORT_CONDITIONS.map((condition) => (
                  <option key={condition} value={condition}>
                    {t(`reports.conditions.${condition}`)}
                  </option>
                ))}
              </select>
              <label htmlFor="note" className="text-sm font-semibold text-text-2">
                {t("reports.note")}
              </label>
              <textarea
                id="note"
                name="note"
                rows={3}
                className="rounded-[var(--radius-card)] border border-line px-3 py-2 text-sm"
              />
              <Button type="submit" variant="primary">
                {t("reports.submit")}
              </Button>
              {actionData && !actionData.ok ? (
                <StatusBadge status="caution" label={t(actionData.errorKey)} />
              ) : null}
              {actionData?.ok ? (
                <StatusBadge status="safe" label={t("reports.success")} />
              ) : null}
            </Form>
          ) : (
            <p className="mt-2 text-sm text-text-2">{t("reports.confirmPrompt")}</p>
          )
        ) : (
          <p className="mt-2 text-sm text-text-2">
            {t("reports.loginPrompt")}{" "}
            <Link to="/belepes" className="font-semibold text-petrol underline">
              {t("reports.loginCta")}
            </Link>
          </p>
        )}
      </Card>
    </main>
  );
}
