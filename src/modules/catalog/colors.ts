/**
 * SZÍNVÁLTOZATOK (`boards.colors`): a színnév márkánként egyedi tulajdonnév,
 * ezért nyers szöveg — nem fordítjuk. A listát a MODERÁTOR tölti az
 * Összefésülésnél; automatikus névelemzés nincs.
 *
 * KÜLÖN FÁJL (mint a `model-years.ts`): az admin űrlap-parse és a szerver-oldali
 * összefésülés is használja, a `.server.ts`-t az űrlap nem importálhatja.
 */

export const MAX_COLORS = 12;
export const MAX_COLOR_LENGTH = 40;

/** Vesszővel elválasztott űrlapmező → tisztított lista (trim, üres eldob, korlátok). */
export function parseColorsInput(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part.length <= MAX_COLOR_LENGTH)
    .slice(0, MAX_COLORS);
}

/**
 * A meglévő színekhez hozzáfűzi az újakat. Kis-/nagybetű-független
 * duplikátum-szűrés; az eredeti írásmód és sorrend megmarad.
 */
export function mergeColors(
  current: readonly string[] | null | undefined,
  incoming: readonly string[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of [...(current ?? []), ...incoming]) {
    const color = raw.trim();
    if (color === "") continue;
    const key = color.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(color);
  }
  return result;
}
