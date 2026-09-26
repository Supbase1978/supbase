/**
 * source-check — a vízi forrás-nyilvántartás (`src/modules/spots/sources.ts`)
 * ellenőrzésének TISZTA része: szövegkinyerés és kifejezés-keresés.
 *
 * A negyedéves futás azt nézi, hogy a forrás szövegében MÉG MINDIG ott áll-e
 * az a mondat, amire az állításunk épül. Ha eltűnt, a szabály (vagy csak az
 * oldal) megváltozott — ember nézi meg, melyik. Szándékosan NEM tartalom-
 * hash: az oldalak dátumot, hírsávot, sütibannert cserélnek, ami hamis
 * riasztást adna; a kifejezés-keresés csak a számunkra lényeges szöveget
 * figyeli.
 */

/**
 * A HTML-ben és a jogszabály-oldalakon a tipográfia forrásonként más (–/-,
 * „/"), a sorvégek és a nem törhető szóközök is. Az összehasonlítás mindkét
 * oldalon ugyanezen megy át, így a nyilvántartásba írt kifejezésnek nem kell
 * betűre egyeznie a forrás írásjeleivel.
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFC")
    .replace(/\u00ad/g, "") // feltételes elválasztójel
    // A latin-1 korszak magyar pótlásai (élesben: szelidi-to.hu „lehetõség"):
    // az ő/ű helyén õ/û (vagy ô) áll — a kifejezés ettől még ugyanaz.
    .replace(/[\u00f5\u00f4]/g, "\u0151")
    .replace(/[\u00d5\u00d4]/g, "\u0150")
    .replace(/\u00fb/g, "\u0171")
    .replace(/\u00db/g, "\u0170")
    .replace(/[\u2010-\u2015\u2212]/g, "-") // kötőjel- és gondolatjel-változatok
    .replace(/[\u201c\u201d\u201e\u201f\u2033\u00ab\u00bb]/g, '"')
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/g, "'")
    .replace(/[\s\u00a0\u2007\u202f]+/g, " ")
    .toLocaleLowerCase("hu")
    .trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bdquo: "„",
  shy: "",
  // Magyar ékezetes betűk — élesben mért: a toserdo.hu és a bank-falu.hu a
  // szöveg ékezeteit névvel ellátott entitásként küldi (`v&iacute;zit&uacute;ra`).
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  ouml: "ö",
  uacute: "ú",
  uuml: "ü",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Ouml: "Ö",
  Uacute: "Ú",
  Uuml: "Ü",
  odblac: "ő",
  udblac: "ű",
  Odblac: "Ő",
  Udblac: "Ű",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    const named = NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()];
    return named ?? whole;
  });
}

/** HTML → olvasható szöveg. Nem DOM-parser: szkript/stílus ki, tagek szóközre. */
export function htmlToPlain(html: string): string {
  const withoutCode = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, " ");
  return decodeEntities(withoutCode.replace(/<[^>]+>/g, " "));
}

/**
 * A válasz bájtjainak karakterkészlete. Élesben mért eset: a bank-falu.hu
 * `iso-8859-2`-t küld — UTF-8-ként olvasva az „ő" és „ű" betűk elromlanak,
 * és a rájuk épülő kifejezés hamisan „eltűnik".
 */
export function detectCharset(contentType: string | null, head: string): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  if (fromMeta) return fromMeta.toLowerCase();
  return "utf-8";
}

export function decodeBody(bytes: Uint8Array, contentType: string | null): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  const charset = detectCharset(contentType, head);
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    // Ismeretlen címke: UTF-8, hibás bájtokat cserélve — a kifejezés-keresés
    // ilyenkor legfeljebb hiányt jelez, amit ember néz meg.
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export function isPdf(bytes: Uint8Array, contentType: string | null): boolean {
  if (/application\/pdf/i.test(contentType ?? "")) return true;
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}

/** Az elvárt kifejezések közül azok, amelyek NEM szerepelnek a szövegben. */
export function findMissing(text: string, expect: readonly string[]): string[] {
  const haystack = normalizeText(text);
  return expect.filter((phrase) => !haystack.includes(normalizeText(phrase)));
}
