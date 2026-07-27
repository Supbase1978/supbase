/**
 * Márkanév — EGYETLEN forrás a TypeScript-kód számára.
 *
 * Az F1 alatt a név még nem volt eldöntve, ezért `[APPNÉV]` placeholder állt
 * ~20 helyen (route-meták, i18n-címek, a megosztás-kártya). A név 2026-07-27-én
 * **Suptime** lett; a placeholderek feloldva.
 *
 * HOL ÉL MÉG A NÉV, ÉS MIÉRT NEM ITT:
 * - az i18n-fájlokban (`locales/**`) a név a lefordított MONDATOK része
 *   („… | Suptime"), és a fordítás nem hivatkozhat kódra;
 * - a `public/og/default.png` kártyán RAJZOLVA (forrás: `scripts/og-card.html`,
 *   újragenerálás: `node scripts/generate-og.mjs`);
 * - a `public/sw.js`-ben (a service worker nem éri el a bundle-t);
 * - a `netlify/edge-functions/basic-auth.ts` realm-jében (Deno-runtime, külön
 *   fordítási egység — és a HTTP-fejléc csak ASCII-t enged).
 * Névváltáskor ez az öt hely a teljes lista (`grep -ri suptime`).
 */
export const APP_NAME = "Suptime";
