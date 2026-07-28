import { describe, expect, it } from "vitest";

import { summarize, type DailyCountRow } from "./analytics-query.server";

const rows: DailyCountRow[] = [
  { day: "2026-07-27", name: "page_view", events: 40 },
  { day: "2026-07-27", name: "advisor_wizard_view", events: 10 },
  { day: "2026-07-27", name: "advisor_result_view", events: 6 },
  { day: "2026-07-26", name: "page_view", events: 25 },
  { day: "2026-07-26", name: "advisor_wizard_view", events: 10 },
  { day: "2026-07-26", name: "advisor_result_view", events: 4 },
];

describe("summarize", () => {
  it("eseményenként összegez, a legnagyobb elöl", () => {
    expect(summarize(rows).totals).toEqual([
      { name: "page_view", events: 65 },
      { name: "advisor_wizard_view", events: 20 },
      { name: "advisor_result_view", events: 10 },
    ]);
  });

  it("napi bontást ad, a legfrissebb nappal elöl", () => {
    const { days } = summarize(rows);
    expect(days.map((d) => d.day)).toEqual(["2026-07-27", "2026-07-26"]);
    expect(days[0]).toMatchObject({ total: 56, byName: { page_view: 40 } });
  });

  it("a tölcsér-arány az eredmény/kérdőív hányados", () => {
    expect(summarize(rows).advisorConversion).toBeCloseTo(0.5);
  });

  it("kérdőív-megjelenés nélkül NEM oszt nullával", () => {
    const only = [{ day: "2026-07-27", name: "advisor_result_view", events: 3 }];
    expect(summarize(only).advisorConversion).toBeNull();
  });

  it("1 fölötti arány megengedett — a megosztott link egyből eredményt mutat", () => {
    const shared: DailyCountRow[] = [
      { day: "2026-07-27", name: "advisor_wizard_view", events: 2 },
      { day: "2026-07-27", name: "advisor_result_view", events: 5 },
    ];
    expect(summarize(shared).advisorConversion).toBeCloseTo(2.5);
  });

  it("üres bemenetre üres összegzés (nem dob)", () => {
    expect(summarize([])).toEqual({ totals: [], days: [], advisorConversion: null });
  });
});
