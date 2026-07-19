/**
 * A `reviews` namespace regisztrációja a core i18n-regiszterbe. Import-időben,
 * mellékhatásként regisztrál; `hu` a forrás, `en` a tükör.
 */
import { registerNamespace } from "@core/i18n";

import huReviews from "./locales/hu/reviews.json";
import enReviews from "./locales/en/reviews.json";

export const REVIEWS_NAMESPACE = "reviews";

registerNamespace(REVIEWS_NAMESPACE, "hu", huReviews);
registerNamespace(REVIEWS_NAMESPACE, "en", enReviews);
