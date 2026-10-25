/**
 * SPEC-VISSZATÖLTÉS a már élő deszkákra és a függő jelöltekre.
 *
 * MIÉRT KELL: a crawl csak ÚJ jelöltet hoz létre, a jóváhagyott sort és a már
 * meglévő jelöltet nem frissíti. Ha egy korábbi futásnál a gyártói spec-tábla
 * nem olvasódott be (vagy a parser hibás volt), a sor üresen maradt — a
 * javított parser ezt magától nem pótolja.
 *
 * SZABÁLY: csak ÜRES (null) mezőt töltünk, meglévő értéket SOHA nem írunk
 * felül (kézi javítás, `verify-specs`). Ez a modul tiszta: a hálózatot és az
 * adatbázist a `cli.ts` intézi.
 */
import { mergeSpecTables, normalizeSizeKey } from "./spec-table.ts";

export const SPEC_FIELDS = [
  "lengthCm",
  "widthCm",
  "thicknessCm",
  "volumeL",
  "weightKg",
  "maxLoadKg",
] as const;
export type SpecField = (typeof SPEC_FIELDS)[number];
export type SpecValues = Record<SpecField, number | null>;

/** A modellnévből: méret-kulcs + a méret UTÁNI rész (a kivitel). */
export function splitModelName(name: string): {
  sizeKey: string | null;
  construction: string | null;
} {
  const text = name
    .replace(/[‘’ʼ′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/''/g, '"');
  const match = text.match(
    /(\d{1,2}'\s*\d{0,2}"?)\s*[xX×]\s*(\d{1,3}(?:\.\d+)?)\+?"?\s*(.*)$/,
  );
  if (!match) return { sizeKey: null, construction: null };
  const rest = (match[3] ?? "").trim();
  return {
    sizeKey: normalizeSizeKey(`${match[1] ?? ""} x ${match[2] ?? ""}`),
    construction: rest === "" ? null : rest,
  };
}

/**
 * Mely üres mezők tölthetők a gyártói táblából? A táblát kivitelenként kell
 * értelmezni, ezért a modellnévből vett kivitellel hívjuk a `mergeSpecTables`-t.
 */
export function planSpecFill(
  name: string,
  current: SpecValues,
  tables: readonly (readonly (readonly string[])[])[],
): Partial<Record<SpecField, number>> {
  const { sizeKey, construction } = splitModelName(name);
  if (sizeKey === null) return {};
  const found = mergeSpecTables(tables, construction).get(sizeKey);
  if (!found) return {};
  const fill: Partial<Record<SpecField, number>> = {};
  for (const field of SPEC_FIELDS) {
    const value = found[field];
    if (current[field] === null && typeof value === "number") fill[field] = value;
  }
  return fill;
}
