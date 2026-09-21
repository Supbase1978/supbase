/**
 * Jogi entitás-adatok és -verzió (F1.8). A cégadatok KITÖLTVE (felhasználói
 * adatszolgáltatás, 2026-09-21) — a korábbi `[KITÖLTENDŐ: …]` placeholderek
 * megszűntek. A szövegek jogi átnézése továbbra is a Szolgáltató feladata.
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
 * Szolgáltató / Adatkezelő adatai (felhasználói adatszolgáltatás, 2026-09-21).
 * A vállalkozási forma EGYÉNI VÁLLALKOZÁS.
 *
 * `registrationNumber` SZÁNDÉKOSAN üres: a felhasználó közlése szerint egyéni
 * vállalkozásnál nincs cégjegyzékszám. Az üres mező NEM jelenik meg az
 * impresszumon (`content.ts` `impresszumLines`) — csonka sor helyett a sor
 * egésze kimarad.
 */
export const LEGAL_ENTITY = {
  name: "Sztellik Endre",
  seat: "7700 Mohács, Hóvirág u. 8.",
  taxNumber: "63594610-1-02",
  registrationNumber: "",
  registrationAuthority: "Nemzeti Adó- és Vámhivatal (NAV)",
  email: "supbase1978@gmail.com",
  phone: "+36 30 400 1750",
  website: "https://suptime.hu",
  hostingProvider:
    "Netlify Inc., 512 2nd Street, Suite 300, San Francisco, California 94107, USA",
  /** Fő adatfeldolgozók (a tényleges lista élesítéskor véglegesítendő). */
  dataProcessors:
    "Supabase (adatbázis/hitelesítés), Netlify (tárhely), Resend (e-mail-küldés), Cloudflare Turnstile (bot-védelem), Open-Meteo (időjárási adatok), Google és Apple (opcionális közösségi bejelentkezés)",
} as const;
