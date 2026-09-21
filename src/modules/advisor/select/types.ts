/**
 * Deszkaválasztó (Advisor) típusok — FEJLESZTESI_DOKUMENTACIO 5.2.
 *
 * A kétrétegű ajánló TISZTA és mellékhatás-mentes: STRUKTURÁLIS bemeneten
 * dolgozik. NEM importál catalog/reviews modult (modul→modul TILOS, 1.3): a
 * deszka-adatokat a hívó (később a wizard-route loadere) adja át
 * `BoardForAdvisor[]` tömbként, a review-átlagokat a reviews-aggregátorból.
 *
 * A kimeneti indoklás SOHA nem kész magyar mondat: i18n-kulcs + paraméterek
 * (`AdvisorReason`), a szöveg az `advisor` namespace-ben él (SUP-index mintája).
 */

/** A wizard 3 tapasztalati szintje (a volume-szorzó kulcsaival egyező). */
export type Experience = "kezdo" | "halado" | "versenyzo";

/**
 * Utas a deszkán (az effektív súlyt növeli).
 *
 * Az `adult` (felnőtt társ) esetén a KETTŐJÜK ÖSSZSÚLYA a mérvadó — a
 * konfigban szereplő kg BECSLÉS, ugyanúgy, mint a gyereknél/kutyánál. Ha a
 * társ ennél lényegesen nehezebb/könnyebb, érdemes a saját testsúlyhoz
 * hozzáadva megadni.
 */
export type Passenger = "none" | "child" | "dog" | "adult";

/** A tervezett vízi közeg. */
export type WaterChoice = "to" | "folyo" | "vedett";

/** Tárolási preferencia. */
export type StorageChoice = "any" | "inflatable_only";

/** A wizard cél-kérdésének opciói (5.2 cél-mapping bemenete). */
export type AdvisorUse = "allround" | "tura" | "verseny" | "joga" | "horgasz";

/**
 * A catalog `board_type` union stringjei — SZÁNDÉKOSAN itt újradeklarálva, NEM a
 * catalog-modulból importálva (modul→modul tilos). A két uniónak egyeznie kell
 * (a route-réteg a catalog sorát képezi le `BoardForAdvisor`-rá).
 */
export type AdvisorBoardType =
  | "allround"
  | "touring"
  | "race"
  | "yoga"
  | "kids"
  | "fishing"
  | "river"
  /**
   * SZÖRF-SUP. A katalógusban böngészhető, de a varázsló EGYELŐRE NEM ajánlja:
   * a cél-kérdésnek nincs „szörf" opciója, ezért a `surf` egyetlen
   * `USE_BOARD_TYPES` bejegyzésben sem szerepel, és a kemény szűrésen nem jut
   * át. Szándékos: ajánlani csak akkor fogjuk, ha a varázsló megkapja a hozzá
   * tartozó kérdést (külön termékdöntés).
   */
  | "surf";

/** A wizard válaszai (5.2 1–2. réteg bemenete). */
export interface AdvisorInputs {
  /** Testsúly kg. */
  weightKg: number;
  /**
   * Testmagasság cm. A SÚLY a térfogatot határozza meg (felhajtóerő), a
   * MAGASSÁG a deszka HOSSZÁT: magasabb evezősnek hosszabb deszka fekszik jobban
   * (nagyobb lépéshossz, magasabb súlypont, jobb nyomtartás). Ez PUHA szempont:
   * csak a pontozásba (`lengthFitScore`) szól bele, kizárni SOHA nem zár ki —
   * a kemény szűrés kizárólag biztonsági (térfogat, terhelhetőség).
   * `null` → nem adta meg: a hossz-illeszkedés semleges (0,5).
   */
  heightCm: number | null;
  passenger: Passenger;
  experience: Experience;
  use: AdvisorUse;
  water: WaterChoice;
  /** Felső ársáv Ft; null → nincs ár-korlát. */
  budgetHuf: number | null;
  storage: StorageChoice;
}

/**
 * Egy deszka az ajánlóhoz szükséges, denormalizált mezőkkel. A route-réteg
 * tölti (boards + board_prices legfrissebb ár + reviews-aggregátumok). A
 * review-átlagok 1–5 skálán; a hiányzó mezők null-ok.
 */
export interface BoardForAdvisor {
  id: string;
  boardType: AdvisorBoardType;
  /**
   * A deszka ÖSSZES használati kategóriája, egyenrangúan (F2.1-utó-43).
   *
   * MIÉRT: a gyártók okkal ajánlanak egy deszkát több felhasználásra — a
   * Fanatic `TOURING / FREERACING`-et ír, a Jobe „all-around AND touring"-ot,
   * a Gladiatornál 82 termékből 25 több aktivitás-kategóriában szerepel.
   * Amíg a cél-illesztés egyetlen értéket nézett, egy „allround + túra"
   * deszka a túra-célnál láthatatlan maradt, pedig a GYÁRTÓ ajánlja rá.
   *
   * A `boardType` az átmenet idejére megmarad, és a tömb ELSŐ elemével
   * azonos. Hiányzó/üres tömb esetén a hívó abból képez egyeleműt.
   */
  boardTypes: AdvisorBoardType[];
  volumeL: number | null;
  widthCm: number | null;
  /** Deszka-hossz cm — a testmagassághoz illesztéshez (`lengthFitScore`). */
  lengthCm: number | null;
  /** Vastagság cm — a kezdő 12–15 cm-es sávhoz illesztéshez. */
  thicknessCm: number | null;
  maxLoadKg: number | null;
  inflatable: boolean;
  modelYear: number | null;
  priceHuf: number | null;
  /** Közös nevező átlag 1–5 (null, ha nincs elég értékelés/adat). */
  reviewAvg: number | null;
  reviewCount: number;
  /** Ár-érték rész-értékelés átlaga 1–5 (null, ha nincs). */
  ratingValueAvg: number | null;
}

/**
 * A vélemény rész-szempontjai — SZÁNDÉKOSAN itt újradeklarálva, NEM a
 * reviews-modulból importálva (modul→modul tilos, 1.3), ugyanaz a minta, mint
 * az `AdvisorBoardType`-nál. Az igazság forrása a `reviews` modul
 * `REVIEW_DIMENSIONS` listája; a kettőnek egyeznie kell. A feliratok az
 * `advisor` namespace `dim.*` kulcsaiból jönnek (a reviews-é nem használható).
 */
export type AdvisorReviewDimension = "stability" | "glide" | "build" | "value";

export const ADVISOR_REVIEW_DIMENSIONS: readonly AdvisorReviewDimension[] = [
  "stability",
  "glide",
  "build",
  "value",
];

/** Rész-szempont → 0–10 érték (null: az adott szempontra nincs adat). */
export type AdvisorDimensionScores = Record<AdvisorReviewDimension, number | null>;

/** Indoklás-template: i18n-kulcs (advisor namespace) + interpolációs paraméterek. */
export interface AdvisorReason {
  /** pl. "reason.volume" — az `advisor` namespace-ben feloldva. */
  key: string;
  params: Record<string, string | number>;
}

/**
 * Miért nem maradt egyetlen ajánlás sem — a DOMINÁNS kizárási ok. Az üres
 * állapot ezt nevezi meg, hogy a felhasználó a VALÓDI korláton tudjon lazítani.
 * A `maxLoad` biztonsági korlát: ott nem lazítást tanácsolunk, hanem más
 * deszka-kategóriát.
 */
export type NoMatchReason =
  | "noBoards"
  | "type"
  | "storage"
  | "maxLoad"
  | "volume"
  | "budget";

/** Egy rangsorolt ajánlás (advisor_sessions.results egy eleme). */
export interface AdvisorResultItem {
  boardId: string;
  /** 0–100, egy tizedesre kerekítve. */
  score: number;
  reasons: AdvisorReason[];
}
