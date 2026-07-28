/**
 * catalog-watch — parancssori belépési pont.
 *
 * Futtatás (Node 22 natív TypeScript-futtatással, build nélkül):
 *
 *   node tools/catalog-watch/cli.ts list-sources
 *   node tools/catalog-watch/cli.ts add-source --name "Bolt" --url https://bolt.hu --pattern /termek/
 *   node tools/catalog-watch/cli.ts crawl --dry-run
 *   node tools/catalog-watch/cli.ts lifecycle
 *
 * Környezet: a repo `.env`-je az AUTORITÁS (`VITE_SUPABASE_URL` +
 * `SUPABASE_SERVICE_ROLE_KEY`); `.env` hiányában (CI) a környezeti változók.
 * A cél-projektet minden futás kiírja, a kulcsot viszont SOHA — a részletes
 * indoklás (shell-árnyékolás elleni védelem) az `env.ts` fejlécében.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { crawlAll, DEFAULT_MIN_DELAY_MS, type CrawlDeps, type FetchText } from "./crawl.ts";
import { resolveSupabaseTarget } from "./env.ts";
import { findDiscontinuedCandidates, DEFAULT_UNSEEN_DAYS } from "./lifecycle.ts";
import { probeSource } from "./probe.ts";
import { CRAWLER_USER_AGENT } from "./robots.ts";
import {
  createDryRunStore,
  createServiceClient,
  createSupabaseStore,
  insertSource,
  listBoardsForLifecycle,
  listSources,
} from "./store.ts";
import type { CrawlConfig, SourceKind } from "./types.ts";

/** Egyetlen kérés felső időkorlátja — egy lassú bolt ne akassza meg a futást. */
const FETCH_TIMEOUT_MS = 20_000;

const HELP = `catalog-watch — SUP-katalógus piacfigyelő (docs/CATALOG_WATCH_TERV.md)

Parancsok:
  probe --url U                    Forrás-felderítés ADATBÁZIS NÉLKÜL: van-e
      [--name N] [--pattern RÉSZLET]... [--exclude RÉSZLET]...
      [--sitemap URL] [--samples N]     sitemap, JSON-LD, ár — és milyen
                                        kapcsolókkal érdemes felvenni
  list-sources                     A figyelt források listája
  add-source --name N --url U      Új forrás felvétele
      [--kind shop|brand_site|feed] [--sitemap URL] [--pattern RÉSZLET]...
      [--exclude RÉSZLET]... [--max N] [--delay MS] [--country HU] [--notes SZÖVEG]
  crawl [--source NÉV|ID] [--dry-run] [--max N]
                                   Crawl az aktív forrásokból
  lifecycle [--days N]             Kifutás-jelöltek listája (csak jelentés)

A cél-projektet a repo .env-je adja (VITE_SUPABASE_URL +
SUPABASE_SERVICE_ROLE_KEY); .env nélkül a környezeti változók élnek.
Minden futás kiírja, MELYIK projekttel dolgozik.`;

/**
 * Nagyon egyszerű `.env` beolvasó — csak `KULCS=érték` sorokat ismer, és NEM
 * írja felül a `process.env`-et: a feloldás (env.ts) dönti el, melyik forrás
 * győz. Hiányzó fájl → üres map (CI-ban ez a normális).
 */
function loadDotEnv(path = resolve(process.cwd(), ".env")): Record<string, string> {
  const values: Record<string, string> = {};
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return values;
  }
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!match) continue;
    values[match[1] as string] = (match[2] ?? "").trim().replace(/^["']|["']$/g, "");
  }
  return values;
}

/**
 * Kapcsolódás a HELYES projektre. Kiírja, melyikre — az env-árnyékolás
 * (CLAUDE.md zshrc-csapda) így nem maradhat észrevétlen.
 */
function connect(): SupabaseClient {
  const target = resolveSupabaseTarget(loadDotEnv(), process.env);
  for (const warning of target.warnings) console.warn(`FIGYELEM: ${warning}`);
  console.log(`Projekt: ${target.projectRef ?? target.url}`);
  return createServiceClient(target);
}

interface Args {
  command: string;
  flags: Map<string, string[]>;
}

function parseArgs(argv: readonly string[]): Args {
  const [command = "help", ...rest] = argv;
  const flags = new Map<string, string[]>();
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i] as string;
    if (!token.startsWith("--")) continue;
    const name = token.slice(2);
    const next = rest[i + 1];
    const value = next !== undefined && !next.startsWith("--") ? next : "true";
    if (value !== "true") i += 1;
    flags.set(name, [...(flags.get(name) ?? []), value]);
  }
  return { command, flags };
}

function flag(args: Args, name: string): string | undefined {
  return args.flags.get(name)?.[0];
}

function flagList(args: Args, name: string): string[] | undefined {
  return args.flags.get(name);
}

function flagNumber(args: Args, name: string): number | undefined {
  const raw = flag(args, name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`A --${name} értéke nem szám: ${raw}`);
  return value;
}

/** Valós hálózati primitív: saját user-agent, időkorlát, hibatűrő olvasás. */
const realFetch: FetchText = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Azonosítjuk magunkat: a bolt üzemeltetője lássa, ki jár nála.
        "user-agent": `${CRAWLER_USER_AGENT}/1.0 (+https://suptime.hu/robot)`,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const text = response.status >= 400 ? "" : await response.text();
    return { status: response.status, text };
  } finally {
    clearTimeout(timer);
  }
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function commandListSources(): Promise<void> {
  const client = connect();
  const sources = await listSources(client, { onlyActive: false });
  if (sources.length === 0) {
    console.log("Nincs felvett forrás. Vedd fel az elsőt: add-source --name … --url …");
    return;
  }
  for (const source of sources) {
    const state = source.active ? "aktív" : "inaktív";
    const last = source.last_crawled_at ?? "még nem futott";
    console.log(
      `${source.id}  ${source.name}  [${source.kind}/${source.country}, ${state}]\n` +
        `    ${source.base_url ?? "(nincs URL)"}  · utolsó crawl: ${last}`,
    );
  }
}

async function commandAddSource(args: Args): Promise<void> {
  const name = flag(args, "name");
  const url = flag(args, "url");
  if (!name || !url) throw new Error("Kötelező: --name és --url");

  const kind = (flag(args, "kind") ?? "shop") as SourceKind;
  if (!["shop", "brand_site", "feed"].includes(kind)) {
    throw new Error(`Ismeretlen --kind: ${kind}`);
  }

  const crawlConfig: CrawlConfig = {};
  const sitemap = flag(args, "sitemap");
  if (sitemap) crawlConfig.sitemapUrl = sitemap;
  const patterns = flagList(args, "pattern");
  if (patterns) crawlConfig.productUrlPatterns = patterns;
  const excludes = flagList(args, "exclude");
  if (excludes) crawlConfig.excludeUrlPatterns = excludes;
  const max = flagNumber(args, "max");
  if (max !== undefined) crawlConfig.maxProducts = max;
  const delay = flagNumber(args, "delay");
  if (delay !== undefined) crawlConfig.minDelayMs = delay;
  const notes = flag(args, "notes");
  if (notes) crawlConfig.notes = notes;

  const client = connect();
  const source = await insertSource(client, {
    name,
    base_url: url,
    kind,
    country: flag(args, "country") ?? "HU",
    crawl_config: Object.keys(crawlConfig).length > 0 ? crawlConfig : null,
  });
  console.log(`Felvéve: ${source.name} (${source.id})`);
  console.log("Próbafutás írás nélkül:  node tools/catalog-watch/cli.ts crawl --dry-run");
}

async function commandCrawl(args: Args): Promise<void> {
  const dryRun = flag(args, "dry-run") === "true";
  const client = connect();

  let sources = await listSources(client);
  const filter = flag(args, "source");
  if (filter) {
    const needle = filter.toLowerCase();
    sources = sources.filter(
      (source) => source.id === filter || source.name.toLowerCase().includes(needle),
    );
    if (sources.length === 0) throw new Error(`Nincs ilyen aktív forrás: ${filter}`);
  }

  const max = flagNumber(args, "max");
  if (max !== undefined) {
    sources = sources.map((source) => ({
      ...source,
      crawl_config: { ...(source.crawl_config ?? {}), maxProducts: max },
    }));
  }

  const dry = dryRun ? createDryRunStore(client) : null;
  const deps: CrawlDeps = {
    fetchText: realFetch,
    store: dry ? dry.store : createSupabaseStore(client),
    sleep,
    log: (message) => console.log(message),
  };

  console.log(
    `${dryRun ? "[DRY-RUN] " : ""}${sources.length} forrás, ` +
      `alap-szünet ${DEFAULT_MIN_DELAY_MS} ms…`,
  );
  const summary = await crawlAll(sources, deps, { dryRun });

  for (const source of summary.sources) {
    console.log(
      `\n${source.sourceName}: ${source.urlsConsidered} URL · ` +
        `${source.productsExtracted} termék · ${source.skippedNonBoard} kiegészítő · ` +
        `${source.matchedKnown} ismert · ` +
        `${source.candidatesCreated} új jelölt · ${source.pricesRecorded} ársor · ` +
        `${source.robotsBlocked} robots-tiltás`,
    );
    for (const error of source.errors) console.log(`    hiba: ${error}`);
  }

  if (dry) {
    console.log("\n[DRY-RUN] amit írt volna:");
    for (const price of dry.log.prices) {
      console.log(`  ár: ${price.boardId} @ ${price.shopName} = ${price.priceHuf} Ft`);
    }
    for (const candidate of dry.log.candidates) {
      const pair = candidate.matchedBoardId
        ? `bizonytalan egyezés: ${candidate.matchedBoardId}`
        : "új típus";
      console.log(`  jelölt: ${candidate.modelName} (${pair}) — ${candidate.url}`);
    }
    console.log("  (semmi nem íródott az adatbázisba)");
  }
}

/**
 * Forrás-felderítés — adatbázis NÉLKÜL. Ezt futtatjuk, mielőtt bármit
 * felvennénk: megmondja, alkalmas-e a bolt, és milyen kapcsolókkal.
 */
async function commandProbe(args: Args): Promise<void> {
  const url = flag(args, "url");
  if (!url) throw new Error("Kötelező: --url");

  const result = await probeSource(
    url,
    {
      name: flag(args, "name"),
      productUrlPatterns: flagList(args, "pattern"),
      excludeUrlPatterns: flagList(args, "exclude"),
      sitemapUrl: flag(args, "sitemap"),
      samples: flagNumber(args, "samples"),
    },
    { fetchText: realFetch, sleep },
  );

  console.log(`\n${result.origin}`);
  console.log(`  robots.txt: ${result.robotsAvailable ? "elérhető" : "NEM elérhető"}`);
  if (result.crawlDelaySec !== null) console.log(`  Crawl-delay: ${result.crawlDelaySec} s`);
  console.log(`  termék-URL a sitemapben: ${result.productUrlCount}`);

  for (const sample of result.samples) {
    const extracted = sample.extracted;
    const price = extracted?.priceHuf === null ? "nincs ár" : `${extracted?.priceHuf} Ft`;
    console.log(
      `  · ${sample.url}\n` +
        `      HTTP ${sample.status} · JSON-LD Product: ${sample.hasProductJsonLd ? "van" : "NINCS"}` +
        (sample.hasProductJsonLd ? ` · ${sample.isBoard ? "DESZKA" : "kiegészítő"}` : "") +
        (extracted
          ? ` · ${extracted.brandName ?? "?"} / ${extracted.modelName || "?"} · ${price}` +
            ` · hossz ${extracted.specs.lengthCm ?? "?"} cm · teherbírás ${
              extracted.specs.maxLoadKg ?? "?"
            } kg`
          : ""),
    );
  }
  for (const error of result.errors) console.log(`  hiba: ${error}`);

  console.log(`\n  ${result.verdict}`);
  if (result.suggestedCommand) console.log(`\n  Felvétel:\n  ${result.suggestedCommand}`);
}

async function commandLifecycle(args: Args): Promise<void> {
  const unseenDays = flagNumber(args, "days") ?? DEFAULT_UNSEEN_DAYS;
  const client = connect();
  const boards = await listBoardsForLifecycle(client);
  const candidates = findDiscontinuedCandidates(boards, { unseenDays });

  console.log(`Kifutás-jelöltek (${unseenDays} napja nem látott, aktív deszkák):`);
  if (candidates.length === 0) {
    console.log("  nincs ilyen — minden aktív modell friss.");
    return;
  }
  for (const candidate of candidates) {
    console.log(`  ${candidate.modelName} — ${candidate.daysUnseen} napja (${candidate.boardId})`);
  }
  console.log(
    "\nA státuszt NEM állítjuk automatikusan: a megerősítés az admin dolga\n" +
      "(/admin/katalogus → Kifutás-jelöltek).",
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  switch (args.command) {
    case "probe":
      return commandProbe(args);
    case "list-sources":
      return commandListSources();
    case "add-source":
      return commandAddSource(args);
    case "crawl":
      return commandCrawl(args);
    case "lifecycle":
      return commandLifecycle(args);
    default:
      console.log(HELP);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
