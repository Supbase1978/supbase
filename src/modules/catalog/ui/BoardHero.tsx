/**
 * Deszka-adatlap hero: kép, vagy token-gradiens placeholder (petrol-család, a
 * design szerint). A „X% neked"-illeszkedés-badge az advisor (F1.6) — most nincs.
 */
export interface BoardHeroProps {
  modelName: string;
  imageUrl: string | null;
}

export function BoardHero({ modelName, imageUrl }: BoardHeroProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={modelName}
        className="h-44 w-full rounded-[var(--radius-card)] object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className="h-44 w-full rounded-[var(--radius-card)]"
      style={{
        background: "linear-gradient(135deg, var(--ink-deep) 0%, var(--petrol) 55%, var(--mist) 100%)",
      }}
    />
  );
}
