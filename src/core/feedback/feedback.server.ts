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
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Mire vonatkozik a visszajelzés (== a tábla `kind` CHECK-kényszere). */
export type FeedbackKind = "bug" | "shop" | "board" | "idea" | "other";

export const FEEDBACK_KINDS: readonly FeedbackKind[] = [
  "bug",
  "shop",
  "board",
  "idea",
  "other",
];

/** Feldolgozottsági állapot (== a tábla `status` CHECK-kényszere). */
export type FeedbackStatus = "new" | "in_progress" | "done" | "rejected";

export const FEEDBACK_STATUSES: readonly FeedbackStatus[] = [
  "new",
  "in_progress",
  "done",
  "rejected",
];

/** `public.feedback` sor. */
export interface FeedbackRow {
  id: number;
  created_at: string;
  user_id: string | null;
  kind: FeedbackKind;
  message: string;
  page_path: string | null;
  status: FeedbackStatus;
  admin_note: string | null;
  handled_by: string | null;
  handled_at: string | null;
}

/** Üzenet-hossz korlátok — a DB-kényszer tükre, barátságos hibaüzenethez. */
export const MESSAGE_MIN_LENGTH = 10;
export const MESSAGE_MAX_LENGTH = 4000;

/** Óránként ennyi visszajelzés mehet felhasználónként. */
export const RATE_LIMIT_PER_HOUR = 5;

export function isFeedbackKind(value: string): value is FeedbackKind {
  return (FEEDBACK_KINDS as readonly string[]).includes(value);
}

export function isFeedbackStatus(value: string): value is FeedbackStatus {
  return (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

/**
 * Az oldal-útvonal tisztítása: QUERY NÉLKÜL, csak abszolút belső út.
 *
 * Ugyanaz a szabály, mint az analitikánál: a Deszkaválasztó megosztható linkje
 * testsúlyt és magasságot tartalmaz, aminek egy hibajegyben semmi keresnivalója.
 * Külső URL vagy furcsa alak → null (a DB-kényszer amúgy is elutasítaná).
 */
export function sanitizePagePath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const withoutQuery = raw.split(/[?#]/)[0] ?? "";
  if (!/^\/[A-Za-z0-9/_.-]{0,120}$/.test(withoutQuery)) {
    return null;
  }
  return withoutQuery;
}

export type SubmitResult =
  | { ok: true }
  | { ok: false; errorKey: "tooShort" | "tooLong" | "invalidKind" | "rateLimited" | "failed" };

/**
 * Tiszta validálás — Supabase nélkül tesztelhető. A DB-kényszer a védőháló;
 * ez a réteg a BARÁTSÁGOS hibaüzenetért felel.
 */
export function validateFeedbackInput(input: { kind: string; message: string }):
  | { ok: true; kind: FeedbackKind; message: string }
  | { ok: false; errorKey: "tooShort" | "tooLong" | "invalidKind" } {
  if (!isFeedbackKind(input.kind)) {
    return { ok: false, errorKey: "invalidKind" };
  }
  const message = input.message.trim();
  if (message.length < MESSAGE_MIN_LENGTH) {
    return { ok: false, errorKey: "tooShort" };
  }
  if (message.length > MESSAGE_MAX_LENGTH) {
    return { ok: false, errorKey: "tooLong" };
  }
  return { ok: true, kind: input.kind, message };
}

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
