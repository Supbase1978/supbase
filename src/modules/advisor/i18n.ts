/**
 * Az `advisor` namespace regisztrációja a core i18n-regiszterbe.
 *
 * A modulok a saját fordításaikat a core `registerNamespace`-én át csatolják be
 * (a core sosem függ modultól — csak fordítva). Ez a fájl import-időben,
 * mellékhatásként regisztrál, hogy a `createI18n` bundle-je tartalmazza az
 * `advisor` kulcsokat. `hu` a forrás, `en` a tükör (8. fejezet).
 */
import { registerNamespace } from "@core/i18n";

import huAdvisor from "./locales/hu/advisor.json";
import enAdvisor from "./locales/en/advisor.json";

export const ADVISOR_NAMESPACE = "advisor";

registerNamespace(ADVISOR_NAMESPACE, "hu", huAdvisor);
registerNamespace(ADVISOR_NAMESPACE, "en", enAdvisor);
