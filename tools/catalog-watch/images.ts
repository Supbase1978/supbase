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
import { decodeEntities, htmlToText } from "./html.ts";
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
export function imageFromPage(
  html: string,
  modelName: string,
  /**
   * Az oldal URL-je, a RELATÍV képhivatkozások feloldásához. A JSON-LD és az
   * `og:image` a gyakorlatban abszolút, az oldal `<img src>`-je viszont nem
   * (élesben a Zray protokoll-relatív `//img.website.xin/…` alakot ír) — a
   * `boards.image_url` viszont abszolút URL-t vár. Elhagyva a nyers érték megy
   * tovább (a régi viselkedés).
   */
  pageUrl?: string,
): string | null {
  const product = pickPrimaryProduct(findProductNodes(html));
  const fromJsonLd = product ? firstImage(product.image) : null;
  if (fromJsonLd !== null) return absolute(displayImageUrl(fromJsonLd), pageUrl);

  const og = html.match(
    /<meta[^>]+(?:property|name)="og:image"[^>]+content="([^"]+)"/i,
  )?.[1];
  if (og !== undefined && og.trim() !== "") return absolute(displayImageUrl(og.trim()), pageUrl);

  return absolute(
    displayImageUrl(
      findProductImage(
        html,
        findModelCode(htmlToText(html)),
        modelName,
        modelName.split(/\s+/)[0] ?? null,
      ),
    ),
    pageUrl,
  );
}

/** Relatív képhivatkozás feloldása az oldal URL-jéhez képest. */
function absolute(raw: string | null, pageUrl: string | undefined): string | null {
  if (raw === null || pageUrl === undefined) return raw;
  try {
    return new URL(raw, pageUrl).toString();
  } catch {
    return raw;
  }
}

/**
 * Egy Shopify termékoldal URL-jéből a termék SAJÁT JSON-ja.
 *
 * A jelölt URL-je `…/products/<handle>?variant=<id>` alakú; a Shopify ugyanezt
 * a terméket kiszolgálja `…/products/<handle>.json` néven is, a teljes
 * `images[]` tömbbel. Ez a galéria-visszatöltés olcsó útja: termékenként EGY
 * kis kérés, a teljes katalógus letöltése nélkül.
 *
 * Nem Shopify-alakú URL-re `null` — ott nincs mit próbálni.
 */
export function shopifyProductJsonUrl(candidateUrl: string | null): string | null {
  if (candidateUrl === null) return null;
  let url: URL;
  try {
    url = new URL(candidateUrl);
  } catch {
    return null;
  }
  const match = url.pathname.match(/^(.*\/products\/[^/]+?)(?:\.json)?$/);
  if (!match) return null;
  return `${url.origin}${match[1]}.json`;
}

/**
 * Legfeljebb ennyi galéria-jelölt kerül a jelölt-sorba. A moderátor ebből
 * válogatja ki a 3–5 megjelenítendőt — a Shopify termékein 7–22 kép van
 * (mérve: star-board.com), az utolsó tizenkettő tipikusan szín-változat és
 * életkép, amit végignézni is fárasztó lenne.
 */
export const MAX_GALLERY_CANDIDATES = 8;

/**
 * Galéria-jelöltek egy termék KÉPLISTÁJÁBÓL (F2.1-utó-30).
 *
 * A telefonos rács két oszlopos, tehát a kártya-kép kicsi — cserébe két deszka
 * egymás MELLETT látszik. A részletet az adatlap teljes képernyős nézete adja
 * vissza, és ahhoz kell több kép.
 *
 * Három szabály, mind a meglévő gyakorlatból:
 *  * a BORÍTÓ kimarad a listából (az az `image_url`, azt a rács mutatja) —
 *    így a galériában nem az első kép ismétlődik;
 *  * ugyanaz a KIZÁRÓ minta érvényes, mint a borító keresésénél (logó,
 *    konstrukció-ábra, technológia-kép) — ezek nem termékfotók;
 *  * minden URL átmegy a `displayImageUrl`-en, és az ismétlődés kiesik.
 */
export function galleryCandidates(
  imageUrls: readonly (string | null | undefined)[],
  coverUrl: string | null,
): string[] {
  const cover = displayImageUrl(coverUrl);
  const seen = new Set<string>(cover === null ? [] : [cover]);
  const out: string[] = [];
  for (const raw of imageUrls) {
    if (out.length >= MAX_GALLERY_CANDIDATES) break;
    const url = displayImageUrl(raw ?? null);
    if (url === null) continue;
    const file = url.split("/").pop() ?? "";
    if (/logo|construction|technology|detail|icon|thumb|badge/i.test(file)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
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
 * ÁLTALÁNOSABBAN: bármelyik kép-URL, ami `width` query-paramétert visel, a
 * kiszolgálója méretezni tud — élesben (fanatic.com) a galéria-csík
 * `?width=50&height=50` BÉLYEGKÉPET ad (4 kB, 50 px), ami a katalógusban
 * használhatatlan; `?width=768`-cal ugyanaz a kép 321 kB. A `height` és az
 * `aspect_ratio` ilyenkor TÖRLŐDIK, hogy a kiszolgáló az eredeti arányt
 * tartsa meg — különben 768×50 jönne.
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
    // ENTITÁS-DEKÓDOLÁS ITT IS: a visszatöltés a JELÖLTBEN TÁROLT URL-lel
    // dolgozik, ami még a crawl idejéből származhat — ott a `&amp;` bent
    // maradhatott. Enélkül a paraméter neve `amp;height` lesz, és a
    // kiszolgáló a bélyegképet adja vissza (élesben: 4 kB, 50 px).
    url = new URL(decodeEntities(raw));
  } catch {
    return raw;
  }
  const isShopify =
    url.pathname.includes("/cdn/shop/") || url.hostname.startsWith("cdn.shopify.");
  if (!isShopify && !url.searchParams.has("width")) return raw;
  url.searchParams.set("width", String(DISPLAY_IMAGE_WIDTH));
  // A magasság és a rögzített oldalarány törlődik: így a kiszolgáló az
  // EREDETI arányt tartja. Enélkül a `height=50` maradna, és 768×50 jönne.
  url.searchParams.delete("height");
  url.searchParams.delete("aspect_ratio");
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
