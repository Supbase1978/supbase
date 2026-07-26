/**
 * Vizuális regressziós harness — CSAK FEJLESZTŐI MÓDBAN (F1.10 audit-hiány).
 *
 * MIÉRT KELL KÜLÖN LAP: a valós oldalak ÉLŐ adatot renderelnek (SUP-index
 * óránként változik, a térkép aszinkron csempéket tölt) — azokról készült
 * képernyőkép óránként eltérne, és a teszt hamis riasztásokat adna. Itt a
 * token-kritikus komponensek FIX propokkal jelennek meg, tehát a kimenet
 * determinisztikus: bármilyen eltérés VALÓDI vizuális regresszió.
 *
 * PRODUKCIÓBAN 404: a loader `import.meta.env.DEV` nélkül nem szolgál ki
 * semmit, így ez a felület nem kerül ki az éles oldalra.
 *
 * A lefedett komponensek a FEJLESZTESI_DOKUMENTACIO 10. fejezetének „vizuális"
 * kapujából jönnek: vízfelszín-vonal · vízmérce · riasztás — kiegészítve a
 * státusz-jelvénnyel, az értékelő-sávval és a gombokkal (ezek hordozzák a
 * token-szabályokat: szín+ikon+szöveg, danger-tiltás, amber CTA sötét felirattal).
 */
import { useSearchParams } from "react-router";

import { Button, Gauge, LoadingWave, RatingBar, StatusBadge, Waterline } from "@core/ui";
import { StormAlertScreen } from "@modules/spots/ui/StormAlertScreen";

import type { Route } from "./+types/dev.vizualis";

export async function loader() {
  if (!import.meta.env.DEV) {
    throw new Response("Not Found", { status: 404 });
  }
  return null;
}

export const meta: Route.MetaFunction = () => [
  { title: "Vizuális harness (dev)" },
  { name: "robots", content: "noindex, nofollow" },
];

/** Egy blokk stabil `id`-vel — a teszt ez alapján készít elem-képernyőképet. */
function Case({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-bold tracking-wide text-text-3 uppercase">{title}</h2>
      <div
        id={id}
        className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4"
      >
        {children}
      </div>
    </section>
  );
}

/**
 * FIX időbélyeg a riasztás-képernyőhöz. A komponens ABSZOLÚT időt formáz
 * (ÓÓ:PP), nem relatívat — fix bemenettel és fix időzónával (a Playwright
 * `Europe/Budapest`-et állít) a kimenet determinisztikus.
 */
const FIXED_UPDATED_AT = "2026-07-26T12:34:00.000Z";

export default function VisualHarnessRoute() {
  // A riasztás-képernyő `fixed inset-0`, tehát elfedné a galériát — külön
  // nézetben jelenik meg (`?riasztas=1`), így önállóan képernyőképezhető.
  const [params] = useSearchParams();
  if (params.get("riasztas") === "1") {
    return (
      <StormAlertScreen
        spotName="Balatonföldvár"
        source="met.hu / BM OKF"
        updatedAt={FIXED_UPDATED_AT}
        gustKmh={78}
      />
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-ink-deep">Vizuális harness</h1>

      {/* Vízfelszín-vonal: állapotonként ELTÉRŐ geometria (színtévesztő-biztos),
          a stale szaggatott. Pont ezt kell a képernyőképnek rögzítenie. */}
      <Case id="vis-waterline" title="Vízfelszín-vonal — 4 állapot">
        <Waterline state="calm" label="Nyugodt" />
        <Waterline state="choppy" label="Fodrozódó" />
        <Waterline state="broken" label="Töredezett" />
        <Waterline state="stale" label="Elavult adat" />
      </Case>

      {/* Vízmérce: 10 szegmens, küszöb-alapú szín, stale = csíkozott. */}
      <Case id="vis-gauge" title="Vízmérce — értékek és elavult állapot">
        <Gauge value={9.2} label="SUP-index 9,2" />
        <Gauge value={5.0} label="SUP-index 5,0" />
        <Gauge value={2.1} label="SUP-index 2,1" />
        <Gauge value={0} label="SUP-index 0,0" />
        <Gauge value={7.4} label="SUP-index 7,4 — elavult" stale />
      </Case>

      {/* Státusz-jelvény: MINDIG szín + ikon + szöveg. */}
      <Case id="vis-statusbadge" title="Státusz-jelvény — szín + ikon + szöveg">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="safe" label="Kiváló · 9,2" />
          <StatusBadge status="caution" label="Óvatosan · 5,0" />
          <StatusBadge status="danger" label="Veszélyes · 2,1" />
          <StatusBadge status="stale" label="Elavult adat" />
        </div>
      </Case>

      {/* Értékelő-sáv: NEM a biztonsági Gauge, danger SOHA. */}
      <Case id="vis-ratingbar" title="Értékelő-sáv (Közös nevező)">
        <RatingBar value={9.1} size="lg" ariaLabel="Összesített 9,1" />
        <RatingBar value={6.4} ariaLabel="Siklás 6,4" />
        <RatingBar value={null} ariaLabel="Nincs adat" />
      </Case>

      {/* Gombok: amber CTA MINDIG sötét felirattal; danger-variáns nem létezik. */}
      <Case id="vis-buttons" title="Gombok">
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Elsődleges CTA</Button>
          <Button variant="secondary">Másodlagos</Button>
          <Button variant="ghost">Kontúros</Button>
          <Button variant="primary" disabled>
            Letiltott
          </Button>
        </div>
      </Case>

      <Case id="vis-loadingwave" title="Betöltés-jelző">
        <LoadingWave label="Térkép betöltése…" />
      </Case>
    </main>
  );
}
