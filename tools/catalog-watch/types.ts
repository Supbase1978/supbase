/**
 * catalog-watch — közös típusok (docs/CATALOG_WATCH_TERV.md).
 *
 * A figyelő a `src/modules`-on KÍVÜL él: nem app-kód, a modul-szerződést (1.3)
 * nem érinti. A `BoardType`-ot típus-szinten a catalog modultól kölcsönzi, hogy
 * a `board_type` CHECK-kényszer és a jelölt-normalizálás ne csúszhasson el —
 * `import type`, tehát futásidőben nyoma sincs (Node type-stripping).
 */
import type { BoardType } from "../../src/modules/catalog/types.ts";

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
  /** Csak az ezeket a részleteket tartalmazó URL-ek termékoldalak (pl. "/termek/"). */
  productUrlPatterns?: string[];
  /** Kizáró minták (pl. "/blog/", "?page="). */
  excludeUrlPatterns?: string[];
  /** Felső korlát egy futásra (udvarias crawl). Default: DEFAULT_MAX_PRODUCTS. */
  maxProducts?: number;
  /** Kérések közti minimum szünet ms-ban (a robots Crawl-delay felülírhatja). */
  minDelayMs?: number;
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

/** Deszka-specifikáció normalizált, SI-egységes formában (null = nem tudjuk). */
export interface BoardSpecs {
  lengthCm: number | null;
  widthCm: number | null;
  thicknessCm: number | null;
  volumeL: number | null;
  weightKg: number | null;
  maxLoadKg: number | null;
  inflatable: boolean | null;
}

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
 * kerül a `catalog_candidates.extracted`-be.
 */
export interface ExtractedProduct {
  sourceUrl: string;
  /** Normalizált márkanév (alias-feloldás után), null ha nem derült ki. */
  brandName: string | null;
  /** Tisztított modellnév (márka-prefix, méret-suffix, évjárat nélkül). */
  modelName: string;
  /** A termékoldal nyers címe — az admin ezt látja a moderációs sorban. */
  rawTitle: string;
  modelYear: number | null;
  /** Ár forintban (más pénznem → null; a figyelő HU-forrásokat néz). */
  priceHuf: number | null;
  /** schema.org availability → van-e készleten (null = nem derült ki). */
  inStock: boolean | null;
  imageUrl: string | null;
  /** Kulcsszóból következtetett típus (a moderátor felülírhatja). */
  boardType: BoardType | null;
  specs: BoardSpecs;
}

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
  /** Ismert deszkára illesztett találat (ársor + last_seen_at). */
  matchedKnown: number;
  /** Új/bizonytalan → catalog_candidates sor. */
  candidatesCreated: number;
  pricesRecorded: number;
  /** robots.txt által tiltott, ezért ki NEM kért URL-ek. */
  robotsBlocked: number;
  errors: string[];
}

export interface CrawlSummary {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  sources: SourceCrawlSummary[];
}
