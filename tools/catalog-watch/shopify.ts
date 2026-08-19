/**
 * catalog-watch — Shopify-katalógus adapter (F2.1-utó-14, 2026-08-19).
 *
 * MIÉRT KELL: a gyártói oldalak nagy része Shopify-boltot futtat, ahol a
 * termékoldal HTML-je NEM tartalmazza a specifikációt (a méret-variánsokat JS
 * tölti be) — a `crawl.ts` sitemap+JSON-LD útja ezeken üres jelöltet gyártana.
 * Élesben mérve (star-board.com): 445 termékoldal, mindegyiken szabályos
 * Product JSON-LD, de a méret sem a nyers HTML-ben, sem a Playwright-
 * RENDERELT szövegben nincs ott — a `parseSpecsFromText` mind az öt mérőszámra
 * `null`-t adott.
 *
 * A megoldás nem több scraping, hanem KEVESEBB: a Shopify minden boltnál
 * kiszolgálja a `/products.json` végpontot, ami ugyanazt a katalógust adja
 * strukturáltan — termékenként `vendor` (márka), `product_type` (kategória) és
 * `variants[]` (méretenkénti sor). Ez egyszerre pontosabb és OLCSÓBB: 445
 * oldal-letöltés helyett 2 lapozott kérés.
 *
 * MIÉRT A GYÁRTÓI NÉV A MÉRVADÓ (felhasználói döntés, 2026-08-19): a
 * modellnevet a gyártó oldaláról vesszük, mert az a hivatalos — a
 * kereskedői oldalak átnevezik/kiegészítik a terméket ("ISUP", "2024",
 * csomagajánlat), amitől ugyanaz a deszka több néven kerülne be.
 *
 * KORLÁT: a `/products.json` a méreten túl NEM ad vastagságot/súlyt/
 * teherbírást. Amit ad (hossz, szélesség, gyakran űrtartalom), az a
 * variáns-címből jön — a többi mező marad `null`, és a szokásos
 * `verify-specs` úton tölthető. Ez tudatos csere: 97 HIVATALOS Starboard-
 * modell fele-adattal többet ér, mint 0 modell.
 */
import {
  cleanModelName,
  classifyProduct,
  detectInflatable,
  extractModelYear,
  guessBoardType,
  normalizeBrandName,
  parseDimensionCm,
} from "./normalize.ts";
import { htmlToText } from "./html.ts";
import { EMPTY_SPECS, type BoardSpecs, type BoardType, type ExtractedProduct } from "./types.ts";

/** Egy `/products.json` lapon legfeljebb ennyi termék kérhető (Shopify-korlát). */
export const SHOPIFY_PAGE_LIMIT = 250;

/** Biztonsági felső korlát a lapozásra — végtelen ciklus ellen. */
const MAX_PAGES = 20;

/** A `/products.json` variáns-sora (csak amit használunk). */
export interface ShopifyVariant {
  id: number | string;
  title: string | null;
  sku?: string | null;
  price?: string | number | null;
  available?: boolean | null;
  grams?: number | null;
}

/** A `/products.json` termék-sora (csak amit használunk). */
export interface ShopifyProduct {
  id: number | string;
  title: string | null;
  handle: string | null;
  vendor?: string | null;
  product_type?: string | null;
  body_html?: string | null;
  variants?: ShopifyVariant[] | null;
  images?: { src?: string | null }[] | null;
}

/**
 * A variáns-címből kiolvasott méret. A `raw` a cím méret-fele VÁLTOZATLANUL —
 * ez lesz a modellnév kiegészítése, hogy a moderátor lássa, melyik méretről van
 * szó (a Shopify-terméknév maga méret NÉLKÜLI: „GO Paddle Board").
 */
export interface VariantSize {
  /**
   * A méret EMBERI címkéje, ami a modellnév végére kerül — CSAK a dimenzió-
   * rész (`12'0" X 34"`). Az űrtartalom és az egyéb utótagok szándékosan
   * kimaradnak: az űrtartalom a `specs.volumeL`-be megy (ne szerepeljen
   * kétszer), a többi szegmens pedig kivitel-megnevezés, nem méret.
   */
  label: string;
  /**
   * A KIVITEL (anyag/konstrukció): `Deluxe Lite`, `Rhino`, `Xtec Carbon D2`.
   *
   * Felhasználói döntés (2026-08-19): a kiviteli változatok KÜLÖN deszkák,
   * nem fésüljük össze őket. Két indok: a gyártó okkal ad meg külön modellt,
   * és az évjáratok között a különbség jóval nagyobb is lehet, mint a mostani
   * (All Star 14'0" x 26": Deluxe 10,5 kg / 105 kg vs. Deluxe Lite 9,6 kg /
   * 85 kg). Összevonva a súlyt üresen kellett hagyni, a teherbírást pedig a
   * szigorúbb értékre húzni — külön tartva mindkettő PONTOS.
   */
  construction: string | null;
  lengthCm: number | null;
  widthCm: number | null;
  volumeL: number | null;
}

/**
 * A göndör idézőjelek ASCII-ra váltása. A Starboard vegyesen használja a
 * `12'0" X 34"` és a `14’0” X 28.5”` alakot ugyanazon a boltban; a
 * `parseDimensionCm` az ASCII-alakokra van hangolva.
 */
function normalizeQuotes(text: string): string {
  return text.replace(/[‘’ʼ]/g, "'").replace(/[“”″]/g, '"');
}

/**
 * Variáns-cím felbontása. Kezelt alakok (élesben mért, star-board.com):
 *   `12'0" X 34" / Rhino`               → méret + konstrukció
 *   `9'8" X 30.5" | 145 L / Xtec Carbon` → méret + űrtartalom + konstrukció
 *   `14’0” X 28.5” / Xtec Carbon D2`     → göndör idézőjelekkel
 *   `Default Title`                      → nincs méret (null)
 *
 * A ` / ` UTÁNI rész a KONSTRUKCIÓ (anyag/kivitel), nem méret — - ez ugyanaz a
 * helyzet, mint a színváltozatoknál (`szinvaltozat-lista-terv`): ugyanaz a
 * deszka, más kivitelben. Ezért a méret-kulcsba NEM megy bele, a konstrukciós
 * variánsok összefésülődnek.
 */
export function parseVariantSize(variantTitle: string | null | undefined): VariantSize | null {
  if (!variantTitle) return null;
  const normalized = normalizeQuotes(variantTitle).trim();
  if (normalized === "" || /^default title$/i.test(normalized)) return null;

  // A méret és a KIVITEL szétválasztása az ELSŐ " / "-nál (a kivitelnév maga is
  // tartalmazhat perjelet, a méret viszont sosem).
  const slashParts = normalized.split(/\s\/\s/);
  const sizePart = (slashParts[0] ?? "").trim();
  const construction = slashParts.slice(1).join(" / ").trim() || null;
  if (sizePart === "") return null;

  // Az űrtartalom külön szegmensben jön: `9'8" X 30.5" | 145 L`.
  const segments = sizePart.split("|").map((s) => s.trim());
  const dimensionText = segments[0] ?? "";
  let volumeL: number | null = null;
  for (const segment of segments.slice(1)) {
    const litre = segment.match(/(\d+(?:[.,]\d+)?)\s*L\b/i);
    if (litre) {
      const value = Number((litre[1] ?? "").replace(",", "."));
      if (Number.isFinite(value)) volumeL = value;
    }
  }

  // `12'0" X 34"` — a szorzójel lehet X/x/× is.
  const parts = dimensionText.split(/\s*[x×X]\s*/).filter((p) => p.trim() !== "");
  const lengthCm = parts[0] ? parseDimensionCm(parts[0]) : null;
  const widthCm = parts[1] ? parseDimensionCm(parts[1]) : null;

  // Ha SEMMI értelmezhető nem jött ki, ez nem méret-variáns (pl. „Blue", „S").
  if (lengthCm === null && widthCm === null && volumeL === null) return null;

  return { label: dimensionText.trim(), construction, lengthCm, widthCm, volumeL };
}

/**
 * A variánsok azonosító kulcsa: méret + űrtartalom + KIVITEL.
 *
 * A kivitel a kulcs része (felhasználói döntés, 2026-08-19), tehát a
 * `12'0" X 34" / Rhino` és a `12'0" X 34" / Lite Tech Wave` KÉT külön jelölt.
 * Az űrtartalom is számít: ugyanaz a hossz×szélesség két különböző térfogattal
 * (eltérő vastagság/alak) szintén két deszka.
 */
function variantKey(size: VariantSize): string {
  const label = size.label.toLowerCase().replace(/\s+/g, "");
  const volume = size.volumeL === null ? "" : `|${size.volumeL}`;
  const construction = size.construction === null ? "" : `|${size.construction.toLowerCase()}`;
  return `${label}${volume}${construction}`;
}

/**
 * A variáns kanonikus URL-je. A jelöltek egyediség-kulcsa az `url`
 * (`store.saveCandidate`), ezért minden méretnek SAJÁT, STABIL URL kell.
 * A `?variant=` valódi, működő Shopify-link a konkrét méretre.
 */
function variantUrl(baseUrl: string, handle: string, variantId: number | string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/products/${handle}?variant=${variantId}`;
}

function firstImage(product: ShopifyProduct): string | null {
  const src = product.images?.[0]?.src;
  if (!src) return null;
  return src.startsWith("//") ? `https:${src}` : src;
}

/** Egy kibontott variáns + a spec-tábla illesztéséhez szükséges kulcsok. */
export interface ExpandedVariant {
  product: ExtractedProduct;
  /** Méret-kulcs a gyártói spec-tábla oszlopához (`spec-table.ts` alakja). */
  sizeLabel: string;
  /** Kivitel, ha a variáns megadta — a spec-tábla cellái ez szerint bontanak. */
  construction: string | null;
}

/**
 * Egy Shopify-termék szétbontása VARIÁNSONKÉNTI jelöltekre.
 *
 * Termékenként TÖBB jelölt keletkezik, mert a SUP-nál sem a méret, sem a
 * kivitel nem árnyalat:
 *  - a MÉRET maga a termék (egy 10'8"-os és egy 12'0"-os GO más deszka, a
 *    Deszkaválasztó a hossz/szélesség alapján pontoz);
 *  - a KIVITEL (Deluxe / Deluxe Lite / Rhino…) külön modell a gyártónál is,
 *    és érdemben eltérhet — az All Star 14'0" x 26"-nál a Deluxe 10,5 kg és
 *    105 kg-ig terhelhető, a Deluxe Lite 9,6 kg és csak 85 kg-ig. Összevonva
 *    a súlyt üresen kellene hagyni, a teherbírást pedig a szigorúbb értékre
 *    húzni; külön tartva mindkettő PONTOS (felhasználói döntés, 2026-08-19).
 *
 * Méret-variáns nélküli termék (`Default Title`) egyetlen jelöltet ad, méret
 * nélkül — a nevéből még kijöhet a hossz (`cleanModelName`/`parseDimensionCm`
 * a hívó `extractProduct`-tal egyező módon), de itt nem találgatunk.
 */
export function expandShopifyProduct(
  product: ShopifyProduct,
  baseUrl: string,
  defaultBrandName: string | null = null,
  /**
   * A GYÁRTÓ saját besorolása kollekció-tagság alapján
   * (`fetchShopifyCollectionTypes`). Ha van, ez ÜT a névből tippelt típuson —
   * a gyártó jobban tudja, mire való a deszkája.
   */
  boardTypeOverride: BoardType | null = null,
): ExpandedVariant[] {
  const rawTitle = (product.title ?? "").replace(/\s+/g, " ").trim();
  const handle = product.handle ?? "";
  if (rawTitle === "" || handle === "") return [];

  const brandName = normalizeBrandName(product.vendor) ?? normalizeBrandName(defaultBrandName);
  const descriptionText = htmlToText(product.body_html ?? "");
  const imageUrl = firstImage(product);
  const variants = product.variants ?? [];

  // A besorolási tippekhez a terméknév + leírás + a Shopify SAJÁT kategóriája.
  // A `product_type` erős jel: a bolt maga mondja meg, hogy „SUP Inflatable"
  // vagy „SUP Bag" — ezt a szabad szövegű találgatás nem éri utol.
  const typeHintText = `${rawTitle}\n${product.product_type ?? ""}\n${descriptionText}`;
  // A `handle` a termék URL-slugja (`2026-touring-inflatable-board-with-paddle`)
  // — a gyártó saját besorolása gyakran csak ebben látszik.
  const boardType =
    boardTypeOverride ??
    guessBoardType(`${rawTitle}\n${product.product_type ?? ""}\n${handle.replace(/[-_]+/g, " ")}`);
  const inflatable = detectInflatable(typeHintText);
  const modelYear = extractModelYear(`${rawTitle} ${handle}`);

  // Variánsonként (méret + űrtartalom + kivitel) az ELSŐ példány a képviselő.
  // A `variants` sorrendje a Shopify válaszában stabil, de a biztonság
  // kedvéért a legkisebb id-t választjuk: így egy átrendezés nem ad új URL-t
  // (és nem duplikálja a jelöltet). Azonos kulcsra több variáns akkor eshet,
  // ha a bolt SZÍNT is variánsként kezel — a szín nem külön deszka.
  const bySize = new Map<string, { size: VariantSize; variant: ShopifyVariant }>();
  for (const variant of variants) {
    const size = parseVariantSize(variant.title);
    if (!size) continue;
    const key = variantKey(size);
    const existing = bySize.get(key);
    if (!existing || String(variant.id) < String(existing.variant.id)) {
      bySize.set(key, { size, variant });
    }
  }

  const buildProduct = (
    url: string,
    modelSuffix: string | null,
    specsOverride: Partial<BoardSpecs>,
    variant: ShopifyVariant | null,
  ): ExtractedProduct | null => {
    const baseModel = cleanModelName(rawTitle, brandName);
    // A méret a modellnév RÉSZE lesz („GO Paddle Board 12'0\" X 34\""), mert a
    // Shopify-terméknév méret nélküli, a katalógusban viszont a méret
    // különbözteti meg a modelleket egymástól.
    const modelName = modelSuffix ? `${baseModel} ${modelSuffix}`.trim() : baseModel;
    if (modelName === "") return null;

    const specs: BoardSpecs = { ...EMPTY_SPECS, inflatable, ...specsOverride };

    const extracted: ExtractedProduct = {
      sourceUrl: url,
      brandName,
      modelName,
      rawTitle: modelSuffix ? `${rawTitle} ${modelSuffix}` : rawTitle,
      modelYear,
      // ÁR SZÁNDÉKOSAN null: gyártói oldal, és az árpolitika szerint bolti
      // árat nem jelenítünk meg (`ar-megjelenites-politika`). A Shopify
      // `price` mezője ráadásul a bolt pénznemében van (Starboard: EUR),
      // a `priceHuf` mező pedig forintot vár — átváltani nem a figyelő dolga.
      priceHuf: null,
      inStock: variant?.available ?? null,
      imageUrl,
      boardType,
      specs,
      accessoryType: null,
    };

    // A besorolást ugyanaz a kapu végzi, mint a JSON-LD-s úton: a Shopify
    // `product_type` csak tipp, a döntés a közös `classifyProduct`-é (így a
    // táska/lapát/ruházat nem szivárog be deszkaként).
    const classification = classifyProduct(extracted);
    if (classification.kind === "ignore") return null;
    extracted.accessoryType = classification.kind === "accessory" ? classification.accessoryType : null;
    return extracted;
  };

  if (bySize.size === 0) {
    const single = buildProduct(
      variantUrl(baseUrl, handle, variants[0]?.id ?? "default"),
      null,
      {},
      variants[0] ?? null,
    );
    return single ? [{ product: single, sizeLabel: "", construction: null }] : [];
  }

  const results: ExpandedVariant[] = [];
  for (const { size, variant } of bySize.values()) {
    // A KIVITEL is a modellnév része lesz („All Star 14'0\" X 26\" Deluxe Lite"),
    // különben két jelölt viselné ugyanazt a nevet, és a moderátor nem tudná
    // megkülönböztetni őket.
    const suffix = size.construction ? `${size.label} ${size.construction}` : size.label;
    const built = buildProduct(
      variantUrl(baseUrl, handle, variant.id),
      suffix,
      { lengthCm: size.lengthCm, widthCm: size.widthCm, volumeL: size.volumeL },
      variant,
    );
    if (built) {
      results.push({ product: built, sizeLabel: size.label, construction: size.construction });
    }
  }
  return results;
}

/**
 * KOLLEKCIÓ-ALAPÚ KATEGÓRIA (F2.1-utó-19, 2026-08-19).
 *
 * A Shopify-boltok kollekciókba rendezik a termékeket, és a GYÁRTÓI boltnál ez
 * a saját, hivatalos besorolás — pontosabb minden szöveg-heurisztikánál.
 * Élesben (star-board.com): `race-paddleboards`, `expedition-paddleboards`,
 * `all-round-wave-paddleboards`, `surf-paddleboards`.
 *
 * Miért fontos: a modellnevekben NINCS kategória-szó (Spice, Whopper, Wedge),
 * a találgatás pedig félrevisz. Élesben mérve a Whopper és a GO Surf EGYSZERRE
 * szerepel az „all-round / wave" és a „surf" kollekcióban — a gyártó tehát
 * mindkét használatra ajánlja őket —, a Wedge viszont CSAK szörf, pedig a neve
 * alapján allroundnak tűnne.
 *
 * A leképezés a forrás `crawl_config`-jában él (nem a kódban), mert
 * boltonként más a kollekciók neve.
 */
export async function fetchShopifyCollectionTypes(
  baseUrl: string,
  fetchJson: FetchJson,
  collectionTypes: Readonly<Record<string, BoardType>>,
  options: { sleep?: (ms: number) => Promise<void>; delayMs?: number } = {},
): Promise<{ byProductId: Map<string, BoardType>; errors: string[] }> {
  const base = baseUrl.replace(/\/+$/, "");
  const sleep = options.sleep ?? (() => Promise.resolve());
  const delayMs = options.delayMs ?? 0;
  const byProductId = new Map<string, BoardType>();
  const errors: string[] = [];

  // A felsorolás sorrendje SZÁMÍT: ha egy termék több kollekcióban is benne
  // van (Whopper: all-round ÉS surf), az ELSŐ egyezés nyer. A konfigban
  // ezért a „fősodratú" kategóriákat kell előre venni.
  for (const [handle, boardType] of Object.entries(collectionTypes)) {
    await sleep(delayMs);
    let response: { status: number; text: string };
    try {
      response = await fetchJson(`${base}/collections/${handle}/products.json?limit=250`);
    } catch (error) {
      errors.push(`${handle}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (response.status >= 400) {
      errors.push(`${handle}: HTTP ${response.status}`);
      continue;
    }
    let parsed: { products?: { id?: number | string }[] };
    try {
      parsed = JSON.parse(response.text) as { products?: { id?: number | string }[] };
    } catch {
      errors.push(`${handle}: érvénytelen JSON`);
      continue;
    }
    for (const product of parsed.products ?? []) {
      const id = product.id === undefined ? null : String(product.id);
      if (id !== null && !byProductId.has(id)) byProductId.set(id, boardType);
    }
  }

  return { byProductId, errors };
}

/**
 * Egy kollekció TERMÉK-AZONOSÍTÓI — a kizáráshoz (`excludeCollections`).
 * Hibatűrő: elérhetetlen kollekció esetén üres halmaz + hibaüzenet, mert egy
 * hiányzó kollekció miatt nem szabad az egész crawlt eldobni.
 */
export async function fetchShopifyCollectionIds(
  baseUrl: string,
  fetchJson: FetchJson,
  handles: readonly string[],
  options: { sleep?: (ms: number) => Promise<void>; delayMs?: number } = {},
): Promise<{ ids: Set<string>; errors: string[] }> {
  const base = baseUrl.replace(/\/+$/, "");
  const sleep = options.sleep ?? (() => Promise.resolve());
  const delayMs = options.delayMs ?? 0;
  const ids = new Set<string>();
  const errors: string[] = [];

  for (const handle of handles) {
    await sleep(delayMs);
    try {
      const response = await fetchJson(`${base}/collections/${handle}/products.json?limit=250`);
      if (response.status >= 400) {
        errors.push(`${handle}: HTTP ${response.status}`);
        continue;
      }
      const parsed = JSON.parse(response.text) as { products?: { id?: number | string }[] };
      for (const product of parsed.products ?? []) {
        if (product.id !== undefined) ids.add(String(product.id));
      }
    } catch (error) {
      errors.push(`${handle}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { ids, errors };
}

/** A `fetchShopifyCatalog` hálózati függősége — tesztben injektálható. */
export type FetchJson = (url: string) => Promise<{ status: number; text: string }>;

export interface ShopifyCatalogOptions {
  /** Legfeljebb ennyi TERMÉK (nem variáns) — udvarias crawl. */
  maxProducts?: number;
  /** Csak ezek a `product_type` értékek (kis/nagybetű-független). Üres → mind. */
  productTypes?: readonly string[];
  /** Lapok közti szünet ms-ban. */
  sleep?: (ms: number) => Promise<void>;
  delayMs?: number;
}

/**
 * A teljes Shopify-katalógus lekérése lapozva. Hibatűrő: egy hibás lap
 * megszakítja a lapozást, de a MÁR begyűjtött termékeket visszaadja (a hívó
 * summaryjába a hiba külön kerül).
 */
export async function fetchShopifyCatalog(
  baseUrl: string,
  fetchJson: FetchJson,
  options: ShopifyCatalogOptions = {},
): Promise<{ products: ShopifyProduct[]; errors: string[] }> {
  const base = baseUrl.replace(/\/+$/, "");
  const maxProducts = options.maxProducts ?? Number.POSITIVE_INFINITY;
  const wanted = new Set((options.productTypes ?? []).map((t) => t.toLowerCase()));
  const sleep = options.sleep ?? (() => Promise.resolve());
  const delayMs = options.delayMs ?? 0;

  const products: ShopifyProduct[] = [];
  const errors: string[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${base}/products.json?limit=${SHOPIFY_PAGE_LIMIT}&page=${page}`;
    if (page > 1) await sleep(delayMs);

    let response: { status: number; text: string };
    try {
      response = await fetchJson(url);
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
      break;
    }
    if (response.status >= 400) {
      errors.push(`${url}: HTTP ${response.status}`);
      break;
    }

    let parsed: { products?: ShopifyProduct[] };
    try {
      parsed = JSON.parse(response.text) as { products?: ShopifyProduct[] };
    } catch {
      errors.push(`${url}: érvénytelen JSON`);
      break;
    }

    const page_products = parsed.products ?? [];
    if (page_products.length === 0) break; // elfogyott a katalógus

    for (const product of page_products) {
      if (wanted.size > 0 && !wanted.has((product.product_type ?? "").toLowerCase())) continue;
      products.push(product);
      if (products.length >= maxProducts) return { products, errors };
    }

    // Rövidebb lap, mint a kért limit → ez volt az utolsó.
    if (page_products.length < SHOPIFY_PAGE_LIMIT) break;
  }

  return { products, errors };
}
