# SUP Platform — PROGRESS

> Session-átvihetőség: keret-elfogyás vagy compact után a karmester (Fable 5,
> hiányában Opus 4.8) INNEN veszi fel a fonalat. Minden fázis végén frissítendő.

## Állapot-összkép

| Lépés | Állapot | Megjegyzés |
|---|---|---|
| F1.0 Projekt-setup | ✅ kész (2026-07-17) | részletek lent |
| F1.1 Core (auth, i18n, ui-primitívek…) | ✅ kész (2026-07-17) | reviewer-jóváhagyással; részletek lent |
| F1.2 DB (séma + RLS + seed) | ✅ kész (2026-07-18) | reviewer-jóváhagyással; futási verifikáció a CI rls-tests jobban |
| F1.3 Weather + SUP-index | ⬜ | |
| F1.4 Spots + térkép | ⬜ | |
| F1.5 Catalog + Reviews | ⬜ | + catalog-watch séma-előkészítés (`docs/CATALOG_WATCH_TERV.md`: boards-életciklusmezők, catalog_sources, catalog_candidates, pg_trgm) |
| F1.6 Advisor | ⬜ | |
| F1.7 Providers | ⬜ | |
| F1.8 SEO-réteg | ⬜ | + jogi oldalak: ÁSZF + adatvédelmi nyilatkozat, consent-checkbox a regisztrációban (spec F1-fázislista + 11.4) |
| F1.9 Push + viharjelzés | ⬜ | |
| F1.10 Záró audit + élesítés | ⬜ | |

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
- `seed.sql`: 9 márka, 20 deszka (+20 ár), 15 spot, 5 provider, 33
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
A migrációk a távoli projektre még NINCSENEK kitolva (`npm run sb -- db push`
a CI-zöld után esedékes).

**Megjegyzések a következő lépéshez (F1.3):**
- `supindex.*` kulcsok a seedben — az algo-engineer validálja a sávokat,
  különösen `storm.level2_cap=0` (II. fok → index 0, spec 9. fejezet).
- A Gauge küszöb-defaultjai (F1.1-jegyzet) innen kötendők be.
- Weather-írás kizárólag service_role (nincs write-policy) — az Edge Function
  ehhez igazodjon.
