import { describe, expect, it } from "vitest";

import {
  MESSAGE_MAX_LENGTH,
  isFeedbackKind,
  isFeedbackStatus,
  sanitizePagePath,
  validateFeedbackInput,
} from "./feedback.server";

describe("validateFeedbackInput", () => {
  it("elfogadja az érvényes beküldést és trimmel", () => {
    expect(
      validateFeedbackInput({ kind: "shop", message: "  Hiányzik a helyi SUP-bolt.  " }),
    ).toEqual({ ok: true, kind: "shop", message: "Hiányzik a helyi SUP-bolt." });
  });

  it("a túl rövid üzenetet elutasítja (a whitespace nem számít bele)", () => {
    expect(validateFeedbackInput({ kind: "bug", message: "   hiba   " })).toEqual({
      ok: false,
      errorKey: "tooShort",
    });
  });

  it("a túl hosszú üzenetet elutasítja", () => {
    expect(
      validateFeedbackInput({ kind: "bug", message: "a".repeat(MESSAGE_MAX_LENGTH + 1) }),
    ).toEqual({ ok: false, errorKey: "tooLong" });
  });

  it("ismeretlen típust elutasít (a DB-kényszer a védőháló)", () => {
    expect(validateFeedbackInput({ kind: "spam", message: "Elég hosszú üzenet ide." })).toEqual({
      ok: false,
      errorKey: "invalidKind",
    });
  });
});

describe("sanitizePagePath", () => {
  it.each([
    ["/deszkak/aqua-marina-vapor", "/deszkak/aqua-marina-vapor"],
    // A query-t ELDOBJUK: a deszkaválasztó linkje testsúlyt és magasságot visz.
    ["/deszkavalaszto?weight=85&height=180", "/deszkavalaszto"],
    ["/spotok/balatonfoldvar#terkep", "/spotok/balatonfoldvar"],
    ["https://kulso.hu/oldal", null],
    ["nem-abszolut-ut", null],
    [null, null],
    [undefined, null],
  ])("%s → %s", (input, expected) => {
    expect(sanitizePagePath(input)).toBe(expected);
  });

  it("a túl hosszú utat elutasítja (a DB-kényszer tükre)", () => {
    expect(sanitizePagePath(`/${"a".repeat(200)}`)).toBeNull();
  });
});

describe("típus-őrök", () => {
  it("felismeri az érvényes értékeket", () => {
    expect(isFeedbackKind("board")).toBe(true);
    expect(isFeedbackKind("valami")).toBe(false);
    expect(isFeedbackStatus("in_progress")).toBe(true);
    expect(isFeedbackStatus("kesz")).toBe(false);
  });
});
