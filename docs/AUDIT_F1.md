# F1 fázis-záró audit — eredmény (2026-07-26)

A `docs/AUDIT_CHECKLIST.md` tételes végigfuttatása. Minden pont MÉRÉSSEL zárult
(parancs-kimenet, nem szemrevételezés); ahol nem, ott az külön jelölve van.

## Összegzés

| Szakasz | Állapot |
|---|---|
| 1. Modul-szerződés | ✅ 4/4 |
| 2. RLS-lefedettség | ✅ 4/4 |
| 3. Biztonság | ✅ 3/3 |
| 4. Tesztkapuk | ✅ 5/5 — vizuális regresszió PÓTOLVA (2026-07-26) |
| 5. Design + a11y | ✅ 5/5 |
| 6. Teljesítmény + SEO | ✅ 3/3 — LCP-mérés PÓTOLVA (2026-07-27) |
| 7. Dokumentáció | ✅ 2/2 |

**Az audit két mérés-jellegű hiánya azóta PÓTOLVA: 26/26.** A vizuális
regresszió 2026-07-26-án (4.5), a teljesítmény-budget 2026-07-27-én (6.1).

---

## 1. Modul-szerződés — ✅

- **Nincs modul→modul import.** ESLint `import/no-restricted-paths` zöld; kézi
  szúrópróba (`grep 'from "@modules/' src/modules/`) a registryn kívül 0 találat.
- **A core nem függ modultól/app-tól.** `grep` a `src/core/`-ban `@modules/`,
  `~/` és app-relatív importra: 0 találat.
- **6 modul, 6 `module.ts` manifest, 6 registry-bejegyzés** — egyezik.
- **`app/routes` vékony.** A két legnagyobb route (`spotok.$slug` 555,
  `deszkak.$slug` 476 sor) SZÁNDÉKOSAN nagyobb: ezek kötik össze a modulokat
  (spots↔weather, catalog↔reviews), amit a modul-szerződés kizárólag itt enged.
  A logika a modulokban van, a route komponál.

## 2. RLS-lefedettség — ✅

- **19 tábla, 19-en RLS engedélyezve** — 0 fedetlen tábla.
- **10 pgTAP-fájl, 189 assert.** A CI `rls-tests` jobja futtatja (lokálisan
  nincs Docker, ezért ott élesben ez az első futás).
- **E-mail-megerősítés gate:** app-oldalon 2 write-route (`deszkak.$slug`,
  `spotok.$slug`) `isEmailConfirmed`-del; DB-oldalon 7 policy hivatkozik az
  `is_email_confirmed()` security definer helperre. A védelem tehát KÉT rétegű
  — az app-réteg megkerülése sem nyit utat.
- **`verified_owner` / `status`:** `protect_review_columns` trigger írja vissza
  a régi értéket user-update-nél; 8 hivatkozás a reviews pgTAP-tesztben.

## 3. Biztonság — ✅

- **Semgrep tiszta** (`p/typescript`, `p/react`, `p/secrets`, `p/owasp-top-ten`,
  `p/sql-injection`) a teljes kódbázison. **Snyk:** 0 produkciós finding.
  Nyitott HIGH/CRITICAL nincs; a triage-olt tételek: `SECURITY_FINDINGS.md`.
- **Nincs kliensre szivárgó secret.** `service_role`/`sb_secret` a kliens-kódban:
  0 találat. A `.env.example` mind a 4 `VITE_` változója szándékosan publikus
  (Supabase URL + publishable kulcs, VAPID PUBLIKUS fele, Turnstile site key).
- **Edge Functionök auth-védettek:** `verify_jwt = true` mindkét cron-hívott
  functionre (`config.toml`).

## 4. Tesztkapuk — ⚠️ 4/5

- `npm run typecheck` **ZÖLD** (strict + `noUncheckedIndexedAccess`).
- `npm run lint` **ZÖLD**.
- `npm test` **ZÖLD — 468 teszt, 46 fájl.** Az algoritmus-határesetek
  táblázatosan fedve (SUP-index sávhatárok, Deszkaválasztó méret-sávok,
  RFC 8291 push-titkosítás roundtrippel).
- **Playwright e2e ZÖLD — 60 teszt** (desktop + mobil), benne az axe a11y.
- **✅ Vizuális regresszió: PÓTOLVA (2026-07-26).** 7 referencia-kép a
  token-kritikus komponensekről (`e2e/visual.spec.ts` + a `/dev/vizualis`
  dev-only harness). Futtatás: `npm run e2e:visual`.
  **A küszöb MÉRÉSSEL lett beállítva:** a Playwright gyári `threshold: 0.2`
  elnyelte, amikor az „Óvatosan"-jelvény háttere a `safe` tokenre váltott —
  a teszt átment egy VALÓDI token-hibán. `0.05` / `maxDiffPixelRatio 0.002`
  mellett ugyanez 2786 eltérő pixellel elbukik, ismételt futtatásnál viszont
  nincs hamis riasztás.
  **CI-ban NEM fut** (platformfüggő referenciák — a spec is „release előtt"-re
  teszi); a runbook leírja, hogyan kell linuxos referenciákat generálni.

## 5. Design + a11y — ✅

- **Biztonsági tokenek érintetlenek.** BIZONYÍTÉK: a `tokens.css`-nek a projekt
  kezdete óta összesen **2 commitja van, mindkettő 0 TÖRLÉSSEL** (F1.0:
  +34 sor létrehozás; F1.10: +28 sor animáció-blokk). Egyetlen sor sem
  módosult — a `--safe*`/`--caution*`/`--danger*`/`--stale` értékek betűre az
  eredetiek.
- **Státusz = szín + ikon + szöveg.** A `StatusBadge` `label` propja kötelező
  (típus-szinten), az ikon beépített. Csak-színes státusz-jelölés: 0 találat.
- **`--danger` interakciós elemen: nincs.** A `ButtonVariant` union
  típus-szinten nem tartalmaz `danger`-t. Az egyetlen `bg-danger` a
  `StormAlertScreen` teljes képernyős HÁTTERE (nem interakciós elem), és külön
  teszt őrzi, hogy a benne lévő CTA-link NE kapjon danger-osztályt.
- **axe-core WCAG 2.1 AA zöld** 10 kulcsképernyőn (e2e-csomag része).
- **Adatkor-szabály:** `STALE_THRESHOLD_MINUTES = 30` kód-konstans (tudatosan
  NEM DB-ből hangolható — lásd F1.10/4). A viharjelzés-sorok `fetched_at`-ja
  MINDIG a scrape pillanata, tehát cache-elt viharjelzés nem jelenhet meg
  aktuálisként.

## 6. Teljesítmény + SEO — ✅

- **✅ LCP < 2,5 s: MÉRVE (2026-07-27).** A PRODUKCIÓS build ellen, Lighthouse-
  mobil fojtással (150 ms RTT / 1,6 Mbps / 4× CPU): `/` **584 ms** ·
  `/deszkak` **528 ms** · `/deszkavalaszto` **588 ms** · `/spotok` **944 ms** —
  mind a 2500 ms-os cél alatt. Kliens-JS (brotli): 130 / 132 / 135 / 395 kB.
  A mérés kapuvá vált (`e2e/perf.spec.ts`, `npm run e2e:perf`), külön teszttel
  arra, hogy a MapLibre CSAK a térképes útvonalon töltődjön.
  **A mérés fogott egy módszertani hibát is:** tömörítés nélküli kiszolgálóból
  a `/spotok` 2764 ms-ot adott volna (budget fölött) — a Netlify viszont
  tömörítve szállít, ezért a lokális futtató is br/gzip-el. Tömörítetlen
  méréssel a kapu hamis riasztást adott volna.
  **Amit NEM igazol:** ez nem field-LCP (nincs HTTP/2, CDN-távolság, valós
  eszköz-szórás). Élő méréshez: `PERF_BASE_URL=https://… npm run e2e:perf`.
- **SSR meta + hreflang + JSON-LD: VALIDÁL.** Minden fő route-on 1 `<title>`,
  1 canonical, 3 hreflang-link (hu + x-default), 4 OG-tag. A deszka-adatlapon
  JSON-LD: `Product` + `Brand` + `Offer` + `AggregateRating`.
  *Audit-jegyzet:* a hreflang a HTML-ben `hrefLang` alakban jelenik meg (React
  attribútum-név). Ez NEM hiba: a HTML attribútumnevek kis-nagybetű-
  érzéketlenek, a crawlerek helyesen olvassák.
- **sitemap + robots fut:** 48 URL a sitemapben, 5 Disallow-sor a robotsban,
  `/en/` URL nincs (activeLocales = hu).

## 7. Dokumentáció — ✅

- `PROGRESS.md` naprakész (fázisonként + a következő lépés jegyzeteivel).
- Az eltérések indoklással dokumentáltak: `ADVISOR_DOMAIN_REVIEW.md` (a
  Deszkaválasztó szakmai kalibrációja), `SECURITY_FINDINGS.md` (elfogadott
  kockázatok), `RUNBOOK.md` (éles műveletek).

---

## Ami az F1 lezárásához még kell (nem audit-hiba)

1. **Cégadatok** a jogi oldalakon (`@core/legal/entity.ts`) — felhasználói adat.
2. **Turnstile éles kulcs** — a publikussá tétel ELŐTT kötelező, különben a
   regisztráció szabadon spamelhető.
3. ~~**LCP-budget (Lighthouse)**~~ ✅ **PÓTOLVA (2026-07-27)** — lásd a 6.
   szakaszt. Az ÉLES oldal mérése a publikussá tétel után esedékes
   (`PERF_BASE_URL=…`), de a kapu és az alapérték megvan.
