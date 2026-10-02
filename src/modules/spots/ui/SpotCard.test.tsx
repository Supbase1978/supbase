import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it } from "vitest";
import { createRoutesStub } from "react-router";

import { createI18n } from "@core/i18n";
// Namespace-regisztráció mellékhatása (a spots ns kelleni fog a createI18n-hez).
import "@modules/spots/i18n";

import { SpotCard, type SpotCardEvaluation, type SpotCardSpot } from "./SpotCard";

afterEach(cleanup);

const SPOT: SpotCardSpot = {
  id: "1",
  name: "Tihany",
  slug: "tihany",
  region: "Balaton",
  waterType: "to",
  difficulty: "konnyu",
};

function baseEvaluation(overrides: Partial<SpotCardEvaluation> = {}): SpotCardEvaluation {
  return {
    index: 10,
    status: "safe",
    stale: false,
    fetchedAt: new Date().toISOString(),
    flags: { offshoreWind: false, neoprene: false },
    ...overrides,
  };
}

function renderCard(evaluation: SpotCardEvaluation | null) {
  const Stub = createRoutesStub([
    {
      path: "/spotok/:slug",
      Component: () => (
        <I18nextProvider i18n={createI18n("hu")}>
          <SpotCard spot={SPOT} evaluation={evaluation} />
        </I18nextProvider>
      ),
    },
  ]);
  return render(<Stub initialEntries={["/spotok/tihany"]} />);
}

describe("SpotCard — fejléc-jelvény", () => {
  it("friss adatnál a jelvény a státuszt és az indexet mutatja", () => {
    renderCard(baseEvaluation());
    expect(screen.getByText("Kiváló · 10,0")).toBeTruthy();
  });

  it("elavult adatnál a jelvény 'Utolsó mérés: …' feliratot mutat, a státuszszó NÉLKÜL", () => {
    renderCard(baseEvaluation({ stale: true, fetchedAt: "2026-01-01T00:00:00.000Z" }));
    expect(screen.getByText("Utolsó mérés: 10,0")).toBeTruthy();
    expect(screen.queryByText(/Kiváló/)).toBeNull();
  });

  it("elavult + forbidden esetén múlt időben, 'Utolsó mérés: Tilos' jelvénnyel jelenik meg", () => {
    renderCard(
      baseEvaluation({
        status: "forbidden",
        stale: true,
        fetchedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    expect(screen.getByText("Utolsó mérés: Tilos")).toBeTruthy();
    expect(screen.queryByText(/Tilos ·/)).toBeNull();
  });

  it("friss forbidden esetén a 'Tilos' szó MEGJELENIK (nincs gyengítve)", () => {
    renderCard(baseEvaluation({ status: "forbidden" }));
    expect(screen.getByText("Tilos · 10,0")).toBeTruthy();
  });

  it("elavult adatnál a kártya alsó kor-címkéje változatlan marad ('Elavult adat · …')", () => {
    renderCard(baseEvaluation({ stale: true, fetchedAt: "2026-01-01T00:00:00.000Z" }));
    expect(screen.getByText(/^Elavult adat ·/)).toBeTruthy();
  });

  it("nincs kiértékelés esetén nem jelenik meg jelvény", () => {
    renderCard(null);
    expect(screen.queryByText(/Kiváló|Tilos|Utolsó mérés/)).toBeNull();
  });
});
