/**
 * „Források" blokk — a spot- és az `/alapinfo`-oldal alján. Minden állításunk
 * elsődleges forrását mutatja (`src/modules/spots/sources.ts`), hogy a
 * felhasználó maga is ellenőrizhesse, és lássa, mikor néztük meg utoljára.
 *
 * Nem státusz-jelzés: semleges kártya, a biztonsági tokenekhez nem nyúl.
 * A linkek külső oldalra, új lapon nyílnak (`noopener noreferrer`); az új lap
 * tényét a képernyőolvasó is megkapja (`labels.newTab`).
 */

export interface SourceListItem {
  id: string;
  url: string;
  title: string;
  /** Feloldott felirat, pl. „megtekintve: 2026. szept. 26." */
  reviewed: string;
}

export interface SourceListProps {
  items: readonly SourceListItem[];
  /** Feloldott feliratok (i18n a route-rétegből, hardcode tilos). */
  labels: {
    title: string;
    hint: string;
    newTab: string;
  };
}

export function SourceList({ items, labels }: SourceListProps) {
  if (items.length === 0) return null;
  return (
    <section
      aria-label={labels.title}
      className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4"
    >
      <h2 className="text-lg font-semibold text-ink-deep">{labels.title}</h2>
      <p className="text-sm text-text-2">{labels.hint}</p>
      <ul className="flex flex-col gap-2 text-sm">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-petrol-text underline"
            >
              {item.title}
              <span className="sr-only"> ({labels.newTab})</span>
            </a>
            <span className="text-xs text-text-3">{item.reviewed}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
