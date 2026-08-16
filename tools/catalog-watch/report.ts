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

/**
 * Egy jelölt/board NEM valódi SUP-deszkának tűnik a NEVÉBŐL (kajak, kötél,
 * fin, hordozópánt, horgászbot, platform stb.) — élesben mért, ismétlődő
 * minta (F2.1-utó-6/9): ezek a `boards`/`catalog_candidates` "board"
 * kind-del kerültek be (mert a klasszifikáció nem ismerte fel a saját
 * kategóriájukat), de ADATGYŰJTÉS helyett MODERÁTORI döntést (átsorolás
 * vagy elutasítás) igényelnek — a hiányos-listán külön, saját szakaszban
 * jelennek meg, hogy ne keveredjenek a valódi deszkákkal.
 */
export function looksLikeNonBoardModel(model: string): boolean {
  return /kajak|horgászbot|kötél|pánt|center fin|\bfin\b|lapát|platform/i.test(model);
}

export function formatIncompleteReport(
  pending: readonly IncompleteRow[],
  liveBoards: readonly IncompleteRow[],
  skipped: readonly IncompleteRow[] = [],
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

  if (skipped.length > 0) {
    lines.push("");
    lines.push(`=== KIHAGYVA (${skipped.length}) — NEM valódi deszka, moderátori döntés kell ===`);
    for (const row of skipped) {
      lines.push(`  [${row.source}] ${row.model} — ${row.ref}`);
    }
  }

  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Böngészőben megnyitható, önálló (nincs külső erőforrás) HTML-riport
 * checkbox-okkal — a felhasználó kérése (2026-08-16): "sima böngészőben
 * lássam, ez sokkal áttekinthetőbb". A pipálás localStorage-ban perzisztál
 * (EBBEN a fájlban, EBBEN a böngészőben) — de a ténylegesen mérvadó "kész"
 * állapotot MINDIG az adatbázis adja: amit a `verify-specs` már beírt, az a
 * KÖVETKEZŐ generált riportból magától kimarad, checkbox-állapottól
 * függetlenül. A pipálás tehát csak SAJÁT munkaközbeni jegyzet, nem
 * szinkronizálódik vissza — ha félbehagyott egy kört, a következő, újabb
 * dátumú riport a nem-befejezett tételeket ÚGYIS újra tartalmazza, mert
 * azok az adatbázisban is hiányosak maradtak.
 */
export function formatIncompleteReportHtml(
  pending: readonly IncompleteRow[],
  liveBoards: readonly IncompleteRow[],
  skipped: readonly IncompleteRow[] = [],
  options: { generatedAt: string } = { generatedAt: new Date().toISOString().slice(0, 10) },
): string {
  let rowCounter = 0;

  function tableRows(rows: readonly IncompleteRow[], linkPrefix: string): string {
    if (rows.length === 0) {
      return `<tr><td colspan="4" class="empty">nincs ilyen tétel</td></tr>`;
    }
    return rows
      .map((row) => {
        const id = `row-${rowCounter++}`;
        const key = escapeHtml(`${linkPrefix}:${row.ref}`);
        const link = linkPrefix === "live" ? `verify-specs --board ${row.ref}` : row.ref;
        const linkHtml = row.ref.startsWith("http")
          ? `<a href="${escapeHtml(row.ref)}" target="_blank" rel="noopener">${escapeHtml(row.ref)}</a>`
          : `<code>${escapeHtml(link)}</code>`;
        return (
          `<tr data-key="${key}">` +
          `<td class="checkbox-cell"><input type="checkbox" id="${id}" class="track" data-key="${key}"><label for="${id}"></label></td>` +
          `<td>${escapeHtml(row.source)}</td>` +
          `<td>${escapeHtml(row.model)}</td>` +
          `<td>${escapeHtml(row.missing.join(", ") || "—")}</td>` +
          `<td class="ref">${linkHtml}</td>` +
          `</tr>`
        );
      })
      .join("\n");
  }

  return `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<title>Validálandó deszkák — ${escapeHtml(options.generatedAt)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, "Segoe UI", sans-serif; max-width: 1000px; margin: 0 auto; padding: 24px 16px 64px; line-height: 1.45; }
  h1 { font-size: 1.5rem; margin-bottom: 4px; }
  .meta { color: #667; margin-bottom: 24px; font-size: 0.9rem; }
  .note { background: color-mix(in srgb, canvastext 6%, canvas); border-left: 3px solid #888; padding: 10px 14px; margin-bottom: 28px; font-size: 0.9rem; border-radius: 0 6px 6px 0; }
  h2 { font-size: 1.15rem; margin-top: 36px; border-bottom: 1px solid color-mix(in srgb, canvastext 20%, canvas); padding-bottom: 6px; }
  table { border-collapse: collapse; width: 100%; margin-top: 10px; font-size: 0.92rem; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid color-mix(in srgb, canvastext 12%, canvas); vertical-align: top; }
  th { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.03em; color: #667; }
  .checkbox-cell { width: 28px; }
  input.track { width: 18px; height: 18px; cursor: pointer; }
  tr.done td:not(.checkbox-cell) { opacity: 0.45; text-decoration: line-through; }
  .ref a, .ref code { font-size: 0.85rem; word-break: break-all; }
  .empty { color: #889; font-style: italic; }
  .count { font-weight: 600; }
</style>
</head>
<body>
<h1>Validálandó deszkák</h1>
<p class="meta">Generálva: ${escapeHtml(options.generatedAt)} · pending: <span class="count">${pending.length}</span> · élő board: <span class="count">${liveBoards.length}</span> · kihagyva: <span class="count">${skipped.length}</span></p>
<p class="note">A pipálás csak SAJÁT munkaközbeni jegyzet (ebben a böngészőben, ebben a fájlban marad meg) —
nem szinkronizálódik vissza. A ténylegesen mérvadó állapotot a <code>verify-specs</code> paranccsal beépített
adat adja: amit egyszer beépítettünk, az a KÖVETKEZŐ riportból magától kimarad. Ha félbehagysz egy kört, a
következő, újabb dátumú riport a még hiányos tételeket úgyis újra tartalmazza.</p>

<h2>Élő (már jóváhagyott) boardok — ${liveBoards.length}</h2>
<table>
<thead><tr><th></th><th>Márka</th><th>Modell</th><th>Hiányzik</th><th>Hivatkozás</th></tr></thead>
<tbody>
${tableRows(liveBoards, "live")}
</tbody>
</table>

<h2>Moderálásra váró jelöltek — ${pending.length}</h2>
<table>
<thead><tr><th></th><th>Forrás</th><th>Modell</th><th>Hiányzik</th><th>Link</th></tr></thead>
<tbody>
${tableRows(pending, "pending")}
</tbody>
</table>

<h2>Kihagyva — nem valódi deszka, moderátori döntés kell — ${skipped.length}</h2>
<table>
<thead><tr><th></th><th>Forrás</th><th>Név</th><th></th><th>Link</th></tr></thead>
<tbody>
${tableRows(skipped, "skipped")}
</tbody>
</table>

<script>
(function () {
  var STORAGE_KEY = "catalogValidation:${escapeHtml(options.generatedAt)}";
  var state = {};
  try { state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (e) {}
  function apply(box) {
    var key = box.dataset.key;
    box.checked = !!state[key];
    box.closest("tr").classList.toggle("done", box.checked);
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  document.querySelectorAll("input.track").forEach(function (box) {
    apply(box);
    box.addEventListener("change", function () {
      state[box.dataset.key] = box.checked;
      box.closest("tr").classList.toggle("done", box.checked);
      save();
    });
  });
})();
</script>
</body>
</html>
`;
}
