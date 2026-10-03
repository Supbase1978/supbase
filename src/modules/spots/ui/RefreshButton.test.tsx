import type { ReactElement } from "react";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createI18n } from "@core/i18n";
// Namespace-regisztráció mellékhatása (a spots ns kelleni fog a createI18n-hez).
import "@modules/spots/i18n";

/**
 * A `useFetcher`/`useRevalidator` mockolva — a valódi react-router fetcher
 * `fetch()`-et hív, ami jsdom+vitest alatt (cross-realm `URLSearchParams`)
 * nem stabil; a komponens LOGIKÁJA (submit-hívás, állapot→szöveg leképezés,
 * revalidáció-ütemezés) a mockkal közvetlenül, router-infrastruktúra nélkül
 * tesztelhető.
 */
const hoisted = vi.hoisted(() => ({
  submit: vi.fn(),
  // `.mockResolvedValue`: a komponens a `revalidate()` Promise-ára `.then`-t
  // hív (a "Frissítve"-váltáshoz) — plain `vi.fn()` `undefined`-et adna,
  // amin a `.then` elhasalna.
  revalidate: vi.fn().mockResolvedValue(undefined),
  fetcher: { state: "idle" as "idle" | "submitting" | "loading", data: undefined as unknown },
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useFetcher: () => ({
      state: hoisted.fetcher.state,
      data: hoisted.fetcher.data,
      submit: hoisted.submit,
    }),
    useRevalidator: () => ({ revalidate: hoisted.revalidate, state: "idle" }),
  };
});

const { RefreshButton } = await import("./RefreshButton");

function withI18n(node: ReactElement) {
  return <I18nextProvider i18n={createI18n("hu")}>{node}</I18nextProvider>;
}

describe("RefreshButton", () => {
  beforeEach(() => {
    hoisted.submit.mockClear();
    hoisted.revalidate.mockClear();
    hoisted.fetcher.state = "idle";
    hoisted.fetcher.data = undefined;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("alapállapotban 'Frissítés most' feliratot mutat, üzenet nélkül", () => {
    render(withI18n(<RefreshButton slug="tihany" />));
    expect(screen.getByRole("button", { name: "Frissítés most" })).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("kattintásra az intent=refresh POST-ot küldi a spot /spotok/<slug> action-jére", () => {
    render(withI18n(<RefreshButton slug="tihany" />));
    fireEvent.click(screen.getByRole("button", { name: "Frissítés most" }));
    expect(hoisted.submit).toHaveBeenCalledWith(
      { intent: "refresh" },
      { method: "post", action: "/spotok/tihany" },
    );
  });

  it("küldés közben 'Frissítés…' feliratot mutat, letiltva és aria-busy", () => {
    hoisted.fetcher.state = "submitting";
    render(withI18n(<RefreshButton slug="tihany" />));
    const button = screen.getByRole("button", { name: "Frissítés…" });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it.each([
    ["queued", "Frissítés elindítva — pár másodperc"],
    ["fresh", "Az adat friss"],
    ["throttled", "Nemrég frissítettük — próbáld pár perc múlva"],
    ["not_found", "A frissítés most nem elérhető"],
    ["unavailable", "A frissítés most nem elérhető"],
  ] as const)("'%s' eredményre role=status üzenetet mutat", (result, expectedText) => {
    hoisted.fetcher.data = { refresh: result };
    render(withI18n(<RefreshButton slug="tihany" />));
    const status = screen.getByRole("status");
    expect(status.textContent).toBe(expectedText);
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("'queued' válasz után ~6 és ~15 másodperccel revalidál, legfeljebb kétszer", () => {
    vi.useFakeTimers();
    hoisted.fetcher.data = { refresh: "queued" };
    render(withI18n(<RefreshButton slug="tihany" />));

    expect(hoisted.revalidate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(6_000);
    expect(hoisted.revalidate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(9_000);
    expect(hoisted.revalidate).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(30_000);
    expect(hoisted.revalidate).toHaveBeenCalledTimes(2);
  });

  it("'queued' üzenet az ELSŐ revalidáció lezárásakor 'Frissítve' állapotra vált", async () => {
    vi.useFakeTimers();
    hoisted.fetcher.data = { refresh: "queued" };
    render(withI18n(<RefreshButton slug="tihany" />));

    expect(screen.getByText("Frissítés elindítva — pár másodperc")).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });

    expect(screen.queryByText("Frissítés elindítva — pár másodperc")).toBeNull();
    expect(screen.getByText("Frissítve")).not.toBeNull();
  });

  it("unmountkor törli az ütemezett revalidáció-timereket", () => {
    vi.useFakeTimers();
    hoisted.fetcher.data = { refresh: "queued" };
    const { unmount } = render(withI18n(<RefreshButton slug="tihany" />));
    unmount();
    vi.advanceTimersByTime(30_000);
    expect(hoisted.revalidate).not.toHaveBeenCalled();
  });
});
