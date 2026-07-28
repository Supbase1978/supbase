/**
 * „Ez is kell hozzá" — a Deszkaválasztó eredmény alatti felszerelés-blokk
 * tiszta logikája (F2.3 1. szakasz, domain-review 2.8 nyitott tétele).
 *
 * TISZTA FÜGGVÉNY, NINCS DB-lekérdezés: kizárólag a wizard bemenetéből
 * (víztípus, tárolási preferencia, cél) számol. Ez a fájl a ROUTE-rétegben
 * él (nem a catalogban és nem az advisorban), mert a `GearCategory` típus a
 * catalog modulból, a `WaterChoice`/`AdvisorUse`/`StorageChoice` típus az
 * advisor modulból jön — a kettő összekötése csak itt engedett (1.3
 * modul-szerződés, lásd az F1.5/F1.6 mintáját: a catalog és a reviews modult
 * is a deszkak.$slug.tsx route köti össze).
 *
 * A "tapasztalat" (Experience) bemenetet a terv (52–94. sor) nem használja a
 * felszerelés-levezetéshez — csak a víztípus, a tárolási preferencia
 * (felfújható-e) és a cél (túra) számít, ezért ez a függvény sem vesz át
 * `experience` paramétert.
 */
import type { AdvisorUse, StorageChoice, WaterChoice } from "@modules/advisor/select/types";
import type { GearCategory } from "@modules/catalog/gear";

export interface GearAdviceInput {
  water: WaterChoice;
  use: AdvisorUse;
  storage: StorageChoice;
}

export interface GearAdviceItem {
  category: GearCategory;
  /** i18n-kulcs a `catalog` namespace-ben (`gear.advisor.*`). */
  textKey: string;
}

/**
 * Mindig póráz (víztípus szerinti típussal) + mentőmellény; felfújható
 * deszka-preferenciánál pumpa-említés; túra célnál szárazzsák.
 */
export function recommendGearFor({ water, use, storage }: GearAdviceInput): GearAdviceItem[] {
  const items: GearAdviceItem[] = [
    {
      category: "poraz",
      textKey: water === "folyo" ? "gear.advisor.leash.river" : "gear.advisor.leash.other",
    },
    { category: "mentomelleny", textKey: "gear.advisor.pfd" },
  ];

  if (storage === "inflatable_only") {
    items.push({ category: "pumpa", textKey: "gear.advisor.pump" });
  }

  if (use === "tura") {
    items.push({ category: "szarazzsak", textKey: "gear.advisor.drybag" });
  }

  return items;
}
