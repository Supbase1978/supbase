import { describe, expect, it } from "vitest";

import { isEmailConfirmed } from "./email-confirmed";

describe("isEmailConfirmed", () => {
  it("null/undefined user → false", () => {
    expect(isEmailConfirmed(null)).toBe(false);
    expect(isEmailConfirmed(undefined)).toBe(false);
  });

  it("hiányzó email_confirmed_at → false (megerősítetlen, csak böngészhet)", () => {
    expect(isEmailConfirmed({ email_confirmed_at: undefined })).toBe(false);
    expect(isEmailConfirmed({})).toBe(false);
  });

  it("kitöltött email_confirmed_at → true (írhat)", () => {
    expect(isEmailConfirmed({ email_confirmed_at: "2026-07-17T10:00:00Z" })).toBe(true);
  });

  it("üres string timestamp → false (nem tekintjük megerősítettnek)", () => {
    expect(isEmailConfirmed({ email_confirmed_at: "" })).toBe(false);
  });
});
