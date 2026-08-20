/**
 * catalog-watch — TERMÉKKÉP-VISSZATÖLTÉS a már élő katalógus-sorokra.
 *
 * MIÉRT KELL KÜLÖN ÚT: a crawl a JELÖLTET írja, és a `saveCandidate`
 * szándékosan nem támasztja fel az elbírált sorokat — egy újracrawl tehát a
 * már jóváhagyott deszka képét SOSEM pótolja. A képet ezért a deszka SAJÁT
 * forrás-oldaláról szedjük, a `matched_board_id` kapcsolaton keresztül: így a
 * kép biztosan a helyes termékhez tartozik, nem hasonlóság-keresés eredménye.
 * (Egy korábbi, hasonlóságra épülő próba `Drift ← Aqua-Marina-Glow.jpeg`
 * párosítást adott — ezért lett elvetve.)
 *
 * A modul TISZTA: a döntés (melyik forrásoldal, milyen sorrendben) itt van, a
 * hálózat és az adatbázis a `cli.ts`-ben. Így hálózat nélkül tesztelhető.
 */
import { findProductNodes, pickPrimaryProduct } from "./jsonld.ts";
import { htmlToText } from "./html.ts";
import { findModelCode, findProductImage } from "./usage-rating.ts";

/** Egy szóba jöhető képforrás: a deszkához kötött jelölt egy sora. */
export interface ImageSourceCandidate {
  url: string | null;
  /** `pending` | `approved` | `rejected` | `merged` */
  status: string;
  /** A jelöltet adó forrás fajtája: `brand_site` | `shop` | `feed`. */
  sourceKind: string | null;
  /** A crawl idején eltárolt kép (ha volt) — ezért nem kell újra letölteni. */
  storedImageUrl: string | null;
}

/**
 * A képforrások SORRENDBEN, a legjobbtól. Két szabály, mindkettő indokolt:
 *
 * 1. **Csak elbírált kapcsolat** (`approved` / `merged`). A `pending` jelölt
 *    `matched_board_id`-ját a trigram-egyeztető tippelte, moderátor még nem
 *    hagyta jóvá — egy „bizonytalan egyezés" képe MÁS termékről jönne.
 * 2. **Gyártói oldal a bolti előtt.** A gyártó fehér hátterű, azonos beállítású
 *    rendert ad, a bolt életképet vagy csomagfotót. A katalógusban a képek
 *    egymás mellett állnak, és a véleményezőnek KÖZTÜK kell eligazodnia —
 *    az összevethetőség itt tartalmi kérdés, nem esztétikai.
 */
export function rankImageSources(
  candidates: readonly ImageSourceCandidate[],
): ImageSourceCandidate[] {
  const rank = (kind: string | null): number =>
    kind === "brand_site" ? 0 : kind === "shop" ? 1 : 2;
  return candidates
    .filter((c) => c.url !== null && (c.status === "approved" || c.status === "merged"))
    .sort((a, b) => rank(a.sourceKind) - rank(b.sourceKind));
}

/**
 * Termékkép EGY letöltött oldalból. A sorrend a megbízhatóság sorrendje:
 * a strukturált adat (JSON-LD `image`, `og:image`) a gyártó/bolt SAJÁT
 * állítása arról, mi a termék fő képe; a `findProductImage` csak akkor jön,
 * ha ilyen állítás nincs (élesben: aquamarina.com egyiket sem adja).
 */
export function imageFromPage(html: string, modelName: string): string | null {
  const product = pickPrimaryProduct(findProductNodes(html));
  const fromJsonLd = product ? firstImage(product.image) : null;
  if (fromJsonLd !== null) return displayImageUrl(fromJsonLd);

  const og = html.match(
    /<meta[^>]+(?:property|name)="og:image"[^>]+content="([^"]+)"/i,
  )?.[1];
  if (og !== undefined && og.trim() !== "") return displayImageUrl(og.trim());

  return displayImageUrl(
    findProductImage(
      html,
      findModelCode(htmlToText(html)),
      modelName,
      modelName.split(/\s+/)[0] ?? null,
    ),
  );
}

/**
 * A megjelenítéshez való szélesség, ahol a KISZOLGÁLÓ tud méretezni.
 *
 * A Shopify-CDN (`/cdn/shop/…`) `width` query-paraméterrel szolgál ki
 * átméretezett képet. Élesben mérve: a bluefinsupboards.eu JSON-LD-je
 * `width=1920`-at ad (1656 kB), 768-cal ugyanaz 1145 kB; a Starboard
 * paraméter NÉLKÜLI képe 165 kB → 114 kB. Mobil-first alkalmazásban ez
 * kártyánként számít.
 *
 * A 768 px ugyanaz a cél, mint a `srcset`-választásnál: a legnagyobb
 * megjelenítéshez (adatlap-hero, 2× kijelző) még elég, a kétoszlopos
 * telefon-rácshoz bőven.
 *
 * Ami NEM megy ezen az úton: a formátum. A `format=webp` paramétert ezek a
 * boltok nem tisztelik (mérve: marad PNG), tehát a Bluefin nagy, tömör
 * felületű PNG-i így is nehezek maradnak — azon csak újrakódoló kép-CDN
 * segítene.
 */
export const DISPLAY_IMAGE_WIDTH = 768;

export function displayImageUrl(raw: string | null): string | null {
  if (raw === null || raw.trim() === "") return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  if (!url.pathname.includes("/cdn/shop/") && !url.hostname.startsWith("cdn.shopify.")) return raw;
  url.searchParams.set("width", String(DISPLAY_IMAGE_WIDTH));
  return url.toString();
}

/** A schema.org `image` lehet string, tömb vagy `ImageObject` — mind elviselve. */
function firstImage(value: unknown): string | null {
  if (typeof value === "string") return value.trim() === "" ? null : value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstImage(item);
      if (found !== null) return found;
    }
    return null;
  }
  if (typeof value === "object" && value !== null) {
    return firstImage((value as { url?: unknown }).url);
  }
  return null;
}
