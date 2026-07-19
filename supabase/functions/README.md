# Supabase Edge Functions — weather-sync & storm-alert

Az időjárás- és viharjelzés-pipeline Edge Functionjei (FEJLESZTESI_DOKUMENTACIO
5.1 adatforrások + 9. fejezet viharjelzés-pipeline). A tényleges **deploy és
cron-beállítás kézi lépés** — ez a README a runbook, a repo CI-ja nem deployol.

## Felépítés — miért van `_shared`?

Az Edge Functionök **Deno-runtime**-ban futnak, a repo `src/` viszont a
web-bundle. A tiszta (parse, SUP-index, batch-orchestráció) logika ezért a
`_shared/` alatt él, **Deno- ÉS Node-semlegesen** (nincs Deno API, nincs
`npm:`/`jsr:` import, nincs I/O). Így ugyanaz a logika:

- **Deno** alól: a `weather-sync/index.ts` és `storm-alert/index.ts` vékony héjak
  importálják (`../_shared/*.ts`), és beinjektálják a valós `fetch` + service-role
  Supabase-klienst;
- **Node/Vitest** alól: a `_shared/*.test.ts` tesztek hálózat nélkül fedik
  (`npm test`).

A `*/index.ts` héjak a repo `tsconfig`-jából **kizárva** (Deno-globálisok,
`jsr:` importok) — ezeket a Deno deploy fordítja. A `_shared` viszont a repo
`tsc`-jével typecheckelt és Vitesttel tesztelt.

## Funkciók

### `weather-sync` — óránkénti
Minden spotra lekéri az Open-Meteo aktuális adatait, kiszámítja a SUP-indexet (a
`supindex.*` konfigot az `advisor_weights`-ből olvasva), és `weather_snapshots`
sort ír (`source='open-meteo'`). A `storm_level` az AKTUÁLIS ismert szint: a spot
utolsó snapshotjának `storm_level`-jét viszi tovább (viharjelzést a `storm-alert`
cron állít). Hibatűrő: egy spot hibája nem buktatja a batchet; a válasz összegző
JSON (`{ total, ok, failed, errors }`).

### `storm-alert` — 5 percenként a szezonban (ápr–okt)
A BM OKF / OMSZ viharjelzés-oldal scrape-elése → körzetenkénti szint (0/1/2) →
az érintett `storm_warning_region` spotjainak LEGUTÓBBI snapshotja alapján
szintváltás-detektálás → szintváltásnál új `weather_snapshots` sor
(`source='bm-okf'`, a SUP-index a storm-override-dal újraszámolva). A
`fetched_at` MINDIG a scrape pillanata (2. fejezet: cache-elt viharjelzés soha
nem aktuális). A push-küldés maga **F1.9** — most csak a szintváltás naplózása és
egy `notifyStormChange()` TODO-hook marad (lásd `_shared/storm-alert.ts`).

## Viharjelzés-forrás (élőben verifikálva, 2026-07-19)

A tavi viharjelzést a **HungaroMet** adja ki, **tavankénti** tartalom-oldalakon
(`.../tavaink/<tó>/viharjelzes/main.php`) — tiszta szöveges jelzéssel („A Tisza
tavon elsőfokú viharjelzés érvényes." / 0-s állapotban: „…a viharjelző rendszer
**alapon van**.") és fokozat-ikonnal (`/images/elemek/viharjelzesN.png`). A
`storm-alert` KÖRZETENKÉNT scrape-el (`DEFAULT_STORM_SOURCES`):

- Balaton → `https://www.met.hu/idojaras/tavaink/balaton/viharjelzes/main.php`
  (medencénként ad mondatot; körzet-szinten a LEGMAGASABB fokozat számít)
- Velencei-tó → `https://www.met.hu/idojaras/tavaink/velencei-to/viharjelzes/main.php`
- Tisza-tó → `https://www.met.hu/idojaras/tavaink/tisza-to/viharjelzes/main.php`

Felülírás a `STORM_SOURCES` env-vel (JSON: `{"Balaton":"https://..."}`).
A parser (`_shared/storm-scrape.ts`, `detectPageLevel`) **szöveg-alapú és
tag-toleráns**, a fokozat-ikon másodlagos jel — szöveg–kép eltérésnél a
MAGASABB fokozat győz (fail-safe felfelé); tagadás-tudatos (M1): leminősítés
(→0) CSAK pozitív megerősítésre („alapon van" / „nincs viharjelzés" /
„megszűnt"), egyébként `unknown` → az utolsó ismert szint él tovább.

> ⚠️ **Fertő-korlát (F1):** a Fertőre a HungaroMet NEM ad viharjelzés-oldalt
> (más üzemeltetőjű rendszer) — a körzet forrás nélkül `unknown`, azaz az
> utolsó ismert szinten marad (leminősítés/riasztás nem történik). Fertő-forrás
> bekötése: új bejegyzés a `STORM_SOURCES`-ben, ha lesz scrape-elhető forrás.

## Deploy (kézi — NE a CI-ból)

A Supabase CLI-t a projekt szerint **csak** a wrapperen át hívjuk (a
Supbase1978-identitással; lásd `CLAUDE.md`):

```bash
# egyszeri: link a projekthez már megvan (ref pycsqnthxaytwaptbiph)
npm run sb -- functions deploy weather-sync
npm run sb -- functions deploy storm-alert

# a service-role kulcsot a Supabase automatikusan injektálja (SUPABASE_URL,
# SUPABASE_SERVICE_ROLE_KEY). A viharjelzés-forrás felülírása (opcionális):
npm run sb -- secrets set STORM_SOURCES='{"Balaton":"https://www.met.hu/idojaras/tavaink/balaton/viharjelzes/main.php"}'
```

> A `weather_snapshots`-ba csak a **service_role** írhat (nincs write-policy, 3.2)
> — az Edge Function ezzel a kulccsal ír, ami megkerüli az RLS-t.

## Cron-beállítás (kézi)

Kétféle út; válassz egyet.

### A) Supabase Dashboard — Scheduled Functions (ajánlott)
Dashboard → Edge Functions → adott függvény → **Schedules** → új cron:

- `weather-sync`: `0 * * * *` (óránként, perc 0).
- `storm-alert`: `*/5 * * * *` (5 percenként) — **de csak a szezonban**. A cron
  önmagában nem tud „ápr–okt”-ot; két lehetőség: (1) a szezon elején kézzel
  bekapcsolod, végén kikapcsolod; vagy (2) a hónapmezővel: `*/5 * * 4-10 *`
  (április–október, 5 percenként).

### B) pg_cron + pg_net (SQL-ből, adatbázisban)
Ha a DB-ből akarod vezérelni (egy migrációban vagy SQL-editorban lefuttatva).
Előfeltétel: a `pg_cron` és `pg_net` extension engedélyezve (Dashboard →
Database → Extensions). A függvény-URL és a kulcs behelyettesítendő.

```sql
-- Óránkénti weather-sync
select cron.schedule(
  'weather-sync-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT-REF>.supabase.co/functions/v1/weather-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- 5 perces storm-alert, ápr–okt szezonban (a hónapmező szűr)
select cron.schedule(
  'storm-alert-5min-season',
  '*/5 * * 4-10 *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT-REF>.supabase.co/functions/v1/storm-alert',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Leállítás / módosítás:
-- select cron.unschedule('weather-sync-hourly');
-- select cron.unschedule('storm-alert-5min-season');
```

> A service-role kulcsot NE tedd verziókövetett SQL-fájlba. Vagy a Dashboard
> scheduled-functions útját használd (A pont), vagy a kulcsot Vault/DB-settingből
> (`current_setting(...)`) húzd, ne literálként.

## Ami kézi/deploy-lépésnek marad

- A tényleges `functions deploy` és a cron **bekötése** (ez a runbook, nem CI).
- A `pg_cron`/`pg_net` extension engedélyezése, ha a B) utat választod.
- A szezon-kapcsolás (`storm-alert` ki/be, vagy a `4-10` hónapmező elfogadása).
- **F1.9**: a `notifyStormChange()` push-küldés bekötése (9./2–4. — a
  `push_subscriptions` join + Web Push VAPID), plusz a HydroInfo vízállás-forrás
  (5.1/6, folyó-korrekció) — külön feladat.
- Tenger-spot vízhő (`includeMarine=true`) — F1-ben minden belvíz-spot `false`.
