/**
 * Beleegyezés-napló szerver-helperek (F1.8). A `user_consents` táblát olvassa/
 * írja; a klienst a hívó (route-loader/-action) adja át. Az írás-gate az RLS
 * (`user_consents_insert_own`: user_id = auth.uid()); a `recordConsents` a
 * bejelentkezett user SAJÁT beleegyezését rögzíti (retroaktív re-consent).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { CONSENT_VERSION, REQUIRED_CONSENT_KINDS, type ConsentKind } from "./config";

/**
 * A megadott userhez az AKTUÁLIS verzióra hiányzó KÖTELEZŐ beleegyezés-fajták.
 * Üres tömb → a user mindent elfogadott (nincs teendő). Hiba esetén fail-safe
 * üres tömböt ad (nem blokkolja a böngészést egy consent-lekérdezési hibán).
 */
export async function getMissingRequiredConsents(
  supabase: SupabaseClient,
  userId: string,
): Promise<ConsentKind[]> {
  const { data, error } = await supabase
    .from("user_consents")
    .select("kind")
    .eq("user_id", userId)
    .eq("version", CONSENT_VERSION)
    .in("kind", REQUIRED_CONSENT_KINDS as unknown as string[]);
  if (error || !data) {
    return [];
  }
  const present = new Set((data as { kind: ConsentKind }[]).map((row) => row.kind));
  return REQUIRED_CONSENT_KINDS.filter((kind) => !present.has(kind));
}

/** Igaz, ha a usernek van hiányzó kötelező beleegyezése az aktuális verzióra. */
export async function hasMissingRequiredConsents(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  return (await getMissingRequiredConsents(supabase, userId)).length > 0;
}

/**
 * A megadott beleegyezés-fajták rögzítése az AKTUÁLIS verzióra (idempotens:
 * a `unique (user_id, kind, version)` + `on conflict` a duplikátumot elnyeli).
 * A user_id-t a hívó a session-ből adja (nem a formból) — az RLS is ezt védi.
 */
export async function recordConsents(
  supabase: SupabaseClient,
  userId: string,
  kinds: readonly ConsentKind[],
): Promise<{ ok: boolean }> {
  if (kinds.length === 0) {
    return { ok: true };
  }
  const rows = kinds.map((kind) => ({
    user_id: userId,
    kind,
    version: CONSENT_VERSION,
  }));
  const { error } = await supabase
    .from("user_consents")
    .upsert(rows, { onConflict: "user_id,kind,version", ignoreDuplicates: true });
  return { ok: !error };
}
