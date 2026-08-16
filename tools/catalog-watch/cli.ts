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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

import type { SupabaseClient } from "@supabase/supabase-js";

import { crawlAll, DEFAULT_MIN_DELAY_MS, type CrawlDeps, type FetchText } from "./crawl.ts";
import { resolveSupabaseTarget } from "./env.ts";
import { findDiscontinuedCandidates, DEFAULT_UNSEEN_DAYS } from "./lifecycle.ts";
import { setFieldValue } from "./lock.ts";
import type { ProductClassification } from "./normalize.ts";
import { probeSource } from "./probe.ts";
import { createRenderFetcher } from "./render.ts";
import {
  formatIncompleteReport,
  formatIncompleteReportHtml,
  looksLikeNonBoardModel,
  missingSpecLabels,
  type IncompleteRow,
} from "./report.ts";
import { CRAWLER_USER_AGENT } from "./robots.ts";
import {
  createDryRunStore,
  createServiceClient,
  createSupabaseStore,
  insertSource,
  listBoardsForLifecycle,
  listSources,
} from "./store.ts";
import type { CrawlConfig, ExtractedProduct, SourceKind } from "./types.ts";

/** Egyetlen kérés felső időkorlátja — egy lassú bolt ne akassza meg a futást. */
const FETCH_TIMEOUT_MS = 20_000;

const HELP = `catalog-watch — SUP-katalógus piacfigyelő (docs/CATALOG_WATCH_TERV.md)

Parancsok:
  probe --url U                    Forrás-felderítés ADATBÁZIS NÉLKÜL: van-e
      [--name N] [--pattern RÉSZLET]... [--exclude RÉSZLET]...
      [--sitemap URL] [--samples N]     sitemap, JSON-LD, ár — és milyen
      [--default-brand NÉV]              kapcsolókkal érdemes felvenni
  list-sources                     A figyelt források listája
  add-source --name N --url U      Új forrás felvétele
      [--kind shop|brand_site|feed] [--sitemap URL] [--pattern RÉSZLET]...
      [--exclude RÉSZLET]... [--max N] [--delay MS] [--country HU]
      [--default-brand NÉV] [--notes SZÖVEG]
      --default-brand: fallback márkanév, ha a JSON-LD nem ad brand/manufacturer
      mezőt (egymárkás gyártói bolt esetén gyakori)
  crawl [--source NÉV|ID] [--dry-run] [--max N]
                                   Crawl az aktív forrásokból
  lifecycle [--days N]             Kifutás-jelöltek listája (csak jelentés)
  list-incomplete [--source NÉV]   Hiányos adatú deszkák (pending jelölt ÉS
      [--html [ÚTVONAL]]            élő board) — a havi kézi adatgyűjtés
                                    munkalistája (F2.1-utó-10). --html:
                                    böngészőben megnyitható riport,
                                    alapértelmezetten "for_validate/<ma>-
                                    validalando-deszkak.html" (checkbox-okkal,
                                    csak saját munkaközbeni jegyzet — a
                                    mérvadó állapotot a verify-specs adja)
  verify-specs --set PATH=ÉRTÉK... Kézi/gyártói adat beépítése — az EGYETLEN
      (--url U | --candidate ID)    támogatott mód erre. Pending jelöltnél
      | --board SLUG                 (--url/--candidate) camelCase jsonb-
      [--done] [--reopen]            path ("specs.lengthCm"), a beírt mezők
                                      zárolódnak (a crawler többé nem írja
                                      felül); --done = "kész", lekerül a
                                      list-incomplete listáról akkor is, ha
                                      maradt hiányzó mező; --reopen =
                                      visszakerül. Élő boardnál (--board)
                                      snake_case oszlopnév ("length_cm").

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

/**
 * `.gz`-tömörített válasz szöveggé alakítása. Élesben mért eset
 * (aquamarinahungary.com sitemap-lánc): a szerver a sitemap-gyereket
 * `content-type: application/x-gzip`-ként adja, `Content-Encoding: gzip`
 * fejléc NÉLKÜL — a `fetch()` transzport-szintű automata kicsomagolása ilyenkor
 * NEM fut le, a `.text()` a nyers gzip-bájtokat próbálná UTF-8-ként olvasni
 * (hibás/olvashatatlan szöveg lenne). A `.gz` kiterjesztés vagy a content-type
 * alapján kézzel csomagoljuk ki.
 */
async function responseToText(response: Response): Promise<string> {
  const url = response.url;
  const contentType = response.headers.get("content-type") ?? "";
  const looksGzipped = url.endsWith(".gz") || /gzip/i.test(contentType);
  if (!looksGzipped) {
    return response.text();
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  try {
    return gunzipSync(buffer).toString("utf8");
  } catch {
    // Ha mégsem valódi gzip (téves content-type), essünk vissza a nyers szövegre.
    return buffer.toString("utf8");
  }
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
    const text = response.status >= 400 ? "" : await responseToText(response);
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
  const defaultBrand = flag(args, "default-brand");
  if (defaultBrand) crawlConfig.defaultBrandName = defaultBrand;
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
  // Lusta indítású böngésző-fallback (render.ts, F2.1-utó-3) — csak akkor
  // indul el ténylegesen, ha egy termék MINDHÁROM méret-mezője hiányzik a
  // sima HTML-ből. `finally`-ben mindig lezárjuk, ha valaha elindult.
  const renderFetcher = createRenderFetcher();
  const deps: CrawlDeps = {
    fetchText: realFetch,
    store: dry ? dry.store : createSupabaseStore(client),
    sleep,
    log: (message) => console.log(message),
    renderText: (url) => renderFetcher.renderText(url),
  };

  console.log(
    `${dryRun ? "[DRY-RUN] " : ""}${sources.length} forrás, ` +
      `alap-szünet ${DEFAULT_MIN_DELAY_MS} ms…`,
  );
  let summary: Awaited<ReturnType<typeof crawlAll>>;
  try {
    summary = await crawlAll(sources, deps, { dryRun });
  } finally {
    await renderFetcher.close();
  }

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

/** A besorolás (`classifyProduct`) rövid, ember-olvasható címkéje a probe-kimenethez. */
function classificationLabel(classification: ProductClassification | null): string {
  if (classification === null) return "?";
  if (classification.kind === "board") return "DESZKA";
  if (classification.kind === "accessory") return `kiegészítő (${classification.accessoryType})`;
  return "figyelmen kívül hagyva";
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
      defaultBrandName: flag(args, "default-brand"),
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
        (sample.hasProductJsonLd ? ` · ${classificationLabel(sample.classification)}` : "") +
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

/** `"true"`/`"false"`/`"null"`/szám → tipizált érték; egyébként szöveg marad. */
function parseSetValue(raw: string): number | string | boolean | null {
  const lower = raw.toLowerCase();
  if (lower === "null") return null;
  if (lower === "true") return true;
  if (lower === "false") return false;
  if (raw !== "" && Number.isFinite(Number(raw))) return Number(raw);
  return raw;
}

function parseSetFlags(values: readonly string[]): { path: string; value: unknown }[] {
  return values.map((entry) => {
    const eq = entry.indexOf("=");
    if (eq < 0) throw new Error(`Érvénytelen --set (nincs '='): "${entry}"`);
    return { path: entry.slice(0, eq), value: parseSetValue(entry.slice(eq + 1)) };
  });
}

/**
 * Kézi/gyártói-forrásból ellenőrzött adat beépítése — az EGYETLEN támogatott
 * mód erre (F2.1-utó-10), felváltva az ad-hoc scratch-szkripteket. Két
 * célmód: `--board <slug>` egy MÁR ÉLŐ, jóváhagyott boardot ír (snake_case
 * oszlopok, nincs zár-mechanizmus — a crawler élő boardot úgyis csak
 * árban/láthatóságban érint); `--url`/`--candidate` egy PENDING jelöltet ír
 * (camelCase jsonb-path az `extracted`-en belül), és a frissített mezőket a
 * `locked_fields`-hez adja, hogy egy következő crawl ne írja felül.
 */
async function commandVerifySpecs(args: Args): Promise<void> {
  const sets = flagList(args, "set") ?? [];
  if (sets.length === 0) throw new Error("Legalább egy --set path=érték kötelező.");
  const assignments = parseSetFlags(sets);

  const boardSlug = flag(args, "board");
  const client = connect();

  if (boardSlug) {
    const patch: Record<string, unknown> = {};
    for (const { path, value } of assignments) patch[path] = value;

    // A `boards.slug` FORDÍTHATÓ jsonb ({"hu": ..., "en": ...}) — a projekt
    // szabálya szerint minden fordítható tartalmi mező jsonb (CLAUDE.md).
    // A magyar (`hu`) alszlug az elsődleges referencia a CLI-ben.
    const { data, error } = await client
      .from("boards")
      .update(patch)
      .eq("slug->>hu", boardSlug)
      .select("id, slug, model_name, length_cm, width_cm, thickness_cm, weight_kg, max_load_kg")
      .maybeSingle();
    if (error) throw new Error(`boards update: ${error.message}`);
    if (!data) throw new Error(`Nincs ilyen board-slug (hu): ${boardSlug}`);
    const slug = data.slug as { hu?: string; en?: string } | null;
    console.log(`Frissítve (élő board): ${data.model_name as string} (${slug?.hu ?? boardSlug})`);
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const url = flag(args, "url");
  const candidateId = flag(args, "candidate");
  if (!url && !candidateId) throw new Error("Kötelező: --board, --url vagy --candidate.");

  const base = client
    .from("catalog_candidates")
    .select("id, url, extracted, locked_fields, data_verified_at");
  const { data: rows, error: selectError } = candidateId
    ? await base.eq("id", candidateId).limit(1)
    : await base.eq("url", url as string).limit(1);
  if (selectError) throw new Error(`catalog_candidates olvasás: ${selectError.message}`);

  const row = rows?.[0] as
    | {
        id: string;
        url: string | null;
        extracted: ExtractedProduct | null;
        locked_fields: string[] | null;
        data_verified_at: string | null;
      }
    | undefined;
  if (!row) throw new Error(`Nincs ilyen jelölt (${candidateId ? `id=${candidateId}` : `url=${url}`}).`);
  if (!row.extracted) throw new Error("A jelöltnek nincs extracted adata — előbb crawlolni kell.");

  let extracted = row.extracted;
  const lockedFields = new Set(row.locked_fields ?? []);
  for (const { path, value } of assignments) {
    extracted = setFieldValue(extracted, path, value);
    lockedFields.add(path);
  }

  const done = flag(args, "done") === "true";
  const reopen = flag(args, "reopen") === "true";
  if (done && reopen) throw new Error("--done és --reopen egyszerre nem adható meg.");

  const patch: Record<string, unknown> = { extracted, locked_fields: [...lockedFields] };
  if (done) patch.data_verified_at = new Date().toISOString();
  if (reopen) patch.data_verified_at = null;

  const { error: updateError } = await client
    .from("catalog_candidates")
    .update(patch)
    .eq("id", row.id);
  if (updateError) throw new Error(`catalog_candidates update: ${updateError.message}`);

  console.log(`Frissítve (jelölt): ${extracted.brandName ?? "?"} ${extracted.modelName} (${row.id})`);
  console.log(`  zárolt mezők: ${[...lockedFields].join(", ") || "(nincs)"}`);
  console.log(
    `  kész (data_verified_at): ${done ? "most beállítva" : reopen ? "törölve (újranyitva)" : "változatlan"}`,
  );
  console.log(JSON.stringify(extracted, null, 2));
}

/**
 * Hiányos adatú deszkák riportja — PENDING jelöltek (aktívan gyűjtés alatt,
 * `data_verified_at IS NULL`) ÉS MÁR ÉLŐ, jóváhagyott boardok, amelyeknél
 * hiányzik legalább egy mérőszám. A felhasználó havi munkalistája
 * (F2.1-utó-10) — ő gyűjti be a hiányzó adatot, a karmester a `verify-specs`
 * paranccsal építi be.
 */
async function commandListIncomplete(args: Args): Promise<void> {
  const client = connect();
  const sourceFilter = flag(args, "source")?.toLowerCase();

  const { data: sources, error: sourcesError } = await client
    .from("catalog_sources")
    .select("id, name");
  if (sourcesError) throw new Error(`catalog_sources olvasás: ${sourcesError.message}`);
  const sourceNameById = new Map((sources ?? []).map((s) => [s.id as string, s.name as string]));

  const { data: pendingRows, error: pendingError } = await client
    .from("catalog_candidates")
    .select("source_id, url, extracted")
    .eq("status", "pending")
    .is("data_verified_at", null);
  if (pendingError) throw new Error(`catalog_candidates olvasás: ${pendingError.message}`);

  const pending: IncompleteRow[] = [];
  const skipped: IncompleteRow[] = [];
  for (const row of pendingRows ?? []) {
    const extracted = row.extracted as ExtractedProduct | null;
    if (!extracted || extracted.accessoryType !== null) continue; // csak deszka
    const sourceName = sourceNameById.get(row.source_id as string) ?? "?";
    if (sourceFilter && !sourceName.toLowerCase().includes(sourceFilter)) continue;
    const missing = missingSpecLabels(extracted.specs);
    if (missing.length === 0) continue;
    const model = [extracted.brandName, extracted.modelName].filter(Boolean).join(" ") || extracted.rawTitle;
    const entry: IncompleteRow = { source: sourceName, model, missing, ref: (row.url as string | null) ?? "(nincs URL)" };
    // Nem valódi deszka (kajak/kötél/fin/stb.) — moderátori döntés kell,
    // NEM adatgyűjtés, ezért külön szakaszba kerül (F2.1-utó-6/9 minta).
    if (looksLikeNonBoardModel(model)) skipped.push(entry);
    else pending.push(entry);
  }

  const { data: liveRows, error: liveError } = await client
    .from("boards")
    .select("slug, model_name, length_cm, width_cm, thickness_cm, weight_kg, max_load_kg, brand:brands(name)")
    .eq("kind", "board")
    .eq("status", "active");
  if (liveError) throw new Error(`boards olvasás: ${liveError.message}`);

  const live: IncompleteRow[] = [];
  for (const row of liveRows ?? []) {
    const brand = row.brand as { name?: string } | { name?: string }[] | null;
    const brandName = Array.isArray(brand) ? (brand[0]?.name ?? "?") : (brand?.name ?? "?");
    if (sourceFilter && !brandName.toLowerCase().includes(sourceFilter)) continue;
    const missing = missingSpecLabels({
      lengthCm: row.length_cm as number | null,
      widthCm: row.width_cm as number | null,
      thicknessCm: row.thickness_cm as number | null,
      weightKg: row.weight_kg as number | null,
      maxLoadKg: row.max_load_kg as number | null,
    });
    if (missing.length === 0) continue;
    // `boards.slug` fordítható jsonb ({"hu": ..., "en": ...}) — ld. a
    // `verify-specs --board` hasonló megjegyzését.
    const slug = row.slug as { hu?: string; en?: string } | null;
    live.push({
      source: brandName,
      model: row.model_name as string,
      missing,
      ref: slug?.hu ?? slug?.en ?? "(nincs slug)",
    });
  }

  const htmlFlag = flag(args, "html");
  if (htmlFlag !== undefined) {
    // A felhasználó kérése (2026-08-16): böngészőben megnyitható, dátumozott
    // fájl a "for_validate/" mappában — sokkal áttekinthetőbb, mint a
    // terminál-kimenet. `--html` üresen (nincs útvonal) → alapértelmezett
    // "for_validate/<ma>-validalando-deszkak.html". A checkbox-ok localStorage-
    // ban perzisztálnak (csak SAJÁT munkaközbeni jegyzet — a mérvadó "kész"
    // állapotot a `verify-specs` adja, ld. a `report.ts` doc-kommentjét).
    const today = new Date().toISOString().slice(0, 10);
    const outPath =
      htmlFlag === "true"
        ? resolve(process.cwd(), "for_validate", `${today}-validalando-deszkak.html`)
        : resolve(process.cwd(), htmlFlag);
    const html = formatIncompleteReportHtml(pending, live, skipped, { generatedAt: today });
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, "utf8");
    console.log(`HTML riport írva: ${outPath}`);
    console.log(`  pending: ${pending.length} · élő board: ${live.length} · kihagyva: ${skipped.length}`);
    return;
  }

  console.log(formatIncompleteReport(pending, live, skipped));
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
    case "verify-specs":
      return commandVerifySpecs(args);
    case "list-incomplete":
      return commandListIncomplete(args);
    default:
      console.log(HELP);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
