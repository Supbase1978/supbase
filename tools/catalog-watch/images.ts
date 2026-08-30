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
import { embeddedImageUrls } from "./embedded.ts";

/** Egy szóba jöhető képforrás: a deszkához kötött jelölt egy sora. */
export interface ImageSourceCandidate {
  url: string | null;
  /** `pending` | `approved` | `rejected` | `merged` */
  status: string;
  /** A jelöltet adó forrás fajtája: `brand_site` | `shop` | `feed`. */
  sourceKind: string | null;
  /** A forrás azonosítója — ebből derül ki a recept (pl. a beágyazott horgony). */
  sourceId?: string | null;
  /** A crawl idején eltárolt kép (ha volt) — ezért nem kell újra letölteni. */
  storedImageUrl: string | null;
  /**
   * A crawl idején BEGYŰJTÖTT galéria, ha a forrás adott ilyet.
   *
   * Fejetlen boltnál (islesurfandsup.com) ez az EGYETLEN út: a
   * `/products/<handle>.json` végpont 404, a képlista a beágyazott JSON-ban
   * áll — a crawl viszont már kiolvasta. Elhagyható: a régebbi jelölt-sorok
   * még nem viselik.
   */
  storedGallery?: readonly string[];
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

/**
 * GALÉRIA A GYÁRTÓ SAJÁT KÉP-KONTÉNERÉBŐL (F2.1-utó-56).
 *
 * MIÉRT KELL, ÉS MIÉRT NEM ÁLTALÁNOS KULCSSZÓ: a katalógus 273 deszkájából 160
 * EGYETLEN képpel állt, mert a galéria eddig KÉT úton jöhetett — a Shopify
 * `/products.json`-ból és a cikkszám-horgonyból —, és a források fele egyiket
 * sem adja. A tiltás viszont továbbra is él: a lap ÖSSZES képét begyűjteni
 * tilos, mert a „Related Products" blokk MÁS termékek fotóit is felkínálja.
 *
 * A megoldás ugyanaz, mint a kategóriánál (`categoryClass`): a gyártó SAJÁT,
 * termékspecifikus ELEMÉT nevezzük meg a receptben. A konténeren BELÜL minden
 * kép ezé a termékéé — ezt a gyártó DOM-ja garantálja, nem a mi heurisztikánk.
 *
 * MÉRVE (2026-08-30): `product__main-gallery` (Gladiator) 6 kép,
 * `w-bigimglist` (Zray) 5 kép — mindkettő tisztán a termék sajátja.
 *
 * A konténert TAG-MÉLYSÉG szerint vágjuk ki, nem karakter-ablakkal: egy
 * galéria-slider tetszőlegesen mély, és a fix ablak vagy levágná a végét, vagy
 * átnyúlna a következő blokkba.
 */
export function galleryByContainer(
  html: string,
  className: string | null | undefined,
  coverUrl: string | null,
  pageUrl?: string,
): string[] {
  if (!className) return [];
  // TÖBB ELEM IS VISELHETI AZ OSZTÁLYT. Élesben (star-board.com) a
  // `hdt-slider__container` HÁROMSZOR fordul elő: kétszer a variáns-bélyegek
  // csíkjaként (2-2 kép), egyszer a termék galériájaként (8 kép). Az elsőt
  // véve a galéria fele elveszne, ezért a LEGTÖBB képet adó elem nyer — az
  // osztálynevet a recept már leszűkítette a gyártó saját sliderére.
  let best: string[] = [];
  for (const container of slicesByClass(html, className)) {
    const urls: string[] = [];
    for (const match of container.matchAll(
      /(?:src|data-src|data-lazy-src|data-original|data-large_image|href)="([^"]+?\.(?:jpe?g|png|webp)(?:\?[^"]*)?)"/gi,
    )) {
      const url = absolute(decodeEntities(match[1] ?? ""), pageUrl);
      if (url !== null) urls.push(url);
    }
    const gallery = galleryCandidates(urls, coverUrl);
    if (gallery.length > best.length) best = gallery;
  }
  return best;
}

/**
 * MINDEN adott osztálynevű elem külső HTML-je, a nyitó- és zárótag
 * párosítását mélység szerint követve.
 *
 * A mélység-követés a karakter-ablak helyett azért kell, mert egy
 * galéria-slider tetszőlegesen mély: a fix ablak vagy levágná a végét, vagy
 * átnyúlna a következő blokkba.
 */
function* slicesByClass(html: string, className: string): Generator<string> {
  const open = new RegExp(
    `<(\\w+)[^>]*class="[^"]*${escapeRegExp(className)}[^"]*"`,
    "gi",
  );
  for (let found = open.exec(html); found !== null; found = open.exec(html)) {
    const tag = found[1];
    if (tag === undefined) continue;
    let depth = 1;
    const tags = new RegExp(`</?${tag}\\b`, "gi");
    tags.lastIndex = found.index + found[0].length;
    let end = html.length;
    for (let m = tags.exec(html); m !== null; m = tags.exec(html)) {
      depth += m[0].startsWith("</") ? -1 : 1;
      if (depth === 0) {
        end = m.index;
        break;
      }
    }
    yield html.slice(found.index, end);
  }
}

/** Regex-metakarakterek védelme a konfigból jövő osztálynévben. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GALÉRIA EGY LETÖLTÖTT OLDALBÓL, a gyártó BEÁGYAZOTT képlistájából.
 *
 * MIÉRT KELL KÜLÖN ÚT: a `backfill-gallery` alapesetben a Shopify
 * `/products/<handle>.json` végpontjára épül — fejetlen boltnál viszont az
 * 404-et ad (islesurfandsup.com), a képlista pedig a lapba ágyazott
 * API-válaszban áll. A crawl ezt már kiolvassa, de a MÁR JÓVÁHAGYOTT jelöltek
 * sorát egy újracrawl szándékosan nem írja felül — a meglévő katalógus-sorok
 * galériája tehát csak innen pótolható.
 *
 * Üres lista, ha a forrásnak nincs horgonya vagy a lap nem ad képet.
 */
export function galleryFromPage(
  html: string,
  embeddedAnchor: string | null,
  coverUrl: string | null,
  pageUrl?: string,
): string[] {
  if (!embeddedAnchor) return [];
  const urls = embeddedImageUrls(html, embeddedAnchor, MAX_GALLERY_CANDIDATES + 1)
    .map((url) => absolute(url, pageUrl))
    .filter((url): url is string => url !== null);
  return galleryCandidates(urls, coverUrl);
}

/**
 * A kép AZONOSSÁGA: origó + útvonal, lekérdező rész NÉLKÜL.
 *
 * A méretező paraméter (`?width=`, `?v=`, `?x-oss-process=…`) ugyanannak a
 * fájlnak a másik változatát kéri — a galériában egyszer kell.
 */
export function imageIdentity(url: string): string {
  const withoutQuery = (() => {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return url.split("?")[0] ?? url;
    }
  })();
  // A MÉRET-KÖNYVTÁR sem tesz másik képet: `…/AMB930068_altpic_1/AMB930068.jpg`
  // és `…/AMB930068_altpic_1/80x52/AMB930068.jpg` UGYANAZ a fotó, csak
  // bélyegkép-méretben (aquamarinahungary.com). A `470x450` alak ugyanígy.
  // A MÉRET A FÁJLNÉVBEN is állhat: a WordPress/WooCommerce `-800x800`
  // utótaggal generálja a kicsinyített változatokat
  // (`Aqua-Marina-HALO-100-s.jpg` és `…-s-800x800.jpg` ugyanaz a fotó).
  return withoutQuery
    .split("/")
    .filter((segment) => !/^\d{2,4}x\d{2,4}$/.test(segment))
    .join("/")
    .replace(/-\d{2,4}x\d{2,4}(\.[a-z]{3,4})$/i, "$1");
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
  // AZONOSSÁG AZ ÚTVONALON, nem a teljes URL-en (F2.1-utó-56). Ugyanaz a kép
  // többféle ÁTMÉRETEZŐ paraméterrel is szerepelhet a lapon — élesben
  // (zraysports.com) a galéria-konténerben ott a `…/3469216.jpg` és a
  // `…/3469216.jpg?x-oss-process=image/resize,m_lfit,h_200,w_200` is, ami a
  // teljes URL-re szűrve KÉT képnek látszik, holott a második a bélyegkép.
  const seen = new Set<string>(cover === null ? [] : [imageIdentity(cover)]);
  const out: string[] = [];
  for (const raw of imageUrls) {
    if (out.length >= MAX_GALLERY_CANDIDATES) break;
    const url = displayImageUrl(raw ?? null);
    if (url === null) continue;
    const file = imageIdentity(url).split("/").pop() ?? "";
    if (/logo|construction|technology|detail|icon|thumb|badge/i.test(file)) continue;
    const identity = imageIdentity(url);
    if (seen.has(identity)) continue;
    seen.add(identity);
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
  if (isTemplatePlaceholder(raw)) return null;
  // ORSZÁGZÁSZLÓ-IKON sosem termékfotó. Élesben (islesurfandsup.com,
  // 2026-08-29) a pénznem-választó zászlaja lett NÉGY deszka borítója: a
  // pozíció-fallback a lapon talált első képet adja, és fejetlen boltnál a
  // termékfotók csak a beágyazott adatban vannak. A `flag-icons` a jól ismert
  // ikonkészlet útvonala — egyértelmű, ezért szűk a szabály.
  if (raw.includes("flag-icons")) return null;
  // VEKTORGRAFIKA nem termékfotó. Élesben (2026-08-30) a `vector-33.svg`
  // KÉT különböző deszka galériájában is ott volt — egy sablon-ikon, amit a
  // kép-konténer felszedett. Fotót a gyártók sosem SVG-ben adnak.
  if (/\.svg(?:\?|$)/i.test(raw)) return null;
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

/**
 * FEL NEM OLDOTT SABLON-HELYŐRZŐ az `src`-ben — sosem kép.
 *
 * Élesben (boteboard.com, 2026-08-29) a HD Gatorshell lapján a sablon egy
 * darabja nyersen kikerült a HTML-be: `<img src="{{ firstImageSrc }}">`. Az
 * abszolutizálás után ebből
 * `https://www.boteboard.com/products/%7B%7B%20firstImageSrc%20%7D%7D&width=200`
 * lett — szintaktikailag ÉRVÉNYES URL, ezért minden korábbi szűrőn átment, és
 * egy törött kép került volna a katalógus-sorra. A `%7B%7B` alak azért is
 * alattomos, mert a kapcsos zárójel a kódolás után már nem látszik.
 *
 * A Liquid (`{{ }}`) mellett a másik két elterjedt jelölést is elutasítjuk
 * (`{% %}`, `${ }`), kódolva és nyersen egyaránt.
 */
function isTemplatePlaceholder(raw: string): boolean {
  const folded = decodeURIComponent_(raw).toLowerCase();
  return (
    folded.includes("{{") ||
    folded.includes("}}") ||
    folded.includes("{%") ||
    folded.includes("${")
  );
}

/** Hibatűrő URL-dekódolás: a hibás `%` szekvencia nem dobhat kivételt. */
function decodeURIComponent_(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
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
