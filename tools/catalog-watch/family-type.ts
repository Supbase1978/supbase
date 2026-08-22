/**
 * catalog-watch — a modellcsalád-öröklés a CATALOG MODULBAN él.
 *
 * A logika 2026-08-22-én átkerült a `src/modules/catalog/family-type.ts`-be,
 * hogy a moderációs FELÜLET is elérje: addig csak a parancssori tömeges
 * jóváhagyó látta, és a moderátornak minden régebbi évjáratnál magának kellett
 * kitalálnia a kategóriát. A `tools` importálhat a `src`-ből, fordítva nem —
 * ezért a közös hely a modul.
 *
 * Ez a fájl csak TOVÁBBADJA, így a figyelő meglévő importjai változatlanok.
 */
export {
  buildFamilyTypeMap,
  familyKey,
  inferBoardType,
  type TypedExample,
} from "../../src/modules/catalog/family-type.ts";
