/**
 * Auth env-hozzáférés (F1.1, 4. fejezet).
 *
 * A kliens-oldalra is szánt értékek `VITE_` prefixűek, így a Vite build
 * beépíti őket az `import.meta.env`-be — SSR-en és böngészőben egyaránt
 * olvashatók. TITOK ide SOHA nem kerül: sem a Supabase `service_role` kulcs,
 * sem a Turnstile SECRET. A Turnstile secret-oldali verifikációja Supabase
 * Auth-beállítás (a captcha-tokent a signUp/signIn hívás `options.captchaToken`
 * mezőjében adjuk át), nem ebben a kódban történik.
 *
 * FONTOS: a hiányzó env NEM modul-szinten dob. Ha az importkor dobnánk, az
 * auth-modul puszta betöltése ledöntené az egész appot (miközben a Supabase-
 * projekt az F1.2-ig nem is létezik). Ehelyett a hiba a tényleges HÍVÁSKOR
 * keletkezik, beszédes üzenettel — a böngészés így env nélkül is működik.
 */

type EnvRecord = Record<string, string | undefined>;

/** Frissen olvassuk minden híváskor — így tesztből `vi.stubEnv`-vel felülírható. */
function readEnv(): EnvRecord {
  return import.meta.env as unknown as EnvRecord;
}

function requireEnv(key: string): string {
  const value = readEnv()[key];
  if (!value) {
    throw new Error(
      `Hiányzó környezeti változó: ${key}. Vedd fel a .env fájlba (minta: .env.example). ` +
        `A Supabase-kliens csak beállított env mellett hozható létre.`,
    );
  }
  return value;
}

function optionalEnv(key: string): string | null {
  const value = readEnv()[key];
  return value && value.length > 0 ? value : null;
}

/** Supabase projekt-URL (publikus). Hiányzik → beszédes Error híváskor. */
export function getSupabaseUrl(): string {
  return requireEnv("VITE_SUPABASE_URL");
}

/** Supabase `anon` kulcs (publikus, RLS mögött). Hiányzik → beszédes Error híváskor. */
export function getSupabaseAnonKey(): string {
  return requireEnv("VITE_SUPABASE_ANON_KEY");
}

/**
 * Nem dob: csak megnézi, hogy a Supabase-kliens felépíthető-e (URL + anon kulcs
 * beállítva). Loaderek ezzel dönthetnek fail-closed módon (env nélkül null
 * session), anélkül hogy 500-at okoznának — a böngészés env nélkül is megy.
 */
export function isSupabaseConfigured(): boolean {
  return optionalEnv("VITE_SUPABASE_URL") !== null && optionalEnv("VITE_SUPABASE_ANON_KEY") !== null;
}

/**
 * Cloudflare Turnstile SITE kulcs (publikus). Ha nincs beállítva (dev),
 * `null` — ilyenkor a captcha kikapcsolt, a formok használhatók maradnak.
 */
export function getTurnstileSiteKey(): string | null {
  return optionalEnv("VITE_TURNSTILE_SITE_KEY");
}

/**
 * A Turnstile be/kikapcsolásának EGYETLEN forrása (widget + actionök is ezt
 * hívják) — így a kliens-oldali widget és a szerver-oldali token-elvárás nem
 * csúszhat szét.
 */
export function isTurnstileEnabled(): boolean {
  return getTurnstileSiteKey() !== null;
}
