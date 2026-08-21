/**
 * SUP-DESZKA.HU — magyar, TÖBB MÁRKÁS bolt
 *
 * Nem márka-forrás: magyar árat és elérhetőséget ad, plusz olyan márkákat
 * (Coasto, Flowa, Too Much), amikhez nincs gyártói oldalunk.
 *
 *  * UGYANAZT a márkát két írásmóddal adja („TooMuch" és „Too Much") — alias
 *    oldja meg, különben két márka jönne létre.
 *  * A kajak/kenu/csónak terméklapokat ki kell zárni: méretben és
 *    teherbírásban deszkának látszanának.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "sup-deszka.hu",
  baseUrl: "https://sup-deszka.hu",
  kind: "shop",
  country: "HU",
  crawlConfig: {
      "notes": "Multi-marka HU webshop (Aqua Marina, TooMuch), JSON-LD 8/8 mintan validalva 2026-07-31",
      "excludeUrlPatterns": [
          "kajak",
          "csonak",
          "transom",
          "kenu"
      ],
      "productUrlPatterns": [
          "/t/"
      ]
  },
};
