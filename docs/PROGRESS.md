# SUP Platform — PROGRESS

> Session-átvihetőség: keret-elfogyás vagy compact után a karmester (Fable 5,
> hiányában Opus 4.8) INNEN veszi fel a fonalat. Minden fázis végén frissítendő.

## Állapot-összkép

| Lépés | Állapot | Megjegyzés |
|---|---|---|
| F1.0 Projekt-setup | ✅ kész (2026-07-17) | részletek lent |
| F1.1 Core (auth, i18n, ui-primitívek…) | ✅ kész (2026-07-17) | reviewer-jóváhagyással; részletek lent |
| F1.2 DB (séma + RLS + seed) | ✅ kész (2026-07-18) | reviewer-jóváhagyással; futási verifikáció a CI rls-tests jobban |
| F1.3 Weather + SUP-index | ✅ kész (2026-07-19) | reviewer-jóváhagyva; Edge Functionök deployolva, cron aktív, élesben end-to-end verifikálva |
| F1.4 Spots + térkép | ✅ kész (2026-07-19) | scaffolder+ui-builder+karmester; MapLibre-térkép, adatlap, spot_reports; élesben verifikálva (m5 „Tilos" éles II. fokon) |
| F1.5 Catalog + Reviews | ✅ kész (2026-07-21) | catalog+reviews modulok, deszka-lista/adatlap, „Közös nevező"-blokk RatingBar-okkal (átnevezve: Népítélet→Közös nevező, színkiemelt evező-szójáték), e-mail-gate-elt vélemény+flag flow, admin-moderáció, catalog-watch séma-előkészítés. Vélemény-flow bejelentkezett teszt-fiókkal ÉLESBEN verifikálva (Közös nevező adattal renderel) |
| F1.6 Advisor | ✅ kész (2026-07-21) | algo-engineer (kétrétegű algoritmus) + ui-builder/karmester (wizard + eredmény + route + session-log); wizard end-to-end élesben verifikálva. Admin-moderáció böngészőben VERIFIKÁLVA (2026-07-24, lásd F1.6-szakasz) — az admin-ág teljesen zöld |
| F1.7 Providers | ✅ kész (2026-07-24) | directory-lista + profil + lead-form + saját-listing (claim/regisztráció) + admin-hitelesítő panel; mind az 5 flow böngészőben élesben verifikálva. Részletek lent |
| F1.8 SEO-réteg | ⬜ | + jogi oldalak: ÁSZF + adatvédelmi nyilatkozat, consent-checkbox a regisztrációban (spec F1-fázislista + 11.4) |
| F1.9 Push + viharjelzés | ⬜ | |
| F1.10 Záró audit + élesítés | ⬜ | |

## ITINER a következő sessionnek (2026-07-21-i állapot)

**Következő lépések (sorrendben):**

0. ~~AZONNALI MIKRO-LÉPÉS: admin-moderáció verifikáció~~ ✅ **KÉSZ (2026-07-24).**
   `/admin/velemenyek` adminként 200 (korábban 403 — szerep-forrás javítás
   böngészőben igazolva). Flag→panel→elrejtés (hidden, kiesik a Közös nevezőből)
   →újra-közzététel→jelzés-lezárás végigkattintva, demo-adat helyreállítva.
   Megjegyzés: a `verified_owner` kapcsoló a UI-ban csak a „Jóváhagyásra vár"
   szekcióban jelenik meg — F1.5-ben nincs pending-queue (a vélemény azonnal
   publikált), így a jelentett/publikált nézetben nem elérhető (nem blokkoló;
   ugyanaz a Form-POST→action→RLS mechanizmus).

1. ~~F1.7 — Providers~~ ✅ **KÉSZ (2026-07-24).** Lásd az F1.7-szakaszt lent.

2. **F1.8 — SEO-réteg + jogi oldalak [scaffolder + auth-security]:** JSON-LD
   (a `@core/seo` builderek már megvannak: Product/Place/LocalBusiness/FAQPage),
   hreflang, sitemap, persona-landingek, **OG-kép-generálás** (advisor megosztás-
   kártya + deszka-adatlap); ÁSZF + adatvédelmi nyilatkozat (statikus kétnyelvű
   route-ok) + **consent-checkbox a regisztrációban** (visszamenőleg is,
   consent-időbélyeggel a profiles-ban). A meta-k jelenleg hardcode HU-k a
   route-okban (home/deszkak/spotok/deszkavalaszto) — F1.8 köti loader-alapú,
   locale-helyes `buildMeta`-ra.

3. **F1.9 — Web push + viharjelzés-pipeline end-to-end [algo-engineer, auth-
   security]:** `notifyStormChange()` (a storm-alert Edge Function már fut, cron
   aktív), `push_subscriptions` join → küldés, II. fok teljes-képernyős push;
   HydroInfo vízállás-forrás; Fertő-forrás kérdése. Itt jön be az m4 follow-up
   (Open-Meteo `observed_at`) is.

4. **F1.10 — Záró audit + e2e + security + Netlify élesítés [karmester + test-
   runner + security-auditor + reviewer]:** Playwright e2e-csomag, axe-a11y,
   Semgrep+Snyk, **Netlify SSR-adapter bekötése** (`@netlify/vite-plugin-react-
   router`) + a `[deploy]`-gated build élesítése, éles `db push` (a catalog-watch
   migráció is), a nyitott kis tételek lezárása (lásd lent).

**Teszt-fiókok (2026-07-21, a felhasználó Studio-SQL-lel hozta létre):**
admin = `endre.sztellik@gmail.com` (profiles.role='admin'); teszt-user =
`teszt@sup-platform.test` / `Teszt_1234` (sima user, megerősített). A vélemény-
flow ezzel élesben verifikálva.

**Szerep-forrás JAVÍTVA (2026-07-22):** a `requireRole` (`session.server.ts`)
mostantól a `current_user_role()` RPC-ből olvassa a szerepet — UGYANAZ a
`profiles.role`-forrás, amit az RLS is használ, így az app-réteg és a DB nem
divergál. A `getUserRole` (roles.ts) csak NEM-autoritatív JWT-hint maradt
(dokumentálva). Kapuk zöldek. **Következő MIKRO-lépés (böngészőben, dev-vel):**
admin (`endre.sztellik@gmail.com`) belépés → `/admin/velemenyek` most 200-at ad
(korábban 403); moderációs akciók végigkattintása (elrejtés / hitelesített-
tulajdonos / jelzés-lezárás). A teszt-userrel írt vélemény (X100 11'0") kész
alany a moderációhoz. Ezután az F1.5/F1.6 admin-ága is teljesen zöld.

**Nyitott kis tételek (nem blokkolók):**
- m3: `supindex.stale_minutes` holt seed-kulcs — bekötni vagy kivenni (db-engineer).
- m4 (F1.9): Open-Meteo `observed_at` tárolása a `fetched_at` mellett.
- **F1.4-utó (geom-forma):** a PostGIS `geom` a projekt PostgREST-jén
  GeoJSON-OBJEKTUMKÉNT jön (`{type:"Point",coordinates:[lng,lat]}`), nem EWKB
  hexként — a `data/wkb.ts` `pointFromGeom`-ja mindkettőt kezeli. Ha később
  `distinct on`-nézetet/RPC-t vezetünk be a snapshotokhoz (lásd lent), a geom-
  select formája ellenőrizendő.
- **F1.4-utó (snapshot-lekérdezés):** `listLatestSnapshots` naiv (utolsó 200
  sor + JS-reduce). Spot-/snapshot-szám növekedésénél `distinct on (spot_id)
  ... order by spot_id, fetched_at desc` nézet/RPC (db-engineer).
- **F1.4-utó (MapLibre-warning):** az OpenFreeMap-stílus renderelésekor 3×
  „Expected value to be of type number, but found null" konzol-warning jön a
  maplibre-gl workeréből (stílus-kifejezés, nem a mi kódunk) — ártalmatlan,
  de F1.10 audit-nál nézni, elnémítható-e.
- F1.2-reviewer follow-up: `amount_huf` update-revert assert; `anonymize_user`
  runbook-jegyzet (service_role-claimmel hívandó).
- Biztonsági ajánlás: a `.env`-beli Supabase access token forgatható (a session
  során fájlba/beszélgetésbe került); a ~/.zshrc:5 régi globális token-exportja
  kivehető, ha a régi projektekhez már nem kell.
- storm-alert szezonon kívül: a cron hónapmezeje (`4-10`) intézi; ellenőrzés
  tavasszal.

**Környezet-emlékeztetők:** Supabase CLI CSAK `npm run sb --` wrapperrel
(CLAUDE.md, zshrc-csapda) · a gépen nincs Docker/helyi Postgres — RLS-teszt
verifikáció a CI `rls-tests` jobban · deploy/cron/SQL a Management API-n vagy
a wrapperen át megy, éles művelethez felhasználói jóváhagyás kell.

**Távolabbi, már bejegyzett tételek:** F1.5-nél catalog-watch séma-előkészítés
(`docs/CATALOG_WATCH_TERV.md`) · F1.8-nál ÁSZF + adatvédelmi nyilatkozat +
consent-checkbox · F1.9-nél `notifyStormChange()` push + HydroInfo vízállás +
Fertő-forrás kérdése.

## F1.0 — Projekt-setup (2026-07-17)

**Elkészült:**
- Claude Design import: `SUP Explorations.dc.html` → `_design-source/` (gitignore-olt, csak olvasható referencia).
- Token-egyeztetés: a design 2c token-blokkja tételesen egyezik a doku 2. fejezetével; **`--caution-bg: #F7ECD8`** a designból pótolva (Óvatosan-badge háttér) → doku + `src/core/ui/tokens.css`. A doku 12/2 nyitott kérdés lezárva.
- RR7 framework-mód + Vite + TS strict (`noUncheckedIndexedAccess`), `BUILD_TARGET=native` → SPA-mód (react-router.config.ts).
- Tailwind 4 + `tokens.css` + `@theme inline` híd (utility-nevek: `bg-petrol`, `bg-caution-bg`…).
- Könyvtárszerkezet az 1.3 szerint; `@core/module-contract` (ModuleManifest), üres `src/modules/registry.ts`, `src/core/platform.ts`.
- ESLint flat config `import/no-restricted-paths` zónákkal (modul→modul tilos, core nem függ modultól/app-tól) — a 8 tervezett modulra előre felvéve.
- CI-váz: `.github/workflows/ci.yml` (typecheck/lint/vitest; RLS- és e2e-jobok kommentben előkészítve F1.2/F1.10-re). `netlify.toml` váz (SSR-adapter bekötése F1.10).
- `CLAUDE.md` (modul-szerződés, biztonsági tokenek, kapu-szabály, agent-tábla).
- 8 subagent-definíció: `.claude/agents/` (scaffolder, ui-builder, db-engineer, algo-engineer, auth-security, test-runner, security-auditor, reviewer).
- PostToolUse hook: `.claude/hooks/post-edit-check.sh` (tsc + eslint minden ts/tsx-edit után).

**Megjegyzések a következő lépéshez (F1.1):**
- Az új subagent-definíciókat a Claude Code session-újraindítás után látja.
- Netlify SSR-adapter (`@netlify/vite-plugin-react-router`) szándékosan nincs még bekötve — F1.10 (élesítés) része.
- A design-fájl komponens-referenciái: gombok · státusz-jelvények · vízfelszín-vonal (4 állapot) · vízmérce (10 szegmens) · II. fokú riasztás-képernyő · kontraszt-tábla — az F1.1 ui-primitívekhez a `_design-source/SUP Explorations.dc.html`-ből olvasandók.

## F1.1 — Core: auth, i18n, ui-primitívek (2026-07-17)

Kiosztás a 11.4 szerint: ui-builder + scaffolder párhuzamosan, majd auth-security,
karmester-integráció, reviewer-jóváhagyás. Kapuk záráskor: typecheck · lint ·
104 vitest zöld + buildelt SSR-füstteszt (/, /belepes, /regisztracio,
/kijelentkezes GET→302, 404 fordított szöveggel).

**Elkészült:**
- `src/core/ui/`: Button (primary/secondary/ghost — danger-variáns típus-szinten
  nem létezik), Card, StatusBadge (kötelező label + beépített ikon = szín+ikon+
  szöveg), Waterline (4 állapot, állapotonként ELTÉRŐ SVG-geometria, stale =
  szaggatott), Gauge (10 szegmens, `role="meter"`, küszöbök propból — végleges
  sávok az F1.3 SUP-indexből; stale = csíkozott), DataAge + `isStale`/
  `minutesSince` (`STALE_THRESHOLD_MINUTES = 30`).
- `src/core/i18n/`: `createI18n(locale)` kérésenkénti példány (SSR-biztos),
  namespace-regiszter (`registerNamespace` — modulok innen csatlakoznak),
  url-helperek (hu prefix nélkül, en `/en/...`), `pickTranslated` jsonb-fallback,
  `locales/{hu,en}/core.json` (hu forrás, en tükör).
- `src/core/seo/`: `buildMeta`, `buildHreflangLinks` (x-default = hu), JSON-LD
  builderek (Product/Place/LocalBusiness/FAQPage) + XSS-biztos `jsonLdScript`,
  `ogImageUrl` stub (F1.8).
- `src/core/notifications/`: `NotificationProvider` interfész + `WebPushProvider`
  váz (isSupported valós, többi F1.9), platform-alapú kiválasztás.
- `src/core/payments/`: `PaymentProvider` interfész (createCheckout/handleWebhook/
  getEntitlements + invoice-hook) + `NoopPaymentProvider`.
- `src/core/auth/` (4. fejezet): @supabase/ssr szerver/browser kliens, cookie-s
  SSR-session, `getUser`-alapú guardok (`requireUser`, `requireRole`), szerep-
  hierarchia (user/moderator/admin, app_metadata védett `user` defaulttal),
  `isEmailConfirmed` UX-gate, Turnstile-komponens (npm-függőség nélkül,
  `isTurnstileEnabled` egyetlen kapcsoló, captchaToken a Supabase-hívásban),
  `safeRedirect` nyílt-redirect-védelem (`//host` ÉS `/\host` tiltva), GDPR
  `deleteAccount` váz. Auth-route-ok: /belepes (jelszó + magic link),
  /regisztracio, /auth/callback (PKCE code-exchange), /kijelentkezes (POST-only,
  redirectTo a safeRedirect-en át). `.env.example` a gyökérben.
- Karmester-integráció: `app/routes.ts` a registry-manifesztekből komponál (új
  modulhoz e fájlhoz nem kell nyúlni; relatív import, mert a RR7 config-loader
  vite-node kontextusában a tsconfig-alias nem él); `app/root.tsx` Layout-szintű
  I18nextProvider (ErrorBoundary is fordít) + `<html lang>` az URL-ből.

**Tudatos döntések / eltérések:**
- `isStale`: a pontosan 30 perces adat MÁR elavult (`>=`), és az értelmezhetetlen
  dátum is stale — fail-safe eltérés a spec „30 percnél régebbi" szövegétől;
  reviewer által elfogadva.
- Nincs `--stale-bg` token (a biztonsági blokk fix): a stale-badge `mist` háttér +
  `stale` szöveg/ikon kombinációt használ, új szín bevezetése nélkül.
- Supabase-env hiányában fail-closed: `getSession`/`getUser` → null (egyszeri
  szerver-warn), guardok a belépőre irányítanak, a kliens-factory híváskor dob —
  a publikus oldalak env nélkül is renderelnek (F1.2-ig nincs Supabase-projekt).
- Reviewer-kör: 1 MAJOR (safeRedirect backslash open-redirect) + 3 minor →
  javítva, regressziós teszttel; végső verdikt: JÓVÁHAGYVA.

**Megjegyzések a következő lépéshez (F1.2):**
- Supabase-projekt provisioning + `.env` kitöltése (minta: `.env.example`);
  Turnstile secret a Supabase Dashboardban, rate limitek szigorítása.
- RLS-adósságok (a kódban feljegyezve): e-mail-megerősítés gate security definer
  függvénnyel (`email-confirmed.ts`), a `role` forrása a `profiles` táblára
  kötve (`roles.ts` — API változatlan marad), GDPR vélemény-anonimizáló SQL
  (`gdpr.ts`), `push_subscriptions` (`web-push.ts`).
- A Gauge küszöb-defaultjai (caution 4, safe 6.5) F1.3-ban a `supindex.*`
  konfigból jönnek majd.
- Vitest `environmentMatchGlobs` deprecation-warningot ír (működik) — később
  projects-alapú konfigra váltható.

## F1.2 — DB: teljes séma + RLS + tesztek + seed (2026-07-18)

Kiosztás: db-engineer (2 kör) + reviewer (2 kör). Helyi kapuk záráskor zöldek
(typecheck · lint · 104 vitest); a futási verifikáció a CI `rls-tests` jobja
(helyben nincs Docker/Postgres — a pgTAP-tesztek először a CI-ban futnak élesben).

**Elkészült:**
- 12 migráció (`supabase/migrations/`): core (extensions, helpers, profiles,
  orders, push_subscriptions, gdpr_anonymize) + modulonként saját fájl
  (catalog, reviews, spots, weather, advisor, providers) — modul-szerződés
  szerint. Minden táblán RLS + minden policyhoz pozitív ÉS negatív pgTAP-teszt.
- 7 pgTAP tesztfájl (`supabase/tests/00,10,20,30,40,45,50`), tranzakció+rollback
  mintával; szerepek: anon / user (confirmed/unconfirmed) / moderator / admin /
  tulajdonos vs. idegen / service_role.
- `seed.sql`: 9 márka, 20 deszka (+20 ár), 15 spot, 5 provider, 32
  advisor_weights kulcs (`supindex.*` defaultokkal, `storm.level1_cap=3.9`,
  `storm.level2_cap=0`).
- CI `rls-tests` job élesítve: setup-cli 2.100.1 (pinnelt) → `supabase db start`
  → `supabase test db --local`.
- Security definer helperek `set search_path=''`-vel; column-védő triggerek:
  `profiles.role`, `board_reviews.verified_owner/status`, `providers.verified/
  tier`, `orders.status/provider_ref/amount_huf/currency/kind/user_id`.
- GDPR `anonymize_user`: csak service_role hívhatja (REST-ről admin sem);
  sentinel-profil, review-duplikátum-kezelés, leads/sessions null-ozás,
  push-törlés.

**Audit/review során javított hibák (tanulság):**
- BLOKKOLÓ: 8 hexjegyű „UUID"-literálok a seedben+tesztekben (Postgres 32
  hexjegyet vár) → kanonikus pad-elés. A seed emiatt az első `db start`-on
  elhasalt volna.
- BLOKKOLÓ: hiányzó `pgtap` extension → minden tesztben `create extension if
  not exists pgtap` (rollback-kel efemer).
- Logikai: RLS USING-gal szűrt UPDATE 0 sort érint és NEM dob kivételt →
  `throws_ok` helyett 0-soros minta + érték-változatlanság assert.
- MAJOR (reviewer): orders pénzügyi mezők user-írhatósága; providers.tier
  önemelés → trigger-védelem + negatív tesztek.

**Follow-up (nem blokkoló):** `amount_huf` update-revert külön assert;
`anonymize_user` runbook-jegyzet (service_role-claimmel hívandó — az Edge
Function így teszi); CI első futásán ellenőrizni, hogy a `db start` seedel.

**Környezet:** Supabase-projekt linkelve („Supbase", ref `pycsqnthxaytwaptbiph`)
— CLI CSAK a `npm run sb --` wrapperrel (lásd CLAUDE.md: zshrc-token-csapda).
A 12 migráció + seed a távoli projektre kitolva (2026-07-18, `db push
--include-seed`); élesben ellenőrizve: 20 boards / 15 spots / 5 providers /
32 advisor_weights, anon írás 401.

**Megjegyzések a következő lépéshez (F1.3):**
- `supindex.*` kulcsok a seedben — az algo-engineer validálja a sávokat,
  különösen `storm.level2_cap=0` (II. fok → index 0, spec 9. fejezet).
- A Gauge küszöb-defaultjai (F1.1-jegyzet) innen kötendők be.
- Weather-írás kizárólag service_role (nincs write-policy) — az Edge Function
  ehhez igazodjon.

## F1.3 — Weather + SUP-index (folyamatban)

**1. kör kész (2026-07-18, algo-engineer + karmester-integráció):**
- `src/modules/weather/`: route-mentes manifeszt + registry-regisztráció.
- SUP-index (`sup-index/`): tiszta `computeSupIndex` az 5.1 mind a 6 lépésével
  (storm-override a végén alkalmazva; offshore-szektor `angularDelta`-val;
  minden küszöb/súly konfigból). Kimenet: index (1 tizedes) + státusz-enum
  (safe/caution/danger) + flagek (besodró, neoprén, viharfok) + indoklás
  i18n-kulcsként (nem kész mondat). Táblázatos határeset-tesztek (sávhatárok,
  pont 3,9 plafon, pont 15 lökés/offshore-szélminimum, pont 14 °C, 4,0/7,0).
- Konfig: `config.ts` (típus + defaultok, seed-kulcsokkal egyező) +
  `config.server.ts` (advisor_weights `supindex.*` olvasó, fallback defaultokra).
- Open-Meteo adapter: forecast + marine (tengeri vízhő; belvíznél null — F1),
  injektálható fetch, parse fixture-tesztekkel; null-biztos parse (karmester-fix).
- i18n: `weather` namespace (hu forrás + en tükör), bekötés az ÚJ
  `src/modules/registry-i18n.ts`-en át (app/root.tsx importálja; új modul
  fordítása ide kötendő — a registry.ts-be azért nem, mert azt a RR7
  config-loader is behúzza, és a manifesztnek mellékhatás-mentesnek kell lennie).

**2. kör kész (2026-07-18, algo-engineer): Edge Functionök + cron-előkészítés.**
- `supabase/functions/_shared/` — Deno- ÉS Node-semleges tiszta logika (nincs
  Deno API / `jsr:` import / I/O), Vitesttel tesztelve: `types.ts`, `sup-index.ts`
  (a webes `computeSupIndex` bit-azonos portja + `parseSupIndexConfig`),
  `open-meteo.ts` (parse + injektálható fetch), `storm-scrape.ts` (BM OKF
  tag-toleráns parse + `detectStormLevelChanges`), `weather-sync.ts` és
  `storm-alert.ts` (tiszta batch-orchestrátorok injektált I/O-val, hibatűrők).
- `weather-sync/index.ts` + `storm-alert/index.ts` — vékony Deno-héjak (service-
  role kliens, valós fetch); a repo `tsconfig`-jából kizárva (`*/index.ts`),
  a `_shared` viszont typecheckelt + tesztelt.
- Konfig-bővítés: `tsconfig` (`allowImportingTsExtensions`, index.ts-kizárás),
  `vitest` include (`supabase/functions/**/*.test.ts`), eslint Deno-globális.
- 44 új Vitest-teszt (OKF-fixture 3 állapot, szintváltás 0→1/1→2/2→0/nincs,
  batch spot-hibatűrés, storm-override újraszámítás) — hálózat nélkül. Kapuk
  zöldek: typecheck · lint · 212 vitest.
- `supabase/functions/README.md`: deploy (`npm run sb -- functions deploy …`) +
  cron (Dashboard scheduled VAGY pg_cron+pg_net SQL; óránként / 5 perc ápr–okt).
- **Forrás-választás:** OMSZ viharjelzés (`STORM_SOURCE_URL`, default met.hu
  balatoni oldal) — a hivatalos kiadó, és a négy körzet pontosan a
  `storm_warning_region` seed-értékekkel egyezik; a parser szöveg-alapú, forrás-
  váltásra csak env + needle-lista kell.

**Reviewer-kör (2026-07-18): JÓVÁHAGYVA.** A két SUP-index implementáció
bit-azonossága, az adatkor-szabály, a modul-szerződés és a fail-safe viselkedés
tételesen ellenőrizve. Findingok: M1 (storm-scrape tagadás-vakság — a
storm-alert élesítése előtt KÖTELEZŐ; azonnal javítva negáció-kezeléssel +
UNKNOWN állapottal) · m2 (README: a default forrás csak Balaton-körzetet fed —
javítva) · m6 (explicit verify_jwt=true a config.toml-ben — javítva).

**Follow-upok (nem blokkolók, célfázissal):**
- m3 → F1.3-utó: `supindex.stale_minutes` seed-kulcs holt (a stale-küszöb a
  core `STALE_THRESHOLD_MINUTES` konstansa) — bekötni vagy seedből kivenni.
- m4 → F1.9: Open-Meteo `observed_at` (current.time) tárolása/használata a
  `fetched_at` mellett.
- m5 → F1.4 ÁTADÁSI FELTÉTEL: II. foknál (`flags.stormLevel===2`) a UI-nak
  „Tilos" státuszt kell rendernie (i18n `status.forbidden`), NEM a
  danger-„Veszélyes"-t — a status-enum önmagában nem elég.

**Élesítés (2026-07-18/19, felhasználói jóváhagyással) — KÉSZ:**
- Mindkét Edge Function deployolva a „Supbase" projektre (`npm run sb --
  functions deploy weather-sync|storm-alert`).
- Cron aktív (pg_cron + pg_net): `weather-sync-hourly` (`0 * * * *`) és
  `storm-alert-5min-season` (`*/5 * * 4-10 *`). A service-kulcs a Supabase
  **Vaultban** (`edge_invoke_key`) — a cron-parancsok a
  `vault.decrypted_secrets`-ből olvassák, literálként sehol nincs.
- Éles verifikáció: weather-sync → 200, 15/15 spot snapshot + SUP-index
  (3–10 közti értékek); storm-alert → 200, 3 körzet scrape, pozitívan
  megerősített 0-s fokozat, `verify_jwt` 401 auth nélkül.
- **Éles teszt fogta + javítva:** az eredeti forrás-URL 404 volt → valódi
  forrás felderítve: met.hu TAVANKÉNTI `main.php` (Balaton medencénként; 0-s
  állapot szövege: „a viharjelző rendszer ALAPON VAN" — felvéve a pozitív
  minták közé). Körzet→URL forráslista (`DEFAULT_STORM_SOURCES`,
  `STORM_SOURCES` env-felülírás), fokozat-ikon (`viharjelzesN.png`) másodlagos
  jelként, szöveg–kép eltérésnél a magasabb győz. Valódi letöltött fixture-ök.
  **Fertő-korlát:** nincs HungaroMet-forrása → unknown/fail-safe (README).

**Megjegyzés:** az 1. kört az algo-engineer session-limit szakította meg (a
hiányzó adapter-tesztet és az i18n-bekötést a karmester pótolta); a forrás-
átállítást session-limit + classifier-kiesés miatt szintén a karmester írta.

## F1.4 — Spots + térkép (2026-07-19)

Kiosztás: scaffolder (modul-váz) → ui-builder (UI) → karmester-integráció +
verifikáció. A ui-buildert session-limit szakította meg; a route-integrációt
(SpotMap/SpotCard/StormAlert bekötése a loaderekbe), az éles verifikációt és a
javításokat a karmester végezte. Kapuk záráskor zöldek: typecheck · lint ·
265 vitest (18 új F1.4-teszt).

**Elkészült:**
- `src/modules/spots/`: route-os manifeszt (`spotok`, `spotok/:slug`) +
  registry- és registry-i18n-regisztráció; `spots` i18n-namespace (hu forrás,
  en tükör; kulcs-paritás ellenőrizve).
- **Modul-szerződés betartva:** a spots-modul NEM importál a weather-modulból —
  a SUP-index kiértékelés (`evaluateSnapshot`) kizárólag a route-rétegben
  (`app/routes/spotok*.tsx`) történik, a spots saját `SpotStatus` típusára
  képezve. Az m5 „forbidden" leképezés (`storm_level===2 → "forbidden"`) is itt.
- `data/wkb.ts`: `parseEwkbPoint` (EWKB hex) + `pointFromGeom` (GeoJSON-objektum
  VAGY hex — az éles PostgREST-forma GeoJSON, lásd follow-up); `data/spots.server.ts`
  injektált klienssel (listSpots, getSpotBySlug slug-alak-guarddal, latest-
  snapshot reduce, reports CRUD).
- `ui/SpotMap.tsx`: MapLibre GL, kizárólag kliens-oldali init (dinamikus import,
  SSR-placeholder), OpenFreeMap kulcs nélküli stílus, OSM-attribúció; token-
  színes + színtévesztő-biztos (eltérő ikon-geometria) markerek, popup
  „Adatlap"-linkkel, réteg-kapcsolók (Spotok/Védett területek).
- `ui/SpotCard.tsx`: Waterline (kártyán VONAL), StatusBadge, DataAge, flag-
  jelvények. `ui/StormAlertScreen.tsx`: teljes képernyős, nem eldugható
  `role="alertdialog"`, 3 MIT TEGYÉL-lépés, amber vízimentő-CTA sötét felirattal
  (`tel:+36303838383`), forrás+időbélyeg.
- Lista-route: térkép + waterType-szűrőchipek (a térkép a szűrt listát kapja) +
  SpotCard-rács. Adatlap-route: fejléc-StatusBadge, Gauge (küszöbök a
  `supindex.*` konfigból), indoklás (weather reason-kulcs a route-rétegben
  fordítva), stale-blokk, besodró/neoprén figyelmeztetések, természetvédelmi
  sáv, mini-térkép, jelentés-lista + űrlap (requireUser + e-mail-gate).
- Fejléc-navigáció: `app/nav.tsx` a modul-manifesztek `primary` nav-
  bejegyzéseiből (registry-vezérelt — új modul automatikusan megjelenik).

**Éles verifikáció (Playwright, dev-szerver a távoli „Supbase" projekttel):**
- Lista: 15 marker renderel a térképen, kártyák helyes SUP-index/státusz/
  adatkor-jelzéssel; a waterType-szűrő a kártyákat ÉS a markereket is szűri.
- **m5 ÁTADÁSI FELTÉTEL ÉLESBEN IGAZOLVA:** a verifikáció közben a storm-alert
  cron valós II. fokot állított a Balatonra → a Balaton-spotok „Tilos · 0,0"-t
  mutatnak (nem „Veszélyes"), az adatlapon a teljes képernyős StormAlertScreen
  renderel (alertdialog, MIT TEGYÉL, vízimentő-CTA, forrás „bm-okf").
- Adatlap: Gauge kitöltött+csíkozott (stale) állapotban, indoklás, adatmezők,
  404 ismeretlen slugra.

**Verifikáció fogta + javítva (a karmester javításai):**
- **BLOKKOLÓ volt:** a térképen 0 marker jelent meg — a PostgREST a `geom`-ot
  GeoJSON-objektumként adja, nem EWKB hexként, amire a `parseEwkbPoint` épült.
  → `pointFromGeom` mindkét formára (GeoJSON + hex), a route-ok erre váltva,
  `SpotRow.geom: unknown`, 4 új teszt. (15/15 marker renderel.)
- **Layout-hiba:** az adatlap mini-térképe 0 magas volt (`h-full` a SpotMap
  bázisán tartalom-magasságú `<section>`-ben 0-ra oldódott) → `h-full` kivéve a
  bázisból, a magasságot a hívó explicit `className`-je adja (a `min-h` alsó
  korlát marad). (240px, a marker a Tiszán renderel.)
- **Biztonsági keményítés:** `getSpotBySlug` a slug-ot nyersen fűzte a PostgREST
  `.or()` szűrő-stringbe → slug-alak-guard (`^[a-z0-9-]+$`) a szűrő-injektálás
  ellen, 4 negatív teszt.

**Follow-upok (nem blokkolók) — az ITINER „Nyitott kis tételek" közé felvéve:**
geom-forma dokumentálva, `listLatestSnapshots` distinct-on-nézetre cserélhető,
MapLibre null-warning az F1.10 auditra.

## F1.5 — Catalog + Reviews (2026-07-19, funkcionális mag)

A scaffolder session-limitbe futott (a subagent-kvóta ezen a napon szűk volt),
így a teljes vázat a karmester írta, az F1.4-mintát követve. A DB-séma és RLS
már F1.2-ben kész (catalog + reviews migrációk), ezért F1.5 UI + route +
adatréteg + i18n, ÚJ core-migráció nélkül. Kapuk zöldek: typecheck · lint ·
276 vitest (11 új). Éles Playwright-verifikáció (dev + távoli „Supbase").

**Elkészült:**
- **Két külön modul** a modul-szerződés szerint: `catalog` (brands/boards/
  board_prices adat + deszka-lista/adatlap) és `reviews` (board_reviews/
  review_flags adat + Közös nevező-aggregátor + admin-moderáció). A catalog NEM
  importál reviews-t és fordítva — a deszka-adatlap a KETTŐT a ROUTE-rétegben
  (`app/routes/deszkak.$slug.tsx`) komponálja (mint a spots↔weather).
- `catalog/data/boards.server.ts`: listBoards (brand-join), getBoardBySlug
  (slug-alak-guard `^[a-z0-9-]+$` a `.or()` szűrő-injektálás ellen, negatív
  teszt), listBoardPrices (legolcsóbb elöl).
- `reviews/aggregate.ts`: tiszta `computeReviewAggregate` (csak publikált sorok;
  count, avgOverall 1–5, dimenzió-átlagok, %ajánlaná, verifiedCount) + `toTen`
  (1–5 → 10-es mérce); táblázatos határeset-tesztek (üres, hidden-szűrés,
  kerekítés 4,55→4,6, null-dimenzió, %recommend, verified).
- `reviews/data/reviews.server.ts`: listReviews (publishedOnly), getUserReview
  (1/deszka), insertReview (rating 1–5 validálás + `23505` unique→„már írtál"),
  insertFlag, és ADMIN: listPendingReviews, listFlaggedReviews (feloldatlan
  jelzés → két lépéses JS-párosítás), setReviewStatus, setVerifiedOwner,
  resolveFlag (moderátori jog, RLS + requireRole a védőháló).
- Route-ok: `/deszkak` (lista), `/deszkak/:slug` (adatlap: hero + spec + Közös nevező
  + vélemény-lista + e-mail-gate-elt vélemény-űrlap + flag + árak; action
  `intent`-tel review/flag), `/admin/velemenyek` (reviews adminPanel,
  requireRole('moderator') loaderben ÉS actionben, moderációs gombok).
- i18n: `catalog` + `reviews` namespace (hu forrás, en tükör, kulcs-paritás
  ellenőrizve); a nav automatikusan hozza a „Deszkák"-at.

**Verifikáció (Playwright + curl):** lista 20 deszkával renderel (típus-badge,
méret + stabilitási index); adatlap: Ride 10'6" fejléc + ár „429 000 Ft-tól",
Paraméterek, Közös nevező ÜRES-állapot, vélemény-űrlap login-gate, árak; admin
route 302 (requireRole átirányít kijelentkezve); 404 ismeretlen slugra; nincs
konzol-hiba.

**Token-megkötés a ui-builder-polishoz (route-kommentben is):** a Közös nevező
mércék NEM a biztonsági Gauge-ot használják (veszély-szemantika), és a `--danger`
(piros) értékelés-sávon TILOS — külön RatingBar kell (petrol/semleges v.
safe/caution), a szám mindig a sáv mellett. A loader már átadja a 10-es
`dimensionsTen`/`overallTen` értékeket.

**UI-polish (2026-07-21):** átnevezés „Népítélet" → „Közös nevező" (színkiemelt
evező-szójáték a blokk-címben, `--caution-text`); új komponensek
`reviews/ui/{RatingBar,ReviewSummary,ReviewCard,FlagButton}` +
`catalog/ui/{BoardCard,BoardHero}`, a route-ok ezekből komponálnak. A RatingBar
NEM a biztonsági Gauge (küszöb-szín ≥7 safe / <7 caution, SOHA danger; a szám
mindig a sáv mellett). 8 új komponens-teszt.

**catalog-watch séma-előkészítés (2026-07-21, `docs/CATALOG_WATCH_TERV.md`):**
ÚJ migráció `20260717091600_catalog_watch.sql` (additív, az F1.2-catalogot nem
bolygatja): boards életciklus-mezők (`status` active|discontinued|unverified +
first/last_seen_at + discontinued_at), `catalog_sources`, `catalog_candidates`
(mindkettő RLS: select ÉS write CSAK moderator/admin — kurált/belső tartalom),
`pg_trgm` + trigram GIN index a modell-névre (fuzzy dedup). pgTAP:
`12_catalog_watch_test.sql` (mod ír/olvas; user/anon se olvas, se ír; boards
default-ok). A `BoardRow` típus bővítve. Migráció NINCS kitolva — CI `rls-tests`
futtatja, éles `db push` a felhasználó jóváhagyásával (lokál-first munkamenet).

**HÁTRA (nem blokkoló):** auth-flow verifikáció teszt-fiókkal (lásd ITINER).

## F1.6 — Advisor / Deszkaválasztó (2026-07-21)

Kiosztás: algo-engineer (tiszta algoritmus-mag) → ui-builder (wizard + eredmény +
route) → karmester-integráció + verifikáció. A ui-buildert a végén kapcsolat-
megszakadás érte (a route-fájl + UI-komponensek a karmester írta). Kapuk zöldek:
typecheck · lint · 335 vitest (~38 új advisor-teszt).

**Elkészült:**
- `src/modules/advisor/select/`: tiszta kétrétegű ajánló (5.2). 1. réteg kemény
  szűrés (térfogat=súly×szint-szorzó, terhelhetőség×0,66≥effektív súly, HU-
  elérhetőség, tárolás, budget, cél→board_type mapping); 2. réteg 0–100
  pontozás (stabilitás-illeszkedés tapasztalat-függő, Közös nevező-átlag ≥5
  vélemény/semleges, ár-érték, cél-fit, elérhetőség/frissesség) — súlyok az
  `advisor_weights`-ből (config.ts/config.server.ts, fail-safe DEFAULT). Az
  algoritmus STRUKTURÁLIS bemeneten dolgozik (`BoardForAdvisor[]`), NEM importál
  catalog/reviews-t; az indoklás determinisztikus {key, params} (level/use
  nested i18n-kulcs). Táblázatos határeset-tesztek.
- `src/modules/advisor/ui/AdvisorWizard.tsx` (5 lépéses kliens-wizard: testsúly+
  utas, tapasztalat, víz, cél, budget+tárolás; progress-bar, opció-kártyák,
  amber CTA sötét felirattal) + `AdvisorResult.tsx` (1 nagy + 2 kompakt ajánlás,
  „X% neked" amber-badge, feloldott indoklások, adatlap-linkek; megosztás
  OG-képe F1.8).
- `app/routes/deszkavalaszto.tsx`: a catalog+reviews+advisor összekötése a
  route-rétegben — boards+legolcsóbb ár+publikált-vélemény-aggregátum →
  `BoardForAdvisor[]` → `recommendBoards` → advisor_sessions insert (anonim is,
  best-effort) → display-DTO. Adat-helperek: catalog `listCheapestPriceByBoard`
  (+pickCheapestPerBoard teszt), reviews `listAllPublishedReviews`.
- advisor i18n (hu forrás + en tükör): nav + wizard.* + result.* + reason/level/use.
- `nav`: „Deszkaválasztó" (order 5) a fejlécben (registry-vezérelt).

**Éles verifikáció (Playwright + dev + távoli „Supbase"):**
- Wizard end-to-end: 85 kg / kezdő / allround / nagy tó lefutás → top ajánlás
  X100 11'0" (65% neked, 189 000 Ft) + 2 kompakt, a feloldott indoklásokkal
  (térfogat/kezdő szint, allround cél, terhelhetőség), adatlap-linkekkel.
- **F1.5 vélemény-flow ÉLESBEN lezárva** a `teszt@sup-platform.test` userrel:
  vélemény beküldve → a Közös nevező „van-adat" nézete renderel (5,0 átlag,
  100% ajánlaná, dimenzió-mércék 10-es skálán), a form „már írtál" + „Köszönjük"
  állapotra váltott.
- **Admin-moderáció verifikáció KÉSZ (2026-07-24, böngésző + éles „Supbase"):**
  a szerep-forrás javítás után `/admin/velemenyek` adminként **200** (korábban
  403). Végigkattintva: jelentés az adatlapról → megjelenik a panel „Jelentett
  vélemények" listájában → **elrejtés** (státusz `hidden`, a vélemény kiesik a
  publikus `published`-only Közös nevezőből) → **újra közzététel** (`published`)
  → **jelzés lezárása** (`resolved`, panel tiszta). Végállapot helyreállítva
  (Közös nevező 5,0 / 1 értékelés). A `verified_owner` kapcsoló csak a
  „Jóváhagyásra vár" (pending) szekcióban látszik — F1.5-ben nincs pending-queue,
  ezért a mostani flow-ban nem elérhető (nem blokkoló, azonos mechanizmus).

## F1.7 — Providers / szolgáltatói directory (2026-07-24)

Kiosztás: karmester (az F1.4/F1.5/F1.6 modul-mintát követve). A DB-séma és RLS
már F1.2-ben kész (providers + provider_spots + provider_leads migráció), ezért
F1.7 = modul + route + adatréteg + UI + i18n, ÚJ migráció nélkül. Kapuk zöldek:
typecheck · lint · 341 vitest (6 új providers-teszt). Éles Playwright-verifikáció
(dev + távoli „Supbase", admin-session).

**Elkészült (`src/modules/providers/`):**
- `types.ts` (ProviderRow/Service-type/Tier/Lead + linked-spot), `module.ts`
  (routes: `szolgaltatok`, `szolgaltatok/uj` [requiresAuth], `szolgaltatok/:slug`;
  adminPanel: `szolgaltatok`; nav order 20), `i18n.ts` + `locales/{hu,en}`
  (kulcs-paritás), registry + registry-i18n regisztráció.
- `data/providers.server.ts`: `listProviders` (+ tiszta `sortProvidersForList` —
  premium elöl, azon belül név), `getProviderBySlug` (slug-alak-guard `^[a-z0-9-]+$`
  a `.or()` szűrő-injektálás ellen), `listLinkedSpots` (provider_spots→spots join),
  `insertLead` (insert-gate: e-mail-forma + RLS `provider_leads_insert_any`),
  `insertProvider` (owner=self; tiszta `slugify` ékezet-hajtással + `resolveUniqueSlug`
  ütközés-feloldás; verified/tier a triggerrel biztonságos defaultra), admin
  `listProvidersByVerified` + `setProviderVerified`. 6 unit-teszt (slugify, sort).
- `ui/ProviderCard.tsx`: név + típus-chipek + „Kiemelt" (semleges chip, NEM
  StatusBadge) + „Hitelesített" (biztonsági StatusBadge safe) / „Hitelesítés
  folyamatban" jelvény + leírás-kivonat.
- Route-ok: `/szolgaltatok` (lista + típus-szűrőchipek + „regisztráld" CTA),
  `/szolgaltatok/:slug` (profil: fejléc + jelvények + elérhetőség + kapcsolódó
  spotok [route-rétegben kötve, a providers NEM importál spots-t] + lead-form),
  `/szolgaltatok/uj` (requireUser; saját listing felvétele → redirect az új
  profilra), `/admin/szolgaltatok` (requireRole('**admin**') — a `verified`
  jelvényt a `protect_provider_columns` trigger CSAK adminnak engedi, a
  moderátor verify-ja némán no-op lenne; verify/unverify).

**Éles verifikáció (Playwright, mind az 5 flow):**
- Directory: 5 seed-szolgáltató, típus-szűrő, kártyák; nav-ban „Szolgáltatók".
- Profil (SUP Balaton): elérhetőség (mailto), kapcsolódó spotok (Balatonföldvár +
  Siófok, /spotok-linkkel), lead-form e-mail-előtöltéssel a session-ből.
- Lead beküldve → „Köszönjük!" (insert-gate zöld).
- Admin-panel: Tisza-tavi hitelesítve → átkerült a „Hitelesített" szekcióba, a
  publikus listán „Hitelesített" StatusBadge jelenik meg (trigger adminnak engedi).
- Új listing: „Balázs SUP TúraBázis" beküldve → slug `balazs-sup-turabazis`
  (ékezet-hajtás), redirect a profilra, „Hitelesítés folyamatban" (a trigger
  user-insertnél verified=false-ra kényszerít ✓). Nincs valós konzol-hiba.

**Follow-upok / nyitott kis tételek (nem blokkolók):**
- **Seed↔trigger interakció:** a `providers` seed közvetlen SQL-inserttel fut
  (nincs `auth.uid()` → `is_admin()`=false), így a `protect_provider_columns`
  trigger a seed `tier='premium'`/`verified` szándékát felülírja `free`/`false`-ra.
  Ezért élesben EGYETLEN provider sem premium/verified alapból. Ha demo-jelleggel
  kell hitelesített/kiemelt példa: seed UTÁNI admin-update, vagy a seed-context
  triggerkerülése (db-engineer, F1.10 seed-revízió). A `sortProvidersForList`
  premium-elöl logikája helyes, csak nincs premium sor az adatban.
- **Meglévő seed-listing „átvétele" (owner=null → user):** a jelenlegi claim =
  önkiszolgáló ÚJ listing (owner=self). A már seedelt, gazdátlan sorok user általi
  átvétele owner-hozzárendelést igényelne, amit az RLS csak adminnak enged — ehhez
  külön `provider_claims` request/approve tábla (ÚJ migráció, db-engineer) kellene.
  Elhalasztva; nem blokkoló.
- **Éles teszt-artefaktumok (a verifikáció hagyta a távoli DB-ben):** „Balázs SUP
  TúraBázis" provider (owner=admin), egy lead a SUP Balatonon, és a Tisza-tavi
  `verified=true`. Ártalmatlan dev-adat; az F1.10 tiszta `db push --include-seed`
  reset-eli. Nincs törlő-UI (admin-panel csak verifikál); DB-törlés a rossz-projekt
  token-csapda miatt szándékosan elmaradt.
