import { describe, expect, it } from "vitest";

import { renderReport } from "./cli.ts";

describe("renderReport", () => {
  it("a runnerről blokkolt forrást kézi teendőként, kész paranccsal listázza", () => {
    const report = renderReport(
      [
        { id: "vkt", url: "https://x", missing: [], error: null, skipped: null },
        { id: "desedaTo", url: "https://y", missing: [], error: null, skipped: "HTTP 403" },
      ],
      "2027-01-01",
    );
    expect(report).toContain("**0 eltérés**, **1 kézi ellenőrzést igényel**");
    expect(report).toContain("npm run sources:check -- --only desedaTo");
    expect(report).not.toContain("## Eltérések");
  });

  it("az eltérésnél megnevezi a hiányzó kifejezést és az érintett oldalt", () => {
    const report = renderReport(
      [{ id: "hsz", url: "https://z", missing: ["100 méter"], error: null, skipped: null }],
      "2027-01-01",
    );
    expect(report).toContain("## Eltérések");
    expect(report).toContain("„100 méter\"");
    expect(report).toContain("/alapinfo/balaton");
  });
});
