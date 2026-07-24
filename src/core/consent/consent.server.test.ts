import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { REQUIRED_CONSENT_KINDS } from "./config";
import {
  getMissingRequiredConsents,
  hasMissingRequiredConsents,
} from "./consent.server";

/** Minimál Supabase-mock: from().select().eq().eq().in() → {data,error}. */
function mockSupabase(
  data: { kind: string }[] | null,
  error: unknown = null,
): SupabaseClient {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => Promise.resolve({ data, error }),
  };
  return { from: () => builder } as unknown as SupabaseClient;
}

describe("getMissingRequiredConsents", () => {
  it("üres napló → minden kötelező fajta hiányzik", async () => {
    const missing = await getMissingRequiredConsents(mockSupabase([]), "u1");
    expect(missing).toEqual([...REQUIRED_CONSENT_KINDS]);
  });

  it("csak terms megvan → privacy hiányzik", async () => {
    const missing = await getMissingRequiredConsents(mockSupabase([{ kind: "terms" }]), "u1");
    expect(missing).toEqual(["privacy"]);
  });

  it("mindkét kötelező megvan → nincs hiányzó", async () => {
    const missing = await getMissingRequiredConsents(
      mockSupabase([{ kind: "terms" }, { kind: "privacy" }]),
      "u1",
    );
    expect(missing).toEqual([]);
  });

  it("lekérdezési hiba → fail-safe üres tömb (nem blokkol)", async () => {
    const missing = await getMissingRequiredConsents(mockSupabase(null, { message: "boom" }), "u1");
    expect(missing).toEqual([]);
  });
});

describe("hasMissingRequiredConsents", () => {
  it("true, ha van hiányzó; false, ha nincs", async () => {
    expect(await hasMissingRequiredConsents(mockSupabase([]), "u1")).toBe(true);
    expect(
      await hasMissingRequiredConsents(
        mockSupabase([{ kind: "terms" }, { kind: "privacy" }]),
        "u1",
      ),
    ).toBe(false);
  });
});
