/**
 * Locale-helyes `t` az auth-oldalakhoz. A root Layout I18nextProvider-éből
 * jövő, kérésenként/locale-onként létrehozott példányra köt (nem gyárt saját
 * i18next-példányt) — a `core` namespace-re szűkítve.
 */
import { useTranslation } from "react-i18next";

export function useAuthT() {
  return useTranslation("core").t;
}
