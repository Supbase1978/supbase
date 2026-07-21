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

/** Utas a deszkán (effektív súlyt növeli). */
export type Passenger = "none" | "child" | "dog";

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
  | "river";

/** A wizard válaszai (5.2 1–2. réteg bemenete). */
export interface AdvisorInputs {
  /** Testsúly kg. */
  weightKg: number;
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
  volumeL: number | null;
  widthCm: number | null;
  maxLoadKg: number | null;
  inflatable: boolean;
  availabilityHu: boolean;
  modelYear: number | null;
  priceHuf: number | null;
  /** Közös nevező átlag 1–5 (null, ha nincs elég értékelés/adat). */
  reviewAvg: number | null;
  reviewCount: number;
  /** Ár-érték rész-értékelés átlaga 1–5 (null, ha nincs). */
  ratingValueAvg: number | null;
}

/** Indoklás-template: i18n-kulcs (advisor namespace) + interpolációs paraméterek. */
export interface AdvisorReason {
  /** pl. "reason.volume" — az `advisor` namespace-ben feloldva. */
  key: string;
  params: Record<string, string | number>;
}

/** Egy rangsorolt ajánlás (advisor_sessions.results egy eleme). */
export interface AdvisorResultItem {
  boardId: string;
  /** 0–100, egy tizedesre kerekítve. */
  score: number;
  reasons: AdvisorReason[];
}
