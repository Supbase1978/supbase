# catalog-watch — SUP-katalógus piacfigyelő

Terv és indoklás: [`docs/CATALOG_WATCH_TERV.md`](../../docs/CATALOG_WATCH_TERV.md).

A figyelő megkeresi a boltok/márkaoldalak SUP-deszkáit, **ismert** modellnél
árat és „láttuk" jelzést ír, **ismeretlennél** jelöltet tesz a moderációs sorba.

> **A figyelő soha nem publikál magától.** `boards` sort nem hoz létre: új típus
> kizárólag a `/admin/katalogus` moderációs felületről születhet. Ugyanez a
> kifutásra: a figyelő csak jelöl, a `discontinued` státuszt ember erősíti meg.

## Futtatás

Node 22 natívan futtatja a TypeScriptet, build nincs:

```bash
node tools/catalog-watch/cli.ts list-sources
node tools/catalog-watch/cli.ts add-source --name "Bolt" --url https://bolt.hu --pattern /termek/
node tools/catalog-watch/cli.ts crawl --dry-run      # próbafutás írás nélkül
node tools/catalog-watch/cli.ts crawl
node tools/catalog-watch/cli.ts lifecycle            # kifutás-jelöltek (csak jelentés)
```

### Új forrás bekötése (a javasolt sorrend)

1. `add-source` — legalább `--name` és `--url`. A `--pattern /termek/`
   megadása udvariasabb crawl: a blog- és kategória-oldalakat meg sem kérjük.
2. `crawl --dry-run --source "Bolt" --max 20` — a kimenetből látszik, mit írna:
   mely modelleket ismerte fel, melyekből lenne jelölt.
3. Ha a felismerés jónak tűnik: `crawl --source "Bolt"`, majd elbírálás a
   `/admin/katalogus` felületen.

Ha a dry-run kevés terméket talál, nézd meg a forrás `crawl_config`-ját:
`sitemapUrl`, `productUrlPatterns`, `excludeUrlPatterns`, `maxProducts`,
`minDelayMs`.

## Környezet — a rossz projekt elleni védelem

A cél-projektet a repo **`.env`-je** adja (`VITE_SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY`); `.env` nélkül (GitHub Actions) a környezeti
változók élnek. Minden futás kiírja, MELYIK projekttel dolgozik.

Ez nem óvatoskodás: a fejlesztőgép shell-profilja globálisan exportál egy
**idegen projekt** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` párosát
(ugyanaz a csapda, amit a `CLAUDE.md` a Supabase CLI-nél ír le), és a figyelő
első futása emiatt az idegen projektre csatlakozott. Azóta a `.env` az
autoritás, a kulcs `ref` claimjét összevetjük a cél-projekttel, eltérésnél a
futás **leáll**. Lásd [`env.ts`](./env.ts).

A szolgáltatói kulcs kliensbe SOHA nem kerül; a CI-ban repo-secret
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), és a log sosem írja ki.

## Ütemezés

`.github/workflows/catalog-watch.yml` — hétfő hajnal (UTC), plusz kézi
indítás (`workflow_dispatch`, van `dry_run` kapcsolója).

## Felépítés

| Fájl | Feladat |
|---|---|
| `robots.ts` | robots.txt parse, leghosszabb-minta illesztés, Crawl-delay |
| `sitemap.ts` | sitemap/sitemapindex → termék-URL-ek, minta-szűrés |
| `jsonld.ts` · `html.ts` | schema.org `Product` JSON-LD és oldalszöveg kinyerés |
| `normalize.ts` | márka-alias, modellnév-tisztítás, spec/ár/elérhetőség parse |
| `match.ts` | `pg_trgm`-kompatibilis trigram-egyezés → ismert / bizonytalan / új |
| `crawl.ts` | orchestrátor (injektált I/O, hibatűrő, udvarias) |
| `lifecycle.ts` | futás-specifikus döntések; a kifutás-szabály a catalog modulban él |
| `store.ts` | az EGYETLEN adatbázist író fájl (service-role) |
| `env.ts` | cél-projekt feloldás + kulcs-projekt egyeztetés |
| `cli.ts` | parancssori belépési pont |

Minden döntés tiszta függvény, az I/O injektált (az Edge Functionök `_shared`
mintája) — a teljes futás hálózat és adatbázis nélkül tesztelhető:
`npx vitest run tools`.

## Korlátok (F2-ben tudatosan nyitva)

- **LLM-fallback nincs bekötve.** A terv a spec-táblázatokhoz Claude API-s
  kinyerést irányoz elő ott, ahol a JSON-LD kevés. Ez API-kulcsot és költség-
  döntést igényel; addig a címkézett szöveg-parse dolgozik, és amit nem talál,
  az a moderátorra marad (inkább hiányozzon, mint tévedjen).
- **Automatikus forrás-felderítés nincs.** A források kézzel jönnek
  (`add-source`) — a terv szerint is ez az elsőrangú út.
- **Ártörténet csak árváltozáskor** íródik (a heti azonos ár nem termel sort).
