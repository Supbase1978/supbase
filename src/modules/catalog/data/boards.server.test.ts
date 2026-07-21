import { describe, expect, it } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getBoardBySlug, pickCheapestPerBoard } from "./boards.server";

describe("pickCheapestPerBoard", () => {
  it("üres tömbre üres Map-et ad", () => {
    expect(pickCheapestPerBoard([])).toEqual(new Map());
  });

  it("egy sor esetén az adott árat adja vissza a board_id kulcs alatt", () => {
    const map = pickCheapestPerBoard([{ board_id: "board-1", price_huf: 189000 }]);
    expect(map.size).toBe(1);
    expect(map.get("board-1")).toBe(189000);
  });

  it("több ár közül a legolcsóbbat tartja meg boardonként, sorrendtől függetlenül", () => {
    const map = pickCheapestPerBoard([
      { board_id: "board-1", price_huf: 209000 },
      { board_id: "board-1", price_huf: 189000 },
      { board_id: "board-1", price_huf: 199000 },
      { board_id: "board-2", price_huf: 159000 },
    ]);
    expect(map.size).toBe(2);
    expect(map.get("board-1")).toBe(189000);
    expect(map.get("board-2")).toBe(159000);
  });
});

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
