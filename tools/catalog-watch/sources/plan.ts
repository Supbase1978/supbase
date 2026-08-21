/**
 * A recept → adatbázis szinkron TISZTA logikája.
 *
 * A hálózat és az adatbázis a `cli.ts`-ben marad; itt csak az összevetés van,
 * hogy teszteléshez ne kelljen se Supabase, se internet.
 *
 * KÉT SZABÁLY, mindkettő biztonsági:
 *
 * 1. **A szinkron SOHA nem töröl.** Ha az adatbázisban van olyan forrás, amihez
 *    nincs recept, azt `extra`-ként JELENTI, de hozzá sem nyúl. Egy elfelejtett
 *    receptfájl nem szedheti ki a lábunk alól a talajt egy működő forrásnál —
 *    és a `catalog_sources` sor TÖRLÉSE a hozzá tartozó jelölteket is vinné.
 * 2. **Ami nem különbözik, azt nem írjuk.** Az `unchanged` sorok kimaradnak az
 *    írásból, így a dry-run kimenete pontosan azt mutatja, mi VÁLTOZNA.
 */
import type { SourceRecipe } from "./index.ts";

/** Amit az adatbázisból az összevetéshez ismerni kell. */
export interface ExistingSource {
  id: string;
  name: string;
  base_url: string | null;
  kind: string;
  country: string;
  crawl_config: unknown;
}

export type SourceSyncKind = "create" | "update" | "unchanged" | "extra";

export interface SourceSyncAction {
  name: string;
  kind: SourceSyncKind;
  /** `update`-nél a ténylegesen eltérő mezők neve (`crawl_config.sitemapUrl`, …). */
  changes: string[];
  /** Meglévő sor azonosítója (`create`-nél null). */
  id: string | null;
}

/**
 * Mit tenne a szinkron. A forrás azonosítója a NÉV — ez a `catalog_sources`
 * egyedi kulcsa, és a receptfájl neve szándékosan NEM az (a `sup-deszka.hu`
 * fájlnévként `sup-deszka.ts`).
 */
export function planSourceSync(
  recipes: readonly SourceRecipe[],
  existing: readonly ExistingSource[],
): SourceSyncAction[] {
  const byName = new Map(existing.map((row) => [row.name, row]));
  const actions: SourceSyncAction[] = [];

  for (const recipe of recipes) {
    const row = byName.get(recipe.name);
    if (row === undefined) {
      actions.push({ name: recipe.name, kind: "create", changes: [], id: null });
      continue;
    }
    const changes = diffSource(recipe, row);
    actions.push({
      name: recipe.name,
      kind: changes.length === 0 ? "unchanged" : "update",
      changes,
      id: row.id,
    });
  }

  const known = new Set(recipes.map((r) => r.name));
  for (const row of existing) {
    if (known.has(row.name)) continue;
    actions.push({ name: row.name, kind: "extra", changes: [], id: row.id });
  }
  return actions;
}

/** A recept és a sor eltérő mezői, olvasható néven. */
function diffSource(recipe: SourceRecipe, row: ExistingSource): string[] {
  const changes: string[] = [];
  if (recipe.baseUrl !== row.base_url) changes.push("base_url");
  if (recipe.kind !== row.kind) changes.push("kind");
  if (recipe.country !== row.country) changes.push("country");
  const stored = (row.crawl_config ?? {}) as Record<string, unknown>;
  const wanted = recipe.crawlConfig as unknown as Record<string, unknown>;
  for (const key of new Set([...Object.keys(stored), ...Object.keys(wanted)])) {
    if (!deepEqual(stored[key], wanted[key])) changes.push(`crawl_config.${key}`);
  }
  return changes.sort();
}

/**
 * Mély összehasonlítás. A `JSON.stringify` NEM elég: a `boardTypeByUrl` 57
 * kulcsa a receptben és az adatbázisban más SORRENDBEN állhat (a Postgres a
 * jsonb kulcsait hossz szerint rendezi újra), és a sorrend itt nem jelentés.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  if (typeof a !== "object" || typeof b !== "object") return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (!deepEqual(left[key], right[key])) return false;
  }
  return true;
}
