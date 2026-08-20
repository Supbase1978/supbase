import type { ReactNode } from "react";

import { cx } from "./cx";

export type ProductImageFrame = "card" | "hero";

export interface ProductImageProps {
  src: string | null;
  /** Kötelező alt-szöveg: a terméknév. Dekoratív kép itt nem fordulhat elő. */
  alt: string;
  frame?: ProductImageFrame;
  /**
   * Kép hiányában ebbe a keretbe kerül — a modul saját placeholderje (a
   * deszka-adatlap például petrol-gradienst használ). Üresen hagyva a semleges
   * `--mist` felület marad.
   */
  fallback?: ReactNode;
  className?: string;
}

/**
 * Termékkép RÖGZÍTETT KERETBEN — a katalógus képi egységességének a helye.
 *
 * MIÉRT NEM `object-cover` (élesben mért kár): a gyártói termékrenderek erősen
 * ÁLLÓ képek (a SUP-deszka front/back nézete tipikusan 470×1000 px), a bolti
 * életképek viszont fekvők (1024×683). Egy alacsony, `object-cover`-rel vágott
 * sávban az álló render közepe marad csak — vagyis minden deszkából ugyanaz a
 * felismerhetetlen színes csík lesz, épp az az információ vész el (orr-forma,
 * fedélzet-rajz, arány), ami alapján a véleményező a modellek között eligazodna.
 *
 * A megoldás: FIX oldalarányú keret + `object-contain`. A keret mérete minden
 * kártyán azonos (ez az „egységes méret"), a kép pedig teljes egészében,
 * torzítás nélkül látszik benne. Ami kimarad, azt a semleges `--mist` felület
 * tölti ki — szándékos, nyugodt passepartout, nem üres lyuk.
 *
 * A forrás-oldali párja a `findProductImage` front/back-preferenciája: azonos
 * beállítású gyártói renderek EGYMÁS MELLETT valóban összevethetők.
 */
export function ProductImage({
  src,
  alt,
  frame = "card",
  fallback,
  className,
}: ProductImageProps) {
  const frameClasses = cx(
    "w-full overflow-hidden rounded-[var(--radius-card)] bg-mist",
    frame === "card" ? "aspect-square" : "aspect-[3/2]",
    className,
  );

  if (!src) {
    return (
      <div className={frameClasses} aria-hidden="true">
        {fallback}
      </div>
    );
  }

  return (
    <div className={frameClasses}>
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-contain" />
    </div>
  );
}
