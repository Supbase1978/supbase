/**
 * catalog-watch — jelöltenkénti mezőzár (F2.1-utó-10).
 *
 * Élesben talált probléma (2026-08-15): a `saveCandidate` egy ismert
 * `pending` URL-t újra-crawlolva MINDIG felülírja a teljes `extracted`
 * payloadot — egy kézzel (gyártói forrásból) javított mező elveszhet a
 * következő heti crawlnál. A `catalog_candidates.locked_fields` (lásd a
 * `20260717092400_catalog_candidates_locked_fields.sql` migrációt) jelöli,
 * mely mezőket NE írja felül többé a crawler; ez a fájl a tiszta
 * alkalmazó-logikát adja, a DB-hívástól elválasztva.
 *
 * Mezőnév-konvenció: lapos kulcs a top-level `extracted` mezőkhöz (pl.
 * `"brandName"`), `"specs.X"` prefix a `specs` alá tartozókhoz (pl.
 * `"specs.lengthCm"`) — a nesting csak 2 szintű, ezért nincs szükség
 * általános path-parserre.
 */
import type { ExtractedProduct } from "./types.ts";

const SPECS_PREFIX = "specs.";

/** Egy `extracted`-mező kiolvasása path szerint (`"specs.lengthCm"` vagy top-level). */
export function getFieldValue(product: ExtractedProduct, path: string): unknown {
  if (path.startsWith(SPECS_PREFIX)) {
    const key = path.slice(SPECS_PREFIX.length) as keyof ExtractedProduct["specs"];
    return product.specs[key];
  }
  return (product as unknown as Record<string, unknown>)[path];
}

/** Egy `extracted`-mező beállítása path szerint — a `verify-specs` CLI-parancs is ezt használja. */
export function setFieldValue(product: ExtractedProduct, path: string, value: unknown): ExtractedProduct {
  if (path.startsWith(SPECS_PREFIX)) {
    const key = path.slice(SPECS_PREFIX.length);
    return { ...product, specs: { ...product.specs, [key]: value } };
  }
  return { ...product, [path]: value };
}

/**
 * A `lockedFields`-ben szereplő minden path esetén az `existing` (jelenleg
 * DB-ben álló) értékét másolja az `incoming` (frissen crawlolt) payloadba,
 * mielőtt mentés történne. Üres `lockedFields` esetén az `incoming`
 * változatlanul visszaadva — ez a korábbi (teljes felülírás) viselkedés,
 * visszafelé kompatibilis.
 */
export function applyFieldLocks(
  existing: ExtractedProduct,
  incoming: ExtractedProduct,
  lockedFields: readonly string[],
): ExtractedProduct {
  let result = incoming;
  for (const path of lockedFields) {
    result = setFieldValue(result, path, getFieldValue(existing, path));
  }
  return result;
}
