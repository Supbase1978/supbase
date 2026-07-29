/**
 * ŐRSZEM-TESZT: a Deszkaválasztó SOHA nem kaphat kiegészítőt (F2.3 2. szakasz).
 *
 * A `boards` tábla a `kind` diszkriminátor óta KÉT dolgot hordoz: deszkát
 * (`kind='board'`) és felszerelést (`kind='accessory'`). A séma alak-kényszere
 * (`boards_kind_shape`) csak azt garantálja, hogy a két SOR-alak ne keveredjen —
 * azt NEM, hogy a lekérdezés szűr. Ha egyetlen olvasásból kimarad a
 * `kind='board'` szűrő, a Deszkaválasztó evezőt ajánlhat deszkaként (a
 * pontozás null-térfogatú, null-szélességű sorral dolgozna), a `/deszkak` lista
 * pedig fél mezős kártyákat rajzolna.
 *
 * A teszt a ROUTE-rétegben él, a `deszkavalaszto.dimensions.test.ts` mintájára:
 * itt találkozik a katalógus-adatréteg a Deszkaválasztóval (`loader` →
 * `listBoards` → `BoardForAdvisor`).
 *
 * Két, egymást kiegészítő fogás:
 *   1. VISELKEDÉS — a `listBoards`/`getBoardBySlug` egy vegyes sorhalmazból
 *      tényleg csak a deszkákat adja vissza (a szűrőt alkalmazó ál-kliens).
 *   2. LEFEDETTSÉG — a `boards` táblát olvasó MINDEN adatréteg-lekérdezésben
 *      ott a szűrő, és egyetlen route sem kérdezi le a táblát közvetlenül.
 *      Ez fogja meg a JÖVŐBELI, ma még meg nem írt lekérdezést is.
 *
 * A lefedettség-ellenőrzés MINDKÉT kind-értéket elfogadja (`board` VAGY
 * `accessory`) — a felszerelés-adatréteg (`getAccessoryBySlug`, `listAccessories`,
 * F2.3 2. szakasz) szándékosan `kind='accessory'`-ra szűr. Az invariáns nem az,
 * hogy csak deszkát lehet lekérdezni, hanem hogy EGYETLEN lekérdezés se maradjon
 * kind-szűrő NÉLKÜL — ezt a mutációs próba (a szűrő kivétele) igazolja.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  getAccessoryBySlug,
  getBoardBySlug,
  listAccessories,
  listBoards,
} from "@modules/catalog/data/boards.server";

// ---------------------------------------------------------------------------
// 1. Viselkedés — ál-kliens, ami TÉNYLEG alkalmazza az `.eq()` szűrőket
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

/** Vegyes katalógus: 1 deszka + 1 kiegészítő, azonos alakú sorokként. */
const MIXED_ROWS: Row[] = [
  {
    id: "board-1",
    kind: "board",
    model_name: "Ride 10'6",
    board_type: "allround",
    accessory_type: null,
    slug: { hu: "red-paddle-ride", en: "red-paddle-ride" },
  },
  {
    id: "accessory-1",
    kind: "accessory",
    model_name: "Alu evező",
    board_type: null,
    accessory_type: "evezo",
    slug: { hu: "alu-evezo", en: "alu-paddle" },
  },
];

/** Oszlop-hivatkozás feloldása, a `slug->>hu` jsonb-alakot is értve. */
function columnValue(row: Row, column: string): unknown {
  const parts = column.split("->>");
  const base = parts[0] ?? column;
  const key = parts[1];
  if (key === undefined) return row[base];
  return (row[base] as Record<string, unknown> | undefined)?.[key];
}

/**
 * Minimális PostgREST-utánzat: az `.eq()` és az `.or("a.eq.x,b.eq.y")` szűrők
 * halmozódnak, és a `then`-nél TÉNYLEGESEN szűrnek. Így ha a kód a `kind`
 * szűrőt elhagyná, a kiegészítő SOR ÁTJÖNNE, és a teszt elhasal.
 */
function filteringClient(rows: Row[]): SupabaseClient {
  const from = () => {
    const predicates: ((row: Row) => boolean)[] = [];
    const result = () => rows.filter((row) => predicates.every((match) => match(row)));
    const builder = {
      select: () => builder,
      order: () => builder,
      limit: () => builder,
      or: (expression: string) => {
        const branches = expression.split(",").map((branch) => {
          const parts = branch.split(".");
          const column = parts[0] ?? branch;
          const value = parts[2];
          return (row: Row) => columnValue(row, column) === value;
        });
        predicates.push((row) => branches.some((match) => match(row)));
        return builder;
      },
      eq: (column: string, value: unknown) => {
        predicates.push((row) => columnValue(row, column) === value);
        return builder;
      },
      maybeSingle: () => ({
        then: (resolve: (value: { data: Row | null; error: null }) => unknown) =>
          Promise.resolve({ data: result()[0] ?? null, error: null }).then(resolve),
      }),
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
        Promise.resolve({ data: result(), error: null }).then(resolve),
    };
    return builder;
  };
  return { from } as unknown as SupabaseClient;
}

describe("a Deszkaválasztó bemenete csak deszka lehet", () => {
  it("a listBoards vegyes katalógusból CSAK a kind='board' sorokat adja vissza", async () => {
    const boards = await listBoards(filteringClient(MIXED_ROWS));
    expect(boards).toHaveLength(1);
    expect(boards[0]?.id).toBe("board-1");
    // A tényleges invariáns, kimondva: egyetlen kiegészítő sem szivároghat át.
    expect(boards.some((board) => board.kind !== "board")).toBe(false);
  });

  it("a listBoards üres katalógusból üres listát ad (nem esik szét)", async () => {
    await expect(listBoards(filteringClient([]))).resolves.toEqual([]);
  });

  it("a getBoardBySlug egy kiegészítő slugjára null-t ad (a /deszkak adatlap 404-el)", async () => {
    await expect(getBoardBySlug(filteringClient(MIXED_ROWS), "alu-evezo")).resolves.toBeNull();
  });

  it("a getBoardBySlug egy deszka slugjára megtalálja a sort", async () => {
    const board = await getBoardBySlug(filteringClient(MIXED_ROWS), "red-paddle-ride");
    expect(board?.id).toBe("board-1");
  });

  it("a listAccessories vegyes katalógusból CSAK a kind='accessory' sorokat adja vissza", async () => {
    const accessories = await listAccessories(filteringClient(MIXED_ROWS));
    expect(accessories).toHaveLength(1);
    expect(accessories[0]?.id).toBe("accessory-1");
  });

  it("a listAccessories kategória-szűrővel csak az adott kategóriát adja vissza", async () => {
    const rowsWithTwoCategories: Row[] = [
      ...MIXED_ROWS,
      {
        id: "accessory-2",
        kind: "accessory",
        model_name: "Mentőmellény L",
        board_type: null,
        accessory_type: "mentomelleny",
        slug: { hu: "mentomelleny-l", en: "pfd-l" },
      },
    ];
    const evezok = await listAccessories(filteringClient(rowsWithTwoCategories), "evezo");
    expect(evezok).toHaveLength(1);
    expect(evezok[0]?.id).toBe("accessory-1");
  });

  it("a getAccessoryBySlug egy deszka slugjára null-t ad", async () => {
    await expect(
      getAccessoryBySlug(filteringClient(MIXED_ROWS), "evezo", "red-paddle-ride"),
    ).resolves.toBeNull();
  });

  it("a getAccessoryBySlug a helyes kategória+slug párra megtalálja a sort", async () => {
    const accessory = await getAccessoryBySlug(filteringClient(MIXED_ROWS), "evezo", "alu-evezo");
    expect(accessory?.id).toBe("accessory-1");
  });
});

// ---------------------------------------------------------------------------
// 2. Lefedettség — forrás-szintű őrszem az ÖSSZES boards-olvasásra
// ---------------------------------------------------------------------------

/** A `boards` táblát olvasó adatréteg-fájlok (route-ok ezeken keresztül járnak). */
const DATA_LAYER_FILES = [
  join("src", "modules", "catalog", "data", "boards.server.ts"),
  join("src", "modules", "catalog", "data", "candidates.server.ts"),
  join("tools", "catalog-watch", "store.ts"),
];

const KIND_FILTER = /\.eq\("kind",\s*"(board|accessory)"\)/;

/**
 * Szándékos kivétel jelölése a lekérdezés-láncban. Egyetlen ilyen van: a
 * slug-ütközés vizsgálata, mert a slug az EGÉSZ táblán belül egyedi.
 */
const AGNOSTIC_MARKER = "kind-AGNOSZTIKUS";

/** Egy `boards`-lekérdezés lánca — durva, de elég: pontosvesszőig tartó darab. */
function boardsReadChains(source: string): string[] {
  return source
    .split(";")
    .filter(
      (chunk) =>
        chunk.includes('.from("boards")') &&
        chunk.includes(".select(") &&
        // Az insert-ág (`.insert(...).select("id")`) írás, nem listázás.
        !chunk.includes(".insert(") &&
        !chunk.includes(AGNOSTIC_MARKER),
    );
}

describe("kind='board' szűrő-lefedettség", () => {
  it.each(DATA_LAYER_FILES)("%s minden boards-olvasása szűr a kind-ra", (relative) => {
    const source = readFileSync(join(process.cwd(), relative), "utf8");
    const chains = boardsReadChains(source);
    expect(chains.length, `${relative}: nem találtam boards-lekérdezést`).toBeGreaterThan(0);
    for (const chain of chains) {
      expect(KIND_FILTER.test(chain), `${relative}: kind-szűrő nélküli boards-olvasás`).toBe(true);
    }
  });

  it("egyetlen route sem kérdezi le közvetlenül a boards táblát", () => {
    const routesDir = join(process.cwd(), "app", "routes");
    const offenders = readdirSync(routesDir)
      .filter((name) => /\.(ts|tsx)$/.test(name) && !name.includes(".test."))
      .filter((name) => readFileSync(join(routesDir, name), "utf8").includes('.from("boards")'));
    // A route-réteg az adatrétegen át olvas — csak ott van egy helyen a szűrő.
    expect(offenders).toEqual([]);
  });
});
