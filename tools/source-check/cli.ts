/**
 * source-check CLI — a vízi forrás-nyilvántartás negyedéves ellenőrzése.
 *
 *   node tools/source-check/cli.ts [--report jelentes.md] [--only id1,id2]
 *
 * Minden forrást letölt, és megnézi, szerepel-e benne még minden `expect`
 * kifejezés. Kilépési kód: 0 = minden rendben, 1 = legalább egy forrás
 * eltért vagy elérhetetlen (a workflow ilyenkor GitHub issue-t nyit).
 *
 * PDF-hez a `pdftotext` (poppler-utils) kell; a runneren a workflow telepíti.
 */

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import {
  SOURCES,
  SPOT_SOURCES,
  WATER_SOURCES,
  type SourceId,
  type WaterSource,
} from "../../src/modules/spots/sources.ts";
import { decodeBody, findMissing, htmlToPlain, isPdf } from "./check.ts";

// Böngészőszerű fejlécek: élesben több forrás (lupabeach.com, bank-falu.hu)
// 403-at, illetve 406-ot ad egy csupasz kliensnek.
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 SUP-Platform-source-check",
  Accept: "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
  "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
};
const TIMEOUT_MS = 30_000;
const CONCURRENCY = 4;

interface Result {
  id: SourceId;
  url: string;
  missing: string[];
  error: string | null;
}

async function fetchText(url: string): Promise<string> {
  let lastError: unknown = null;
  // Egy újrapróbálás: a kisebb önkormányzati szerverek időnként 502-t adnak.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const contentType = response.headers.get("content-type");
      if (isPdf(bytes, contentType)) return pdfToText(bytes);
      return htmlToPlain(decodeBody(bytes, contentType));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function pdfToText(bytes: Uint8Array): string {
  const run = spawnSync("pdftotext", ["-layout", "-", "-"], {
    input: bytes,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.error) throw new Error(`pdftotext nem futtatható: ${run.error.message}`);
  if (run.status !== 0) throw new Error(`pdftotext hiba (${run.status})`);
  return run.stdout.toString("utf-8");
}

async function checkOne(id: SourceId, source: WaterSource): Promise<Result> {
  const url = source.checkUrl ?? source.url;
  try {
    const text = await fetchText(url);
    return { id, url, missing: findMissing(text, source.expect), error: null };
  } catch (error) {
    return { id, url, missing: [], error: error instanceof Error ? error.message : String(error) };
  }
}

/** Melyik víz / spot használja az adott forrást — a jelentésbe. */
function usersOf(id: SourceId): string[] {
  const users: string[] = [];
  for (const [slug, ids] of Object.entries(WATER_SOURCES)) {
    if (ids.includes(id)) users.push(`/alapinfo/${slug}`);
  }
  for (const [spotId, ids] of Object.entries(SPOT_SOURCES)) {
    if (ids.includes(id)) users.push(`spot ${spotId.slice(0, 8)}`);
  }
  return users;
}

export function renderReport(results: readonly Result[], date: string): string {
  const failed = results.filter((r) => r.error !== null || r.missing.length > 0);
  const lines = [
    `# Vízi forrás-ellenőrzés — ${date}`,
    "",
    `${results.length} forrás, ebből **${failed.length} eltérés**.`,
    "",
  ];
  if (failed.length === 0) {
    lines.push("Minden forrásban megtalálható minden elvárt kifejezés.");
    return lines.join("\n");
  }
  lines.push(
    "Teendő forrásonként: nyisd meg, és döntsd el, hogy a SZABÁLY változott (→ a",
    "`/alapinfo` / spot szövegét javítani kell), vagy csak az OLDAL (→ az `expect`",
    "kifejezést és a `reviewedAt` dátumot kell frissíteni a",
    "`src/modules/spots/sources.ts`-ben). Kutatási háttér: `docs/VIZTESTEK_KUTATAS.md`.",
    "",
  );
  for (const result of failed) {
    const source = SOURCES[result.id];
    lines.push(`## \`${result.id}\` — ${source.title.hu}`, "", `- URL: ${result.url}`);
    const users = usersOf(result.id);
    lines.push(`- Érintett: ${users.length > 0 ? users.join(", ") : "csak a kutatási jegyzet"}`);
    if (result.error !== null) {
      lines.push(`- **Nem sikerült letölteni:** ${result.error}`);
    } else {
      lines.push("- **Hiányzó kifejezések:**");
      for (const phrase of result.missing) lines.push(`  - „${phrase}"`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const reportPath = args.includes("--report") ? args[args.indexOf("--report") + 1] : undefined;
  const onlyArg = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;
  const only = onlyArg ? new Set(onlyArg.split(",")) : null;

  const entries = (Object.entries(SOURCES) as [SourceId, WaterSource][]).filter(
    ([id]) => only === null || only.has(id),
  );
  const results: Result[] = [];
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(batch.map(([id, source]) => checkOne(id, source)))));
  }

  for (const r of results) {
    const status = r.error !== null ? `HIBA: ${r.error}` : r.missing.length > 0 ? `HIÁNYZIK ${r.missing.length}` : "ok";
    console.log(`${status.padEnd(24)} ${r.id}`);
    for (const phrase of r.missing) console.log(`    - ${phrase}`);
  }

  const report = renderReport(results, new Date().toISOString().slice(0, 10));
  if (reportPath) writeFileSync(reportPath, report);
  const failedCount = results.filter((r) => r.error !== null || r.missing.length > 0).length;
  console.log(`\n${results.length} forrás, ${failedCount} eltérés.`);
  process.exitCode = failedCount > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
