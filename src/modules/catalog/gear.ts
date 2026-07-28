/**
 * „Felszerelés" kategóriák (F2.3 1. szakasz — tartalom, séma-módosítás NÉLKÜL).
 *
 * A domain-review 2.8 pontja + a boltokban ténylegesen látott kínálat alapján
 * rögzített, ZÁRT kategória-lista. Ez a fájl KIZÁRÓLAG a statikus útmutató-
 * tartalomhoz kell (`/felszereles`, `/felszereles/:kategoria`) — a `boards`
 * táblához, a `kind`-diszkriminátorhoz és a termékszintű katalógushoz a terv
 * 2. szakasza tartozik, ide (még) nem nyúlunk.
 */

export const GEAR_CATEGORIES = [
  "evezo",
  "poraz",
  "mentomelleny",
  "pumpa",
  "szarazzsak",
  "ules",
  "uszony",
  "taska",
] as const;

export type GearCategory = (typeof GEAR_CATEGORIES)[number];

export function isGearCategory(value: string): value is GearCategory {
  return (GEAR_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Melyik kategória-oldal biztonsági blokkja forrás CSAK a `core` namespace
 * MEGLÉVŐ `safety.riverLeash.*` kulcsaiból (a spot-adatlap és a Deszkaválasztó
 * ugyanezt a szöveget mutatja — nem másoljuk, újra hasznosítjuk). A pumpa és a
 * szárazzsák biztonsági szövege a `catalog` namespace SAJÁT
 * `gear.categories.<kategória>.safety.*` kulcsaiból jön, mert ezekhez nincs
 * meglévő core-szöveg. Az evező/ülés/uszony/táska kategóriáknak nincs
 * biztonsági jellegű tartalma (nem szerepelnek a domain-review 2.8 kritikus
 * listáján) — ezeknél a kategória-oldal nem jelenít meg `SafetyNote`-ot.
 */
export const CORE_SAFETY_SOURCE: Partial<Record<GearCategory, "leash" | "pfd">> = {
  poraz: "leash",
  mentomelleny: "pfd",
};

/** Saját (catalog-namespace) biztonsági szöveggel rendelkező kategóriák. */
export const OWN_SAFETY_CATEGORIES: readonly GearCategory[] = ["pumpa", "szarazzsak"];
