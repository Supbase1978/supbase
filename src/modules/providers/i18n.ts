/**
 * A `providers` namespace regisztrációja a core i18n-regiszterbe (catalog/spots
 * mintája). Import-időben, mellékhatásként regisztrál; `hu` a forrás, `en` a tükör.
 */
import { registerNamespace } from "@core/i18n";

import huProviders from "./locales/hu/providers.json";
import enProviders from "./locales/en/providers.json";

export const PROVIDERS_NAMESPACE = "providers";

registerNamespace(PROVIDERS_NAMESPACE, "hu", huProviders);
registerNamespace(PROVIDERS_NAMESPACE, "en", enProviders);
