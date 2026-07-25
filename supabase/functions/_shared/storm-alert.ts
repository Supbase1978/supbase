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
import {
  buildStormPushTargets,
  type AffectedSpot,
  type PushSubscriptionRow,
  type PushTarget,
} from "./push-notify.ts";
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
  /** Megjelenítendő spot-név (a push-üzenet címében szerepel). */
  name: string;
  /** A spot publikus útvonala (`/spotok/<slug>`), ha van slugja. */
  path: string | null;
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

/**
 * A push-ág injektált I/O-ja (F1.9, 9./2–4.). Opcionális: ha hiányzik (pl.
 * nincs VAPID-kulcs konfigurálva), a viharjelzés-pipeline többi része
 * változatlanul fut — a riasztás megjelenik a weben, csak push nem megy ki.
 */
export interface StormPushDeps {
  /** `push_subscriptions` sorok, amelyek az adott spotok BÁRMELYIKÉre szólnak. */
  getSubscriptionsForSpots: (spotIds: string[]) => Promise<PushSubscriptionRow[]>;
  /** Egy üzenet kiküldése; `stale: true` = a feliratkozás érvénytelen (410/404). */
  send: (target: PushTarget) => Promise<{ stale: boolean }>;
  /** Az érvénytelenné vált feliratkozások törlése (takarítás). */
  deleteSubscriptions: (ids: string[]) => Promise<void>;
  /** Forrás-megjelölés az üzenet végén (9./4.). */
  source: string;
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
  /** Push-értesítés (F1.9). Hiányában a pipeline push nélkül fut le. */
  push?: StormPushDeps;
}

export interface StormAlertSummary {
  /** A friss scrape körzetenkénti fokozata (csak a megerősített körzetek). */
  levels: Record<string, StormLevel>;
  /** A detektált körzet-szintváltások (from → to). */
  changes: StormLevelChange[];
  /** Beírt bm-okf snapshotok száma. */
  snapshotsWritten: number;
  /** Sikeresen kiküldött push-értesítések száma. */
  pushSent: number;
  /** Érvénytelenné vált (410/404) és törölt feliratkozások száma. */
  pushStale: number;
  /** Körzetek, amelyeknél a fetch/parse/írás hibázott (hibatűrés — a körzet
   * ilyenkor unknown: az utolsó ismert szint marad, leminősítés nincs). */
  errors: { region: string; message: string }[];
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Push-értesítés egy körzet szintváltásáról (9./2–4.): az érintett spotokra
 * feliratkozók lekérése → feliratkozásonként szabott üzenet → küldés.
 *
 * HIBATŰRŐ: egyetlen feliratkozó hibája nem viszi a többit, és a push-ág
 * hibája nem befolyásolja a snapshot-írást (a webes riasztás akkor is él).
 * A 410/404-es (visszavont engedélyű) feliratkozásokat kitakarítja.
 */
export async function notifyStormChange(
  change: StormLevelChange,
  spots: readonly RegionSpotState[],
  deps: StormPushDeps,
  now: Date,
): Promise<{ sent: number; stale: number }> {
  const affected: AffectedSpot[] = spots.map((spot) => ({
    spotId: spot.spotId,
    name: spot.name,
    ...(spot.path ? { path: spot.path } : {}),
  }));

  const subscriptions = await deps.getSubscriptionsForSpots(
    affected.map((spot) => spot.spotId),
  );
  const targets = buildStormPushTargets(change, affected, subscriptions, {
    now,
    source: deps.source,
  });

  const staleIds: string[] = [];
  let sent = 0;

  const results = await Promise.allSettled(
    targets.map(async (target) => {
      const { stale } = await deps.send(target);
      if (stale) staleIds.push(target.subscriptionId);
      else sent += 1;
    }),
  );
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("push-küldés hiba:", errorMessage(result.reason));
    }
  }

  if (staleIds.length > 0) await deps.deleteSubscriptions(staleIds);
  return { sent, stale: staleIds.length };
}

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

  const at = now();
  const fetchedAt = at.toISOString();
  let snapshotsWritten = 0;
  let pushSent = 0;
  let pushStale = 0;

  for (const change of changes) {
    const spots = spotsByRegion.get(change.region) ?? [];
    try {
      for (const spot of spots) {
        const row = buildStormSnapshotRow(spot, change.to, deps.config, fetchedAt);
        await deps.insertSnapshot(row);
        snapshotsWritten += 1;
      }
    } catch (err) {
      errors.push({ region: change.region, message: errorMessage(err) });
    }

    // A push KÜLÖN try-ban: a snapshot-írás hibája nem némíthatja el a
    // riasztást (és fordítva sem — a webes felület a snapshotból él).
    if (deps.push) {
      try {
        const result = await notifyStormChange(change, spots, deps.push, at);
        pushSent += result.sent;
        pushStale += result.stale;
      } catch (err) {
        errors.push({
          region: change.region,
          message: `push: ${errorMessage(err)}`,
        });
      }
    }
  }

  return {
    levels: Object.fromEntries(current),
    changes,
    snapshotsWritten,
    pushSent,
    pushStale,
    errors,
  };
}
