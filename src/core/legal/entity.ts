/**
 * Jogi entitás-adatok és -verzió (F1.8). A KÖTELEZŐ erejű cégadatok
 * PLACEHOLDER-ek — élesítés ELŐTT ki kell tölteni (a Szolgáltató tényleges
 * adataival, jogásszal egyeztetve). A `[KITÖLTENDŐ: …]` markerek jelzik a
 * hiányzó mezőket; a `docs/PROGRESS.md` F1.8-szakasza és a Hullám-projekt
 * `aszf-kitoltendo.md`-je is felsorolja őket.
 *
 * Jövőállóság: üzleti forma-váltáskor (pl. egyéni → Kft) CSAK ezt az objektumot
 * és a `LEGAL_VERSION`-t kell frissíteni — a jogi szövegek ezekre hivatkoznak,
 * a verzió emelése pedig a meglévő userek re-consentjét váltja ki ([[config]]).
 */
import { CONSENT_VERSION } from "@core/consent/config";

/** A jogi szövegek verziója = a consent-verzió (együtt mozognak). */
export const LEGAL_VERSION = CONSENT_VERSION;

/** Hatálybalépés — verzió-emeléskor frissítendő (a jogi oldalak fejlécén jelenik meg). */
export const LEGAL_EFFECTIVE_FROM = "2026. július 24.";

/**
 * Szolgáltató / Adatkezelő adatai. MIND placeholder — élesítés előtt kitöltendő.
 * A tárhelyszolgáltató (Netlify) már ismert (F1.10 élesítési terv).
 */
export const LEGAL_ENTITY = {
  name: "[KITÖLTENDŐ: Szolgáltató neve]",
  seat: "[KITÖLTENDŐ: Székhely / lakcím]",
  taxNumber: "[KITÖLTENDŐ: Adószám]",
  registrationNumber: "[KITÖLTENDŐ: Cégjegyzék-/nyilvántartási szám]",
  registrationAuthority: "[KITÖLTENDŐ: Nyilvántartásba vevő hatóság]",
  email: "[KITÖLTENDŐ: Kapcsolattartó e-mail]",
  phone: "[KITÖLTENDŐ: Telefon]",
  website: "[KITÖLTENDŐ: Weboldal]",
  hostingProvider:
    "Netlify Inc., 512 2nd Street, Suite 300, San Francisco, California 94107, USA",
  /** Fő adatfeldolgozók (a tényleges lista élesítéskor véglegesítendő). */
  dataProcessors:
    "Supabase (adatbázis/hitelesítés), Netlify (tárhely), Cloudflare Turnstile (bot-védelem), Open-Meteo (időjárási adatok), Google és Apple (opcionális közösségi bejelentkezés)",
} as const;
