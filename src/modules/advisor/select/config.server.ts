/**
 * Deszkaválasztó-konfig betöltése az `advisor_weights` táblából (szerver-oldal).
 *
 * Az `advisor.*` kulcsokat olvassa a publikus SELECT-en át (RLS: advisor_weights
 * publikusan olvasható). ÍRÁS nincs. DB-hiba/üres eredmény esetén a
 * `DEFAULT_ADVISOR_CONFIG` a fallback (fail-safe: az ajánló mindig fut).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_ADVISOR_CONFIG,
  parseAdvisorConfig,
  type AdvisorConfig,
  type AdvisorWeightRow,
} from "./config";

/** Az advisor.* kulcsprefix — csak ezeket olvassuk. */
export const ADVISOR_KEY_PREFIX = "advisor.";

/**
 * `advisor.*` súlyok betöltése és tipizált konfiggá alakítása. Bármilyen hiba
 * (nincs kliens, DB-hiba, nulla sor) → `DEFAULT_ADVISOR_CONFIG`.
 */
export async function loadAdvisorConfig(
  supabase: SupabaseClient,
): Promise<AdvisorConfig> {
  try {
    const { data, error } = await supabase
      .from("advisor_weights")
      .select("key, value")
      .like("key", `${ADVISOR_KEY_PREFIX}%`);

    if (error || !data) return DEFAULT_ADVISOR_CONFIG;
    return parseAdvisorConfig(data as AdvisorWeightRow[]);
  } catch {
    return DEFAULT_ADVISOR_CONFIG;
  }
}
