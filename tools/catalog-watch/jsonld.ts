/**
 * catalog-watch — JSON-LD `Product` kinyerés termékoldal-HTML-ből (terv 2. pont).
 *
 * A HU webshop-motorok (Shopify, WooCommerce, UNAS, Shoprenter) döntő többsége
 * schema.org Product JSON-LD-t tesz a termékoldalra — ez adja a nevet, márkát,
 * árat és elérhetőséget szelektor-írás NÉLKÜL, tehát a bolt sablon-átalakítása
 * nem töri el a figyelőt.
 *
 * TISZTA modul (nincs I/O). Hibatűrő: egy hibás JSON-LD blokk nem viszi el a
 * többit, és a nem-termék oldalak egyszerűen üres listát adnak.
 */

/** `<script type="application/ld+json">` blokkok nyers szövege. */
export function extractJsonLdBlocks(html: string): string[] {
  const blocks: string[] = [];
  // Tag-toleráns: az attribútum-sorrend és a whitespace tetszőleges lehet.
  const re =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const body = (match[1] ?? "").trim();
    if (body !== "") blocks.push(body);
  }
  return blocks;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `@type` lehet string vagy string-tömb — normalizált, kisbetűs lista. */
function typesOf(node: Record<string, unknown>): string[] {
  const raw = node["@type"];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase());
}

/**
 * A JSON-LD gráf bejárása: tömbök, `@graph`, és a beágyazott objektumok
 * (pl. `mainEntity`). Ciklus ellen látogatott-halmaz.
 */
function walk(value: unknown, visit: (node: Record<string, unknown>) => void): void {
  const stack: unknown[] = [value];
  const seen = new Set<unknown>();
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    if (!isRecord(node) || seen.has(node)) continue;
    seen.add(node);
    visit(node);
    for (const child of Object.values(node)) {
      if (Array.isArray(child) || isRecord(child)) stack.push(child);
    }
  }
}

/**
 * Egy termékoldal HTML-jéből az összes `Product` (és altípusa) JSON-LD objektum.
 * A `ProductGroup`-ot is elfogadjuk: több bolt így írja le a méret-variánsokat.
 */
export function findProductNodes(html: string): Record<string, unknown>[] {
  const products: Record<string, unknown>[] = [];
  for (const block of extractJsonLdBlocks(html)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch {
      // Egy hibás blokk nem viheti el a többit (a boltok gyakran írnak
      // szintaktikailag hibás JSON-LD-t egy-egy widgethez).
      continue;
    }
    walk(parsed, (node) => {
      const types = typesOf(node);
      if (types.includes("product") || types.includes("productgroup")) {
        products.push(node);
      }
    });
  }
  return products;
}

/**
 * A termékoldal ELSŐDLEGES Product-ja. Több találatnál az nyer, amelyiknek
 * van neve ÉS ára — a boltok gyakran tesznek fel „ajánlott termék" node-okat is.
 */
export function pickPrimaryProduct(
  nodes: readonly Record<string, unknown>[],
): Record<string, unknown> | null {
  if (nodes.length === 0) return null;
  const scored = nodes.map((node) => {
    let score = 0;
    if (typeof node.name === "string" && node.name.trim() !== "") score += 2;
    if (node.offers !== undefined) score += 2;
    if (node.brand !== undefined) score += 1;
    if (node.sku !== undefined || node.gtin13 !== undefined) score += 1;
    return { node, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.node ?? null;
}
