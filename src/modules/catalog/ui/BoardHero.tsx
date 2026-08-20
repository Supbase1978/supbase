/**
 * Deszka-adatlap hero: kép, vagy token-gradiens placeholder (petrol-család, a
 * design szerint). A „X% neked"-illeszkedés-badge az advisor (F1.6) — most nincs.
 *
 * A képre koppintva TELJES KÉPERNYŐS nézet nyílik (`ProductGallery`,
 * F2.1-utó-30): a telefonos lista kétoszlopos, tehát a kártya-kép kicsi — a
 * részletet (orr-forma, fedélzet-rajz) itt lehet megnézni, és több kép esetén
 * legyintéssel váltani köztük.
 */
import { useTranslation } from "react-i18next";

import { ProductGallery } from "@core/ui";

export interface BoardHeroProps {
  modelName: string;
  imageUrl: string | null;
  /** További képek a teljes képernyős nézethez (`boards.images`). */
  images?: readonly string[];
}

export function BoardHero({ modelName, imageUrl, images = [] }: BoardHeroProps) {
  const { t } = useTranslation("catalog");

  return (
    <ProductGallery
      cover={imageUrl}
      images={images}
      modelName={modelName}
      frame="hero"
      labels={{
        open: t("gallery.open"),
        close: t("gallery.close"),
        previous: t("gallery.previous"),
        next: t("gallery.next"),
        position: t("gallery.position"),
      }}
      fallback={
        <div
          className="h-full w-full"
          style={{
            background:
              "linear-gradient(135deg, var(--ink-deep) 0%, var(--petrol) 55%, var(--mist) 100%)",
          }}
        />
      }
    />
  );
}
