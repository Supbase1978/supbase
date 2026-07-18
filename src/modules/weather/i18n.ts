/**
 * A `weather` namespace regisztrációja a core i18n-regiszterbe.
 *
 * A modulok a saját fordításaikat a core `registerNamespace`-én át csatolják be
 * (a core sosem függ modultól — csak fordítva). Ez a fájl import-időben,
 * mellékhatásként regisztrál, hogy a `createI18n` bundle-je tartalmazza a
 * `weather` kulcsokat. `hu` a forrás, `en` a tükör (8. fejezet).
 */
import { registerNamespace } from "@core/i18n";

import huWeather from "./locales/hu/weather.json";
import enWeather from "./locales/en/weather.json";

export const WEATHER_NAMESPACE = "weather";

registerNamespace(WEATHER_NAMESPACE, "hu", huWeather);
registerNamespace(WEATHER_NAMESPACE, "en", enWeather);
