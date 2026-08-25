/**
 * CORE: fejlesztői visszajelzés-csatorna (F2.2) — adatréteg.
 *
 * A felhasználó hibát jelenthet, hiányzó BOLTOT vagy DESZKA-MODELLT
 * javasolhat. A tartalom NEM publikus: a `feedback` tábla RLS-e szerint
 * olvasni csak admin tud (migráció 20260717092100). A route-réteg
 * `requireUser` + e-mail-gate a védőháló, az RLS a valódi kapu.
 *
 * Miért core és nem modul? Mert keresztmetszeti: bármelyik oldalról érkezhet,
 * és a javaslatok több modult érintenek (catalog, providers). Ugyanaz a
 * megfontolás, mint az F1.12 analitikánál.
 *
 * A klienst a hívó route adja át paraméterként (a modul-adatrétegek mintája).
 *
 * CSAK SZERVEROLDAL: ebben a fájlban kizárólag Supabase-t érintő kód lakhat.
 * A típusok, konstansok és tiszta validálók a `feedback.ts`-ben vannak, mert
 * azokat a kliens-komponensek is használják — ld. az ottani indoklást.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type FeedbackRow,
  type FeedbackStatus,
  type SubmitResult,
  sanitizePagePath,
  validateFeedbackInput,
} from "./feedback";

/**
 * Visszajelzés beküldése a SAJÁT néven. A `user_id`-t a hívó a hitelesített
 * sessionből adja — a kliens-bemenetből SOHA (az RLS `with check` amúgy is
 * elutasítaná az idegen nevet).
 */
export async function submitFeedback(
  supabase: SupabaseClient,
  input: { userId: string; kind: string; message: string; pagePath?: string | null },
): Promise<SubmitResult> {
  const validated = validateFeedbackInput(input);
  if (!validated.ok) {
    return validated;
  }

  // A GYAKORISÁG-KORLÁTOT az adatbázis kényszeríti ki (definer-trigger), nem
  // ez a réteg: a beküldő a saját sorait sem olvashatja vissza (admin-only
  // select), így itt nem is tudnánk megszámolni őket. A trigger a
  // `feedback_rate_limit` SQLSTATE-tel jelez, azt fordítjuk vissza üzenetre.
  const { error } = await supabase.from("feedback").insert({
    user_id: input.userId,
    kind: validated.kind,
    message: validated.message,
    page_path: sanitizePagePath(input.pagePath),
  });

  if (!error) {
    return { ok: true };
  }
  // A trigger `P0001` (raise exception) kóddal és beszédes üzenettel jelez.
  return {
    ok: false,
    errorKey: error.message.includes(RATE_LIMIT_SQL_MARKER) ? "rateLimited" : "failed",
  };
}

/** A definer-trigger hibaüzenetének felismerhető jelzése (lásd a migrációt). */
export const RATE_LIMIT_SQL_MARKER = "feedback_rate_limit";

/** Admin: visszajelzés-lista, legfrissebb elöl (opcionális állapot-szűrővel). */
export async function listFeedback(
  supabase: SupabaseClient,
  options: { status?: FeedbackStatus } = {},
): Promise<FeedbackRow[]> {
  let query = supabase.from("feedback").select("*").order("created_at", { ascending: false });
  if (options.status) {
    query = query.eq("status", options.status);
  }
  const { data, error } = await query.limit(200);
  if (error || !data) {
    return [];
  }
  return data as FeedbackRow[];
}

/** Admin: állapot (és jegyzet) állítása. Az RLS + trigger csak adminnak engedi. */
export async function setFeedbackStatus(
  supabase: SupabaseClient,
  input: { id: number; status: FeedbackStatus; adminNote?: string | null; adminId: string },
): Promise<{ ok: boolean }> {
  const patch: Record<string, unknown> = {
    status: input.status,
    handled_by: input.adminId,
    handled_at: new Date().toISOString(),
  };
  if (input.adminNote !== undefined) {
    patch.admin_note = input.adminNote === "" ? null : input.adminNote;
  }
  const { error } = await supabase.from("feedback").update(patch).eq("id", input.id);
  return { ok: !error };
}
