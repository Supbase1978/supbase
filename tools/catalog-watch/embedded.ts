/**
 * catalog-watch — SPEC A BEÁGYAZOTT JSON-BÓL (F2.1-utó-55, 2026-08-29).
 *
 * MIÉRT KELL EZ AZ ÚT: van gyártó, akinek a boltja FEJETLEN (headless) —
 * a HTML egy React-váz, a termék adata pedig egy `<script>`-be ágyazott
 * API-válasz. A `htmlToText` ezt SOHA nem látja (a script-tartalmat kiszedi),
 * a JSON-LD pedig csak nevet és árat ad. Élesben (islesurfandsup.com,
 * 2026-08-29): a teljes spec-tábla — mind a HAT mező, űrtartalommal együtt —
 * ott van a lapon, csak egy JSON-mezőben, CSV-alakban:
 *
 *   "sizes":{"value":"Length,Width,Thick,Volume,Capacity,Board Weight\n
 *                     10'6\",34\",6\",326 L,285 LBS,19 LBS"}
 *
 * A modul NEM ÉRTELMEZI a mezőket: `címke: érték` SOROKKÁ alakítja őket, és a
 * hívó azokat a MEGLÉVŐ `parseSpecsFromText` elé fűzi. Így minden korábbi
 * tudás érvényben marad — a font-átváltás, a `Complete Package Weight`
 * csomag-kizárása, a láb-hüvelyk olvasás —, és nem születik párhuzamos,
 * karbantartandó második kinyerő.
 *
 * A HORGONY A LÉNYEG. Ugyanazon a lapon TÖBB ilyen CSV is áll: a
 * termékajánlóké. Élesben az `explorer-pro-2` lapján HÁROM van, és az ELSŐ a
 * szomszéd modellé (`explorer-pro`) — a „vedd az elsőt" szabály némán rossz
 * deszkát adott volna. A termék SAJÁT blokkját egy JSON-kulcs jelöli
 * (`productBoxAccordionItems`), ami oldalanként PONTOSAN EGYSZER fordul elő,
 * és a saját spec 140 karakterrel utána áll. A kulcs forrásonként más, ezért
 * a receptből jön (`embeddedSpecAnchor`) — találgatni nem szabad.
 */

/**
 * A horgony utáni ablak, amiben a termék saját adatait keressük.
 *
 * MÉRVE (islesurfandsup.com, mind a 16 termékoldalon): a spec-CSV a horgony
 * után 140 karakterrel áll, a címkézett tények (`Ideal For`, `Type`)
 * legfeljebb 12 kB-ra. A 40 kB-os ablak ezt bőven fedi, a lap többi
 * megabájtját viszont — köztük az ajánlott termékek blokkjait — kizárja.
 */
const WINDOW_CHARS = 40_000;

/** Legalább ennyi oszlop kell egy spec-CSV-hez, hogy tábla legyen, ne mondat. */
const MIN_CSV_COLUMNS = 4;

/** A címkézett tény (`Ideal For: All Around Paddling`) épkézláb hossza. */
const MAX_LABEL_CHARS = 32;
const MAX_VALUE_CHARS = 80;

/**
 * A FORRÁS RÖVIDÍTÉSEINEK feloldása a katalógus szótárára.
 *
 * CSAK ott, ahol a globális címkelista SZÁNDÉKOSAN nem tartalmazza a rövid
 * alakot. A `thick` a `SPEC_LABELS`-ből MÉRÉS után maradt ki: kipróbálva
 * (2026-08-28) elrontotta a Jobe-t, ahol a próza az ANYAG vastagságáról ír
 * („thick"), nem a deszkáéról. Itt viszont nem prózáról van szó, hanem egy
 * spec-tábla oszlopfejéről — és maga a gyártó is `Thickness`-t ír a
 * termékei feléhez. A feloldás tehát a forrás saját következetlenségét
 * javítja, nem a globális szabályt lazítja.
 */
const LABEL_ALIASES: Record<string, string> = {
  thick: "Thickness",
  // A CSUPASZ `Weight` a globális listából is MÉRÉS után maradt ki: szabad
  // szövegben a „Max weight: 140 kg" a TEHERBÍRÁS, és a deszka súlyaként
  // kerülne be. Egy CSV-spec-táblában viszont nincs ilyen kétértelműség: a
  // terhelésnek SAJÁT oszlopa van (`Capacity`), tehát a `Weight` csak a
  // deszkáé lehet. Élesben (islesurfandsup.com) a gyártó a termékei felénél
  // `Board Weight`-et ír, a másik felénél csak `Weight`-et — enélkül a
  // katalógus fele súly nélkül maradt volna.
  weight: "Board Weight",
};

/**
 * `címke: érték` sorok a beágyazott JSON-ból, a horgony utáni ablakból.
 * Üres string, ha a horgony nincs meg vagy nincs mit kiolvasni.
 */
export function embeddedSpecText(html: string, anchor: string): string {
  if (anchor === "") return "";
  const at = html.indexOf(`"${anchor}"`);
  if (at < 0) return "";
  const window = html.slice(at, at + WINDOW_CHARS);

  return [...specCsvLines(window), ...labelledFactLines(window)].join("\n");
}

/**
 * A spec-tábla CSV-alakban: fejsor és értéksor, `\n`-nel elválasztva EGY
 * JSON-stringen belül. Az ELSŐ érvényes blokk nyer — a horgony miatt az a
 * termék sajátja.
 */
function specCsvLines(window: string): string[] {
  for (const match of window.matchAll(/"value":"((?:[^"\\]|\\.)*?)"/g)) {
    const value = decodeJsonString(match[1] ?? "");
    if (value === null) continue;
    const [head, body] = value.split("\n");
    if (head === undefined || body === undefined) continue;
    const labels = head.split(",").map((cell) => cell.trim());
    const values = body.split(",").map((cell) => cell.trim());
    if (labels.length < MIN_CSV_COLUMNS || labels.length !== values.length) continue;
    // Egy CSV-fejsor csupa SZÓ; ha számot visel, az nem oszlopfej.
    if (labels.some((label) => label === "" || /\d/.test(label))) continue;
    return labels.map((label, i) => `${resolveLabel(label)}: ${values[i] ?? ""}`);
  }
  return [];
}

/**
 * CÍMKÉZETT TÉNYEK: `"title":{"value":"Ideal For"},"description":{"value":"…"}`
 * és a választós alakja (`optionSelected`). Ezekben áll a gyártó saját
 * használat-besorolása és a szerkezet — pont az a két mező, amiről a
 * termékoldal szövege hallgat.
 */
function labelledFactLines(window: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const pattern =
    /"title":\{"value":"((?:[^"\\]|\\.)*?)"\},(?:"options":\{"value":"(?:[^"\\]|\\.)*?"\},)?"(?:description|optionSelected)":\{"value":"((?:[^"\\]|\\.)*?)"\}/g;
  for (const match of window.matchAll(pattern)) {
    const label = decodeJsonString(match[1] ?? "");
    const value = decodeJsonString(match[2] ?? "");
    if (label === null || value === null) continue;
    if (label === "" || value === "") continue;
    // A HOSSZÚ szöveg nem tény, hanem marketing-bekezdés (a technológia-blokkok
    // ugyanezt az alakot használják, 400 karakteres leírással).
    if (label.length > MAX_LABEL_CHARS || value.length > MAX_VALUE_CHARS) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(`${resolveLabel(label)}: ${value}`);
  }
  return out;
}

/** A forrás rövidítése helyett a katalógus által ismert címke. */
function resolveLabel(label: string): string {
  return LABEL_ALIASES[label.trim().toLowerCase()] ?? label.trim();
}

/** JSON-escape feloldása egyetlen stringre; hibás sorozatnál `null`. */
function decodeJsonString(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(`"${raw}"`);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
}
