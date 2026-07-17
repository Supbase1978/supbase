# SUP Platform — PROGRESS

> Session-átvihetőség: keret-elfogyás vagy compact után a karmester (Fable 5,
> hiányában Opus 4.8) INNEN veszi fel a fonalat. Minden fázis végén frissítendő.

## Állapot-összkép

| Lépés | Állapot | Megjegyzés |
|---|---|---|
| F1.0 Projekt-setup | ✅ kész (2026-07-17) | részletek lent |
| F1.1 Core (auth, i18n, ui-primitívek…) | ✅ kész (2026-07-17) | reviewer-jóváhagyással; részletek lent |
| F1.2 DB (séma + RLS + seed) | ⬜ következő | |
| F1.3 Weather + SUP-index | ⬜ | |
| F1.4 Spots + térkép | ⬜ | |
| F1.5 Catalog + Reviews | ⬜ | |
| F1.6 Advisor | ⬜ | |
| F1.7 Providers | ⬜ | |
| F1.8 SEO-réteg | ⬜ | |
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
