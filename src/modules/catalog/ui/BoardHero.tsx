/**
 * Deszka-adatlap hero: kép, vagy token-gradiens placeholder (petrol-család, a
 * design szerint). A „X% neked"-illeszkedés-badge az advisor (F1.6) — most nincs.
 *
 * A kép a `ProductImage` fix keretében ül (`hero` arány), ugyanazzal az
 * indoklással, mint a kártyáknál: az álló termékrendert nem szabad vágni.
 */
import { ProductImage } from "@core/ui";

export interface BoardHeroProps {
  modelName: string;
  imageUrl: string | null;
}

export function BoardHero({ modelName, imageUrl }: BoardHeroProps) {
  return (
    <ProductImage
      src={imageUrl}
      alt={modelName}
      frame="hero"
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
