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
  // TIPOGRÁFIAI ENTITÁSOK (F2.1-utó-48). Élesben (red.equipment) a `<title>`
  // így áll: `… Paddle Board Package&ndash; Red Equipment - ROW`. Feloldatlanul
  // a `–` SOSEM jelenik meg a szövegben, tehát a recept `titleCutAfter: ["–"]`
  // beállítása némán nem csinál semmit — a cím utótagja bennmarad, és a benne
  // álló „Equipment" a `NEVER_BOARD_KEYWORDS` gyűjtőlap-szűrőjére esik. Így a
  // forrás EGYETLEN terméket sem adott, teljesen félrevezető okból.
  //
  // A `&times;` külön nyereség: a `×` a méret-hármas szorzójele.
  "&ndash;": "–",
  "&mdash;": "—",
  "&hellip;": "…",
  "&lsquo;": "‘",
  "&rsquo;": "’",
  "&ldquo;": "“",
  "&rdquo;": "”",
  "&times;": "×",
  "&middot;": "·",
  "&bull;": "•",
  "&deg;": "°",
};

/**
 * HTML-entitások feloldása. EXPORTÁLT, mert nem csak a HTML-ből szedett
 * szövegnek kell: élesben mérve a Shopify `/products.json` és a JSON-LD
 * `name` mezője is tartalmaz entitást (`Indiana 12&#039;6 Touring`), és
 * enélkül az `&#039;` NYERSEN kerülne a katalógusba, a modellnév részeként.
 */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(
      /&(amp|lt|gt|quot|apos|nbsp|ndash|mdash|hellip|lsquo|rsquo|ldquo|rdquo|times|middot|bull|deg);/g,
      (entity) => ENTITIES[entity] ?? entity,
    );
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
      //
      // A `<` UTÁN SZÓKÖZ NEM TAG-KEZDET (F2.1-utó-49). Valódi HTML-tagben a
      // `<` után azonnal a névnek (vagy `/`-nek) kell jönnie; a szóköz azt
      // jelenti, hogy a `<` TARTALOM — jellemzően a „kisebb mint" jel,
      // escape-elés nélkül. Élesben (aquatone.com) így áll a teherbírás:
      //   <h6>MAX. PAYLOAD</h6> <p>< 75 kg / 165 lbs</p>
      // A naiv minta a `< 75 kg / 165 lbs</p>` darabot EGY tagnek vette és
      // eldobta — a deszka teherbírása és ajánlott terhelése NYOMTALANUL
      // eltűnt, pedig ott volt a letöltött HTML-ben. Teherbírás nélkül a
      // Deszkaválasztó ki is zárja a deszkát, tehát ez nem szépséghiba.
      .replace(/<(?!\s)[^>]+>/g, " "),
  )
    // LÁTHATATLAN IRÁNYJELEK ÉS NULLA SZÉLESSÉGŰ KARAKTEREK (F2.1-utó-47).
    //
    // Élesben mért (funwaterboard.com): a spec-sorok értéke elé a sablon egy
    // U+200E (LEFT-TO-RIGHT MARK) jelet ír — `Item Weight: ‎28 Pounds`. A
    // szemnek nincs ott, a mintáinknak viszont igen: elválasztja a
    // kettőspontot az értéktől, és beékelődik a szám elé. Ugyanez a fajta a
    // lágy elválasztójel (U+00AD) és a BOM (U+FEFF), amit másolt szövegek
    // hoznak be. Egyik sem hordoz jelentést, tehát nem szóközre váltjuk,
    // hanem TÖRÖLJÜK — a szóköz itt hamis szóhatárt csinálna.
    .replace(/[\u00AD\u200B-\u200F\u2060\uFEFF]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .split("\n")
    // GÉPI ADAT KISZŰRÉSE: a `\"` és a `\n` ESCAPE-sorozat JSON-string jele —
    // emberi szemnek szánt szövegben backslash nem áll idézőjel előtt. Élesben
    // (funwaterboard.com) egy HTML-attribútumba ágyazott JSON így került a
    // „oldalszövegbe", és HAMIS méretet adott: a `10'6"(320cm) length
    // 33"(83cm) width` sorban a címke a VÉTE UTÁN áll, ezért a hosszba a
    // szélesség 83 cm-e került. Nem hiány lett belőle, hanem téves adat.
    .filter((line) => !/\\["'\\]|\\n|\\u00/.test(line))
    .join("\n")
    .trim();
}
