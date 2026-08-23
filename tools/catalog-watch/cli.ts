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
import { dirname, join, resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  crawlAll,
  DEFAULT_MIN_DELAY_MS,
  extractPageProducts,
  needsRenderedText,
  type CrawlDeps,
  type FetchText,
} from "./crawl.ts";
import { resolveSupabaseTarget } from "./env.ts";
import { findDiscontinuedCandidates, DEFAULT_UNSEEN_DAYS } from "./lifecycle.ts";
import { dedupeCandidates, type DedupeCandidate } from "./dedupe.ts";
import { buildFamilyTypeMap, inferBoardType, type TypedExample } from "./family-type.ts";
import { planApproval } from "./match.ts";
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
  listBoardsForGalleryBackfill,
  listBoardsForImageBackfill,
  listBoardsForLifecycle,
  listCandidatesForBoards,
  listSources,
  mergeCandidateIntoBoard,
  updateBoardGallery,
  updateBoardImage,
} from "./store.ts";
import {
  displayImageUrl,
  galleryCandidates,
  imageFromPage,
  rankImageSources,
  shopifyProductJsonUrl,
  type ImageSourceCandidate,
} from "./images.ts";
import { SOURCE_RECIPES } from "./sources/index.ts";
import { planSourceSync } from "./sources/plan.ts";
import { htmlToText } from "./html.ts";
import {
  allCategoryMethods,
  boardTypesFromProse,
  multiUseFromProse,
} from "./normalize.ts";
import { findSuspicions, formatCoverage, type Suspicion } from "./suspicion.ts";
import type { BoardType, CrawlConfig, ExtractedProduct, SourceKind } from "./types.ts";

/**
 * Szünet a `suggest-categories --from-pages` letöltései között. Udvarias
 * crawl: ez a menet a MEGLÉVŐ katalógusra fut rá, tehát nem sürgős.
 */
const SUGGEST_DELAY_MS = 1200;

/** Egyetlen kérés felső időkorlátja — egy lassú bolt ne akassza meg a futást. */
const FETCH_TIMEOUT_MS = 20_000;

const HELP = `catalog-watch — SUP-katalógus piacfigyelő (docs/CATALOG_WATCH_TERV.md)

Parancsok:
  probe --url U                    Forrás-felderítés ADATBÁZIS NÉLKÜL: van-e
      [--name N] [--pattern RÉSZLET]... [--exclude RÉSZLET]...
      [--sitemap URL] [--samples N]     sitemap, JSON-LD, ár — és milyen
      [--default-brand NÉV]              kapcsolókkal érdemes felvenni
  list-sources                     A figyelt források listája
  sync-sources [--apply]           A REPÓBELI receptek (tools/catalog-watch/
                                    sources/*.ts) írása az adatbázisba. A
                                    beállítások eddig CSAK az adatbázisban
                                    éltek: nem voltak átnézhetők, nem voltak
                                    verziózva, és egy újraépítésnél elvesztek
                                    volna. SOHA nem töröl: a recept nélküli
                                    forrást csak JELENTI. DRY-RUN; --apply ír.
  sync-unpublished [--apply]       A receptben deklarált „a gyártó NEM KÖZLI"
                                    tény átvezetése a katalógus-sorokra, hogy
                                    az adatlap meg tudja különböztetni a
                                    „nem tudjuk"-ot a „nem létezik"-től. Csak
                                    hozzáad; DRY-RUN, --apply ír.
  capture-fixture                  Egy valós termékoldal mentése a GYÁRTÓNKÉNTI
      --source NÉV --url U          regresszió-hálóba (tools/catalog-watch/
      --teaches "mit tanít"         fixtures/). A mentett oldalon a tesztek
      [--brand MAPPA] [--name SLUG] hálózat nélkül futnak, így egy általános
                                    javításról másodpercek alatt kiderül, ha
                                    elrontott egy másik gyártót. A kiírt
                                    elvárás a MOSTANI kimenet — commit előtt
                                    át kell nézni.
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
  backfill-gallery [--apply]       A teljes képernyős nézet TOVÁBBI képei.
      [--all] [--limit N]           Forrása a Shopify termék saját JSON-ja
                                    (…/products/<handle>.json): ott a teljes
                                    images[] tömb strukturáltan ott van,
                                    termékenként egy kis kéréssel. A
                                    HTML-forrásokból SZÁNDÉKOSAN nem gyűjt —
                                    ott a „Related Products" MÁS termékek
                                    fotóit is felkínálná. Alapból csak a
                                    galéria nélküli sorokat nézi, és DRY-RUN.
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

/**
 * HIBATŰRŐ letöltés a visszatöltő parancsokhoz. A `realFetch` hálózati hibára
 * DOB — élesben ez egyetlen `fetch failed`-del megölte a 209 soros
 * galéria-visszatöltést a második sornál. A crawl régóta hibatűrő
 * (soronként gyűjti a hibát); a visszatöltők most már ugyanúgy.
 */
async function fetchOrNull(url: string): Promise<{ status: number; text: string } | null> {
  try {
    return await realFetch(url);
  } catch {
    return null;
  }
}

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

/**
 * A repóbeli receptek szinkronizálása az adatbázisba (F2.1-utó-36).
 *
 * A repó az AUTORITÁS: ami a receptben áll, az kerül a `crawl_config`-ba. Ez
 * fordítva is igaz — ha valaki élesben, kézzel írt át egy beállítást, a
 * szinkron VISSZAÁLLÍTJA a receptre. Ez szándékos: a beállítás mögött mindig
 * egy mérés áll, és annak a receptben, indoklással a helye.
 */
async function commandSyncSources(args: Args): Promise<void> {
  const apply = flag(args, "apply") !== undefined;
  const client = connect();
  const existing = await listSources(client, { onlyActive: false });
  const actions = planSourceSync(
    SOURCE_RECIPES,
    existing.map((row) => ({
      id: row.id,
      name: row.name,
      base_url: row.base_url,
      kind: row.kind,
      country: row.country,
      crawl_config: row.crawl_config,
    })),
  );

  for (const action of actions) {
    if (action.kind === "unchanged") continue;
    if (action.kind === "extra") {
      console.log(`?  ${action.name} — az adatbázisban van, de NINCS receptje (érintetlen)`);
      continue;
    }
    const what = action.kind === "create" ? "ÚJ forrás" : action.changes.join(", ");
    console.log(`${action.kind === "create" ? "+" : "~"}  ${action.name} — ${what}`);
  }
  const unchanged = actions.filter((a) => a.kind === "unchanged").length;
  const writes = actions.filter((a) => a.kind === "create" || a.kind === "update");
  console.log(`\n${unchanged} változatlan · ${writes.length} írandó`);

  if (writes.length === 0) return;
  if (!apply) {
    console.log("DRY-RUN — írni --apply-vel ír.");
    return;
  }

  for (const action of writes) {
    const recipe = SOURCE_RECIPES.find((r) => r.name === action.name);
    if (recipe === undefined) continue;
    const row = {
      name: recipe.name,
      base_url: recipe.baseUrl,
      kind: recipe.kind,
      country: recipe.country,
      crawl_config: recipe.crawlConfig,
    };
    const { error } =
      action.id === null
        ? await client.from("catalog_sources").insert(row)
        : await client.from("catalog_sources").update(row).eq("id", action.id);
    if (error) throw new Error(`${recipe.name}: ${error.message}`);
    console.log(`  írva: ${recipe.name}`);
  }
}

/**
 * „A GYÁRTÓ NEM KÖZLI" tény átvezetése a katalógus-sorokra (F2.1-utó-37).
 *
 * A tény a RECEPTBEN születik (`unpublishedFields`, indoklással), és a
 * megjelenítéshez a `boards` sorára kell kerülnie — a felületnek nincs
 * forrás-kapcsolata kéznél. Az átvezetés a MODERÁTOR ÁLTAL ELBÍRÁLT
 * (`approved`/`merged`) jelölt-kapcsolaton megy, ugyanazon az úton, mint a
 * kép-visszatöltés: a `pending` jelölt `matched_board_id`-ját még csak a
 * trigram-egyeztető tippelte.
 *
 * CSAK HOZZÁAD, nem vesz el: ha egy mező már meg van jelölve, marad. A
 * levételt (mert a gyártó elkezdte közölni) a fixtúra-teszt jelzi, és
 * moderátori döntés.
 */
async function commandSyncUnpublished(args: Args): Promise<void> {
  const apply = flag(args, "apply") !== undefined;
  const client = connect();
  const sources = await listSources(client, { onlyActive: false });

  let touched = 0;
  for (const source of sources) {
    const recipe = SOURCE_RECIPES.find((r) => r.name === source.name);
    const fields = recipe?.crawlConfig.unpublishedFields ?? [];
    if (fields.length === 0) continue;

    const { data: candidates, error } = await client
      .from("catalog_candidates")
      .select("matched_board_id, status")
      .eq("source_id", source.id)
      .not("matched_board_id", "is", null)
      .in("status", ["approved", "merged"]);
    if (error) throw new Error(`${source.name}: ${error.message}`);

    const boardIds = [...new Set((candidates ?? []).map((c) => c.matched_board_id as string))];
    if (boardIds.length === 0) continue;

    const { data: boards, error: boardsError } = await client
      .from("boards")
      .select("id, model_name, unpublished_fields")
      .in("id", boardIds);
    if (boardsError) throw new Error(`${source.name}: ${boardsError.message}`);

    console.log(`${source.name} — nem közölt: ${fields.join(", ")} (${boardIds.length} deszka)`);
    for (const board of boards ?? []) {
      const current = (board.unpublished_fields ?? []) as string[];
      const missing = fields.filter((field) => !current.includes(field));
      if (missing.length === 0) continue;
      touched += 1;
      console.log(`  + ${board.model_name}: ${missing.join(", ")}`);
      if (!apply) continue;
      const { error: updateError } = await client
        .from("boards")
        .update({ unpublished_fields: [...current, ...missing] })
        .eq("id", board.id);
      if (updateError) throw new Error(`${String(board.model_name)}: ${updateError.message}`);
    }
  }

  console.log(`\n${touched} deszka jelölendő`);
  if (touched > 0 && !apply) console.log("DRY-RUN — írni --apply-vel ír.");
}

/**
 * VÉGIGPRÓBÁLJA az ÖSSZES kategória-módszert egy valós termékoldalon.
 *
 * Ez maga a munkafolyamat, amit a felhasználó leírt (2026-08-22): új gyártónál
 * végigpróbálod a meglévő módszereket, a működőt beírod a receptbe. Ha egyik
 * sem visz eredményre, ÚJ módszert írsz — és az is felkerül a polcra, tehát a
 * következő gyártónál már próbálható.
 *
 * MINDEN módszer BIZONYÍTÉKKAL válaszol: melyik szövegrészlet/elem váltotta ki.
 * Enélkül a találat ellenőrizhetetlen állítás lenne, és épp az ilyenből lett a
 * Fanatic „choppy waters or rivers" mondatából vadvízi deszka.
 */
async function commandProbeMethods(args: Args): Promise<void> {
  const url = flag(args, "url");
  if (!url) throw new Error("Kötelező: --url");
  const sourceName = flag(args, "source");
  const recipe = sourceName
    ? SOURCE_RECIPES.find((item) => item.name === sourceName)
    : undefined;
  if (sourceName && !recipe) {
    throw new Error(
      `Nincs recept ehhez: "${sourceName}". Ismert: ${SOURCE_RECIPES.map((r) => r.name).join(", ")}`,
    );
  }

  const page = await realFetch(url);
  if (page.status !== 200) throw new Error(`HTTP ${page.status}`);

  // A RENDERELT szöveg is számít: van forrás, ahol a kategória csak JS után
  // kerül a látható szövegbe (fanatic.com), és ott a nyers HTML semmit sem ad.
  let pageText = htmlToText(page.text);
  if (recipe?.crawlConfig.renderWhenEmpty || flag(args, "render") !== undefined) {
    const fetcher = createRenderFetcher();
    try {
      const rendered = await fetcher.renderText(url);
      if (rendered !== null) pageText = rendered;
    } finally {
      await fetcher.close();
    }
  }

  const titleMatch = page.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const context = {
    html: page.text,
    pageText,
    rawTitle: htmlToText(titleMatch?.[1] ?? "").replace(/\s+/g, " ").trim(),
    sourceUrl: url,
    categoryClass: recipe?.crawlConfig.categoryClass,
    boardTypeByUrl: recipe?.crawlConfig.boardTypeByUrl ?? {},
    description: "",
  };

  const wanted = recipe?.crawlConfig.categoryMethods;
  console.log(`\n${url}`);
  if (wanted && wanted.length > 0) {
    console.log(`recept szerinti sorrend: ${wanted.join(" → ")}\n`);
  } else {
    console.log("a recept NEM szűkít — mind fut, a katalógus sorrendjében\n");
  }

  for (const method of allCategoryMethods()) {
    const result = method.run(context);
    const inRecipe = !wanted || wanted.length === 0 || wanted.includes(method.name);
    const mark = inRecipe ? " " : "·"; // a `·` = a recept NEM kéri
    const types = result.types.length > 0 ? result.types.join(", ") : "—";
    console.log(`${mark} ${method.name.padEnd(16)} ${types.padEnd(20)} ${result.evidence ?? ""}`);
  }
  console.log(
    "\nA `·` jelölt módszereket a recept nem kéri. A leírásukat a " +
      "`methods/catalog.ts` tartalmazza.",
  );
}

/**
 * TOVÁBBI KATEGÓRIÁK a gyártói LEÍRÁSBÓL (F2.1-utó-44).
 *
 * MIÉRT: „ahol a leírás többféle használatot tesz lehetővé, ott már előre
 * jelöljük" (felhasználói kérés, 2026-08-22). A gyártók a prózában mondják ki
 * a többes használatot — „Ideal for both all-around paddling and touring" —,
 * a specifikációs táblában nem. A halmaz-modell óta ez nem kétértelműség,
 * hanem a válasz.
 *
 * A FORRÁS a jelöltek `raw.description` mezője: a JSON-LD-s forrásoknál ez már
 * el van tárolva, tehát 209 termékhez HÁLÓZAT NÉLKÜL megvan a szöveg.
 *
 * CSAK HOZZÁAD, nem vesz el: a moderátor által beállított kategóriát nem
 * bántja. A javaslat DRY-RUN, mint minden író parancsunk.
 */
async function commandSuggestCategories(args: Args): Promise<void> {
  const apply = flag(args, "apply") !== undefined;
  const client = connect();

  const { data: candidates, error } = await client
    .from("catalog_candidates")
    .select("raw, url, extracted, matched_board_id, status")
    .not("matched_board_id", "is", null)
    .in("status", ["approved", "merged"]);
  if (error) throw new Error(`catalog_candidates: ${error.message}`);

  // A leírás a JELÖLTÉ, a kategória a DESZKÁÉ — a kapcsolat a moderátor által
  // elbírált `matched_board_id`. Bizonytalan (pending) párosítást nem
  // fogadunk el: ott a trigram-egyeztető tippelt, és MÁS termék leírása
  // kerülne a deszkára.
  const fromPages = flag(args, "from-pages") !== undefined;
  const proseByBoard = new Map<string, Set<string>>();

  if (fromPages) {
    // A TELJES TERMÉKOLDALRÓL. A tárolt `raw.description` rövid SEO-blurb
    // (medián 196 karakter, mérve: 210-ből 195 semmit nem ad) — a gyártók a
    // többes használatot a TELJES prózában mondják ki. Ezért itt újra
    // letöltjük az oldalt, és a `multiUseFromProse` mondat-szintű mintáját
    // eresztjük rá: az a navigációs menüre NEM ugrik rá.
    const urls = new Map<string, string>();
    for (const row of candidates ?? []) {
      const url = row.url as string | null;
      if (url) urls.set(row.matched_board_id as string, url);
    }
    let done = 0;
    for (const [boardId, url] of urls) {
      const page = await fetchOrNull(url);
      done += 1;
      if (done % 25 === 0) console.log(`  … ${done}/${urls.size}`);
      if (page === null || page.status !== 200) continue;
      const types = multiUseFromProse(htmlToText(page.text));
      if (types.length > 0) proseByBoard.set(boardId, new Set(types));
      await sleep(SUGGEST_DELAY_MS);
    }
  } else {
    for (const row of candidates ?? []) {
      const description = (row.raw as { description?: unknown } | null)?.description;
      if (typeof description !== "string" || description.length < 40) continue;
      const boardId = row.matched_board_id as string;
      const set = proseByBoard.get(boardId) ?? new Set<string>();
      for (const type of boardTypesFromProse(description)) set.add(type);
      proseByBoard.set(boardId, set);
    }
  }

  const { data: boards, error: boardsError } = await client
    .from("boards")
    .select("id, model_name, board_type, board_types, brand:brands(name)")
    .eq("kind", "board")
    .in("id", [...proseByBoard.keys()]);
  if (boardsError) throw new Error(`boards: ${boardsError.message}`);

  let changed = 0;
  for (const board of boards ?? []) {
    const current = ((board.board_types ?? []) as string[]).length > 0
      ? (board.board_types as string[])
      : [board.board_type as string];
    const proposed = [...(proseByBoard.get(board.id as string) ?? [])].filter(
      (type) => !current.includes(type),
    );
    if (proposed.length === 0) continue;
    changed += 1;
    const brand = (board as { brand?: { name?: string } }).brand?.name ?? "";
    console.log(
      `+ ${brand} ${board.model_name}: ${current.join(", ")} → ${[...current, ...proposed].join(", ")}`,
    );
    if (!apply) continue;
    const { error: updateError } = await client
      .from("boards")
      .update({ board_types: [...current, ...proposed] })
      .eq("id", board.id);
    if (updateError) throw new Error(`${String(board.model_name)}: ${updateError.message}`);
  }

  console.log(`\n${changed} deszka kapna további kategóriát a gyártói leírásból`);
  if (changed > 0 && !apply) console.log("DRY-RUN — írni --apply-vel ír.");
}

/**
 * FIXTÚRA-RÖGZÍTÉS: egy valós termékoldal mentése a regresszió-hálóba.
 *
 * A rögzítés ADATBÁZIS NÉLKÜL megy — a beállítás a repóbeli receptből jön,
 * ahogy a tesztben is. A renderelés csak akkor fut, ha a recept szerint kell
 * (`renderWhenEmpty`) vagy a nyers HTML nem használható.
 *
 * FONTOS: a kiírt `expected` a MOSTANI kimenet. Ha a kinyerés ma hibás, a
 * fixtúra a HIBÁT betonozná be — ezért a parancs kiírja a hat mezőt, és a
 * commit előtt EL KELL OLVASNI. Ez ugyanaz a lépés, mint a `crawl --dry-run`
 * ellenőrzése egy új forrásnál.
 */
async function commandCaptureFixture(args: Args): Promise<void> {
  const sourceName = flag(args, "source");
  const url = flag(args, "url");
  if (!sourceName || !url) throw new Error("Kötelező: --source és --url");
  const recipe = SOURCE_RECIPES.find((r) => r.name === sourceName);
  if (recipe === undefined) {
    throw new Error(
      `Nincs recept ehhez: "${sourceName}". Ismert: ${SOURCE_RECIPES.map((r) => r.name).join(", ")}`,
    );
  }
  const teaches = flag(args, "teaches");
  if (!teaches) {
    throw new Error(
      "Kötelező: --teaches «mit tanít ez a fixtúra» — bukáskor EZ mondja meg, mi veszett el.",
    );
  }
  const dir = join(
    "tools/catalog-watch/fixtures",
    flag(args, "brand") ?? slugify(recipe.name),
  );
  // Az URL utolsó NEM ÜRES szegmense: sok forrás záró perjellel adja a
  // termék-URL-t (gladiatorsup.com), és a puszta `pop()` ott üres nevet adna.
  const segments = new URL(url).pathname.split("/").filter((part) => part !== "");
  const slug = flag(args, "name") ?? slugify(segments[segments.length - 1] ?? "oldal");

  const page = await realFetch(url);
  if (page.status !== 200) throw new Error(`HTTP ${page.status}`);

  let products = extractPageProducts(page.text, url, recipe.crawlConfig, null);
  let renderedText: string | null = null;
  if (needsRenderedText(products, recipe.crawlConfig)) {
    const fetcher = createRenderFetcher();
    try {
      renderedText = await fetcher.renderText(url);
    } finally {
      await fetcher.close();
    }
    if (renderedText !== null) {
      const rerendered = extractPageProducts(page.text, url, recipe.crawlConfig, renderedText);
      if (rerendered.length > 0) products = rerendered;
      else renderedText = null;
    }
  }
  if (products.length === 0) throw new Error("A kinyerés EGYETLEN terméket sem adott.");

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${slug}.html.gz`), gzipSync(Buffer.from(page.text, "utf8")));
  if (renderedText !== null) {
    writeFileSync(join(dir, `${slug}.txt.gz`), gzipSync(Buffer.from(renderedText, "utf8")));
  }
  const kase = {
    source: recipe.name,
    url,
    capturedAt: new Date().toISOString().slice(0, 10),
    teaches,
    rendered: renderedText !== null,
    expected: products,
  };
  writeFileSync(join(dir, `${slug}.json`), `${JSON.stringify(kase, null, 2)}\n`);

  console.log(`\n${dir}/${slug} — ${products.length} termék${renderedText ? " (renderelt)" : ""}`);
  console.log("NÉZD ÁT, mielőtt commitolod — a mostani kimenet lesz az elvárás:\n");
  for (const product of products) {
    const s = product.specs;
    console.log(
      `  ${product.brandName ?? "?"} · ${product.modelName} [${product.boardType ?? "nincs kategória"}]\n` +
        `    ${s.lengthCm ?? "?"} × ${s.widthCm ?? "?"} × ${s.thicknessCm ?? "?"} cm · ` +
        `${s.volumeL ?? "?"} L · ${s.weightKg ?? "?"} kg · teherbírás ${s.maxLoadKg ?? "?"} kg`,
    );
  }
}

/** Fájlnév-barát alak: ékezet nélkül, kisbetűvel, kötőjelezve. */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
  const titleCut = flagList(args, "title-cut");
  if (titleCut) crawlConfig.titleCutAfter = titleCut;
  if (flag(args, "render-when-empty") !== undefined) crawlConfig.renderWhenEmpty = true;
  const categoryClass = flag(args, "category-class");
  if (categoryClass) crawlConfig.categoryClass = categoryClass;
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
  /** Gyanú-jelet viselő sorok — a gépi menet átlépi őket, a moderátor nem. */
  const skippedSuspicious: { modelName: string; details: Suspicion[] }[] = [];
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
    // BIZTONSÁGI MEZŐK. Az űrtartalom akkor NEM kötelező, ha a forrás
    // receptje szerint a gyártó nem közli (F2.1-utó-37) — ott a hiány maga a
    // tény, nem adathiba, és a Deszkaválasztó is beengedi az ilyen deszkát,
    // ha a gyártói teherbírás megvan. Máshol viszont a hiányzó űrtartalom
    // továbbra is moderátori kérdés.
    const unpublished = source?.crawl_config?.unpublishedFields ?? [];
    const volumeRequired = !unpublished.includes("volumeL");
    if (
      !isAccessory &&
      (extracted.specs.maxLoadKg === null ||
        (volumeRequired && extracted.specs.volumeL === null))
    ) {
      skippedNoSafety += 1;
      continue;
    }
    // GYANÚ-JEL (F2.1-utó-38): a megjelölt sor NEM mehet át tömegesen. Ez az a
    // fogaskerék, ami a jelzést védelemmé teszi — enélkül a gyanús érték
    // bekerülne az adatbázisba, és onnantól ugyanolyan tényként viselkedne,
    // mint a többi. A moderátor egyenként megnézheti (hátha csak egy modell
    // HTML-oldala hibás), de a gépi menet átlépi.
    const suspicions = findSuspicions(extracted);
    if (suspicions.length > 0) {
      skippedSuspicious.push({ modelName: extracted.modelName, details: suspicions });
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

  // ÚJRA-EGYEZTETÉS a MOSTANI katalógussal (2026-08-20). A jelölt sora a crawl
  // pillanatában fagyott meg: a bolti jelöltek java KORÁBBAN keletkezett, mint
  // a hozzájuk tartozó gyártói deszka, ezért `matched_board_id` nélkül vannak.
  // Enélkül a jóváhagyó „új típusként" vinné be őket, és a katalógusba került
  // volna egy második ATLAS, BEAST, HYPER, RAPID és Dhyana — bolti nevekkel.
  //
  // A három kimenet háromféle sorsot kap:
  //  * `known`     — biztos egyezés (név ÉS márka): ÖSSZEFÉSÜLÉS, nem új sor,
  //  * `uncertain` — bizonytalan: MARAD a moderátornál (nem tippelünk helyette),
  //  * `new`       — tényleg új típus: mehet a szokásos jóváhagyásra.
  const liveForMatch = await createSupabaseStore(client).listBoardsForMatch();
  const freshCandidates: DedupeCandidate[] = [];
  const toMerge: { candidate: DedupeCandidate; boardId: string; boardName: string }[] = [];
  let leftUncertain = 0;
  for (const candidate of eligible) {
    const plan = planApproval(candidate.extracted, liveForMatch);
    if (plan.kind === "merge") {
      const board = liveForMatch.find((b) => b.id === plan.boardId);
      toMerge.push({
        candidate,
        boardId: plan.boardId,
        boardName: `${board?.brandName ?? ""} ${board?.modelName ?? ""}`.trim(),
      });
    } else if (plan.kind === "moderator") {
      leftUncertain += 1;
    } else {
      freshCandidates.push(candidate);
    }
  }

  const groups = dedupeCandidates(freshCandidates);
  const planned = limit === undefined ? groups : groups.slice(0, limit);

  console.log(
    `\nJóváhagyható: ${freshCandidates.length} jelölt → ${groups.length} deszka ` +
      `(${freshCandidates.length - groups.length} duplikátum összevonva)`,
  );
  if (toMerge.length > 0) {
    console.log(`MEGLÉVŐ katalógus-sorral fésülendő: ${toMerge.length} jelölt`);
    for (const merge of toMerge) {
      console.log(`  ⇄ ${merge.candidate.extracted.modelName} → ${merge.boardName}`);
    }
  }
  if (leftUncertain > 0) {
    console.log(`Bizonytalan egyezés — a MODERÁTORNÁL marad: ${leftUncertain} jelölt`);
  }
  console.log(
    `Kihagyva: ${skippedNoType} kategória nélkül · ${skippedNoSafety} biztonsági mező nélkül` +
      (skippedNoBrand > 0 ? ` · ${skippedNoBrand} márkanév nélkül` : ""),
  );
  // A gyanús sorokat NÉVVEL és INDOKKAL írjuk ki: a moderátornak egyenként kell
  // megnéznie őket, és a lista mondja meg, mit keressen az oldalon.
  if (skippedSuspicious.length > 0) {
    console.log(
      `\nGYANÚS ÉRTÉK MIATT KIHAGYVA — moderátori döntés kell (${skippedSuspicious.length}):`,
    );
    for (const item of skippedSuspicious) {
      console.log(`  ${item.modelName}`);
      for (const detail of item.details) console.log(`      ${detail.detail}`);
    }
  }
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

  let mergedIntoExisting = 0;
  for (const merge of toMerge) {
    const result = await mergeCandidateIntoBoard(client, {
      candidateId: merge.candidate.id,
      boardId: merge.boardId,
      reviewerId,
    });
    if (result.ok) mergedIntoExisting += 1;
    else failures.push(`${merge.candidate.extracted.modelName} → ${merge.boardName}: ${result.error}`);
  }

  console.log(`\nLétrehozva: ${created}/${planned.length} deszka`);
  if (toMerge.length > 0) {
    console.log(`Meglévő sorral összefésülve: ${mergedIntoExisting}/${toMerge.length} jelölt`);
  }
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
    // MEZŐLEFEDETTSÉG (F2.1-utó-38): a hiány forrás-szinten mond valamit. A
    // „19/20" egy termék ügye, a „0/15" a kinyerésé — a kettőt eddig semmi
    // nem különböztette meg, mert a summary terméket számolt, mezőt nem.
    if (source.coverage.length > 0 && source.coverage[0]!.total > 0) {
      console.log(`    mezők: ${formatCoverage(source.coverage)}`);
    }
    // GYANÚS ÉRTÉKEK. Nem elutasítás — de itt, a gyűjtésnél derül ki, amíg
    // még meg lehet nézni, egyetlen modell oldala hibás-e vagy az egész forrás.
    for (const item of source.suspicious) {
      console.log(`    GYANÚS — ${item.modelName}`);
      for (const detail of item.details) console.log(`        ${detail}`);
      console.log(`        ${item.url}`);
    }
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
        // A TÁROLT URL is átmegy a megjelenítési normalizáláson: a jelölt-sor
        // a crawl idején keletkezett, esetleg még a méret-szabály előtt
        // (élesben: a Bluefin JSON-LD-je `width=1920`-at írt, 1656 kB/kép).
        image = displayImageUrl(source.storedImageUrl);
        break;
      }
      const response = await fetchOrNull(source.url as string);
      await sleep(DEFAULT_MIN_DELAY_MS);
      if (response === null || response.status >= 400 || response.text === "") continue;
      image = imageFromPage(response.text, row.modelName);
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

/**
 * GALÉRIA-visszatöltés: a teljes képernyős nézet további képei (F2.1-utó-30).
 *
 * MIÉRT KÜLÖN a `backfill-images`-től: más a FORRÁSA. A borítót a termékoldal
 * HTML-jéből keressük, a galériát viszont a Shopify termék SAJÁT JSON-jából
 * (`…/products/<handle>.json`) — ott a teljes `images[]` tömb strukturáltan ott
 * van, termékenként egyetlen kis kéréssel.
 *
 * A HTML-forrásokból (Aqua Marina, Indiana, Zray) SZÁNDÉKOSAN nem gyűjtünk:
 * ott a „Related Products" blokk MÁS termékek fotóit is felkínálná — ugyanaz a
 * csapda, ami az „ALUMINUM OARS" hibát okozta. Egy rossz kép rosszabb, mint a
 * hiánya; azok a deszkák egyelőre egy képesek maradnak, és a felület ezt
 * elegánsan kezeli (nincs pöttysor, nincs legyintés).
 */
async function commandBackfillGallery(args: Args): Promise<void> {
  const apply = flag(args, "apply") === "true";
  const all = flag(args, "all") === "true";
  const limit = flagNumber(args, "limit");
  const client = connect();

  const rows = await listBoardsForGalleryBackfill(client, { includeFilled: all });
  const targets = limit === undefined ? rows : rows.slice(0, limit);
  if (targets.length === 0) {
    console.log("Minden sornak van galériája — nincs mit pótolni.");
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

  let filled = 0;
  let notShopify = 0;
  let empty = 0;
  for (const row of targets) {
    const ranked = rankImageSources(byBoard.get(row.id) ?? []);
    const jsonUrl = ranked.map((source) => shopifyProductJsonUrl(source.url)).find((u) => u !== null);
    if (jsonUrl === undefined || jsonUrl === null) {
      notShopify += 1;
      continue;
    }

    const response = await fetchOrNull(jsonUrl);
    await sleep(DEFAULT_MIN_DELAY_MS);
    if (response === null || response.status >= 400 || response.text === "") {
      empty += 1;
      continue;
    }

    let imageUrls: string[] = [];
    try {
      const parsed = JSON.parse(response.text) as { product?: { images?: { src?: string }[] } };
      imageUrls = (parsed.product?.images ?? []).map((image) => image.src ?? "");
    } catch {
      empty += 1;
      continue;
    }

    const gallery = galleryCandidates(imageUrls, row.imageUrl);
    if (gallery.length === 0) {
      empty += 1;
      continue;
    }

    filled += 1;
    console.log(`  ✓ ${row.modelName} — ${gallery.length} kép`);
    if (apply) await updateBoardGallery(client, row.id, gallery);
  }

  console.log(
    `\n${filled} galéria ${apply ? "beírva" : "megvan (DRY-RUN, nem íródott)"} · ` +
      `${notShopify} nem Shopify-forrású (marad egy képes) · ${empty} üres`,
  );
  if (!apply && filled > 0) console.log("Írás: add hozzá a --apply kapcsolót.");
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
    case "sync-sources":
      return commandSyncSources(args);
    case "sync-unpublished":
      return commandSyncUnpublished(args);
    case "probe-methods":
      return commandProbeMethods(args);
    case "suggest-categories":
      return commandSuggestCategories(args);
    case "capture-fixture":
      return commandCaptureFixture(args);
    case "add-source":
      return commandAddSource(args);
    case "crawl":
      return commandCrawl(args);
    case "backfill-images":
      return commandBackfillImages(args);
    case "backfill-gallery":
      return commandBackfillGallery(args);
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
