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
| F1.4 Spots + térkép | ⬜ | |
| F1.5 Catalog + Reviews | ⬜ | + catalog-watch séma-előkészítés (`docs/CATALOG_WATCH_TERV.md`: boards-életciklusmezők, catalog_sources, catalog_candidates, pg_trgm) |
| F1.6 Advisor | ⬜ | |
| F1.7 Providers | ⬜ | |
| F1.8 SEO-réteg | ⬜ | + jogi oldalak: ÁSZF + adatvédelmi nyilatkozat, consent-checkbox a regisztrációban (spec F1-fázislista + 11.4) |
| F1.9 Push + viharjelzés | ⬜ | |
| F1.10 Záró audit + élesítés | ⬜ | |

## ITINER a következő sessionnek (2026-07-19-i állapot)

**Következő lépés: F1.4 — Spots-modul: térkép (MapLibre), spot-lista/adatlap,
rétegek, spot_reports [ui-builder + scaffolder].** Induláskor olvasd el az
F1.3-fejezet follow-upjait, KIEMELTEN az m5 átadási feltételt: II. fokú
viharjelzésnél (`flags.stormLevel===2`) a UI „Tilos"-t (i18n `status.forbidden`)
renderel, NEM a danger-„Veszélyes"-t. A weather-modul fogyasztása:
`src/modules/weather/` (computeSupIndex, reading.ts a stale-hez, weather i18n
namespace); a friss adat a `weather_snapshots`-ból jön (óránkénti cron tölti).

**Nyitott kis tételek (nem blokkolók):**
- m3: `supindex.stale_minutes` holt seed-kulcs — bekötni vagy kivenni (db-engineer).
- m4 (F1.9): Open-Meteo `observed_at` tárolása a `fetched_at` mellett.
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
