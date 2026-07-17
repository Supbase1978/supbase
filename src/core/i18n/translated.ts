/**
 * Fordítható jsonb-tartalmi mezők (pl. `boards.description`,
 * `spots.slug`) kliens-oldali kiválasztó helpere. Fallback-lánc:
 * kért locale → `defaultLocale` (hu) → az első elérhető érték.
 */
import { defaultLocale, type Locale } from "./config";

export function pickTranslated(
  field: Record<string, string> | null | undefined,
  locale: Locale,
): string {
  if (!field) {
    return "";
  }
  const direct = field[locale];
  if (direct) {
    return direct;
  }
  const fallback = field[defaultLocale];
  if (fallback) {
    return fallback;
  }
  for (const value of Object.values(field)) {
    if (value) {
      return value;
    }
  }
  return "";
}
