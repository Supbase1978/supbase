/**
 * A Deszkaválasztó válaszainak URL-be kódolása és vissza.
 *
 * MIÉRT KELL: az eredmény korábban KIZÁRÓLAG a POST-válasz törzsében létezett.
 * Ennek három látható következménye volt:
 *   1. újratöltésnél a böngésző űrlap-újraküldést kért,
 *   2. a vissza-gomb után az eredmény elveszett,
 *   3. nem lehetett könyvjelzőzni és megosztani (a „Megosztás" gombnak nem is
 *      volt mit megosztania).
 * A POST→redirect→GET mintához az összes válasznak el kell férnie az URL-ben.
 *
 * TISZTA modul: se I/O, se React — Vitesttel közvetlenül tesztelhető.
 *
 * A paraméternevek magyarul, a route-okkal egy stílusban. RÖVIDÍTÉS NÉLKÜL:
 * a megosztott link olvasható marad, és egy elgépelt paraméter is felismerhető.
 */
import type {
  AdvisorInputs,
  AdvisorUse,
  Experience,
  Passenger,
  StorageChoice,
  WaterChoice,
} from "./types";

export const PARAM = {
  weight: "suly",
  height: "magassag",
  passenger: "utas",
  experience: "szint",
  use: "cel",
  water: "viz",
  budget: "keret",
  storage: "tarolas",
} as const;

const EXPERIENCES: readonly Experience[] = ["kezdo", "halado", "versenyzo"];
const PASSENGERS: readonly Passenger[] = ["none", "child", "dog", "adult"];
const WATERS: readonly WaterChoice[] = ["to", "folyo", "vedett"];
const USES: readonly AdvisorUse[] = ["allround", "tura", "verseny", "joga", "horgasz"];
const STORAGES: readonly StorageChoice[] = ["any", "inflatable_only"];

/** Csak akkor fogadjuk el, ha a felsorolásban szerepel — az URL nem megbízható. */
function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Számérték a megadott tartományban, különben null. */
function numberInRange(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

/** A testsúly elfogadott tartománya (a wizard is ezt kéri). */
export const WEIGHT_RANGE = { min: 30, max: 200 } as const;
/** A testmagasság elfogadott tartománya. */
export const HEIGHT_RANGE = { min: 120, max: 220 } as const;

/**
 * URL-paraméterek → wizard-válaszok. `null`, ha a TESTSÚLY hiányzik vagy
 * érvénytelen: az az egyetlen kötelező adat, ami nélkül nincs értelmes
 * ajánlás — ilyenkor a route a wizardot mutatja, nem egy üres eredményt.
 *
 * A többi mező hiánynál a józan alapértékre esik vissza (nem hibázik), mert
 * egy megosztott linkből könnyen kimaradhat egy paraméter.
 */
export function inputsFromSearchParams(params: URLSearchParams): AdvisorInputs | null {
  const weightKg = numberInRange(params.get(PARAM.weight), WEIGHT_RANGE.min, WEIGHT_RANGE.max);
  if (weightKg === null) return null;

  return {
    weightKg,
    heightCm: numberInRange(params.get(PARAM.height), HEIGHT_RANGE.min, HEIGHT_RANGE.max),
    passenger: oneOf(params.get(PARAM.passenger), PASSENGERS, "none"),
    experience: oneOf(params.get(PARAM.experience), EXPERIENCES, "kezdo"),
    use: oneOf(params.get(PARAM.use), USES, "allround"),
    water: oneOf(params.get(PARAM.water), WATERS, "to"),
    // A budget felső korlátja nagyvonalú: nem a mi dolgunk megmondani, mennyit
    // költhet valaki. Csak a nyilvánvalóan hibás (negatív) értéket zárjuk ki.
    budgetHuf: numberInRange(params.get(PARAM.budget), 0, 100_000_000),
    storage: oneOf(params.get(PARAM.storage), STORAGES, "any"),
  };
}

/**
 * Wizard-válaszok → URL-paraméterek. A `null` mezők KIMARADNAK (nem
 * `?keret=null`), így a link rövidebb és a visszaolvasás egyértelmű.
 */
export function searchParamsFromInputs(inputs: AdvisorInputs): URLSearchParams {
  const params = new URLSearchParams();
  params.set(PARAM.weight, String(inputs.weightKg));
  if (inputs.heightCm !== null) params.set(PARAM.height, String(inputs.heightCm));
  params.set(PARAM.passenger, inputs.passenger);
  params.set(PARAM.experience, inputs.experience);
  params.set(PARAM.use, inputs.use);
  params.set(PARAM.water, inputs.water);
  if (inputs.budgetHuf !== null) params.set(PARAM.budget, String(inputs.budgetHuf));
  params.set(PARAM.storage, inputs.storage);
  return params;
}
