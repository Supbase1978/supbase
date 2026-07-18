/**
 * weather-sync — tiszta batch-orchestráció (óránkénti cron, 9./5.1).
 *
 * Minden spotra: Open-Meteo aktuális adat → SUP-index (advisor_weights supindex.*
 * konfigból) → weather_snapshots sor (source='open-meteo'). A storm_level az
 * AKTUÁLIS ismert szint: az utolsó snapshot storm_level-jét visszük tovább
 * (viharjelzést a storm-alert cron állít; ha nincs frissebb, ez marad érvényben).
 *
 * Az I/O (fetch, DB-írás) INJEKTÁLT, így a batch Node/Vitest alól hálózat nélkül
 * tesztelhető. HIBATŰRŐ: egy spot hibája (fetch/parse/insert) NEM buktatja a
 * többit — a hiba a summary-ba kerül, a batch fut tovább.
 */
import type { SupIndexConfig } from "./sup-index.ts";
import { computeSupIndex } from "./sup-index.ts";
import type { WeatherSnapshotDraft } from "./open-meteo.ts";
import type { StormLevel, WaterType, WeatherSnapshotRow } from "./types.ts";

/** Egy szinkronizálandó spot (a spots táblából + legutóbbi ismert viharfok). */
export interface SyncSpot {
  id: string;
  lat: number;
  lon: number;
  shore_bearing_deg: number | null;
  water_type: WaterType;
  /** Kérjen-e marine vízhőt (tenger-spot). Belvíznél false. */
  includeMarine: boolean;
  /** A spot legutóbbi ismert viharfoka (utolsó snapshot storm_level-je). */
  lastStormLevel: StormLevel;
}

export interface WeatherSyncDeps {
  /** Open-Meteo draft lekérése egy spotra (index.ts: fetchOpenMeteoSnapshot). */
  fetchSnapshot: (spot: SyncSpot) => Promise<WeatherSnapshotDraft>;
  /** Egy weather_snapshots sor beszúrása (index.ts: service_role kliens). */
  insertSnapshot: (row: WeatherSnapshotRow) => Promise<void>;
  /** SUP-index konfig (advisor_weights supindex.* → parseSupIndexConfig). */
  config: SupIndexConfig;
  /** Injektálható "most" a determinisztikus fetched_at-hoz (default: new Date()). */
  now?: () => Date;
}

export interface SpotSyncError {
  spotId: string;
  message: string;
}

export interface WeatherSyncSummary {
  total: number;
  ok: number;
  failed: number;
  errors: SpotSyncError[];
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Egy draftból + spot-geometriából weather_snapshots sor (SUP-index számítással).
 * A SUP-index csak akkor számítható, ha van szél-adat; szél híján sup_index null,
 * de a sort így is rögzítjük (auditálható, "nincs mérés" állapot).
 */
export function buildSnapshotRow(
  spot: SyncSpot,
  draft: WeatherSnapshotDraft,
  config: SupIndexConfig,
  fetchedAt: string,
): WeatherSnapshotRow {
  let supIndex: number | null = null;
  if (draft.wind_kmh !== null && draft.wind_dir_deg !== null) {
    const { index } = computeSupIndex(
      {
        wind_kmh: draft.wind_kmh,
        gust_kmh: draft.gust_kmh ?? draft.wind_kmh,
        wind_dir_deg: draft.wind_dir_deg,
        water_temp_c: draft.water_temp_c,
        storm_level: spot.lastStormLevel,
        shore_bearing_deg: spot.shore_bearing_deg,
        water_type: spot.water_type,
      },
      config,
    );
    supIndex = index;
  }

  return {
    spot_id: spot.id,
    wind_kmh: draft.wind_kmh,
    gust_kmh: draft.gust_kmh,
    wind_dir_deg: draft.wind_dir_deg,
    water_temp_c: draft.water_temp_c,
    air_temp_c: draft.air_temp_c,
    storm_level: spot.lastStormLevel,
    sup_index: supIndex,
    source: draft.source,
    fetched_at: fetchedAt,
  };
}

/**
 * A teljes batch. Spotonként külön try/catch: egy elhalás nem viszi a többit.
 * Determinisztikus, szekvenciális bejárás (a rate-limit-barát, kiszámítható
 * naplózásért — a spot-szám kicsi, 15).
 */
export async function runWeatherSync(
  spots: readonly SyncSpot[],
  deps: WeatherSyncDeps,
): Promise<WeatherSyncSummary> {
  const now = deps.now ?? (() => new Date());
  const errors: SpotSyncError[] = [];
  let ok = 0;

  for (const spot of spots) {
    try {
      const draft = await deps.fetchSnapshot(spot);
      const row = buildSnapshotRow(spot, draft, deps.config, now().toISOString());
      await deps.insertSnapshot(row);
      ok += 1;
    } catch (err) {
      errors.push({ spotId: spot.id, message: errorMessage(err) });
    }
  }

  return { total: spots.length, ok, failed: errors.length, errors };
}
