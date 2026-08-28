/**
 * catalog-watch — közös típusok (docs/CATALOG_WATCH_TERV.md).
 *
 * A figyelő a `src/modules`-on KÍVÜL él: nem app-kód, a modul-szerződést (1.3)
 * nem érinti. A `BoardType`-ot típus-szinten a catalog modultól kölcsönzi, hogy
 * a `board_type` CHECK-kényszer és a jelölt-normalizálás ne csúszhasson el —
 * `import type`, tehát futásidőben nyoma sincs (Node type-stripping).
 */
import type { FieldCoverage } from "./suspicion.ts";
import type {
  BoardType,
  ExtractedBoardData,
  ExtractedBoardSpecs,
} from "../../src/modules/catalog/types.ts";

export type { BoardType };

/** `catalog_sources.kind` (migráció 20260717091600). */
export type SourceKind = "brand_site" | "shop" | "feed";

/** `catalog_sources.discovery` — kézzel felvitt vs. automatikusan javasolt. */
export type SourceDiscovery = "manual" | "search";

/** `catalog_candidates.status`. */
export type CandidateStatus = "pending" | "approved" | "rejected" | "merged";

/**
 * A `catalog_sources.crawl_config` jsonb sémája. Minden mező opcionális: a
 * crawler működik puszta `base_url`-lel is (robots.txt → sitemap felderítés).
 */
export interface CrawlConfig {
  /** Explicit sitemap-URL. Hiányában a robots.txt `Sitemap:` sorai. */
  sitemapUrl?: string;
  /**
   * LISTAOLDALAK, amikből a termék-URL-ek jönnek — sitemap HELYETT.
   *
   * Akkor kell, ha a forrásnak nincs használható sitemapje. Élesben
   * (aquatone.com): a `robots.txt` és minden sitemap-út 200-zal felel, de a
   * tartalmuk egy hibaoldal; a terméklistát viszont a bolt saját
   * AJAX-végpontja kiszolgálja sima GET-re is, HTML-töredékként.
   *
   * A megadott oldalak MINDEN `href`-je átmegy a szokásos
   * `productUrlPatterns`/`excludeUrlPatterns` szűrésen — a nem termék-linkek
   * (menü, lábléc) így maguktól kiesnek.
   */
  productListUrls?: string[];
  /** Csak az ezeket a részleteket tartalmazó URL-ek termékoldalak (pl. "/termek/"). */
  productUrlPatterns?: string[];
  /** Kizáró minták (pl. "/blog/", "?page="). */
  excludeUrlPatterns?: string[];
  /** Felső korlát egy futásra (udvarias crawl). Default: DEFAULT_MAX_PRODUCTS. */
  maxProducts?: number;
  /** Kérések közti minimum szünet ms-ban (a robots Crawl-delay felülírhatja). */
  minDelayMs?: number;
  /**
   * Fallback márkanév, ha egy termékoldal JSON-LD-je nem ad `brand`/`manufacturer`
   * mezőt (pl. egymárkás gyártói bolt, ahol ez magától értetődő, ezért ki sem
   * írják). Csak akkor él, ha a JSON-LD hallgat — a saját mezője mindig elsőbbséget
   * élvez.
   */
  defaultBrandName?: string;
  /**
   * SHOPIFY-MÓD (F2.1-utó-14). Ha jelen van, a crawl NEM a sitemapet járja,
   * hanem a bolt `/products.json` végpontját (indoklás: `shopify.ts` fejléc).
   * A `sitemapUrl`/`productUrlPatterns` ilyenkor nem játszik.
   */
  shopify?: {
    /**
     * Csak ezeket a Shopify `product_type` értékeket vesszük figyelembe (pl.
     * `["SUP Hardboard", "SUP Inflatable"]`). Üresen minden termék átmegy a
     * szokásos `classifyProduct` kapun — nagy, vegyes katalógusnál viszont
     * olcsóbb már itt szűrni.
     */
    productTypes?: string[];
    /**
     * Kollekció-slug → deszkatípus, a GYÁRTÓ saját besorolása alapján
     * (`race-paddleboards`: race, `surf-paddleboards`: …). Ez ÜT a névből
     * tippelt típuson. A SORREND SZÁMÍT: ha egy termék több kollekcióban is
     * szerepel (élesben: a Whopper „all-round / wave" ÉS „surf" is), az ELSŐ
     * egyezés nyer — a fősodratú kategóriát kell előre venni.
     */
    collectionTypes?: Record<string, BoardType>;
    /**
     * Kollekciók, amiknek a TERMÉKEI NEM kellenek. Felhasználói döntés
     * (2026-08-19): „a surf egy teljesen más dolog, mi a SUP-okra
     * fókuszálunk" — a `surf-paddleboards` és a wing-kollekciók termékei
     * tehát ki sem kerülnek jelölt-sorba.
     *
     * FONTOS: az ÁTFEDŐ modellek megmaradnak. A `collectionTypes`-ban
     * szereplő (pl. all-round) kollekció ERŐSEBB — a Whopper és a GO Surf a
     * gyártónál egyszerre „all-round / wave" ÉS „surf", és ezeket a gyártó
     * sík vízre is ajánlja, tehát kellenek.
     */
    excludeCollections?: string[];
  };
  /**
   * JSON-LD NÉLKÜLI oldalak feldolgozása (F2.1-utó-17): ha a forrás nem tesz ki
   * schema.org `Product`-ot, de a specifikációt címkézett szövegként közli
   * (élesben: `aquamarina.com`), a kinyerés a `<title>` + oldalszöveg alapján
   * megy. Csak explicit kapcsolóra, mert lazább, mint a JSON-LD út.
   */
  htmlOnly?: boolean;
  /**
   * KÉZI kategória-rögzítés URL-részlet szerint, azokra a termékekre, ahol a
   * gyártó sehol nem mondja ki a besorolást — sem a kategória-URL-ben, sem a
   * használat-sávokban, sem a leírásban.
   *
   * Élesben mért eset: az Aqua Marina `Revolution` leírása körülír
   * („stable enough for a first-time experience but with a shape to entertain
   * the expert paddler"), de kategória-szót nem használ. A moderátori döntés
   * ITT marad meg, hogy a KÖVETKEZŐ gyűjtésnél már ne kérdés legyen
   * (felhasználói kérés, 2026-08-19).
   */
  boardTypeByUrl?: Record<string, BoardType>;
  /**
   * A `<title>` végéről levágandó, OLDAL-SZINTŰ utótagok. Élesben mért eset
   * (zraysports.com): minden cím „-Zray Official Site"-tal végződik, amitől a
   * modellnév „Max Azure M2 A Official Site" lenne. Forrásonként más, ezért
   * konfig — globális zajszó-listaként egy jogos modellnevet is elvághatna.
   */
  titleSuffixes?: string[];
  /**
   * A `<title>`-t ENNÉL A JELNÉL elvágjuk, a mögötte álló reklámszöveggel
   * együtt. Élesben (fanatic.com): „FANATIC VIPER AIR S | L | T ᐅ SUPing or
   * Windsurfing couldn't be easier!" — a szlogen termékenként más, ezért
   * pontos utótagként nem adható meg, a `ᐅ` jel viszont mindig ott áll.
   */
  titleCutAfter?: string[];
  /**
   * FORRÁS-SZINTŰ zajszavak a modellnévből, a globális lista MELLÉ.
   *
   * Élesben (funwaterboard.com): minden cím SEO-szóhalmaz — „Cheap Polar Bear
   * 10′6″ Touring", „Best Paddle Boards Smiling Face Touring". A záró
   * „Touring" is kulcsszó, nem besorolás: MINDEN terméken ott áll, a
   * deszkatípust a gyártó külön mezőben (`Versatility`) mondja ki. Ugyanez a
   * szó az Indianánál VALÓDI modellnév-rész, ezért globálisan tilos kivenni —
   * a lista forrásonként, MÉRÉS után bővül.
   */
  titleNoiseWords?: string[];
  /**
   * A HOSSZ A CÍM ELEJÉRŐL, ha egyetlen mező sem adja meg.
   *
   * Élesben (red.equipment): a spec-blokk `Width`/`Board Thickness`/
   * `Board Weight` mezőket ad, HOSSZAT nem — az a modellnév eleje
   * (`10'8" Ride MSL …`). Enélkül a forrás egyetlen terméket sem ad.
   * Opt-in, mert a cím sokszor MÁS méretet visel (csomag, evező).
   */
  lengthFromTitle?: boolean;
  /**
   * Böngésző-renderelés akkor is, ha a nyers HTML EGYETLEN terméket sem adott.
   *
   * Alapból KI van kapcsolva, mert drága: e nélkül a fallback csak ott fut,
   * ahol már van termékünk, csak hiányos/ellentmondásos az adata. Van viszont
   * olyan forrás (fanatic.com), ahol a spec-tábla KIZÁRÓLAG renderelés után
   * létezik — ott a nyers HTML semmit nem ad, és a fallback esélyt sem kapna.
   *
   * Csak akkor kapcsold be, ha az URL-minta már szűkre van húzva: minden
   * illeszkedő, de terméket nem adó oldal egy böngésző-renderelésbe kerül.
   */
  renderWhenEmpty?: boolean;
  /**
   * A gyártó SAJÁT kategória-feliratát viselő elem osztályneve (részlet).
   * Élesben (fanatic.com): `product-overview__line` — a termékfejlécben álló
   * „ALL-AROUND / WINDSURF". Ez termékspecifikus jel, ezért erős: ugyanolyan
   * rangú, mint az URL kategória-szegmense.
   */
  categoryClass?: string;
  /**
   * A forrás által NEM KÖZÖLT mezők — „nincs adat", nem hiba (F2.1-utó-37).
   *
   * MIÉRT KELL KÜLÖN: a hiányzó mezőnek két, gyökeresen eltérő oka lehet, és
   * eddig nem tudtuk megkülönböztetni őket:
   *  * a KINYERÉS nem találta meg (ilyenkor javítani kell) — ez a gyakoribb;
   *  * a GYÁRTÓ nem teszi közzé (ilyenkor nincs mit javítani).
   *
   * Élesben mért eset (bluefinsupboards.eu, felhasználói ellenőrzés
   * 2026-08-21): a márka EGYETLEN modellnél sem közöl űrtartalmat — méretet
   * és teherbírást igen. Enélkül a 15 deszka örökre „hiányos" maradna a
   * munkalistán, és a mezőlefedettségi jelentés minden futásnál anomáliát
   * jelezne ott, ahol nincs.
   *
   * NEM feljogosítás a becslésre. A hiányzó érték hiányzó marad — a
   * geometriából számolt űrtartalom KITALÁLT biztonsági adat lenne.
   */
  unpublishedFields?: ("volumeL" | "weightKg" | "maxLoadKg" | "thicknessCm")[];
  /**
   * A KATEGÓRIA-KINYERÉSI MÓDSZEREK, a kért sorrendben (F2.1-utó-45).
   *
   * MIÉRT FORRÁSONKÉNT: „univerzálisat nem lehet létrehozni… minden gyártónak
   * egyedi megoldásai vannak" (felhasználói döntés, 2026-08-22). A kategóriát
   * hét gyártónál hét különböző úton mondja ki a forrás, és egy máshol hasznos
   * szabály itt téveszthet — a `multiUseProse` a Jobe-nál és a Gladiatornál a
   * gyártó saját állítását adja, a Fanatic prózájában viszont a „choppy waters
   * or rivers" fordulatból vadvízi deszka lett volna.
   *
   * A LISTA HIÁNYA = MINDEN módszer, a katalógus sorrendjében. Így egy recept
   * bővítése nem változtat a viselkedésen, amíg listát nem írunk bele; a
   * szűkítés MÉRÉS után történik (`probe-methods`).
   *
   * Ismert nevek: `pinnedUrl` · `nameAndUrl` · `categoryLine` · `breadcrumb` ·
   * `usageBars` · `prose` · `multiUseProse`.
   */
  categoryMethods?: string[];
  /** Szabad szöveges megjegyzés az adminnak. */
  notes?: string;
}

/** `public.catalog_sources` sor. */
export interface CatalogSourceRow {
  id: string;
  name: string;
  base_url: string | null;
  kind: SourceKind;
  country: string;
  discovery: SourceDiscovery;
  crawl_config: CrawlConfig | null;
  active: boolean;
  last_crawled_at: string | null;
  added_by: string | null;
  created_at: string;
}

/** Egy termékoldalról kinyert, MÉG NEM normalizált adat. */
export interface RawProduct {
  url: string;
  /** A termékoldal JSON-LD `Product` objektuma (nyers). */
  jsonLd: Record<string, unknown>;
}

/**
 * Deszka-specifikáció normalizált, SI-egységes formában (null = nem tudjuk).
 * A típus a catalog modulé: a `catalog_candidates.extracted` jsonb-szerződését
 * EGY helyen tartjuk, hogy a figyelő és a moderációs UI ne csúszhasson el.
 */
export type BoardSpecs = ExtractedBoardSpecs;

/** Üres spec — a parse-olók innen indulnak (a hiányzó érték marad null). */
export const EMPTY_SPECS: BoardSpecs = {
  lengthCm: null,
  widthCm: null,
  thicknessCm: null,
  volumeL: null,
  weightKg: null,
  maxLoadKg: null,
  inflatable: null,
};

/**
 * Egy termékoldal normalizált kivonata — ez megy az egyezés-keresésbe, és ez
 * kerül a `catalog_candidates.extracted` jsonb-be. A mezők jelentése a
 * catalog modul `ExtractedBoardData` típusánál van dokumentálva (ott él a
 * szerződés, amit a moderációs UI is olvas).
 */
export type ExtractedProduct = ExtractedBoardData;

/** Az egyezés-keresés három kimenete (terv 3. pont). */
export type MatchKind = "known" | "uncertain" | "new";

export interface MatchResult {
  kind: MatchKind;
  /** A legjobb jelölt deszka azonosítója (`new` esetén null). */
  boardId: string | null;
  /** 0–1 hasonlóság; a `catalog_candidates.match_confidence`-be kerül. */
  confidence: number;
}

/** Az egyezés-kereséshez szükséges minimális deszka-vetület. */
export interface BoardForMatch {
  id: string;
  brandName: string | null;
  modelName: string;
  modelYear: number | null;
}

/** Egy forrás egy futásának eredménye (a summary sora). */
export interface SourceCrawlSummary {
  sourceId: string;
  sourceName: string;
  /** Sitemapből kiszűrt termék-URL-ek száma (a maxProducts vágás UTÁN). */
  urlsConsidered: number;
  productsExtracted: number;
  /**
   * Kinyert, de a `classifyProduct` „ignore"-t adott (nem deszka, és NEM a
   * követett evező/mentőmellény/pumpa kategória egyike) — nem kerül jelölt-sorba.
   */
  skippedNonBoard: number;
  /** Ismert deszkára illesztett találat (ársor + last_seen_at). */
  matchedKnown: number;
  /** Új/bizonytalan → catalog_candidates sor. */
  candidatesCreated: number;
  pricesRecorded: number;
  /** robots.txt által tiltott, ezért ki NEM kért URL-ek. */
  robotsBlocked: number;
  /**
   * Hány TERMÉKNÉL sikerült a gyártói spec-táblából kiegészíteni a hiányzó
   * mezőket (F2.1-utó-16, Shopify-ág). Ez a szám mutatja, mennyire éri meg a
   * — költséges — böngésző-renderelés.
   */
  specTablesUsed: number;
  /**
   * MEZŐLEFEDETTSÉG ebben a futásban (F2.1-utó-38). Nem a soronkénti hiányt
   * mutatja, hanem a FORRÁSÉT: „19/20-nál volt űrtartalom" egészen mást
   * jelent, mint „0/15-nél". Az előbbi egy termék ügye, az utóbbi a kinyerésé.
   */
  coverage: FieldCoverage[];
  /**
   * GYANÚS TERMÉKEK ebben a futásban, emberi indoklással. A gyanú nem
   * elutasítás: az érték beíródik, de a sor nem csúszhat át a tömeges
   * jóváhagyáson, és itt, a GYŰJTÉSNÉL derül ki.
   */
  suspicious: { modelName: string; url: string; details: string[] }[];
  errors: string[];
}

export interface CrawlSummary {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  sources: SourceCrawlSummary[];
}
