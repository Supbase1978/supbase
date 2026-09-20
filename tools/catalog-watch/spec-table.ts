/**
 * catalog-watch — gyártói SPEC-TÁBLÁZAT értelmezése (F2.1-utó-16, 2026-08-19).
 *
 * MIÉRT KELL: a Shopify `/products.json` (ld. `shopify.ts`) hosszt és
 * szélességet ad, de vastagságot, súlyt és TEHERBÍRÁST nem — a teherbírás
 * viszont KÖTELEZŐ biztonsági mező a Deszkaválasztóban (`passesHardFilter`,
 * `select.ts`): nélküle a deszka kiesik a kemény szűrőn, tehát sosem kerül
 * ajánlásba. Teherbírás nélkül a jelölt gyakorlatilag használhatatlan.
 *
 * A star-board.com a specifikációt egy külső Shopify-app (TablePress)
 * táblájában közli, amit JS tölt be — a nyers HTML-ben NINCS ott (0 `<table>`),
 * és a Shopify Section Rendering API sem adja vissza. A `render.ts`
 * böngésző-fallbackkal viszont pontosan kiolvasható.
 *
 * A TÁBLA ALAKJA: oszloponként EGY méret, soronként egy tulajdonság —
 *
 *   Model        | 14'0" x 32" iCON | 12'0" x 33" iCON | 10'8" x 33" iCON
 *   Rider Weight | 70-135 kg        | 55-120 kg        | 45-120 kg
 *   Length       | 14'0" / 426.7 cm | 12'0" / 365.8 cm | 10'8" / 325.1 cm
 *   Thickness    | 4.75" / 12 cm    | 4.75" / 12 cm    | 4.75" / 12 cm
 *   Volume       | 328L             | 299L             | 272L
 *   Weight       | 12.10 kg (Est.)  | 11.10 kg (Est.)  | 9.30 kg (Est.)
 *
 * ÓVATOSSÁG (a projekt elve: inkább hiányozzon, mint tévedjen): néhány
 * terméknél egy cella TÖBB KIVITEL értékét sorolja fel egyszerre — élesben
 * mért (Whopper): „Blue Carbon, Starlite: 174 LLite Tech Wave, Rhino: 168 L".
 * Az ilyen cellából NEM tippelünk, `null` marad. Csak az egyértelmű,
 * EGYETLEN mérőszámot tartalmazó cellát fogadjuk el.
 */
import type { BoardSpecs } from "./types.ts";
import { EMPTY_SPECS } from "./types.ts";

/** Sor-címkék → spec-mező. A címke tartalmazhat kiegészítést („Weight (Tolerance +/- 5%)"). */
const ROW_LABELS = {
  lengthCm: ["length"],
  widthCm: ["width"],
  thicknessCm: ["thickness"],
  volumeL: ["volume"],
  weightKg: ["weight"],
  maxLoadKg: [
    "rider weight",
    "max load",
    "max rider weight",
    // Élesben mért (star-board.com Roamer): „Gross Load Weight | 130 kg" — ez a
    // TEHERBÍRÁS, nem a deszka súlya. A „weight" részstring miatt korábban a
    // `weightKg`-ba került, és 130 kg-os deszkát írt volna be.
    "gross load weight",
    "load weight",
    // Aqua Marina hivatalos spec-lapja ezt a címkét használja („MAX. PAYLOAD").
    "payload",
    "capacity",
  ],
} as const;

/**
 * A részstring-illesztés csapdái, kizáró szavakkal védve:
 *  - „Tail Width" NEM a deszka szélessége,
 *  - „Rider Weight" / „Gross Load Weight" / „Max Payload" NEM a deszka súlya
 *    (élesben mért hiba, ld. fent),
 *  - „Carbon Footprint (kgCO2e)" végképp nem súly.
 * A sor akkor számít az adott mezőnek, ha a címke NEM tartalmaz kizáró szót.
 */
const ROW_EXCLUSIONS: Partial<Record<keyof typeof ROW_LABELS, readonly string[]>> = {
  widthCm: ["tail"],
  weightKg: ["rider", "carbon", "footprint", "load", "payload", "capacity"],
};

function normalizeQuotes(text: string): string {
  return text.replace(/[‘’ʼ]/g, "'").replace(/[“”″]/g, '"');
}

/**
 * A méret-oszlop kulcsa: a fejlécből („14'0" x 32" iCON") csak a DIMENZIÓ.
 * A modellnév a fejlécben néha szóköz nélkül tapad („10'0" x 34"WHOPPER"),
 * ezért a mintát a számokra horgonyozzuk, nem a szóközökre.
 */
export function sizeKeyFromHeader(header: string): string | null {
  const normalized = normalizeQuotes(header);
  const match = normalized.match(/(\d{1,2}'\s*\d{0,2}"?)\s*[xX×]\s*(\d{1,3}(?:\.\d+)?)"?/);
  if (!match) return null;
  return normalizeSizeKey(`${match[1]} x ${match[2]}`);
}

/**
 * Közös kulcs-alak, hogy a tábla fejléce és a Shopify variáns-címke
 * (`shopify.ts` → `12'0" X 34"`) EGYMÁSRA találjon: idézőjelek egységesítve,
 * szóközök és a záró hüvelyk-jel eldobva, kisbetűs.
 */
export function normalizeSizeKey(text: string): string {
  return normalizeQuotes(text)
    .toLowerCase()
    .replace(/["”]/g, "")
    .replace(/\s+/g, "")
    .replace(/×/g, "x");
}

/**
 * A cella „hüvelyk / centiméter" alakjából a CM érték: `32" / 81.3 cm`.
 * Ha nincs `/ … cm` rész, nem tippelünk hüvelykből — a gyártó maga írta ki
 * a cm-t, ahol akarta.
 */
function parseSlashCm(cell: string): number | null {
  const match = cell.match(/\/\s*(\d+(?:[.,]\d+)?)\s*cm/i);
  if (!match) return null;
  const value = Number((match[1] ?? "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/**
 * EGYETLEN, egyértelmű mérőszám a cellából (`328L`, `9.70 kg`,
 * `12.10 kg (Est.)`). Ha a cella több számot sorol fel (kivitelenkénti
 * értékek), `null` — inkább hiányozzon, mint tévedjen.
 */
function parseSingleNumber(cell: string, unit: "kg" | "l"): number | null {
  // A MÉRTÉKEGYSÉGHEZ TAPADÓ számokat számoljuk, nem az összeset. Két élesben
  // mért alak indokolja pontosan ezt a szabályt:
  //  - „Xtec Carbon D2: 13.93 kg" — a kivitel nevében is van számjegy („D2"),
  //    ezért a puszta szám-számlálás tévesen több-értékűnek hinné;
  //  - „…: 174 LLite Tech Wave, Rhino: 168 LASAP: 183 L" — itt viszont VALÓBAN
  //    három érték van, és ezt a tapadó minta helyesen fogja meg (a `L` után
  //    nincs szóhatár, de a szám ELŐTTE van).
  const pattern = unit === "kg" ? /\d+(?:[.,]\d+)?\s*kg/gi : /\d+(?:[.,]\d+)?\s*l/gi;
  const matches = [...cell.matchAll(pattern)];
  if (matches.length !== 1) return null;
  const value = Number((matches[0]?.[0] ?? "").replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/**
 * „Rider Weight" → teherbírás. A gyártó TARTOMÁNYT ad (`70-135 kg`) vagy
 * felső korlátot (`Up to 130 kg`); mindkettőnél a FELSŐ HATÁR kerül a
 * `maxLoadKg`-ba.
 *
 * Ez KÖZELÍTÉS, és tudatos: a felhasználó 2026-08-17-én az Indiana-tételeknél
 * pontosan így döntött („a rec jelentése: recommended rider weight, tehát
 * lehet ez a max load"), mert hivatalos „max load" címkét a gyártók jellemzően
 * nem adnak. Ha egyszer előkerül pontosabb szám, felülírandó.
 */
export function parseRiderWeightKg(cell: string): number | null {
  // A KG-hoz tapadó számok élveznek elsőbbséget: a gyártók gyakran kiírják a
  // fontot is („308 lbs / 140 kg" — Aqua Marina adatlap), és font-értéket
  // kilogrammként beírni durva hiba lenne (140 helyett 308 kg).
  const kgNumbers = [...cell.matchAll(/(\d+(?:[.,]\d+)?)\s*kg/gi)]
    .map((m) => Number((m[1] ?? "").replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0);

  // Ésszerűségi korlát: emberi testsúly-tartomány. Egy elgépelt/rossz oszlopból
  // származó 900 kg-ot nem írunk be.
  const plausible = (values: number[]) => values.filter((n) => n >= 20 && n <= 400);

  const kgPlausible = plausible(kgNumbers);
  if (kgPlausible.length > 0) {
    // A `kg` a TARTOMÁNY FELSŐ határához tapad („60-105 kg" → csak a 105-höz),
    // tehát KIVITELENKÉNT egy szám gyűlik ide. Ha több van, a cella több
    // kivitelt sorol fel — élesben mért (All Star 14'0" x 26"):
    // „Deluxe: 60-105 kg / Deluxe Lite: 50-85 kg".
    //
    // Ilyenkor a LEGKISEBB felső határ a helyes: a jelölt a kiviteleket EGY
    // deszkává vonja össze (ld. `shopify.ts`), a teherbírás pedig BIZTONSÁGI
    // mező a kemény szűrőben. A 105 kg beírása azt jelentené, hogy egy 100 kg-os
    // evezősnek ajánljuk a deszkát, holott a Deluxe Lite változata csak 85 kg-ig
    // terhelhető. Alábecsülve legfeljebb egy jó ajánlatot hagyunk ki;
    // fölébecsülve viszont a felhasználót küldjük vízre alkalmatlan deszkával.
    return Math.min(...kgPlausible);
  }

  // Mértékegység nélküli cella: itt egyetlen tartományt feltételezünk
  // („70-90"), aminek a FELSŐ határa a teherbírás.
  const bare = plausible(
    [...cell.matchAll(/(\d+(?:[.,]\d+)?)/g)]
      .map((m) => Number((m[1] ?? "").replace(",", ".")))
      .filter((n) => Number.isFinite(n) && n > 0),
  );
  if (bare.length === 0) return null;
  return Math.max(...bare);
}

/**
 * Egy cella KIVITEL szerinti szűkítése.
 *
 * A gyártó néha egyetlen cellába zsúfolja több kivitel adatát — élesben mért
 * (All Star 14'0" x 26"): `„Deluxe: 60-105 kgDeluxe Lite: 50-85 kg"`. Mivel a
 * jelöltek kivitelenként külön sorok (`shopify.ts`), a cellából a SAJÁT
 * kivitelünkhöz tartozó szeletet kell kivágni.
 *
 * A szeletelés a `Címke:` mintára megy. FIGYELEM a `Deluxe` vs `Deluxe Lite`
 * csapdára: a rövidebb név a hosszabb ELEJE, ezért nem részstringet keresünk,
 * hanem a szegmens-címkét TELJES EGYEZÉSSEL azonosítjuk.
 *
 * Ha a cella nem bont kivitelre (`„11.2 kg"`), változatlanul visszaadjuk —
 * az érték mindegyik kivitelre érvényes.
 */
export function cellForConstruction(cell: string, construction: string | null): string {
  // Szegmens-határok: „Valami:" alakú címkék. A címke NAGYBETŰVEL kezdődik —
  // ez a horgony, mert a gyártó gyakran elválasztó nélkül fűzi össze a
  // szegmenseket: „60-105 kgDeluxe Lite: 50-85 kg". Kisbetűt is megengedve a
  // minta a „kg"-ot is a következő címke elejének hinné, és levágná az
  // előző érték mértékegységét.
  const labelPattern = /([A-ZÀ-Þ][A-Za-zÀ-ÿ.+-]*(?:[ \t]+[A-Za-zÀ-ÿ.+-]+)*)[ \t]*:[ \t]*/g;
  const matches = [...cell.matchAll(labelPattern)];
  if (matches.length === 0) return cell;

  const segments: { label: string; value: string }[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    if (!current) continue;
    const start = (current.index ?? 0) + current[0].length;
    const next = matches[i + 1];
    const end = next?.index ?? cell.length;
    segments.push({ label: (current[1] ?? "").trim(), value: cell.slice(start, end).trim() });
  }
  if (segments.length === 0) return cell;

  if (construction === null) {
    // Nincs mihez illeszteni: a cella több kivitelt sorol fel, közülük nem
    // választunk — a hívó parse-olói így „több érték"-ként fogják kezelni.
    return cell;
  }

  const wanted = construction.toLowerCase().replace(/\s+/g, " ").trim();
  // EGY SZEGMENS TÖBB KIVITELÉ is lehet: a gyártó vesszővel sorolja fel őket
  // („Starlite, Lite Tech, Blue Carbon,Limited Series: 172 L"). A címke-mintába
  // a vessző nem fér bele, ezért a felsorolásból csak az UTOLSÓ tag illeszkedik,
  // a többi a találat ELŐTTI szövegben marad.
  //
  // A megelőző szakaszt CSAK akkor olvassuk címkének, ha VESSZŐVEL zárul —
  // ekkor a kettőspontos címke a felsorolás utolsó tagja. Enélkül az előző
  // szegmens ÉRTÉKE csúszna be címkének: a `Deluxe: 60-105 kgDeluxe Lite:`
  // cellában a `Deluxe Lite` elé a `60-105 kg` ragad, és a saját címkéje
  // veszne el (élesben mért `Deluxe` ⇄ `Deluxe Lite` csapda).
  const labelsOf = (index: number): string[] => {
    const current = matches[index];
    if (!current) return [];
    const own = (current[1] ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    const previous = index > 0 ? matches[index - 1] : null;
    const zoneStart = previous ? (previous.index ?? 0) + previous[0].length : 0;
    const zone = cell.slice(zoneStart, current.index ?? 0);
    if (!zone.trimEnd().endsWith(",")) return [own];
    const extra = zone
      .split(",")
      .map((part) => part.toLowerCase().replace(/\s+/g, " ").trim())
      // A zóna ELEJÉN az előző szegmens értéke is ott lehet („174 L…") — a
      // számmal kezdődő tag nem kivitel-név.
      .filter((part) => part !== "" && !/^\d/.test(part));
    return [...extra, own];
  };

  // 1) teljes egyezés, 2) a kivitel-név ELEJE (a tábla rövidíthet: a
  //    „Deluxe Airline" variánshoz a tábla „Deluxe" szegmense tartozhat).
  for (let i = 0; i < segments.length; i += 1) {
    if (labelsOf(i).includes(wanted)) return segments[i]!.value;
  }
  let best: { value: string; length: number } | null = null;
  for (let i = 0; i < segments.length; i += 1) {
    for (const label of labelsOf(i)) {
      // A LEGHOSSZABB illeszkedő címke nyer: „Deluxe Lite" verjen a „Deluxe"-t.
      if (wanted.startsWith(label) && (!best || label.length > best.length)) {
        best = { value: segments[i]!.value, length: label.length };
      }
    }
  }
  if (best) return best.value;

  // ISMERETLEN KIVITEL: a cella KIMONDJA, kikről szól, és mi nem vagyunk
  // köztük — tehát erről a kivitelről NINCS adata. Üres jelzés megy vissza.
  //
  // ÉLESBEN MÉRT HIBA (star-board.com, 2026-09-20). Korábban itt a TELJES
  // cellát adtuk vissza, arra építve, hogy „a parse-olók több-értékűként
  // elutasítják". Ez csak akkor igaz, ha a cella többféle értéket sorol fel.
  // A 2025-ös Whopper táblájában viszont HÁROM oszlop visel azonos
  // méret-fejlécet (`10'0" x 34"`), és mindegyik EGYETLEN kivitelé:
  // `ASAP: 11.9 kg` külön oszlopban. A Rhino-jelölt így az ASAP oszlopából
  // vette a súlyt (11,9 helyett 13,22 kg), a térfogatot (172 helyett 168 l)
  // és a vastagságot (10,9 helyett 10,4 cm) — egyetlen értékű cellából, amit
  // semmi nem utasított el. A hiba NÉMA volt: hihető számokat adott.
  return "";
}

/** Melyik spec-mezőhöz tartozik ez a sor-címke? */
function fieldForLabel(rawLabel: string): keyof typeof ROW_LABELS | null {
  const label = rawLabel.toLowerCase().trim();
  if (label === "") return null;
  for (const [field, needles] of Object.entries(ROW_LABELS) as [
    keyof typeof ROW_LABELS,
    readonly string[],
  ][]) {
    const excluded = ROW_EXCLUSIONS[field]?.some((word) => label.includes(word)) ?? false;
    if (excluded) continue;
    if (needles.some((needle) => label.includes(needle))) return field;
  }
  return null;
}

/**
 * A gyártói spec-tábla → méretenkénti spec-térkép.
 *
 * A kulcs a `normalizeSizeKey` alakja, hogy a `shopify.ts` variáns-címkéjével
 * összepárosítható legyen. Az első sor a fejléc (méret-oszlopok); ha abból egy
 * oszlop sem értelmezhető méretként, üres térképet adunk vissza (ez nem
 * spec-tábla, hanem pl. a tartozéklista).
 */
export function parseSpecTable(
  rows: readonly (readonly string[])[],
  construction: string | null = null,
): Map<string, BoardSpecs> {
  const result = new Map<string, BoardSpecs>();
  const header = rows[0];
  if (!header || header.length < 2) return result;

  // Oszlop-index → méret-kulcs (a 0. oszlop a sor-címke).
  const columns = new Map<number, string>();
  for (let index = 1; index < header.length; index += 1) {
    const key = sizeKeyFromHeader(header[index] ?? "");
    if (key) columns.set(index, key);
  }
  if (columns.size === 0) return result;

  for (const key of columns.values()) {
    result.set(key, { ...EMPTY_SPECS });
  }

  // MELYIK OSZLOP KIÉ. A gyártó ugyanazt a méretet több oszlopban is hozhatja,
  // kivitelenként — a 2025-ös Whoppernél HÁROM `10'0" x 34"` oszlop áll
  // egymás mellett (Starlite/Lite Tech/Blue Carbon/Limited Series · ASAP ·
  // Rhino). A méret-kulcs mindháromnál AZONOS, tehát egy vödörbe esnének, és
  // az első nem-null érték nyerne — kivitelre való tekintet nélkül.
  //
  // A CÍMKÉZETT sorok (Volume, Weight, Fins) elárulják, melyik oszlop kié.
  // Ha a keresett kivitelt egy oszlop KIMONDJA, akkor ehhez a mérethez csak az
  // ilyen oszlopok szólnak — a CÍMKÉZETLEN cellák (Length, Width, Thickness)
  // is onnan jönnek. Enélkül a Rhino a szomszéd oszlop vastagságát kapná
  // (10,9 helyett 10,4 cm), mert azon a soron nincs kivitel-címke.
  const claimedBy = new Map<number, boolean>();
  if (construction !== null) {
    for (const index of columns.keys()) {
      let mentionsAny = false;
      let mentionsUs = false;
      for (const row of rows.slice(1)) {
        const raw = (row[index] ?? "").trim();
        if (raw === "") continue;
        // A cella akkor „címkézett", ha a kivitel-szűkítés egyáltalán talál
        // benne szegmenst — ezt az jelzi, hogy más eredményt ad, mint a nyers.
        const mine = cellForConstruction(raw, construction);
        if (mine !== raw) {
          mentionsAny = true;
          if (mine !== "") mentionsUs = true;
        }
      }
      claimedBy.set(index, mentionsUs || !mentionsAny);
    }
    // Csak akkor szűkítünk, ha a keresett kivitelt legalább egy oszlop KIMONDJA
    // — különben (címkézetlen tábla) minden oszlop marad, a régi viselkedéssel.
    const anyExplicit = [...columns.keys()].some((index) => claimedBy.get(index) === false);
    if (!anyExplicit) claimedBy.clear();
  }

  for (const row of rows.slice(1)) {
    const field = fieldForLabel(row[0] ?? "");
    if (!field) continue;
    for (const [index, key] of columns) {
      if (claimedBy.get(index) === false) continue;
      // A cellát ELŐBB a saját kivitelünkre szűkítjük (ld. cellForConstruction).
      const cell = cellForConstruction((row[index] ?? "").trim(), construction);
      if (cell === "") continue;
      const specs = result.get(key);
      if (!specs) continue;

      switch (field) {
        case "lengthCm":
        case "widthCm":
        case "thicknessCm": {
          const value = parseSlashCm(cell);
          if (value !== null && specs[field] === null) specs[field] = value;
          break;
        }
        case "volumeL": {
          const value = parseSingleNumber(cell, "l");
          if (value !== null && specs.volumeL === null) specs.volumeL = value;
          break;
        }
        case "weightKg": {
          const value = parseSingleNumber(cell, "kg");
          if (value !== null && specs.weightKg === null) specs.weightKg = value;
          break;
        }
        case "maxLoadKg": {
          const value = parseRiderWeightKg(cell);
          if (value !== null && specs.maxLoadKg === null) specs.maxLoadKg = value;
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Több tábla összefésülése egy térképbe (egy termékoldalon a SIZES és a
 * SPECIFICATIONS fül is tábla, plusz a tartozék- és karbonlábnyom-tábla).
 * Az ELSŐ nem-null érték nyer: a spec-táblák sorrendje a lapon a mérvadó.
 */
export function mergeSpecTables(
  tables: readonly (readonly (readonly string[])[])[],
  construction: string | null = null,
): Map<string, BoardSpecs> {
  const merged = new Map<string, BoardSpecs>();
  for (const table of tables) {
    for (const [key, specs] of parseSpecTable(table, construction)) {
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...specs });
        continue;
      }
      // Mezőnként kiírva: a `BoardSpecs` mezői eltérő típusúak
      // (number|boolean|null), egy általános kulcs-ciklus itt csak
      // típus-kényszerítéssel menne, ami elrejtené a valódi elgépeléseket.
      existing.lengthCm ??= specs.lengthCm;
      existing.widthCm ??= specs.widthCm;
      existing.thicknessCm ??= specs.thicknessCm;
      existing.volumeL ??= specs.volumeL;
      existing.weightKg ??= specs.weightKg;
      existing.maxLoadKg ??= specs.maxLoadKg;
      existing.inflatable ??= specs.inflatable;
    }
  }
  return merged;
}
