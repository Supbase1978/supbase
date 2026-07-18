/**
 * SUP-index konfig betöltése az `advisor_weights` táblából (szerver-oldal).
 *
 * A `supindex.*` kulcsokat olvassa be a publikus SELECT-en át (RLS: advisor_
 * weights publikusan olvasható). ÍRÁS nincs — a weather_snapshots-ba az Edge
 * Function ír (service_role), a kliens sosem. DB-hiba/üres eredmény esetén a
 * `DEFAULT_SUPINDEX_CONFIG` a fallback (fail-safe: az algoritmus mindig fut).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_SUPINDEX_CONFIG,
  parseSupIndexConfig,
  type AdvisorWeightRow,
  type SupIndexConfig,
} from "./config";

/** A supindex.* kulcsprefix — csak ezeket olvassuk. */
export const SUPINDEX_KEY_PREFIX = "supindex.";

/**
 * `supindex.*` súlyok betöltése és tipizált konfiggá alakítása. Bármilyen hiba
 * (nincs kliens, DB-hiba, nulla sor) → `DEFAULT_SUPINDEX_CONFIG`.
 */
export async function loadSupIndexConfig(
  supabase: SupabaseClient,
): Promise<SupIndexConfig> {
  try {
    const { data, error } = await supabase
      .from("advisor_weights")
      .select("key, value")
      .like("key", `${SUPINDEX_KEY_PREFIX}%`);

    if (error || !data) return DEFAULT_SUPINDEX_CONFIG;
    return parseSupIndexConfig(data as AdvisorWeightRow[]);
  } catch {
    return DEFAULT_SUPINDEX_CONFIG;
  }
}
