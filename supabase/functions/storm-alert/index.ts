/**
 * storm-alert — Deno Edge Function (vékony héj), 5 perces cron a szezonban.
 *
 * FELELŐSSÉG: valós I/O bekötése a _shared TISZTA orchestrációjába
 * (`_shared/storm-alert.ts` + `_shared/storm-scrape.ts`). A parse, a
 * szintváltás-detektálás és a snapshot-építés mind tesztelt tiszta függvény. Ez
 * a fájl NEM tesztelt és NEM typecheckelt a repo `tsc`-jével (Deno-runtime).
 *
 * PUSH (F1.9, 9./2–4.): szintváltásnál a `_shared/push-notify.ts` célzása +
 * `_shared/web-push.ts` küldése. VAPID-kulcs nélkül a push-ág egyszerűen
 * kimarad (a webes riasztás akkor is él) — fail-safe, nem hibázik.
 *
 * ENV: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STORM_SOURCES (opcionális JSON:
 * {"Balaton":"https://...","Velencei-tó":"..."} — default: DEFAULT_STORM_SOURCES,
 * a met.hu tavankénti main.php oldalak; a Fertőnek nincs forrása, F1-korlát),
 * VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (push; a privát TITOK).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

import type { PushSubscriptionRow } from "../_shared/push-notify.ts";
import {
  parseSupIndexConfig,
  type AdvisorWeightRow,
} from "../_shared/sup-index.ts";
import {
  runStormAlert,
  type RegionSpotState,
  type RegionState,
  type StormPushDeps,
} from "../_shared/storm-alert.ts";
import {
  DEFAULT_STORM_SOURCES,
  type StormSource,
} from "../_shared/storm-scrape.ts";
import type { StormLevel, WaterType, WeatherSnapshotRow } from "../_shared/types.ts";
import { sendWebPush, type VapidKeys } from "../_shared/web-push.ts";

/** STORM_SOURCES env (JSON: körzet→URL) → forrás-lista; hibás JSON → default. */
function resolveSources(): readonly StormSource[] {
  const raw = Deno.env.get("STORM_SOURCES");
  if (!raw) return DEFAULT_STORM_SOURCES;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const sources = Object.entries(parsed)
      .filter((e): e is [string, string] => typeof e[1] === "string")
      .map(([region, url]) => ({ region, url }));
    return sources.length > 0 ? sources : DEFAULT_STORM_SOURCES;
  } catch {
    console.error("STORM_SOURCES: érvénytelen JSON — default forrás-lista él");
    return DEFAULT_STORM_SOURCES;
  }
}

interface SpotRow {
  id: string;
  name: string;
  slug: Record<string, string> | null;
  water_type: WaterType;
  shore_bearing_deg: number | null;
  storm_warning_region: string | null;
}

interface SnapshotRow {
  wind_kmh: number | null;
  gust_kmh: number | null;
  wind_dir_deg: number | null;
  water_temp_c: number | null;
  air_temp_c: number | null;
  storm_level: number | null;
}

function stormLevelOf(value: unknown): StormLevel {
  return value === 1 ? 1 : value === 2 ? 2 : 0;
}

/** VAPID-kulcsok az env-ből; bármelyik hiánya → null (push-ág kimarad). */
function resolveVapid(): VapidKeys | null {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) {
    console.warn("VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY hiányzik — push-ág kikapcsolva");
    return null;
  }
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:info@sup-platform.hu";
  return { publicKey, privateKey, subject };
}

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return new Response(
      JSON.stringify({ error: "Hiányzó SUPABASE_URL / SERVICE_ROLE_KEY" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
  const sources = resolveSources();

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const vapid = resolveVapid();
  const push: StormPushDeps | undefined = vapid
    ? {
        source: "met.hu / BM OKF",
        getSubscriptionsForSpots: async (spotIds: string[]) => {
          const { data, error } = await supabase
            .from("push_subscriptions")
            .select("id, platform, token, alert_spot_ids")
            .eq("platform", "webpush")
            .overlaps("alert_spot_ids", spotIds);
          if (error) throw new Error(error.message);
          return (data ?? []) as PushSubscriptionRow[];
        },
        send: (target) =>
          sendWebPush(target.subscription, target.payload, vapid, { fetch }),
        deleteSubscriptions: async (ids: string[]) => {
          const { error } = await supabase
            .from("push_subscriptions")
            .delete()
            .in("id", ids);
          if (error) throw new Error(error.message);
        },
      }
    : undefined;

  const { data: weightRows } = await supabase
    .from("advisor_weights")
    .select("key, value")
    .like("key", "supindex.%");
  const config = parseSupIndexConfig((weightRows ?? []) as AdvisorWeightRow[]);

  const summary = await runStormAlert({
    config,
    sources,
    ...(push ? { push } : {}),
    fetchHtml: async (sourceUrl: string): Promise<string> => {
      const res = await fetch(sourceUrl, {
        headers: { "user-agent": "sup-platform-storm-alert/1.0" },
      });
      if (!res.ok) throw new Error(`Viharjelzés-forrás HTTP ${res.status}`);
      return await res.text();
    },
    getRegionStates: async (): Promise<RegionState[]> => {
      const { data: spotRows } = await supabase
        .from("spots")
        .select("id, name, slug, water_type, shore_bearing_deg, storm_warning_region")
        .not("storm_warning_region", "is", null);

      const byRegion = new Map<string, RegionState>();
      for (const raw of (spotRows ?? []) as SpotRow[]) {
        const region = raw.storm_warning_region;
        if (!region) continue;

        const { data: last } = await supabase
          .from("weather_snapshots")
          .select(
            "wind_kmh, gust_kmh, wind_dir_deg, water_temp_c, air_temp_c, storm_level",
          )
          .eq("spot_id", raw.id)
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle<SnapshotRow>();

        const lastStormLevel = stormLevelOf(last?.storm_level);
        // A slug jsonb ({"hu": "...", "en": "..."}) — a push a hu-útvonalra
        // mutat (F1-ben csak a hu locale él, lásd activeLocales).
        const huSlug = raw.slug?.hu;
        const spot: RegionSpotState = {
          spotId: raw.id,
          name: raw.name,
          path: huSlug ? `/spotok/${huSlug}` : null,
          shore_bearing_deg: raw.shore_bearing_deg,
          water_type: raw.water_type,
          wind_kmh: last?.wind_kmh ?? null,
          gust_kmh: last?.gust_kmh ?? null,
          wind_dir_deg: last?.wind_dir_deg ?? null,
          water_temp_c: last?.water_temp_c ?? null,
          air_temp_c: last?.air_temp_c ?? null,
          lastStormLevel,
        };

        const existing = byRegion.get(region);
        if (existing) {
          existing.spots.push(spot);
          // Körzet-szintű előző szint: a legmagasabb ismert (konzervatív).
          if (lastStormLevel > existing.previousLevel) {
            existing.previousLevel = lastStormLevel;
          }
        } else {
          byRegion.set(region, {
            region,
            previousLevel: lastStormLevel,
            spots: [spot],
          });
        }
      }
      return [...byRegion.values()];
    },
    insertSnapshot: async (row: WeatherSnapshotRow): Promise<void> => {
      const { error } = await supabase.from("weather_snapshots").insert(row);
      if (error) throw new Error(error.message);
    },
  });

  return new Response(JSON.stringify({ sources, ...summary }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
