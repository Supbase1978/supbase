/**
 * A `catalog` namespace regisztrációja a core i18n-regiszterbe (weather/spots
 * mintája). Import-időben, mellékhatásként regisztrál; `hu` a forrás, `en` a tükör.
 */
import { registerNamespace } from "@core/i18n";

import huCatalog from "./locales/hu/catalog.json";
import enCatalog from "./locales/en/catalog.json";

export const CATALOG_NAMESPACE = "catalog";

registerNamespace(CATALOG_NAMESPACE, "hu", huCatalog);
registerNamespace(CATALOG_NAMESPACE, "en", enCatalog);
