/**
 * catalog-watch — HTML → olvasható szöveg (a spec-táblázatok kinyeréséhez).
 *
 * TISZTA modul, függőség nélkül. Nem DOM-parser: a célja mindössze annyi, hogy
 * a `normalize.parseSpecsFromText` CÍMKE-ÉRTÉK párokat találjon a termékoldal
 * szövegében („Hosszúság: 320 cm"). Ezért a cellahatárokat szóközre váltjuk —
 * a táblázatos spec így egy sorba folyik össze, de a címke és az érték
 * egymás mellett marad, ami a szűk keresési ablak miatt épp elég.
 */

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (entity) => ENTITIES[entity] ?? entity);
}

/** Termékoldal-HTML → tömör szöveg (script/style/megjegyzés nélkül). */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      // A blokk-határokat megtartjuk sortörésként: a spec-sorok így nem
      // csúsznak egymásba (a „Hosszúság" nem a következő sor számát kapná).
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article)\s*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      // A cella- és címke-határ szóköz: „Hosszúság</td><td>320 cm" → egy sor.
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}
