/**
 * STARBOARD (star-board.com) — Shopify-mód
 *
 *  * A 445 termékoldalon van Product JSON-LD, de a MÉRET sem a nyers
 *    HTML-ben, sem a renderelt szövegben nincs ott (JS-tab tölti). A
 *    `/products.json` viszont strukturáltan adja: 445 letöltés helyett 2 kérés.
 *  * MÉRETENKÉNT külön jelölt (a SUP-nál a méret maga a termék), a KIVITELI
 *    változatok viszont összefésülődnek.
 *  * Ár SOHA nem íródik innen: gyártói forrás, és a Shopify-ár EUR-ban van.
 *  * A `collectionTypes` a gyártó SAJÁT besorolása; a `surf` és a wing
 *    kollekciók termékei kimaradnak (felhasználói döntés, 2026-08-19).
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Starboard",
  baseUrl: "https://star-board.com",
  kind: "brand_site",
  country: "EU",
  crawlConfig: {
      // GALÉRIA (F2.1-utó-56): A gyártó sliderje. HÁROMSZOR fordul elő: kétszer a variáns-bélyegek csíkjaként (2-2 kép), egyszer a termék galériájaként — a legtöbb képet adó nyer.
      galleryClass: "hdt-slider__container",
      "notes": "Gyártói Shopify-katalógus (/products.json). A modellnév a HIVATALOS gyártói név; ár nincs (árpolitika).",
      "shopify": {
          "productTypes": [
              "SUP Hardboard",
              "SUP Inflatable",
              "Paddleboard"
          ],
          "collectionTypes": {
              "race-paddleboards": "race",
              "expedition-paddleboards": "touring",
              "all-round-wave-paddleboards": "allround",
              "entry-level-inflatable-paddleboards": "allround"
          },
          "excludeCollections": [
              "surf-paddleboards",
              "entry-level-wingboards"
          ]
      },
      "minDelayMs": 1500,
      "maxProducts": 200,
      "defaultBrandName": "Starboard"
  },
};
