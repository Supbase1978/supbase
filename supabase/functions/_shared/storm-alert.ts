/**
 * storm-alert — tiszta orchestráció (5 perces cron szezonban, 9. fejezet 1–2.).
 *
 * BM OKF viharjelzés-scrape → körzetenkénti szint → szintváltás-detektálás az
 * érintett `storm_warning_region` spotjainak LEGUTÓBBI snapshotja alapján →
 * szintváltásnál új weather_snapshots sor (source='bm-okf', SUP-index a
 * storm-override-dal ÚJRASZÁMOLVA). A push-küldés maga F1.9 (9./2–4.) — itt csak
 * a szintváltás-tény naplózása és egy notifyStormChange() TODO-hook marad.
 *
 * ADATKOR (2. fejezet 5. szabály): cache-elt viharjelzés SOHA nem aktuális — a
 * beírt sor fetched_at-ja MINDIG a scrape pillanata (deps.now()).
 */
import { computeSupIndex, type SupIndexConfig } from "./sup-index.ts";
import {
  detectPageLevel,
  detectStormLevelChanges,
  type StormLevelChange,
  type StormSource,
} from "./storm-scrape.ts";
import type { StormLevel, WaterType, WeatherSnapshotRow } from "./types.ts";

/** Egy spot legutóbbi ismert mérése + geometriája (a SUP-index újraszámításhoz). */
export interface RegionSpotState {
  spotId: string;
  shore_bearing_deg: number | null;
  water_type: WaterType;
  wind_kmh: number | null;
  gust_kmh: number | null;
  wind_dir_deg: number | null;
  water_temp_c: number | null;
  air_temp_c: number | null;
  /** A spot legutóbbi ismert viharfoka (a szintváltás előtti állapot). */
  lastStormLevel: StormLevel;
}

/** Egy viharjelzési körzet állapota: előző szint + a hozzá tartozó spotok. */
export interface RegionState {
  region: string;
  /** A körzet legutóbbi ismert (körzet-szintű) viharfoka. */
  previousLevel: StormLevel;
  spots: RegionSpotState[];
}

export interface StormAlertDeps {
  /** Körzetenkénti forrás-oldalak (default: DEFAULT_STORM_SOURCES; Fertő nincs). */
  sources: readonly StormSource[];
  /** Egy forrás-URL HTML-jének letöltése (index.ts: valós fetch). */
  fetchHtml: (url: string) => Promise<string>;
  /** Körzet-állapotok a DB-ből (előző szint + spotok legutóbbi snapshotja). */
  getRegionStates: () => Promise<RegionState[]>;
  /** Egy weather_snapshots sor beszúrása (service_role kliens). */
  insertSnapshot: (row: WeatherSnapshotRow) => Promise<void>;
  config: SupIndexConfig;
  /** Injektálható "most" — a fetched_at (scrape-idő) forrása. */
  now?: () => Date;
}

export interface StormAlertSummary {
  /** A friss scrape körzetenkénti fokozata (csak a megerősített körzetek). */
  levels: Record<string, StormLevel>;
  /** A detektált körzet-szintváltások (from → to). */
  changes: StormLevelChange[];
  /** Beírt bm-okf snapshotok száma. */
  snapshotsWritten: number;
  /** Körzetek, amelyeknél a fetch/parse/írás hibázott (hibatűrés — a körzet
   * ilyenkor unknown: az utolsó ismert szint marad, leminősítés nincs). */
  errors: { region: string; message: string }[];
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * TODO (F1.9 — 9./2–4.): a szintváltásnál push-értesítés az érintett körzet
 * `push_subscriptions` feliratkozóinak. Most csak a naplózási/hook-pont marad;
 * a tényleges küldést a Push-modul (core/notifications) végzi majd.
 */
// function notifyStormChange(change: StormLevelChange): Promise<void> { ... } // F1.9

/**
 * Új bm-okf snapshot egy spotra, a legutóbbi méréssel, de az ÚJ viharfokkal —
 * a SUP-index az override-dal újraszámolva. Szél-adat híján sup_index null.
 */
export function buildStormSnapshotRow(
  spot: RegionSpotState,
  newLevel: StormLevel,
  config: SupIndexConfig,
  fetchedAt: string,
): WeatherSnapshotRow {
  let supIndex: number | null = null;
  if (spot.wind_kmh !== null && spot.wind_dir_deg !== null) {
    const { index } = computeSupIndex(
      {
        wind_kmh: spot.wind_kmh,
        gust_kmh: spot.gust_kmh ?? spot.wind_kmh,
        wind_dir_deg: spot.wind_dir_deg,
        water_temp_c: spot.water_temp_c,
        storm_level: newLevel,
        shore_bearing_deg: spot.shore_bearing_deg,
        water_type: spot.water_type,
      },
      config,
    );
    supIndex = index;
  }

  return {
    spot_id: spot.spotId,
    wind_kmh: spot.wind_kmh,
    gust_kmh: spot.gust_kmh,
    wind_dir_deg: spot.wind_dir_deg,
    water_temp_c: spot.water_temp_c,
    air_temp_c: spot.air_temp_c,
    storm_level: newLevel,
    sup_index: supIndex,
    source: "bm-okf",
    fetched_at: fetchedAt,
  };
}

/**
 * A teljes storm-alert futás. Determinisztikus, körzetenként hibatűrő: egy
 * körzet fetch-/írás-hibája nem viszi a többit. Fetch-hibás vagy nem
 * megerősített (unknown) körzet KIMARAD a current-ből → az utolsó ismert szint
 * él tovább (leminősítéshez pozitív megerősítés kell — M1, biztonságkritikus).
 * Csak a TÉNYLEGES szintváltásoknál ír.
 */
export async function runStormAlert(deps: StormAlertDeps): Promise<StormAlertSummary> {
  const now = deps.now ?? (() => new Date());
  const errors: { region: string; message: string }[] = [];

  const current = new Map<string, StormLevel>();
  for (const { region, url } of deps.sources) {
    try {
      const level = detectPageLevel(await deps.fetchHtml(url));
      if (level !== "unknown") current.set(region, level);
    } catch (err) {
      errors.push({ region, message: errorMessage(err) });
    }
  }

  const regionStates = await deps.getRegionStates();
  const previous = new Map<string, StormLevel>(
    regionStates.map((r) => [r.region, r.previousLevel]),
  );
  const spotsByRegion = new Map<string, RegionSpotState[]>(
    regionStates.map((r) => [r.region, r.spots]),
  );

  const changes = detectStormLevelChanges(previous, current);

  const fetchedAt = now().toISOString();
  let snapshotsWritten = 0;

  for (const change of changes) {
    const spots = spotsByRegion.get(change.region) ?? [];
    try {
      for (const spot of spots) {
        const row = buildStormSnapshotRow(spot, change.to, deps.config, fetchedAt);
        await deps.insertSnapshot(row);
        snapshotsWritten += 1;
      }
      // notifyStormChange(change); // F1.9 — push az érintett feliratkozóknak.
    } catch (err) {
      errors.push({ region: change.region, message: errorMessage(err) });
    }
  }

  return {
    levels: Object.fromEntries(current),
    changes,
    snapshotsWritten,
    errors,
  };
}
