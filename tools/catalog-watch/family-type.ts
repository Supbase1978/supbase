/**
 * catalog-watch — kategória átvétele a MODELLCSALÁDON belül (F2.1-utó-21,
 * 2026-08-19).
 *
 * MIÉRT KELL: a gyártói kollekciók (`shopify.collectionTypes`) csak az AKTUÁLIS
 * évjáratot sorolják fel. Ugyanaz a modellcsalád viszont több éven át fut, és a
 * régebbi példányok kimaradnak a kollekcióból — élesben mérve a 2027-es
 * „All Star" megkapta a `race` besorolást, a 2024-es és 2025-ös ugyanaz a
 * deszka viszont kategória NÉLKÜL maradt. 251 kategória nélküli jelöltből 153
 * pontosan ilyen.
 *
 * A SZABÁLY: ha egy modellcsalád BÁRMELYIK példányának van hivatalos
 * kategóriája (kollekcióból vagy már jóváhagyott deszkából), azt a család
 * többi tagja is megkapja. Az „All Star" race marad 2024-ben is.
 *
 * A CSALÁD kulcsa a márka + a modellnév SZÁM ELŐTTI része: az
 * `All Star 14'0" X 24.5" Wood Carbon` családja `all star`. A méret és a
 * kivitel szándékosan kimarad — épp azok különböztetik meg a testvéreket,
 * a kategóriájuk viszont közös.
 *
 * TISZTA modul: se hálózat, se adatbázis.
 */
import type { BoardType } from "./types.ts";

/** Egy már ISMERT besorolás — élő deszkából vagy típussal bíró jelöltből. */
export interface TypedExample {
  brandName: string | null;
  modelName: string;
  boardType: BoardType | null;
  /**
   * MEGBÍZHATÓ forrás-e? Csak ilyen példa adhat kategóriát a családnak:
   *  - **gyártói oldal** (a gyártó a saját kollekciójában/URL-jében sorolja be),
   *  - **már jóváhagyott deszka** (moderátor nézte át).
   *
   * A BOLTI tipp NEM megbízható — élesben mérve a `sup-deszka.hu` az
   * „Aqua Marina FUSION 10'10" 150 kg" címből `kids` kategóriát vezetett le
   * (a Fusion allround deszka), az Atlasból pedig `touring`-ot. Ha ezek is
   * számítanának, a téves tipp a család MINDEN tagjára rákerülne.
   */
  trusted: boolean;
}

/**
 * A modellcsalád kulcsa: márka + a modellnév első SZÁM ELŐTTI szakasza,
 * kisbetűsen. Márka nélkül nincs kulcs — két gyártó használhatja ugyanazt a
 * modellnevet, és a besorolásuk eltérhet.
 */
export function familyKey(brandName: string | null, modelName: string): string | null {
  if (!brandName) return null;
  const family = modelName
    .replace(/\s*\d.*$/, "")
    .trim()
    .toLowerCase();
  if (family === "") return null;
  return `${brandName.toLowerCase()}|${family}`;
}

/**
 * Család → kategória térkép a már ismert példákból.
 *
 * CSAK a `trusted` példák számítanak (ld. a mező magyarázatát).
 *
 * ÜTKÖZÉSNÉL az ELSŐ nyer, és a további, ELTÉRŐ besorolású példák a
 * `conflicts` halmazba kerülnek — azoknál NEM következtetünk, mert a család
 * besorolása bizonytalan (a hívó ilyenkor a moderátorra hagyja).
 */
export function buildFamilyTypeMap(examples: readonly TypedExample[]): {
  byFamily: Map<string, BoardType>;
  conflicts: Set<string>;
} {
  const byFamily = new Map<string, BoardType>();
  const conflicts = new Set<string>();

  for (const example of examples) {
    if (example.boardType === null || !example.trusted) continue;
    const key = familyKey(example.brandName, example.modelName);
    if (key === null) continue;
    const existing = byFamily.get(key);
    if (existing === undefined) {
      byFamily.set(key, example.boardType);
    } else if (existing !== example.boardType) {
      conflicts.add(key);
    }
  }

  for (const key of conflicts) byFamily.delete(key);
  return { byFamily, conflicts };
}

/**
 * A családból örökölt kategória — `null`, ha a család ismeretlen vagy
 * ellentmondásos.
 */
export function inferBoardType(
  map: ReadonlyMap<string, BoardType>,
  brandName: string | null,
  modelName: string,
): BoardType | null {
  const key = familyKey(brandName, modelName);
  return key === null ? null : (map.get(key) ?? null);
}
