# Catalog-watch — piacfigyelő pipeline (terv)

> Állapot: **jóváhagyott terv** (2026-07-17). Séma-előkészítés: F1.5. Futó
> rendszer (crawler + moderációs UI): F2. Kapcsolódás: a fő spec 3.1 (catalog
> séma), 5.1 (ütemezett scraper-minta), 11.4 (fázisbontás).

## Cél és alapelv

A katalógus típusait (SUP-deszka modellek) **ne kézzel kelljen bevinni és
karbantartani**: a rendszer automatikusan találja meg az új modelleket, kövesse
az árakat/elérhetőséget, és jelezze, ha egy modell eltűnt a piacról. Az admin
dolga egyetlen egyszerű jóváhagyás típusonként — ez a kapu védi ki, hogy
ugyanaz a modell rossz vagy eltérő néven duplán kerüljön fel.

**A figyelő soha nem publikál magától.** Minden új típus-jelölt moderációs
sorba kerül; a katalógus kurált jellege (RLS: írás csak moderator/admin)
változatlan — a figyelő maga is csak jelölt- és ártáblákba ír.

## A pipeline

```
[bármikor, kézzel]  Új bolt/forrás felvitele (admin-űrlap VAGY CLI-parancs) → catalog_sources
[2-3 havonta]       Automatikus forrás-felderítés webkereséssel → forrás-JAVASLAT → admin hagyja jóvá
[hetente, cron]     Crawl minden aktív forrásból (sitemap + JSON-LD Product; fallback: LLM-extrakció)
                      → normalizálás → egyezés-keresés (pg_trgm fuzzy: brand+model+year)
                      → ismert deszka: last_seen_at frissül + board_prices sor
                      → új/bizonytalan: catalog_candidates (pending) + valószínű egyezések listája
[admin, bármikor]   Moderációs sor: jóváhagy / elutasít / MERGE meglévő típusba (dupla-név védelem)
[életciklus]        amit N egymást követő crawl nem lát sehol → 'discontinued'-jelölt (admin erősíti meg)
```

### 1. Források — kézi felvitel elsőrangú funkció

- A figyelt források a `catalog_sources` táblában élnek; a `discovery` mező
  (`manual|search`) különbözteti meg a kézzel felvitt és az automatikusan
  javasolt forrásokat.
- **Kézi felvitel:** ha menet közben előkerül egy eddig nem ismert bolt vagy
  márkaoldal, az admin bármikor felviheti — F2-ben admin-űrlappal (catalog-modul
  admin-route), addig/mellette CLI-paranccsal (`tools/catalog-watch/add-source`):
  URL-t kap, felderíti a forrás típusát (van-e sitemap? JSON-LD? feed?),
  és beírja a táblába. A következő cron-futás már ellenőrzi.
- **Automatikus felderítés** (ritka, 2-3 havonta): webkeresés SUP-webshopokra;
  a találatok csak forrás-JAVASLATKÉNT kerülnek be, admin hagyja jóvá.
  (A boltok köre nagyjából stabil — ez a futás olcsó és ritka.)
- Első kör: **HU webshopok + gyártói márkaoldalak.** A boltok adják az árat és
  elérhetőséget (`board_prices`, `availability_hu`), a márkaoldalak a teljes
  modellpalettát és a pontos spec-eket. CEE-bővítés (F2+) = új forrás-sorok,
  kódváltozás nélkül.

### 2. Crawl és kinyerés — strukturált adat először

- A webshop-motorok döntő többsége (Shopify, WooCommerce, UNAS, Shoprenter)
  schema.org **`Product` JSON-LD-t** tesz a termékoldalakra: név, márka, ár,
  elérhetőség szelektor-írás nélkül, robusztusan kinyerhető. Termékoldal-lista
  a sitemap.xml-ből.
- **LLM-extrakció (Claude API) csak fallbackként** és a spec-táblázatokhoz
  (hossz/szélesség/vastagság/térfogat/teherbírás), ahol a JSON-LD kevés. A
  kimenet szigorú JSON-séma ellen validálódik; bizonytalan érték üresen marad
  (az adatlapon inkább hiányozzon, mint tévedjen).
- Jogi/etikai keret: robots.txt tisztelet · rate limit (udvarias crawl,
  forrásonként pár oldal/mp) · ahol van hivatalos feed vagy affiliate-API, azt
  preferáljuk a HTML-crawl helyett.

### 3. Egyezés-keresés és dedup — az admin-jóváhagyás magja

- Normalizálás: márka-alias-lista (pl. „SPK" ~ „Spinera"?), modellnév-tisztítás
  (méret-suffixek, évjárat leválasztása), `model_year` felismerés.
- Fuzzy egyezés `pg_trgm`-mel a meglévő `boards` ellen (brand+model+year).
- Három kimenet:
  - **magas egyezés** → ismert deszka: `last_seen_at` frissül, ársor íródik;
  - **bizonytalan egyezés** → `catalog_candidates` sor `matched_board_id` +
    `match_confidence` kitöltve: az admin a moderációs sorban látja a javasolt
    párt, és „ugyanaz → merge" vagy „új típus → jóváhagy" döntést hoz;
  - **nincs egyezés** → új típus-jelölt (pending), jóváhagyás után lesz belőle
    `boards` sor (`status='active'`).

### 4. Életciklus (kifutó modellek)

- Minden crawl frissíti a látott deszkák `last_seen_at`-ját forrásonként.
- Amit **N egymást követő futás** (javaslat: N=4, ~1 hónap) egyetlen aktív
  forrás sem látott, az `discontinued`-JELÖLT lesz — az admin erősíti meg
  (státusz: `discontinued`, `discontinued_at` kitöltve).
- Az `availability_hu`-t a figyelő állítja: van-e aktuálisan aktív HU
  bolt-listing. A kifutott modell NEM törlődik (a Közös nevező-vélemények és a
  Deszkaválasztó-történet megmarad; adatlapján „már nem kapható" jelzés).

## Adatmodell (F1.5-ben, ÚJ migrációként — az F1.2-es catalog-migrációt nem bolygatja)

- `boards` bővítés: `status text` (`active|discontinued|unverified`, default
  `active`), `first_seen_at`, `last_seen_at`, `discontinued_at timestamptz`.
- Új `catalog_sources`: `name`, `base_url`, `kind` (`brand_site|shop|feed`),
  `country` (default `HU`), `discovery` (`manual|search`), `crawl_config jsonb`
  (sitemap-URL, feed-URL, megjegyzések), `active bool`, `last_crawled_at`,
  `added_by uuid → profiles`. RLS: select/write csak moderator/admin.
- Új `catalog_candidates`: `source_id → catalog_sources`, `url`, `raw jsonb`
  (nyers JSON-LD/extrakció), `extracted jsonb` (normalizált spec),
  `matched_board_id uuid null → boards`, `match_confidence numeric`,
  `status` (`pending|approved|rejected|merged`), `reviewed_by uuid null`,
  `created_at`. RLS: csak moderator/admin.
- `create extension if not exists pg_trgm;` (fuzzy egyezéshez).
- A `board_prices` már jó így: a figyelő csak sorokat ír bele (ártörténet →
  F3 árfigyelő prémium).

## Futtatási környezet

- **GitHub Actions ütemezett workflow** (heti cron; a felderítő futás 2-3
  havonta) — ugyanaz a minta, amit a spec 5.1 a HydroInfo-scraperhez bevezet.
  Ingyenes, hosszú futás belefér (crawl + LLM-hívások), a repo része.
- A kód `tools/catalog-watch/` alatt él (TypeScript) — a `src/modules`-on
  KÍVÜL: nem app-kód, a modul-szerződést nem érinti. A Supabase-be
  service-role kulccsal ír (GitHub Actions secret, kliensbe soha nem kerül).
- A moderációs sor UI-ja a catalog-modul admin-route-ja (F2; addig a jelöltek
  SQL-ből/Studio-ból is kezelhetők).

## Ütemezés

| Mikor | Mi készül |
|---|---|
| Most (F1.2 mellett) | Ez a tervdokumentum + spec-hivatkozás + PROGRESS-jegyzet |
| F1.5 | Séma-bővítő migráció (boards-mezők, catalog_sources, catalog_candidates, pg_trgm) + RLS-tesztek |
| F1.5 | Induló katalógus feltöltése **egyszeri, asszisztált importtal** (ugyanez a pipeline kézzel futtatva, admin-jóváhagyással) |
| F2 | Crawler + GH Actions cron + add-source CLI + admin moderációs UI |
| F2+ | Forrás-felderítő futás · CEE-források · árfigyelő-előkészítés (F3) |
