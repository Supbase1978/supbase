/**
 * Beleegyezés-konfiguráció (F1.8, 11.4). A jogi szöveg VERZIÓJA — a jogi oldalak
 * (ÁSZF + adatvédelmi) is ehhez a verzióhoz kötöttek. Lényeges tartalmi
 * változáskor (pl. üzleti forma-váltás, új adatkör) EZT a verziót kell emelni:
 * a meglévő userek onnantól „hiányzó beleegyezés" állapotba kerülnek, és a
 * re-consent felületen (`/beleegyezes`) újra elfogadhatják. A régi verzióra adott
 * beleegyezés a naplóban marad (audit).
 *
 * A verzió formátuma szabad szöveg; a dátum-alak (`YYYY-MM`) olvasható és
 * rendezhető. Emeléskor a jogi oldalak „Hatályos" dátumát is frissítsd.
 */
export const CONSENT_VERSION = "2026-07";

/** user_consents.kind CHECK-értékkészletével egyező fajták. */
export type ConsentKind = "terms" | "privacy" | "marketing";

/**
 * A regisztrációhoz KÖTELEZŐ beleegyezés-fajták (ÁSZF + adatvédelmi). A
 * `marketing` opcionális, külön opt-in — nem itt szerepel.
 */
export const REQUIRED_CONSENT_KINDS: readonly ConsentKind[] = ["terms", "privacy"];
