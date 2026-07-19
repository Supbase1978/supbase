import { describe, expect, it } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getBoardBySlug } from "./boards.server";

describe("getBoardBySlug — slug-alak guard", () => {
  // Érvénytelen alakú slugnál a kliens-hívás ELŐTT tér vissza null-lal — a
  // dummy kliens dobna, ha mégis elérné a .from()-ot.
  const throwingClient = new Proxy(
    {},
    {
      get() {
        throw new Error("a supabase-kliens nem hívható érvénytelen slugnál");
      },
    },
  ) as SupabaseClient;

  it.each([
    "x,id.eq.00000000-0000-0000-0000-000000000000", // PostgREST .or() szűrő-injektálás
    "a)b(c",
    "Red-Paddle", // nagybetű — nem slug-alak
    "",
  ])("érvénytelen slugra (%j) null, kliens-hívás nélkül", async (slug) => {
    await expect(getBoardBySlug(throwingClient, slug)).resolves.toBeNull();
  });
});
