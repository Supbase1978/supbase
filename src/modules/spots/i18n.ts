/**
 * A `spots` namespace regisztrációja a core i18n-regiszterbe (weather/i18n.ts
 * mintájára — lásd ott a bővebb indoklást). `hu` a forrás, `en` a tükör
 * (8. fejezet).
 */
import { registerNamespace } from "@core/i18n";

import huSpots from "./locales/hu/spots.json";
import enSpots from "./locales/en/spots.json";

export const SPOTS_NAMESPACE = "spots";

registerNamespace(SPOTS_NAMESPACE, "hu", huSpots);
registerNamespace(SPOTS_NAMESPACE, "en", enSpots);
