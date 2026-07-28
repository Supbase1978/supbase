/**
 * catalog-watch — sitemap.xml parse és termék-URL szűrés (terv 2. pont).
 *
 * TISZTA modul: a letöltött XML-t kapja szövegként. Szándékosan NEM használ
 * XML-parser függőséget — a sitemap-séma egyetlen érdekes eleme a `<loc>`,
 * és a tag-toleráns kinyerés (a storm-scrape mintája) robusztusabb a
 * névtér-variációkra (`<sitemap:loc>`), mint egy szigorú parser.
 */

export type SitemapKind = "index" | "urlset";

export interface ParsedSitemap {
  /** `index` → a locok további sitemapek; `urlset` → oldal-URL-ek. */
  kind: SitemapKind;
  locs: string[];
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

/** XML-entitások feloldása (a `<loc>` tartalma escape-elt). */
function decodeXmlText(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&(amp|lt|gt|quot|apos);/g, (entity) => ENTITIES[entity] ?? entity);
}

/**
 * Sitemap XML → típus + URL-lista. Ismeretlen/üres bemenetnél üres `urlset`
 * (a hívó ilyenkor egyszerűen nem talál terméket — nem dobunk).
 */
export function parseSitemap(xml: string): ParsedSitemap {
  const kind: SitemapKind = /<sitemapindex[\s>]/i.test(xml) ? "index" : "urlset";
  const locs: string[] = [];
  const re = /<loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const value = decodeXmlText((match[1] ?? "").trim());
    if (value !== "") locs.push(value);
  }
  return { kind, locs };
}

/** Egy URL illeszkedik-e a konfigurált minta-listára (részlet-egyezés). */
function matchesAny(url: string, patterns: readonly string[]): boolean {
  const lower = url.toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern.toLowerCase()));
}

/**
 * A sitemap URL-jeiből a TERMÉKOLDALAK kiválogatása.
 *
 * `productUrlPatterns` nélkül minden URL termék-jelölt (a JSON-LD-kinyerés
 * úgyis kiszűri a nem-termék oldalakat) — de a minta megadása sokkal
 * udvariasabb crawl, mert meg sem kérjük a blog- és kategória-oldalakat.
 * Az `excludeUrlPatterns` MINDIG erősebb, mint a befoglaló minta.
 */
export function selectProductUrls(
  locs: readonly string[],
  options: {
    productUrlPatterns?: readonly string[];
    excludeUrlPatterns?: readonly string[];
    maxProducts?: number;
  } = {},
): string[] {
  const include = options.productUrlPatterns ?? [];
  const exclude = options.excludeUrlPatterns ?? [];

  const selected: string[] = [];
  const seen = new Set<string>();
  for (const loc of locs) {
    if (include.length > 0 && !matchesAny(loc, include)) continue;
    if (exclude.length > 0 && matchesAny(loc, exclude)) continue;
    if (seen.has(loc)) continue;
    seen.add(loc);
    selected.push(loc);
    if (options.maxProducts !== undefined && selected.length >= options.maxProducts) {
      break;
    }
  }
  return selected;
}
