/**
 * catalog-watch — hiányos adatú deszkák riportja (F2.1-utó-10, `list-
 * incomplete` parancs). TISZTA formázó-függvény, az I/O-tól (Supabase-
 * lekérdezések, a `cli.ts`-ben) elválasztva — táblázatos tesztekkel védhető.
 *
 * KÉT forrás, EGY riportban: a `pending` jelöltek (catalog_candidates, még
 * jóváhagyásra várnak) ÉS a már ÉLŐ, jóváhagyott boardok (boards) is
 * hiányosak lehetnek — a felhasználó explicit kérése (2026-08-15): a
 * hiányos adattal publikált boardok se vesszenek el a nyomon követésből.
 */

export interface IncompleteRow {
  /** Pendingnél a forrás neve (pl. "sup-deszka.hu"); élő boardnál a márka. */
  source: string;
  model: string;
  missing: readonly string[];
  /** Pendingnél a termékoldal URL-je; élő boardnál a katalógus-slug. */
  ref: string;
}

const SPEC_LABELS_HU: Record<string, string> = {
  lengthCm: "hossz",
  widthCm: "szélesség",
  thicknessCm: "vastagság",
  weightKg: "súly",
  maxLoadKg: "teherbírás",
};

/** Melyik `specs`-mező hiányzik — magyar címkékkel, a riport-sorokhoz. */
export function missingSpecLabels(specs: {
  lengthCm: number | null;
  widthCm: number | null;
  thicknessCm: number | null;
  weightKg: number | null;
  maxLoadKg: number | null;
}): string[] {
  return Object.entries(SPEC_LABELS_HU)
    .filter(([key]) => specs[key as keyof typeof specs] == null)
    .map(([, label]) => label);
}

export function formatIncompleteReport(
  pending: readonly IncompleteRow[],
  liveBoards: readonly IncompleteRow[],
): string {
  const lines: string[] = [];

  lines.push(`Hiányos adatú deszkák — pending jelölt: ${pending.length}, élő board: ${liveBoards.length}`);

  lines.push("");
  lines.push(`=== PENDING JELÖLTEK (${pending.length}) — még nem átnézett/nem "kész" ===`);
  if (pending.length === 0) {
    lines.push("  nincs ilyen — minden aktívan gyűjtött jelölt kész, vagy nincs hiányzó mezője.");
  }
  for (const row of pending) {
    lines.push(`  [${row.source}] ${row.model} — hiányzik: ${row.missing.join(", ")}`);
    lines.push(`     ${row.ref}`);
  }

  lines.push("");
  lines.push(`=== ÉLŐ (JÓVÁHAGYOTT) BOARDOK (${liveBoards.length}) ===`);
  if (liveBoards.length === 0) {
    lines.push("  nincs ilyen — minden élő board adata teljes.");
  }
  for (const row of liveBoards) {
    lines.push(`  [${row.source}] ${row.model} — hiányzik: ${row.missing.join(", ")}`);
    lines.push(`     verify-specs --board ${row.ref}`);
  }

  return lines.join("\n");
}
