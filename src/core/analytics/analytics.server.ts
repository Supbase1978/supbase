/**
 * Használati statisztika — szerver-oldali rögzítés (12/6, F1.12).
 *
 * HÁROM SZABÁLY, amit a kód betart:
 * 1. A mérés SOHA nem törhet el egy oldalt. Minden hiba elnyelve, a hívó nem
 *    kap kivételt, és nincs `throw` semmilyen ágon.
 * 2. A mérés SOHA nem lassíthat érezhetően. Időkorláttal fut; ha a DB lassú,
 *    az esemény elveszik — ez elfogadható ár egy statisztikáért.
 * 3. Nem gyűjtünk azonosítót. Se süti, se eszköz-azonosító, se IP, se
 *    user_id — az `analytics_events` táblában ilyen oszlop nincs is.
 *
 * A robotokat és a nyomkövetést kifejezetten elutasító böngészőket kihagyjuk:
 * előbbi torzítaná a számokat, utóbbi a felhasználó kifejezett kérése.
 *
 * FEJLESZTŐI FORGALOM SEM SZÁMÍT. Ezt élő próba mutatta meg: a lokális
 * dev-szerver a TÁVOLI adatbázisba ír, tehát a saját kattintgatásunk azonnal
 * belekerült volna az éles statisztikába — és pont a kis kezdeti számoknál
 * torzít a legjobban. Dev-módban ezért nem mérünk (felülírható a
 * `VITE_ANALYTICS_IN_DEV=true` env-változóval, ha a mérést magát teszteljük).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isbot } from "isbot";

import type { AnalyticsEvent } from "./events";

/** Ennyi ideig várunk az esemény rögzítésére; utána feladjuk. */
const RECORD_TIMEOUT_MS = 1_500;

export interface RecordEventOptions extends SkipOptions {
  /** Útvonal query NÉLKÜL (a hívó adja; a DB is levágja, ha mégis benne marad). */
  path?: string | null;
  /** Rövid címkék, pl. `{ water: "folyo" }`. Személyes adat NEM kerülhet ide. */
  props?: Record<string, string | number | boolean>;
}

export interface SkipOptions {
  /** Dev-mód (default: a build módja). Teszteknél explicit `false`. */
  dev?: boolean;
}

/**
 * Kihagyandó-e a mérés ennél a kérésnél.
 *
 * - dev-mód: a lokális forgalom NEM kerülhet az éles statisztikába;
 * - robot (`isbot`): a crawler-forgalom elfedné a valódi használatot;
 * - `DNT: 1` vagy `Sec-GPC: 1`: a felhasználó kifejezetten kéri, hogy ne
 *   kövessük. Nem gyűjtünk ugyan személyes adatot, de a jelzés tiszteletben
 *   tartása olcsó, és a bizalom többet ér, mint egy esemény.
 */
export function shouldSkipTracking(request: Request, options: SkipOptions = {}): boolean {
  const env = import.meta.env as unknown as Record<string, unknown>;
  const dev = options.dev ?? env.DEV === true;
  if (dev && env.VITE_ANALYTICS_IN_DEV !== "true") {
    return true;
  }

  const headers = request.headers;
  if (headers.get("dnt") === "1" || headers.get("sec-gpc") === "1") {
    return true;
  }
  const userAgent = headers.get("user-agent");
  return userAgent !== null && isbot(userAgent);
}

/** Az útvonal query nélkül — a megosztott advisor-link testsúlyt tartalmaz. */
export function pathWithoutQuery(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

/**
 * Esemény rögzítése. Best-effort: a visszatérési érték csak azt mondja meg,
 * megtörtént-e — a hívónak NEM kell kezelnie.
 */
export async function recordEvent(
  supabase: SupabaseClient,
  request: Request,
  name: AnalyticsEvent,
  options: RecordEventOptions = {},
): Promise<boolean> {
  if (shouldSkipTracking(request, options)) {
    return false;
  }

  const path = options.path ?? pathWithoutQuery(request.url);

  try {
    const call = supabase.rpc("record_analytics_event", {
      p_name: name,
      p_path: path,
      p_props: options.props ?? {},
    });
    const timeout = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), RECORD_TIMEOUT_MS),
    );
    const result = await Promise.race([call, timeout]);
    return result !== "timeout" && !("error" in result && result.error);
  } catch {
    // Szándékosan néma: egy statisztikai hívás nem buktathat oldalt.
    return false;
  }
}
