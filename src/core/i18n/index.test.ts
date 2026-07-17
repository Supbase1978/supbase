import { describe, expect, it } from "vitest";

import { createI18n, registerNamespace } from "./index";

describe("createI18n", () => {
  it("translates the core namespace in hu", () => {
    const i18n = createI18n("hu");
    expect(i18n.t("core:status.safe")).toBe("Biztonságos");
  });

  it("translates the core namespace in en", () => {
    const i18n = createI18n("en");
    expect(i18n.t("core:status.safe")).toBe("Safe");
  });

  it("falls back to hu when an en key is missing", () => {
    registerNamespace("test-ns-fallback", "hu", { greeting: "Szia" });

    const i18n = createI18n("en");
    expect(i18n.t("test-ns-fallback:greeting")).toBe("Szia");
  });

  it("registered namespaces are usable for both locales once present", () => {
    registerNamespace("test-ns-both", "hu", { greeting: "Szia" });
    registerNamespace("test-ns-both", "en", { greeting: "Hi" });

    const hu = createI18n("hu");
    const en = createI18n("en");
    expect(hu.t("test-ns-both:greeting")).toBe("Szia");
    expect(en.t("test-ns-both:greeting")).toBe("Hi");
  });

  it("creates independent instances per call (SSR: no shared mutable language state)", () => {
    const hu = createI18n("hu");
    const en = createI18n("en");
    expect(hu.language).toBe("hu");
    expect(en.language).toBe("en");
  });
});
