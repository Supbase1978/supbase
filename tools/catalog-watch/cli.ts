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
import { dedupeCandidates, type DedupeCandidate } from "./dedupe.ts";
import { buildFamilyTypeMap, inferBoardType, type TypedExample } from "./family-type.ts";
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
  approveCandidateRow,
  createDryRunStore,
  createServiceClient,
  createSupabaseStore,
  insertSource,
  listAllSources,
  listBoardsForImageBackfill,
  listBoardsForLifecycle,
  listCandidatesForBoards,
  listSources,
  updateBoardImage,
} from "./store.ts";
import { imageFromPage, rankImageSources, type ImageSourceCandidate } from "./images.ts";
import type { BoardType, CrawlConfig, ExtractedProduct, SourceKind } from "./types.ts";

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
      [--shopify [--product-type "SUP Hardboard"]...]
      --default-brand: fallback márkanév, ha a JSON-LD nem ad brand/manufacturer
      mezőt (egymárkás gyártói bolt esetén gyakori)
      --shopify: a bolt /products.json végpontjáról dolgozunk sitemap helyett
      (Shopify-boltoknál a méret gyakran csak JS után jelenik meg a HTML-ben;
      a /products.json strukturáltan adja, és 1-2 kérés az egész katalógus).
      --product-type: csak ezek a Shopify-kategóriák (ismételhető)
      --html-only: nincs JSON-LD az oldalon, de a specifikáció címkézett
      szövegként ott van (pl. aquamarina.com). Csak akkor ad jelöltet, ha a
      hossz tényleg kijött — így a blog/kategória oldalak kimaradnak.
      --title-suffix: a <title> végéről levágandó oldal-szintű utótag
      (ismételhető), pl. "-Zray Official Site" — enélkül a modellnév része lenne
  crawl [--source NÉV|ID] [--dry-run] [--max N]
                                   Crawl az aktív forrásokból
  approve-candidates               TÖMEGES jóváhagyás (F2.1-utó-19). A tiszta
      [--source NÉV] [--apply]      eseteket egy menetben hagyja jóvá, a
      [--brand-site] [--limit N]    duplikátumokat összevonja: a GYÁRTÓI
      [--accessories]               (--accessories: a felszerelés-jelöltek —
      [--reviewer ID]               jelölt nyer, a hiányzó mezőit a kereskedői
                                    lapról tölti. Csak az mehet át, aminél
                                    van kategória ÉS megvan a két biztonsági
                                    mező (teherbírás, térfogat) — a többi a
                                    moderátornál marad. ALAPÉRTELMEZÉSBEN
                                    DRY-RUN; írni csak --apply-vel ír.
  backfill-images [--apply]        TERMÉKKÉP-visszatöltés a már élő sorokra.
      [--all] [--limit N]           A crawl a JELÖLTET írja, a jóváhagyott
                                    deszkát nem — a képet ezért a sor SAJÁT
                                    forrás-oldaláról szedjük, a
                                    matched_board_id kapcsolaton át (nem
                                    hasonlóság alapján!). Csak MODERÁTOR által
                                    elbírált (approved/merged) kapcsolatot
                                    fogad el, és a gyártói oldalt előbb
                                    próbálja, mint a boltit. Alapból csak a
                                    kép nélküli sorokat nézi (--all: mindet
                                    újraszámolja), és DRY-RUN; --apply ír.
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
  const titleSuffixes = flagList(args, "title-suffix");
  if (titleSuffixes) crawlConfig.titleSuffixes = titleSuffixes;
  const notes = flag(args, "notes");
  if (notes) crawlConfig.notes = notes;

  // JSON-LD nélküli gyártói oldal (F2.1-utó-17).
  if (flag(args, "html-only") !== undefined) crawlConfig.htmlOnly = true;

  // Shopify-mód (F2.1-utó-14): a `/products.json`-ról dolgozunk, nem sitemapről.
  if (flag(args, "shopify") !== undefined) {
    const productTypes = flagList(args, "product-type");
    crawlConfig.shopify = productTypes ? { productTypes } : {};
    if (crawlConfig.sitemapUrl || crawlConfig.productUrlPatterns) {
      console.warn(
        "FIGYELEM: --shopify mellett a --sitemap/--pattern nem játszik (a katalógus a /products.json-ból jön).",
      );
    }
  }

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

/**
 * TÖMEGES JÓVÁHAGYÁS. A moderációs UI `approveCandidate`-jével azonos műveletet
 * végzi, csak sok soron — mert 500 tétel egyenkénti átkattintása értelmetlen
 * munka lenne. A „figyelő sosem publikál magától" elv NEM sérül: ezt a
 * parancsot az ADMIN futtatja, a saját döntéseként.
 *
 * Amit NEM hagy jóvá (marad a moderátornál):
 *  - nincs kategória (`boardType`) — azt csak ember tudja eldönteni,
 *  - hiányzik a TEHERBÍRÁS vagy a TÉRFOGAT — ez a két kemény, biztonsági
 *    szűrő a Deszkaválasztóban; nélkülük a deszka amúgy sem kerülne ajánlásba.
 */
async function commandApproveCandidates(args: Args): Promise<void> {
  const apply = flag(args, "apply") !== undefined;
  const limit = flagNumber(args, "limit");
  const sourceFilter = flag(args, "source")?.toLowerCase();
  // Csak GYÁRTÓI forrásból: a modellnév ott hivatalos, a bolti nevek
  // zajosak („Aqua Marina FUSION ( )"), és a bolti jelöltek kategória-tippje
  // is megbízhatatlanabb. A kihagyottak nem vesznek el: amint a gyártói
  // deszkák léteznek, a következő crawl a boltiakat MÁR ISMERT deszkára
  // illeszti (ár + elérhetőség), nem új jelöltként.
  const brandSiteOnly = flag(args, "brand-site") !== undefined;
  // KIEGÉSZÍTŐ-mód: a jelölt-sor deszkákat ÉS a 3 követett felszerelés-
  // kategóriát is tartalmazza. A kiegészítőknél nincs emberi döntés: a
  // kategóriát (`accessoryType`) a besoroló már megadta, biztonsági
  // mérőszám pedig nem kell hozzájuk.
  const accessoriesOnly = flag(args, "accessories") !== undefined;
  const client = connect();

  const reviewerId = flag(args, "reviewer") ?? (await resolveAdminReviewer(client));
  if (!reviewerId) {
    throw new Error("Nem találtam admin profilt — add meg a --reviewer <profil-id> kapcsolóval.");
  }

  const sources = await listAllSources(client);
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const { data: rows, error } = await client
    .from("catalog_candidates")
    .select("id, url, source_id, extracted")
    .eq("status", "pending");
  if (error) throw new Error(`catalog_candidates olvasás: ${error.message}`);

  // CSALÁD → KATEGÓRIA (F2.1-utó-21): a gyártói kollekciók csak az AKTUÁLIS
  // évjáratot sorolják fel, ezért ugyanannak a modellcsaládnak a régebbi
  // példányai kategória nélkül maradnak. A már ISMERT besorolásokat (élő
  // deszkák + típussal bíró jelöltek) átvesszük a család többi tagjára.
  const { data: liveBoards } = await client
    .from("boards")
    .select("model_name, board_type, brand:brands(name)")
    .eq("kind", "board");
  const examples: TypedExample[] = [];
  for (const row of (liveBoards ?? []) as Record<string, unknown>[]) {
    const brand = row.brand as { name?: string } | { name?: string }[] | null;
    examples.push({
      brandName: (Array.isArray(brand) ? brand[0]?.name : brand?.name) ?? null,
      modelName: (row.model_name as string | null) ?? "",
      boardType: (row.board_type as BoardType | null) ?? null,
      // Az élő deszka moderátori döntésből született → megbízható.
      trusted: true,
    });
  }
  for (const row of rows ?? []) {
    const extracted = row.extracted as ExtractedProduct | null;
    if (!extracted || extracted.accessoryType !== null) continue;
    examples.push({
      brandName: extracted.brandName,
      modelName: extracted.modelName,
      boardType: extracted.boardType,
      // CSAK a gyártói oldal tippje megbízható: a boltok címeiből levezetett
      // kategória élesben tévesnek bizonyult (a Fusion „kids" lett volna).
      trusted: sourceById.get(row.source_id as string)?.kind === "brand_site",
    });
  }
  const { byFamily, conflicts } = buildFamilyTypeMap(examples);
  if (conflicts.size > 0) {
    console.log(`Ellentmondásos családok (nem következtetünk): ${[...conflicts].join(", ")}`);
  }

  const eligible: DedupeCandidate[] = [];
  let skippedNoType = 0;
  let skippedNoSafety = 0;
  let skippedNoBrand = 0;
  let inferredType = 0;
  for (const row of rows ?? []) {
    const extracted = row.extracted as ExtractedProduct | null;
    if (!extracted) continue;
    const isAccessory = extracted.accessoryType !== null;
    if (isAccessory !== accessoriesOnly) continue;
    const source = sourceById.get(row.source_id as string);
    if (sourceFilter && !(source?.name ?? "").toLowerCase().includes(sourceFilter)) continue;
    if (brandSiteOnly && source?.kind !== "brand_site") continue;

    if (!extracted.brandName) {
      // A jóváhagyás márkát old fel/hoz létre — márkanév nélkül elakadna.
      skippedNoBrand += 1;
      continue;
    }
    if (!isAccessory && (extracted.specs.maxLoadKg === null || extracted.specs.volumeL === null)) {
      skippedNoSafety += 1;
      continue;
    }
    let boardType = extracted.boardType;
    if (!isAccessory && boardType === null) {
      boardType = inferBoardType(byFamily, extracted.brandName, extracted.modelName);
      if (boardType === null) {
        skippedNoType += 1;
        continue;
      }
      inferredType += 1;
    }
    eligible.push({
      id: row.id as string,
      url: (row.url as string | null) ?? "",
      extracted: { ...extracted, boardType },
      sourceKind: source?.kind ?? "shop",
      sourceName: source?.name ?? "?",
    });
  }

  const groups = dedupeCandidates(eligible);
  const planned = limit === undefined ? groups : groups.slice(0, limit);

  console.log(
    `\nJóváhagyható: ${eligible.length} jelölt → ${groups.length} deszka ` +
      `(${eligible.length - groups.length} duplikátum összevonva)`,
  );
  console.log(
    `Kihagyva: ${skippedNoType} kategória nélkül · ${skippedNoSafety} biztonsági mező nélkül` +
      (skippedNoBrand > 0 ? ` · ${skippedNoBrand} márkanév nélkül` : ""),
  );
  if (inferredType > 0) {
    console.log(`Kategória a modellcsaládból örökölve: ${inferredType} jelölt`);
  }
  console.log(apply ? `\nÍRÁS (--apply), ${planned.length} deszka:` : `\n[DRY-RUN] amit létrehozna (${planned.length}):`);

  let created = 0;
  const failures: string[] = [];
  for (const group of planned) {
    const w = group.winner.extracted;
    const label = w.accessoryType ?? w.boardType;
    const merged = group.merged.length > 0 ? ` +${group.merged.length} összevonva` : "";
    const filled = group.filledFields.length > 0 ? ` [pótolt: ${group.filledFields.join(", ")}]` : "";
    console.log(`  ${w.brandName} ${w.modelName} (${label})${merged}${filled}`);
    if (!apply) continue;

    const result = await approveCandidateRow(client, {
      candidateId: group.winner.id,
      extracted: w,
      boardType: w.boardType,
      accessoryType: w.accessoryType,
      reviewerId,
      mergedCandidateIds: group.merged.map((m) => m.id),
    });
    if (result.ok) created += 1;
    else failures.push(`${w.brandName} ${w.modelName}: ${result.error}`);
  }

  if (!apply) {
    console.log("\n(semmi nem íródott — futtasd --apply kapcsolóval)");
    return;
  }
  console.log(`\nLétrehozva: ${created}/${planned.length} deszka`);
  for (const failure of failures) console.log(`  HIBA: ${failure}`);
}

/** Az első admin profil — a jóváhagyás `reviewed_by` mezőjéhez. */
async function resolveAdminReviewer(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.from("profiles").select("id").eq("role", "admin").limit(1);
  return ((data as { id: string }[] | null) ?? [])[0]?.id ?? null;
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
    renderTables: (url) => renderFetcher.renderTables(url),
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
        `${source.robotsBlocked} robots-tiltás` +
        (source.specTablesUsed > 0 ? ` · ${source.specTablesUsed} gyártói spec-tábla` : ""),
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
      // A specifikáció kiírása a dry-run LÉNYEGE: írás előtt látni kell,
      // mit tenne be — különösen a teherbírást, ami kötelező biztonsági mező.
      const s = candidate.specs;
      const specs = [
        s.lengthCm === null ? null : `H${s.lengthCm}`,
        s.widthCm === null ? null : `Sz${s.widthCm}`,
        s.thicknessCm === null ? null : `V${s.thicknessCm}`,
        s.volumeL === null ? null : `${s.volumeL}L`,
        s.weightKg === null ? null : `${s.weightKg}kg`,
        s.maxLoadKg === null ? null : `teher:${s.maxLoadKg}kg`,
      ]
        .filter((part) => part !== null)
        .join(" ");
      console.log(`  jelölt: ${candidate.modelName} (${pair}) [${specs || "NINCS ADAT"}]`);
      console.log(`     ${candidate.url}`);
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

/**
 * TERMÉKKÉP-visszatöltés a már élő katalógus-sorokra (`images.ts`).
 *
 * MIÉRT KÜLÖN PARANCS és nem a crawl része: a `saveCandidate` szándékosan nem
 * támasztja fel az elbírált jelölteket, tehát egy újracrawl a jóváhagyott
 * deszka képét sosem pótolná. Ez a parancs a MEGLÉVŐ soron tölt ki egy mezőt,
 * a sor saját forrás-oldaláról.
 */
async function commandBackfillImages(args: Args): Promise<void> {
  const apply = flag(args, "apply") === "true";
  const all = flag(args, "all") === "true";
  const limit = flagNumber(args, "limit");
  const client = connect();

  const rows = await listBoardsForImageBackfill(client, { includeWithImage: all });
  const targets = limit === undefined ? rows : rows.slice(0, limit);
  if (targets.length === 0) {
    console.log("Minden katalógus-sornak van képe — nincs mit pótolni.");
    return;
  }

  const candidates = await listCandidatesForBoards(
    client,
    targets.map((row) => row.id),
  );
  const sources = await listAllSources(client);
  const kindById = new Map(sources.map((source) => [source.id, source.kind as string]));

  const byBoard = new Map<string, ImageSourceCandidate[]>();
  for (const candidate of candidates) {
    const list = byBoard.get(candidate.boardId) ?? [];
    list.push({
      url: candidate.url,
      status: candidate.status,
      sourceKind: kindById.get(candidate.sourceId) ?? null,
      storedImageUrl: candidate.imageUrl,
    });
    byBoard.set(candidate.boardId, list);
  }

  console.log(
    `${apply ? "" : "[DRY-RUN] "}${targets.length} sor vizsgálata ` +
      `(alap-szünet ${DEFAULT_MIN_DELAY_MS} ms)…\n`,
  );

  let found = 0;
  let noSource = 0;
  let noImage = 0;
  for (const row of targets) {
    const ranked = rankImageSources(byBoard.get(row.id) ?? []);
    if (ranked.length === 0) {
      noSource += 1;
      console.log(`  – ${row.modelName}: nincs elbírált forrás-oldala`);
      continue;
    }

    let image: string | null = null;
    for (const source of ranked) {
      if (source.storedImageUrl) {
        image = source.storedImageUrl;
        break;
      }
      const { status, text } = await realFetch(source.url as string);
      await sleep(DEFAULT_MIN_DELAY_MS);
      if (status >= 400 || text === "") continue;
      image = imageFromPage(text, row.modelName);
      if (image !== null) break;
    }

    if (image === null) {
      noImage += 1;
      console.log(`  ? ${row.modelName}: a forrás-oldalán nem találtam képet`);
      continue;
    }

    found += 1;
    console.log(`  ✓ ${row.modelName}\n      ${image}`);
    if (apply) await updateBoardImage(client, row.id, image);
  }

  console.log(
    `\n${found} kép ${apply ? "beírva" : "megvan (DRY-RUN, nem íródott)"} · ` +
      `${noSource} forrás nélkül · ${noImage} oldalon nem volt kép`,
  );
  if (!apply && found > 0) console.log("Írás: add hozzá a --apply kapcsolót.");
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
    case "backfill-images":
      return commandBackfillImages(args);
    case "lifecycle":
      return commandLifecycle(args);
    case "approve-candidates":
      await commandApproveCandidates(args);
      break;
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
