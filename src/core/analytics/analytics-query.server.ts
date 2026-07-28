/**
 * Az admin-riport adatlekérése és összesítése (F1.12).
 *
 * A NEHÉZ munkát az adatbázis végzi (`analytics_daily` nézet: napi darabszám
 * eseménynevenként), itt csak sorba rendezünk és összegzünk. Így a felület
 * akkor sem lassul be, ha az esemény-tábla megnő.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnalyticsEvent } from "./events";

export interface DailyCountRow {
  day: string;
  name: string;
  events: number;
}

export interface AnalyticsSummary {
  /** Eseményenkénti összeg az adott időszakra, csökkenő sorrendben. */
  totals: Array<{ name: string; events: number }>;
  /** Napi bontás (legfrissebb nap elöl), eseményenkénti bontással. */
  days: Array<{ day: string; total: number; byName: Record<string, number> }>;
  /**
   * A deszkaválasztó tölcsére: hány eredmény jutott egy kérdőív-megjelenésre.
   * `null`, ha nem volt kérdőív-megjelenés (nullával nem osztunk).
   */
  advisorConversion: number | null;
}

/** Az utolsó N nap eseményei (default 30). */
export async function listDailyCounts(
  supabase: SupabaseClient,
  days = 30,
): Promise<DailyCountRow[]> {
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("analytics_daily")
    .select("day, name, events")
    .gte("day", from)
    .order("day", { ascending: false });

  if (error || !data) {
    return [];
  }
  return data as DailyCountRow[];
}

/** Tiszta összesítő — tesztelhető, DB nélkül. */
export function summarize(rows: readonly DailyCountRow[]): AnalyticsSummary {
  const totalsByName = new Map<string, number>();
  const daysMap = new Map<string, { total: number; byName: Record<string, number> }>();

  for (const row of rows) {
    totalsByName.set(row.name, (totalsByName.get(row.name) ?? 0) + row.events);

    const day = daysMap.get(row.day) ?? { total: 0, byName: {} };
    day.total += row.events;
    day.byName[row.name] = (day.byName[row.name] ?? 0) + row.events;
    daysMap.set(row.day, day);
  }

  const totals = [...totalsByName.entries()]
    .map(([name, events]) => ({ name, events }))
    .sort((a, b) => b.events - a.events || a.name.localeCompare(b.name));

  const days = [...daysMap.entries()]
    .map(([day, value]) => ({ day, ...value }))
    .sort((a, b) => b.day.localeCompare(a.day));

  const wizard = totalsByName.get("advisor_wizard_view" satisfies AnalyticsEvent) ?? 0;
  const result = totalsByName.get("advisor_result_view" satisfies AnalyticsEvent) ?? 0;

  return {
    totals,
    days,
    // A megosztott linkből érkező eredmény-megtekintés miatt ez az arány 1 fölé
    // is mehet — ez NEM hiba, hanem információ (a megosztás hoz forgalmat).
    advisorConversion: wizard > 0 ? result / wizard : null,
  };
}
