import type { ComponentProps } from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WaterLevel } from "./WaterLevel";

type Props = ComponentProps<typeof WaterLevel>;

const LABELS: Props["labels"] = {
  title: "Vízállás",
  level: "A folyó vízállása a hozzárendelt vízmércén.",
  trend: { rising: "emelkedik", falling: "apad", stable: "változatlan" },
  alert: {
    1: "I. fokú árvízi készültség",
    2: "II. fokú árvízi készültség",
    3: "III. fokú árvízi készültség",
  },
  observed: "Mérve: 13:00",
  stale: false,
};

function renderWaterLevel(props: Partial<Props> = {}) {
  return render(
    <WaterLevel
      levelCm={207}
      trend="rising"
      alertLevel={0}
      observedAt="2026-07-27T13:00:00Z"
      labels={LABELS}
      {...props}
    />,
  );
}

describe("WaterLevel", () => {
  afterEach(() => {
    cleanup();
  });

  it("a vízállást és a tendenciát SZÖVEGGEL is közli, nem csak nyíllal", () => {
    renderWaterLevel();
    expect(screen.getByText(/207 cm/)).toBeTruthy();
    expect(screen.getByText(/emelkedik/)).toBeTruthy();
  });

  it("készültség nélkül NINCS státusz-jelvény (a 0. fok nem riasztás)", () => {
    const { container } = renderWaterLevel({ alertLevel: 0 });
    expect(container.textContent).not.toContain("árvízi készültség");
  });

  it("nincs jelvény akkor sem, ha a fokozat ISMERETLEN (null) — nem találunk ki nyugalmat", () => {
    const { container } = renderWaterLevel({ alertLevel: null });
    expect(container.textContent).not.toContain("árvízi készültség");
    // A mért vízállás ettől még látszik: az adat megvan, csak a küszöb hiányzik.
    expect(screen.getByText(/207 cm/)).toBeTruthy();
  });

  it.each([
    [1 as const, "I. fokú árvízi készültség"],
    [2 as const, "II. fokú árvízi készültség"],
    [3 as const, "III. fokú árvízi készültség"],
  ])("a %i. fok látható, feliratos jelvényt kap", (level, label) => {
    renderWaterLevel({ alertLevel: level });
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("a jelvény SOHA nem csak színnel jelöl: ikon + felirat is van (2. fejezet 3.)", () => {
    const { container } = renderWaterLevel({ alertLevel: 2 });
    const badge = screen.getByText("II. fokú árvízi készültség").parentElement;
    expect(badge?.querySelector("svg")).toBeTruthy();
    // A danger-családú szín csak HÁTTÉRKÉNT/szövegszínként jelenik meg,
    // interakciós elemen tilos — itt nincs is gomb/link a blokkban.
    expect(container.querySelector("a, button")).toBeNull();
  });

  it("a mérés SAJÁT időbélyegét mutatja (a mércék óránként jelentenek)", () => {
    renderWaterLevel();
    expect(screen.getByText("Mérve: 13:00")).toBeTruthy();
  });

  it("időbélyeg nélkül nem jelenik meg üres adatkor-jelzés", () => {
    const { container } = renderWaterLevel({ observedAt: null });
    expect(container.textContent).not.toContain("Mérve");
  });
});
