import type { ReactElement } from "react";

import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it } from "vitest";

import { createI18n } from "@core/i18n";
// Namespace-regisztráció mellékhatása (a reviews ns kell a createI18n-hez).
import "@modules/reviews/i18n";

import { ReviewSummary } from "./ReviewSummary";

function withI18n(node: ReactElement) {
  return <I18nextProvider i18n={createI18n("hu")}>{node}</I18nextProvider>;
}

const FULL = {
  count: 12,
  overall: 4.6,
  overallTen: 9.2,
  percentRecommend: 92,
  verifiedCount: 7,
  dimensionsTen: { stability: 9.1, glide: 8.3, build: 7, value: 6 },
};

describe("ReviewSummary", () => {
  afterEach(() => cleanup());

  it("a cimben az evezo resz szinkiemelt spanban van (szojatek)", () => {
    const { container } = render(withI18n(<ReviewSummary {...FULL} />));
    const accent = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "evező",
    );
    expect(accent).toBeTruthy();
    expect(accent?.getAttribute("style") ?? "").toContain("--caution-text");
    // A teljes cím továbbra is „Közös nevező".
    expect(container.querySelector("h2")?.textContent).toBe("Közös nevező");
  });

  it("van-adat esetén: összesített átlag, %ajánlaná, dimenzió-nevek és -értékek", () => {
    render(withI18n(<ReviewSummary {...FULL} />));
    expect(screen.getByText("4,6")).toBeTruthy();
    expect(screen.getByText("92% ajánlaná")).toBeTruthy();
    expect(screen.getByText("7 hitelesített tulajdonos")).toBeTruthy();
    expect(screen.getByText("Stabilitás")).toBeTruthy();
    expect(screen.getByText("9,1")).toBeTruthy(); // stability /10
    expect(screen.getByText("6,0")).toBeTruthy(); // value /10
  });

  it("10 szegmenses RatingBar-ok jelennek meg (nem a biztonsági Gauge), danger nélkül", () => {
    const { container } = render(withI18n(<ReviewSummary {...FULL} />));
    const bars = container.querySelectorAll("div[role='img']");
    // 1 összesített + 4 dimenzió = 5 sáv, egyenként 10 szegmens.
    expect(bars.length).toBe(5);
    expect(container.innerHTML).not.toContain("bg-danger");
    expect(container.querySelector("[role='meter']")).toBeNull();
  });

  it("ures allapotban a meg nincs ertekeles uzenet jelenik meg", () => {
    render(
      withI18n(
        <ReviewSummary
          count={0}
          overall={null}
          overallTen={null}
          percentRecommend={0}
          verifiedCount={0}
          dimensionsTen={{ stability: null, glide: null, build: null, value: null }}
        />,
      ),
    );
    expect(screen.getByText(/még nincs értékelés/)).toBeTruthy();
  });
});
