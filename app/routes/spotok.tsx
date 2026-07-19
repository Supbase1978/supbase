/**
 * /spotok — spot-lista (F1.4 váz). VÉKONY loader: spots + legfrissebb
 * weather_snapshots + a weather-modul SUP-index kiértékelése — a spots és a
 * weather modul összekötése KIZÁRÓLAG itt, a route-rétegben történik (a
 * spots-modul maga nem importálhat a weather-modulból, 1.3 modul-szerződés,
 * lásd `src/modules/spots/module.ts`).
 *
 * A komponens: SpotMap (MapLibre, réteg-kapcsolókkal) + waterType-szűrőchipek
 * + SpotCard-rács — a spots-modul UI-komponenseiből komponálva.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { getLocaleFromPath, pickTranslated } from "@core/i18n";
import { cx } from "@core/ui";
import { listLatestSnapshots, listSpots } from "@modules/spots/data/spots.server";
import { pointFromGeom } from "@modules/spots/data/wkb";
import { SpotCard } from "@modules/spots/ui/SpotCard";
import { SpotMap, type SpotMapMarker } from "@modules/spots/ui/SpotMap";
import type {
  Difficulty,
  SpotRow,
  SpotStatus,
  WaterType,
  WeatherSnapshotRow,
} from "@modules/spots/types";
import { loadSupIndexConfig } from "@modules/weather/sup-index/config.server";
import type { SupIndexConfig } from "@modules/weather/sup-index/config";
import { evaluateSnapshot } from "@modules/weather/sup-index/reading";
import type { SupIndexInput } from "@modules/weather/sup-index/types";

import type { Route } from "./+types/spotok";

interface SpotListItemEvaluation {
  index: number;
  status: SpotStatus;
  stale: boolean;
  fetchedAt: string;
  flags: { offshoreWind: boolean; neoprene: boolean };
}

interface SpotListItem {
  id: string;
  name: string;
  slug: string;
  region: string | null;
  waterType: WaterType;
  difficulty: Difficulty | null;
  lat: number | null;
  lng: number | null;
  protectedArea: boolean;
  evaluation: SpotListItemEvaluation | null;
}

/**
 * A spot + snapshot → SUP-index kiértékelés. Ha a snapshot hiányzik VAGY a
 * kiértékeléshez szükséges alapmezők (szél/lökés/irány) nincsenek meg,
 * `null`-t ad — a UI ilyenkor "nincs mérés" state-et mutat index nélkül.
 *
 * FONTOS (F1.3-reviewer m5 átadási feltétele): II. fokú viharjelzésnél
 * (`storm_level === 2`) a spots-UI mindig `"forbidden"` státuszt kap, NEM a
 * weather-modul `"danger"` `SupIndexStatus`-át — a leképezés itt, a
 * route-rétegben történik, a spots-modul saját `SpotStatus` típusára.
 */
function evaluateSpotSnapshot(
  spot: Pick<SpotRow, "shore_bearing_deg" | "water_type">,
  snapshot: WeatherSnapshotRow,
  config: SupIndexConfig,
): SpotListItemEvaluation | null {
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
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  const locale = getLocaleFromPath(new URL(request.url).pathname);
  const { supabase } = createSupabaseServerClient(request);

  const spots = await listSpots(supabase);
  const [snapshots, config] = await Promise.all([
    listLatestSnapshots(supabase, spots.map((spot) => spot.id)),
    loadSupIndexConfig(supabase),
  ]);

  const items: SpotListItem[] = spots.map((spot) => {
    const point = pointFromGeom(spot.geom);
    const snapshot = snapshots.get(spot.id);
    const evaluation = snapshot ? evaluateSpotSnapshot(spot, snapshot, config) : null;

    return {
      id: spot.id,
      name: spot.name,
      slug: pickTranslated(spot.slug, locale),
      region: spot.region,
      waterType: spot.water_type,
      difficulty: spot.difficulty,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      protectedArea: spot.protected_area !== null,
      evaluation,
    };
  });

  return { items };
}

/** A szűrőchipek sorrendje — a spots.water_type CHECK-értékei (3.1). */
const WATER_TYPE_FILTERS: readonly WaterType[] = ["to", "folyo", "holtag", "csatorna"];

export const meta: Route.MetaFunction = () => {
  return [{ title: "[APPNÉV] — Spotok" }];
};

export default function SpotsListRoute({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation("spots");
  const navigate = useNavigate();
  const { items } = loaderData;

  // Kliens-oldali waterType-szűrő: null = mind. A térkép a szűrt listát kapja.
  const [filter, setFilter] = useState<WaterType | null>(null);
  const visible = filter ? items.filter((item) => item.waterType === filter) : items;

  const markers: SpotMapMarker[] = useMemo(
    () =>
      visible
        .filter((item) => item.lat !== null && item.lng !== null)
        .map((item) => ({
          id: item.id,
          name: item.name,
          slug: item.slug,
          lat: item.lat as number,
          lng: item.lng as number,
          status: item.evaluation?.status ?? null,
          stale: item.evaluation?.stale ?? false,
          protectedArea: item.protectedArea,
        })),
    [visible],
  );

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1
          className="text-3xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("list.title")}
        </h1>
        <p className="text-text-2">{t("list.lead")}</p>
      </header>

      <SpotMap
        spots={markers}
        onSelect={(slug) => void navigate(`/spotok/${slug}`)}
        className="h-[50vh] min-h-[280px] lg:h-[60vh]"
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label={t("list.title")}>
        <FilterChip active={filter === null} label={t("list.title")} onClick={() => setFilter(null)} />
        {WATER_TYPE_FILTERS.map((waterType) => (
          <FilterChip
            key={waterType}
            active={filter === waterType}
            label={t(`waterType.${waterType}`)}
            onClick={() => setFilter((prev) => (prev === waterType ? null : waterType))}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-text-2">{t("list.empty")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <li key={item.id}>
              <SpotCard
                spot={{
                  id: item.id,
                  name: item.name,
                  slug: item.slug,
                  region: item.region,
                  waterType: item.waterType,
                  difficulty: item.difficulty,
                }}
                evaluation={item.evaluation}
                className="h-full"
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "min-h-[var(--tap-min)] rounded-full border px-4 text-sm font-semibold transition-colors",
        active
          ? "border-ink-deep bg-ink-deep text-surface"
          : "border-line bg-surface text-text-2 hover:text-petrol-text",
      )}
    >
      {label}
    </button>
  );
}
