/**
 * INDIANA (indiana-paddlesurf.com)
 *
 *  * A hüvelyk-jelet ASCII dupla aposztróffal írja („Width Foot/Inch: 32''"),
 *    amit láb-jelként olvasva 32 láb = 975 cm jött volna ki a valós 81,3
 *    helyett — ezért van a `(?!')` védelem a méret-parseben.
 */
import type { SourceRecipe } from "./index.ts";

export const recipe: SourceRecipe = {
  name: "Indiana Paddle & Surf",
  baseUrl: "https://indiana-paddlesurf.com",
  kind: "brand_site",
  country: "EU",
  crawlConfig: {
      "notes": "F2.1 folytatás — inflatable/wave SUP-ok gazdag metrikus spec-cel; CHF-ár szándékosan nem HUF, priceHuf null marad",
      "sitemapUrl": "https://indiana-paddlesurf.com/pub/sitemap_b2c_en_ch.xml",
      "defaultBrandName": "Indiana",
      "excludeUrlPatterns": [
          "indiana-check-storeview",
          "indiana-impressum",
          "indiana-newsletter-signup",
          "indiana-paddle-surf-event-inscription-form",
          "indiana-partners",
          "indiana-terms-conditions"
      ],
      "productUrlPatterns": [
          "/en_ch/indiana-"
      ]
  },
};
