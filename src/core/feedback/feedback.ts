/**
 * CORE: fejlesztői visszajelzés-csatorna (F2.2) — KLIENS-BIZTOS réteg.
 *
 * Ez a fájl mindent tartalmaz, ami NEM érinti a Supabase-t: típusok, a
 * DB-kényszereket tükröző konstansok és tiszta validálók. Az adatréteg
 * (`feedback.server.ts`) ezekre épül, de a kliens is behúzhatja.
 *
 * MIÉRT KÜLÖN FÁJL: a route-ok kliens-komponensei futásidejű értékeket
 * használnak (`FEEDBACK_KINDS` a témaválasztóban, `FEEDBACK_STATUSES` az
 * admin-szűrőben, `MESSAGE_MIN_LENGTH` a súgószövegben). Amíg ezek a
 * `.server` fájlban laktak, a szerveroldali adatréteg belekerült a
 * kliens-csomagba. A vite 7 build ezt már hibaként állítja meg
 * („Server-only module referenced by client"), a vite 6 még átengedte.
 * A határ tehát: SupabaseClient-et érintő kód → `.server`, minden más → ide.
 */

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
