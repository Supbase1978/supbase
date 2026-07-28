/**
 * Kontextusból induló visszajelzés-hívás (F2.2).
 *
 * A lábléc-link mindig ott van, de a javaslat AKKOR jut eszébe a
 * felhasználónak, amikor épp hiányol valamit — ezért a listaoldalak alján egy
 * célzott mondat, ami előválasztott témával nyitja az űrlapot.
 *
 * Diszkrét, nem CTA: nem versenyez az oldal valódi műveleteivel.
 */
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { FeedbackKind } from "./feedback.server";

export function FeedbackPrompt({ kind, path }: { kind: FeedbackKind; path: string }) {
  const { t } = useTranslation("core");
  const href = `/visszajelzes?tema=${kind}&ut=${encodeURIComponent(path)}`;

  return (
    <p className="mt-6 text-sm text-text-3">
      {t(`feedback.prompt.${kind}`)}{" "}
      <Link to={href} className="text-petrol underline">
        {t("feedback.prompt.cta")}
      </Link>
    </p>
  );
}

export default FeedbackPrompt;
