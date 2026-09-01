/**
 * catalog-watch — SOROZAT-SZINTŰ LEÍRÁS a termékoldal szövege MELLÉ
 * (F2.1-utó-58).
 *
 * MIÉRT KELL. Van gyártó, aki a specifikációt nem a termékoldalon közli,
 * hanem EGYSZER, a SOROZAT leírásában — mert a sorozat minden tagja
 * ugyanakkora, és csak a színük tér el. Élesben mérve
 * (rocoutdoors.com, 2026-09-01):
 *
 *  * a `10' Explorer` termékoldala kiírja a méretet, a TEHERBÍRÁST viszont
 *    SEHOL — az `/collections/explorer-series` leírásában áll:
 *    „…are 10' tall, 32 inches wide with a weight capacity of 350 pounds";
 *  * a négy `10' Scout` színváltozat lapján még a VASTAGSÁG sincs meg, a
 *    sorozat leírásában viszont ott a teljes hármas.
 *
 * A teherbírás nélkül a deszka a moderációs sorban ragad és a Deszkaválasztó
 * sem ajánlja — a gyártó tehát KÖZLI az adatot, csak nem ott, ahol keressük.
 *
 * MIÉRT NEM A KOLLEKCIÓ HTML-OLDALA A FORRÁS. Kézenfekvő lenne a
 * `/collections/<slug>` lapot letölteni és a szövegét hozzáfűzni. Élesben
 * MÉRVE ez rossz adatot adna: a ROC kollekció-oldalának alján a TÖBBI sorozat
 * leírása is ott áll (az Explorer lapján a Scout „10' tall, 33 inches wide"
 * mondata is), tehát a hozzáfűzés a SZOMSZÉD sorozat méretét szórná be. Ez a
 * navigációs-menü csapda testvére: a lap egésze nem a termékről szól.
 *
 * Ezért a recept egy olyan URL-re mutat, ami PONTOSAN egy sorozat leírását
 * adja. Shopify-boltnál ez a `/collections/<slug>.json` — egyetlen kérés,
 * egyetlen `description` mező. HTML-forrásnál a lap szövege megy tovább,
 * változatlanul; a recept felelőssége, hogy olyan címet adjon meg, ahol csak
 * ennek a sorozatnak a leírása áll.
 *
 * A szöveg a termékoldal szövege UTÁN kerül, tehát csak a MÉG ÜRES mezőket
 * tölti: a termék saját, konkrétabb adata mindig üt (a `parseSpecsFromText`
 * első-találat-nyer sorrendje ezt garantálja).
 */
import { htmlToText } from "./html.ts";

/**
 * A letöltött erőforrásból a SOROZAT leírásának szövege.
 *
 * JSON-nál a Shopify két szerződését ismerjük fel (`collection.description`,
 * `product.body_html`) — mindkettő HTML-töredék, ezért ugyanazon a
 * `htmlToText`-en megy át, mint bármelyik oldal. Bármi más → üres, azaz a
 * hívó úgy dolgozik tovább, mintha nem lenne sorozat-szöveg. NEM dobunk
 * hibát: egy elérhetetlen sorozat-leírás nem viheti el a termék kinyerését.
 */
export function seriesTextFromPayload(payload: string): string {
  const trimmed = payload.trimStart();
  if (!trimmed.startsWith("{")) return htmlToText(payload).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return "";
  }
  if (typeof parsed !== "object" || parsed === null) return "";
  const record = parsed as Record<string, unknown>;
  const collection = record["collection"];
  const product = record["product"];
  const html =
    pickString(collection, "description") ?? pickString(product, "body_html");
  return html === null ? "" : htmlToText(html).trim();
}

function pickString(node: unknown, key: string): string | null {
  if (typeof node !== "object" || node === null) return null;
  const value = (node as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * A termék-URL-hez tartozó sorozat-leírás CÍME, a recept leképezéséből.
 *
 * A kulcs URL-RÉSZLET, ugyanúgy, mint a `boardTypeByUrl`-nél. A LEGHOSSZABB
 * illeszkedő kulcs nyer: a ROC-nál a `/products/explorer` és a
 * `/products/explorer-pro` egyaránt illeszkedne az előbbire, és az objektum
 * bejárási sorrendje nem lehet a döntés alapja.
 */
export function seriesTextUrlFor(
  productUrl: string,
  map: Readonly<Record<string, string>>,
): string | null {
  let best: { needle: string; url: string } | null = null;
  for (const [needle, url] of Object.entries(map)) {
    if (needle === "" || !productUrl.includes(needle)) continue;
    if (best === null || needle.length > best.needle.length) {
      best = { needle, url };
    }
  }
  return best?.url ?? null;
}
