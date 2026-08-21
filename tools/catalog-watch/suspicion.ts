/**
 * catalog-watch — GYANÚ-JELEK a kinyert adaton (F2.1-utó-38).
 *
 * MIÉRT VAN ERRE SZÜKSÉG (felhasználói megfogalmazás, 2026-08-21): „ha rossz
 * adat eljut [a jóváhagyóig], akkor alapvetően megkérdőjeleződik a többi adat
 * is egy adott márkánál." A hiba nem egy sor ügye: ha egy modell űrtartalma
 * félremegy, jogos a kérdés, mi van a gyártó többi modelljével.
 *
 * EZ NEM ELUTASÍTÁS. A gyanús érték BEÍRÓDIK — meg kell tudni nézni, hátha
 * csak egyetlen modell HTML-oldala hibás. Amit a jel elér: a sor nem csúszhat
 * át a TÖMEGES jóváhagyáson, és a moderátor látja, mi a gyanús és miért.
 *
 * A KÜSZÖBÖK MÉRTEK, NEM TIPPELTEK. Mind a 236 élő deszka bejárja a
 * megengedett sávot; a határok ezen kívül, ráhagyással állnak. A
 * `suspicion.test.ts` a valós szélsőértékeket is átengedi — ha egy jövőbeli
 * szabály elkezdene legitim deszkát gyanúsítani, ott bukik el.
 */
import type { BoardSpecs, BoardType, ExtractedProduct } from "./types.ts";

export type SuspicionCode =
  | "volume_geometry"
  | "too_short"
  | "implausible_load"
  | "conflicts_with_board";

export interface Suspicion {
  code: SuspicionCode;
  /** Melyik spec-mező gyanús (a moderációs felület ezt emeli ki). */
  field: keyof BoardSpecs | "modelName";
  /** EMBERI indoklás — ez jelenik meg a moderátornak és a crawl-logban. */
  detail: string;
}

/** A párosított, MÁR ISMERT deszka — az ütközés-vizsgálat alapja. */
export interface MatchedBoard {
  modelName: string;
  lengthCm: number | null;
  volumeL: number | null;
  maxLoadKg: number | null;
}

/**
 * ŰRTARTALOM / GEOMETRIA arány: a térfogat hányad része a befoglaló doboznak.
 *
 * A 221 mérhető élő deszkán ez 0,36 és 1,01 között szór. A két szél is
 * értelmes: a legalacsonyabb a hegyes orrú-farú Sprint 14'0" versenydeszka
 * (0,36), a legmagasabb a szinte téglatest Peace jógadeszka (1,01).
 *
 * BECSLÉSRE EZ TÚL LAZA — a szórás háromszoros —, ELLENŐRZÉSRE viszont éles:
 * a hibásan kinyert HYPER 11'6" (350×79×15 = 48 L) 0,12-t ad, a legalacsonyabb
 * valós érték harmadát.
 */
export function volumeGeometryRatio(specs: BoardSpecs): number | null {
  const { lengthCm, widthCm, thicknessCm, volumeL } = specs;
  if (lengthCm === null || widthCm === null || thicknessCm === null) return null;
  if (volumeL === null) return null;
  const box = (lengthCm * widthCm * thicknessCm) / 1000;
  if (box <= 0) return null;
  return volumeL / box;
}

/**
 * ALSÓ HATÁR: mért minimum (0,36) alatt, bőven ráhagyva. Ami ez alatt van, az
 * nem „karcsú deszka", hanem elszállt szám.
 */
const MIN_VOLUME_RATIO = 0.25;
/**
 * FELSŐ HATÁR: FIZIKAI, nem statisztikai. Egy deszka térfogata nem lehet
 * nagyobb a befoglaló dobozánál, tehát 1,0 fölé csak kerekítés vihet — a
 * ráhagyás ezt fedi.
 */
const MAX_VOLUME_RATIO = 1.1;

/**
 * HOSSZ-KÜSZÖB KATEGÓRIÁNKÉNT. A felhasználó pontosítása (2026-08-21): „egy
 * gyerek SUP hossza biztosan kisebb a többinél… de a gyerek méretre mindig
 * utal a gyártó". Vagyis nem a szám önmagában gyanús, hanem a szám a
 * KATEGÓRIÁJÁHOZ képest.
 *
 * Mérve: a legrövidebb gyerekdeszkánk 244 cm, a legrövidebb nem-gyerek 249 cm
 * (Peace jógadeszka). A gyerek-küszöb ezért enged lejjebb — létezik 7'6"
 * (229 cm) gyerekdeszka —, a többi kategóriánál viszont a 240 cm alatti hossz
 * vagy kiegészítő, vagy kinyerési hiba.
 */
const MIN_LENGTH_CM: Record<"kids" | "other", number> = { kids: 180, other: 240 };

/** Mért minimum 55 kg (gyerekdeszka). Ez alatt nem terhelési adat. */
const MIN_LOAD_KG = 40;

/**
 * Mennyivel térhet el a jelölt a MÁR ISMERT deszkától, mielőtt ütközésnek
 * számít. A 10% megengedi a kerekítést és a gyártói adatlapok apró
 * eltéréseit (a bolt 325 cm-t ír, a gyártó 325,1-et), de a nagyságrendi
 * elcsúszást — 210 kontra 300 cm — kimutatja.
 */
const CONFLICT_TOLERANCE = 0.1;

/**
 * Ütközés-vizsgálat CSAK BIZTOS egyezésnél. A `pending` jelölt párosítását a
 * trigram-egyeztető tippelte; egy bizonytalan egyezésnél az „ellentmondás"
 * valójában azt jelentené, hogy MÁS termékről van szó — abból hamis riasztás
 * lenne, nem információ.
 */
const CONFLICT_MIN_CONFIDENCE = 0.8;

/**
 * Minden gyanú-jel egy kinyert termékre.
 *
 * KIEGÉSZÍTŐRE NEM FUT: egy uszony 18 cm hosszú és 0,3 kg-os — a
 * deszka-küszöbök ott értelmetlenek lennének.
 */
export function findSuspicions(
  product: ExtractedProduct,
  matched: { board: MatchedBoard; confidence: number } | null = null,
): Suspicion[] {
  if (product.accessoryType !== null) return [];
  const out: Suspicion[] = [];
  const specs = product.specs;

  const ratio = volumeGeometryRatio(specs);
  if (ratio !== null && (ratio < MIN_VOLUME_RATIO || ratio > MAX_VOLUME_RATIO)) {
    out.push({
      code: "volume_geometry",
      field: "volumeL",
      detail:
        `${specs.volumeL} L nem fér össze a saját méreteivel ` +
        `(${specs.lengthCm}×${specs.widthCm}×${specs.thicknessCm} cm, arány ${ratio.toFixed(2)}; ` +
        `a valós deszkáké 0,36–1,01)`,
    });
  }

  const floor = MIN_LENGTH_CM[product.boardType === "kids" ? "kids" : "other"];
  if (specs.lengthCm !== null && specs.lengthCm < floor) {
    out.push({
      code: "too_short",
      field: "lengthCm",
      detail:
        `${specs.lengthCm} cm — rövidebb, mint bármelyik valós ` +
        `${labelForType(product.boardType)}deszka (küszöb ${floor} cm)`,
    });
  }

  if (specs.maxLoadKg !== null && specs.maxLoadKg < MIN_LOAD_KG) {
    out.push({
      code: "implausible_load",
      field: "maxLoadKg",
      detail: `${specs.maxLoadKg} kg teherbírás — a legkisebb valós érték 55 kg`,
    });
  }

  if (matched !== null && matched.confidence >= CONFLICT_MIN_CONFIDENCE) {
    for (const [field, label] of [
      ["lengthCm", "hossz"],
      ["volumeL", "űrtartalom"],
      ["maxLoadKg", "teherbírás"],
    ] as const) {
      const mine = specs[field];
      const theirs = matched.board[field];
      if (mine === null || theirs === null || theirs === 0) continue;
      if (Math.abs(mine - theirs) / theirs <= CONFLICT_TOLERANCE) continue;
      out.push({
        code: "conflicts_with_board",
        field,
        detail:
          `${label}: ${mine} — a katalógusban „${matched.board.modelName}" ` +
          `${theirs} értékkel szerepel`,
      });
    }
  }

  return out;
}

function labelForType(boardType: BoardType | null): string {
  return boardType === "kids" ? "gyerek" : "";
}

/** Egy mező kitöltöttsége egy forrás EGY futásában. */
export interface FieldCoverage {
  field: keyof BoardSpecs;
  withValue: number;
  total: number;
  /** A recept szerint a gyártó NEM közli — a hiány ilyenkor várt állapot. */
  unpublished: boolean;
}

/** A lefedettségi jelentésben szereplő mezők, megjelenítési sorrendben. */
const COVERAGE_FIELDS: (keyof BoardSpecs)[] = [
  "lengthCm",
  "widthCm",
  "thicknessCm",
  "volumeL",
  "weightKg",
  "maxLoadKg",
];

/**
 * MEZŐLEFEDETTSÉG forrásonként (F2.1-utó-38).
 *
 * Ez válaszol a felhasználó kérdésére — „ha itt hibázik, mi van a gyártó többi
 * modelljével?" — számokkal: 19 rendben, egyet nézz meg. A jelzés a
 * GYŰJTÉSNÉL jelenik meg, nem a moderálásnál.
 *
 * A kétféle hiány itt is elválik: a recept szerint nem közölt mező VÁRT
 * hiány (bluefinsupboards.eu — űrtartalmat egyetlen modellnél sem ad), nem
 * anomália. Enélkül a jelentés minden futásnál ott jelezne, ahol nincs baj —
 * és pár ilyen után senki nem nézné.
 */
export function fieldCoverage(
  products: readonly ExtractedProduct[],
  unpublishedFields: readonly string[] = [],
): FieldCoverage[] {
  const boards = products.filter((product) => product.accessoryType === null);
  return COVERAGE_FIELDS.map((field) => ({
    field,
    withValue: boards.filter((product) => product.specs[field] !== null).length,
    total: boards.length,
    unpublished: unpublishedFields.includes(field),
  }));
}

/**
 * A lefedettségi sor EMBERI alakja. Csak azt emeli ki, ami figyelmet kér:
 * a teljes mező egy szó, a hiányos mező a hiányzó darabszámmal áll.
 */
export function formatCoverage(coverage: readonly FieldCoverage[]): string {
  return coverage
    .map((item) => {
      const label = FIELD_LABELS[item.field];
      if (item.unpublished) return `${label} n.a.`;
      if (item.total === 0 || item.withValue === item.total) return `${label} ✓`;
      return `${label} ${item.withValue}/${item.total}`;
    })
    .join(" · ");
}

const FIELD_LABELS: Record<keyof BoardSpecs, string> = {
  lengthCm: "hossz",
  widthCm: "szél",
  thicknessCm: "vast",
  volumeL: "térf",
  weightKg: "súly",
  maxLoadKg: "teher",
  inflatable: "felfújható",
};
