import { describe, expect, it } from "vitest";

import { pickTranslated } from "./translated";

describe("pickTranslated", () => {
  it("returns the requested locale when present", () => {
    expect(pickTranslated({ hu: "Vándor", en: "Wanderer" }, "en")).toBe("Wanderer");
  });

  it("falls back to hu when the requested locale is missing", () => {
    expect(pickTranslated({ hu: "Vándor" }, "en")).toBe("Vándor");
  });

  it("falls back to the first available value when hu is also missing", () => {
    expect(pickTranslated({ en: "Wanderer" } as Record<string, string>, "hu")).toBe("Wanderer");
  });

  it("returns an empty string for null/undefined fields", () => {
    expect(pickTranslated(null, "hu")).toBe("");
    expect(pickTranslated(undefined, "hu")).toBe("");
  });

  it("returns an empty string when nothing is available", () => {
    expect(pickTranslated({}, "hu")).toBe("");
  });
});
