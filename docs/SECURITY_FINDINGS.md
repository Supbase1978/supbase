# SUP Platform — biztonsági findingok és triage

> Az `AUDIT_CHECKLIST.md` 3. pontjának („nincs nyitott HIGH/CRITICAL") élő
> nyilvántartása. Minden finding ide kerül: elfogadva / javítva / nyitva,
> INDOKLÁSSAL. Új fázis-záráskor a nyitottakat újra kell értékelni.

## Eszközök és futtatás

| Eszköz | Mit fed | Hol fut |
|---|---|---|
| **Semgrep** (`p/typescript`, `p/react`, `p/secrets`, `p/owasp-top-ten`, `p/sql-injection`) | SAST | CI `semgrep` job, minden PR-en, `--error` (találat = piros CI) |
| **pgTAP** | RLS-policy lefedettség | CI `rls-tests` job |
| **Playwright + axe** | jogosultsági kapuk, a11y | CI `e2e` job |
| **npm audit** | függőség-CVE | kézzel (`npm audit --omit=dev`) |
| **Snyk** | függőség + SAST | MCP-n át, `snyk_auth` után (2026-08-23 óta fut); CI-ben még nincs — `SNYK_TOKEN` kell |

Helyi futtatás:

```bash
semgrep scan --config=p/typescript --config=p/react --config=p/secrets \
  --config=p/owasp-top-ten --config=p/sql-injection \
  --exclude=node_modules --exclude=build --exclude=.react-router
npm audit --omit=dev
npm run typecheck
```

A teljes menetet a `biztonsagi-ellenorzes` skill írja le (Semgrep + Snyk +
TypeScript), a Snyk-lépéssel együtt.

## Findingok

### F1.10-01 · react-router RSC-mód CSRF-megkerülés — **JAVÍTVA**

- **Súlyosság:** high (GHSA-qwww-vcr4-c8h2, CWE-352)
- **Érintett:** `react-router >=7.12.0 <8.3.0` — a projekt 7.18.1-en van.
- **Miért nem érint minket:** a sérülékenység **kizárólag RSC-módban**
  (React Server Components) él. A projekt framework-módú SSR-t használ, RSC
  nincs bekötve — sem `@react-router/rsc` függőség, sem `unstable_RSC` API
  nem fordul elő a kódbázisban (ellenőrizve grep-pel, 2026-07-25).
- **JAVÍTVA (2026-08-23).** A 7.x ágon időközben megjelent a patch: **7.18.2**.
  A korábbi indoklás („csak a 8.3.0 főverzióban van javítás") elavult — a
  frissítés főverzió-emelés nélkül, egy patch-lépéssel megtörtént.
  Ellenőrizve: `npm audit --omit=dev` → **0 sebezhetőség**, 1170 teszt zöld.
- **Tanulság:** az „elfogadott kockázat" nem örök állapot. Az elfogadás
  indoklása („nincs javítás") elévülhet — az újraértékelést a rendszeres
  Snyk-futás váltja ki, nem az emlékezet.
- **Utólagos korrekció (2026-08-24):** a frissítés ELSŐRE hiányos volt. Csak a
  `react-router` ment 7.18.2-re, a `@react-router/*` család nem — a
  `@react-router/serve` viszont PONTOS verziót vár, így a lock ellentmondásossá
  vált. Lokálisan az `npm install` még feloldotta, a CI szigorúbb `npm ci`-je
  ERESOLVE-val megállt, és ezzel a biztonsági javítás egy CI-lábat pirosított.
  **Tanulság a tanulságon túl:** a rögzített verziójú társcsomagoknál a
  frissítés a CSALÁDRA szól, és a biztonsági javítás sem kész addig, amíg a
  kapuk nem zöldek — épp azért, mert az `npm install` engedékenyebb, mint a CI.

### F1.10-02 · `dangerouslySetInnerHTML` a JSON-LD-ben — **FALSE POSITIVE**

- **Súlyosság:** Semgrep `react-dangerouslysetinnerhtml` (warning)
- **Hely:** `src/core/seo/json-ld.tsx`
- **Triage:** a `<script>` elemből a HTML-parser kizárólag `<`-gal léptethető
  ki (`</script`, `<!--`); a `jsonLdScript` MINDEN `<`-et `<`-re cserél,
  ami JSON-ban ekvivalens, HTML-ben ártalmatlan. Felhasználói tartalom
  (vélemény-szöveg, szolgáltató-név) így sem tud script-taget zárni.
  Regressziós teszt: `jsonld.test.ts` — `"</script><script>alert(1)"`.
  DOMPurify itt nem alkalmazható: nem HTML-t, hanem JSON-t szúrunk be.
- **Kezelés:** `nosemgrep` a kódban, a fenti indoklással. Ez a projekt
  EGYETLEN innerHTML-pontja — új `dangerouslySetInnerHTML` csak külön
  biztonsági review-val kerülhet be.

### F1.10-03 · Mozgó GitHub Actions tagek — **JAVÍTVA**

- **Súlyosság:** Semgrep `github-actions-mutable-action-tag` (supply chain)
- **Triage:** a `@v4` / `@v1` tag némán átirányítható az action tulajdonosa
  által — a `trivy-action` és a `kics-github-action` kompromittálása pontosan
  így történt.
- **Javítás:** minden `uses:` teljes 40 karakteres commit-SHA-ra pinnelve, a
  komment mutatja a verziót (`.github/workflows/ci.yml`).
- **Karbantartási teher:** frissítéskor a SHA-t is cserélni kell — F2-ben
  Dependabotra bízandó.

### F2.1-01 · Shell-injekció a crawl-workflow-ban — **JAVÍTVA**

- **Súlyosság:** high — Semgrep `yaml.github-actions.security.run-shell-injection`
  (CWE-78). A CI `semgrep` jobját 2026-07-31 óta EZ pirosította.
- **Triage:** a `.github/workflows/catalog-watch.yml` `run:` blokkja
  `${{ inputs.* }}` interpolációval hívta a crawlert. A `max_products`
  **szabad szöveges** workflow-bemenet, tehát aki el tudta indítani a
  workflow-t, tetszőleges parancsot futtathatott a runneren — és onnan a
  `SUPABASE_SERVICE_ROLE_KEY`-hez fért volna hozzá. Nem elméleti: a workflow
  `workflow_dispatch`-csel kézzel indítható.
- **Javítás:** a bemenetek KÖZTES `env:` változóba kerülnek
  (`DRY_RUN`, `MAX_PRODUCTS`), a `run:` blokk pedig idézőjelezett shell-
  változóként használja őket, tömb-argumentumokkal. A `max_products` ezen
  felül SZÁM-ellenőrzésen megy át: hibás értéknél a lépés megáll, nem pedig
  csendben végigjárja az egész katalógust.
- **Ellenőrizve:** a teljes Semgrep-menet (144 szabály, 445 fájl) a javítás
  után **0 találat**.

### F1.10-04 · Snyk nincs bekötve — **LEZÁRVA (2026-08-23)**

- A Snyk MCP (1.1303.1) telepítve van, és a `snyk_auth` után **lefutott**:
  `snyk_sca_scan` (függőségek) + `snyk_code_scan` (SAST).
- **Eredmény:** a TERMELÉSI függőségekben **0 HIGH/CRITICAL**. A fejlesztői
  fában 14 tétel (ld. F2.1-03), a SAST-ban 4 (ld. F2.1-04).
- **Marad nyitott részlet:** a `SNYK_TOKEN` repository secret és a heti
  ütemezett workflow — a HELYI futtatás ettől függetlenül működik, és a
  `biztonsagi-ellenorzes` skill rögzíti a menetét.

### F2.1-03 · Fejlesztői függőségek: 1 kritikus + 5 magas — **JAVÍTVA (2026-08-25)**

- **Forrás:** `snyk_sca_scan --dev` (2026-08-23), 14 tétel; ebből a kritikus az
  `esbuild@0.25.12` volt („Resources Downloaded over Insecure Protocol",
  CWE-426/494).
- **A javítás:** `vite@^6.3.0` → **`vite@^7.3.6`** (esbuild 0.28.2), majd a
  tranzitív tételek relockolása: `brace-expansion` 1.1.18 / 5.0.9,
  `browserslist` 4.28.8, `nanoid` 3.3.18, `postcss` 8.5.26, `undici` 7.29.0,
  `js-yaml` 4.3.1.
- **Eredmény (újramérve 2026-08-25):** `snyk_sca_scan --dev` → **0 tétel**,
  `npm audit` (teljes fa) → **0**, `npm audit --omit=dev` → 0.
- **Miért nem kellett eslint-major:** a Snyk `eslint@10.0.0`-t javasolt a
  `js-yaml`-hoz, de a követelő `@eslint/eslintrc@3.3.6` `^4.3.0`-t kér, amibe a
  javított 4.3.1 belefér — egy `npm update js-yaml` elég volt. A Snyk
  remediation-javaslata a legfelső szintű útvonalat preferálja; érdemes előbb a
  tényleges peer-tartományt megnézni.
- **Miért 7 és nem 8:** a `vitest@3.2.7` peer-je `^5 || ^6 || ^7.0.0-0`, a
  `@react-router/dev@8` pedig Node ≥22.22-t kér (a gépen 22.20). A telepített
  plugin-család (`@react-router/dev` 7.18.2, `@tailwindcss/vite` 4.3.3,
  `@netlify/vite-plugin-react-router` 3.1.1, `vite-tsconfig-paths` 5.1.4) peer-
  tartománya viszont MÁR tartalmazta a 7-est, így a családhoz nem kellett nyúlni
  — az F1.10-01 lock-csapdája (`npm install` feloldja, `npm ci` nem) itt nem
  ismétlődött, `npm ci`-vel is ellenőrizve.
- **Kapuk a frissítés után:** `npm ci` · `typecheck` · `lint` · `test`
  (83 fájl / 1170 teszt) · `build:web` — mind zöld.
- **Amit a frissítés MELLESLEG kihozott:** ld. F2.1-05.

### F2.1-04 · SAST a lokális build-kiszolgálóban — **ELFOGADOTT KOCKÁZAT**

- **Forrás:** `snyk_code_scan` (2026-08-23), 4 tétel — HIGH egy sincs.
- **Három tétel (medium) a `scripts/serve-build.mjs`-ben:** externally
  controlled format string (CWE-134), HTTP HTTPS helyett (CWE-319), és
  hiányzó ráta-korlát egy fájlrendszer-műveleten (CWE-770).
- **Miért elfogadható:** ez a szkript KIZÁRÓLAG lokálisan fut, a Playwright
  teljesítmény-mérése indítja (`playwright.config.ts`, `localhost:3100`).
  Sosem néz ki az internetre, és nincs nem-megbízható hívója. A HTTPS itt
  kifejezetten ROSSZ lenne: a TLS-többlet torzítaná a mért LCP-t, márpedig a
  szkript LÉTOKA a valósághű mérés.
- **A negyedik (low):** beégetett teszt-érték a
  `notify.server.test.ts`-ben — fixtúra, nem titok.
- **Újraértékelés kiváltó oka:** ha a `serve-build.mjs` valaha kilép a
  localhostról (pl. előnézeti környezet), mind a három tétel AZONNAL valódivá
  válik.

### F2.1-05 · Szerveroldali adatréteg a kliens-csomagban (`feedback.server`) — **JAVÍTVA (2026-08-25)**

- **Hogyan került elő:** a `vite@7` build HIBAKÉNT állt meg ott, ahol a 6-os
  csendben átengedte: „Server-only module referenced by client —
  `@core/feedback/feedback.server` imported by route
  `app/routes/admin.visszajelzesek.tsx`".
- **Az ok:** a `feedback.server.ts` nem csak adatréteget exportált, hanem
  FUTÁSIDEJŰ értékeket is (`FEEDBACK_KINDS`, `FEEDBACK_STATUSES`,
  `MESSAGE_MIN_LENGTH`, `isFeedbackKind`, `sanitizePagePath`), amiket a
  route-ok KLIENS-komponensei használnak (témaválasztó, admin-szűrő,
  súgószöveg). A React Router csak a `loader`/`action`/`middleware`/`headers`
  exportokból távolítja el a szerverkódot — a default export komponensből nem.
  Ugyanez a minta a `visszajelzes.tsx`-ben is megvolt.
- **Mekkora a kár:** titok NEM szivárgott. A `feedback.server.ts` egyetlen
  importja `type SupabaseClient` (típus, lefordítva eltűnik), kulcs nincs
  benne. Ami kikerülhetett: az admin adatréteg ALAKJA — `listFeedback` /
  `setFeedbackStatus` táblanevekkel, oszlopnevekkel, a `feedback_rate_limit`
  jelzéssel. Felderítési előny egy támadónak, nem közvetlen hozzáférés. Az
  RLS (admin-only select) végig a valódi kapu volt és maradt.
- **Javítás:** a modul kettévált. `src/core/feedback/feedback.ts` = kliens-biztos
  réteg (típusok, a DB-kényszereket tükröző konstansok, tiszta validálók);
  `feedback.server.ts` = KIZÁRÓLAG Supabase-t érintő kód. A határ kimondva
  mindkét fájl fejlécében. A `.server` szándékosan NEM re-exportálja a
  kliens-biztos szimbólumokat — a re-export csendben visszahozná a hibát.
  A tiszta validálók tesztje `feedback.test.ts`-re költözött (a lefedettség
  változatlan: 83 fájl / 1170 teszt zöld).
- **Ellenőrizve:** a `build/client` fában a `listFeedback`, `setFeedbackStatus`
  és `feedback_rate_limit` minta egyikére sincs találat.
- **Tanulság:** a build-lánc frissítése nem csak CVE-t zár — ez a leak évekig
  elfért volna a vite 6 alatt. Aki `.server` fájlba konstanst tesz, előbb-utóbb
  kliensbe húzza az adatréteget.
- **Újraértékelés kiváltó oka:** ESLint-szabály (`import/no-restricted-paths`
  vagy `no-restricted-imports`) hiányzik, ami a `.server` importot kliens-
  komponensből tiltaná. MOST a vite-build a kapu — az a route-okat fogja meg,
  de egy sima `.tsx` komponensben ugyanez a hiba csak a csomagban derülne ki.
  Felvéve a nyitott higiéniai tételek közé.

### F2.4-02 · A `profiles` teljes egészében publikus volt — **JAVÍTVA**

- **Súlyosság:** medium (információ-kiszivárgás, CWE-200) + adatvédelmi
  kitettség.
- **Mit mértünk (2026-08-23, VALÓS anonim kulccsal):** a
  `profiles_public_read` policy `using (true)` volt, tehát bejelentkezés
  nélkül minden oszlop olvasható: `id, display_name, role, rider_weight_kg,
  experience, locale, created_at`.
- **Miért nem volt ez elméleti:** a regisztráció NEM kérte be a nevet, ezért a
  `profiles` trigger tartaléklánca az **e-mail @ előtti részét** tette a
  `display_name`-be. A publikus olvasással így mindenki e-mail-címének az
  első fele nyilvános volt.
- **A `role` külön kockázat:** elárulja, ki az admin — célzott adathalászathoz
  ad kiindulópontot.
- **Javítás:** `profiles_public` NÉZET (`id`, `display_name`), a táblán pedig
  saját sor + moderátor policy. A név publikus KELL maradjon, mert a
  vélemények a szerző neve alatt jelennek meg.
- **Ellenőrizve:** anonim kulccsal a tábla 0 sort ad, a nézet 3-at két
  oszloppal, a `role` a nézeten át sem érhető el.
- **Újraértékelés kiváltó oka:** a `profiles_public` nézet BŐVÍTÉSE — a nézet
  a definiálója jogaival fut, tehát bármely új oszlop azonnal publikussá válna.

### F2.4-03 · Postgres-szegfault jogosultság-megtagadáskor (upstream) — **NEM KIVÁLTHATÓ A HTTP-FELÜLETRŐL, MEGKERÜLVE**

- **Súlyosság:** a rendelkezésre állás szempontjából elvben critical (egyetlen
  hívás leállítja az adatbázist), a TÉNYLEGES kitettség viszont **nincs**: a
  kiváltásához olyan adatbázis-hozzáférés kell, amivel a támadó amúgy is bármit
  megtehetne. Lásd a mérést lentebb.
- **Mit mértünk (2026-08-23/24, eldobható konténerben, öt körben):** ha egy
  szerep EXECUTE-jog nélkül hív meg egy függvényt, a Postgres a „permission
  denied" helyett `signal 11: Segmentation fault`-tal leáll, és az egész
  példány helyreállításba megy. A `pgTAP`-készletben ez nyolc további
  tesztfájlt vitt magával, és ez pirosította a CI-t 2026-07-31 óta.
- **A hiba NEM a mi kódunké.** Leszűkítve: a pgTAP ártatlan (`throws_ok` anon
  alatt önmagában elfut); a NULL `auth.uid()` ártatlan (`authenticated`
  szerepből szabályosan 42501-et dob); a `pgaudit` ártatlan (kikapcsolva is
  összeomlik); és a döntő bizonyíték: egy triviális, az anon elől elzárt
  `create function probe() returns int as 'select 1'` UGYANÍGY szegfaultol.
  Vagyis bármely függvény-szintű megtagadás elég hozzá.
- **Környezet:** Supabase helyi kép, PostgreSQL 17.6. Az ÉLES projekt ugyanezen
  a motoron fut (17.6.1.147, management API-ból lekérdezve), ezért a kérdést
  nem lehetett „ez csak lokális" alapon lezárni.
- **MIÉRT NEM KITETTSÉG — ez a lényegi mérés:** hitelesítés nélküli
  PostgREST-hívással próbáltuk kiváltani, teljes stackkel (Kong + PostgREST),
  vagyis pontosan az éles kérésúton. Az eredmény tiszta
  `42501 permission denied for function` + HTTP 401, az adatbázis a hívás után
  is kiszolgált (HTTP 200), és a szerver naplójában NINCS crash-nyom. Az
  összeomláshoz superuser-munkamenetből indított `SET ROLE` kell — azt a
  pgTAP-futtató psql csinálja, a PostgREST nem.
  **Élesben SZÁNDÉKOSAN nem próbáltuk ki: ott a mérés maga lenne a támadás.**
- **Megkerülés:** a `42_push_webpush_test.sql` az anon elzárását mostantól
  `has_function_privilege`-dzsel méri, a viselkedési ágat pedig `authenticated`
  szerepből, `sub` nélküli claimsszel — a megtagadási útvonal érintése nélkül,
  ugyanazzal a lefedettséggel.
- **Újraértékelés kiváltó oka:** Postgres-verzióváltás (a javítás felszabadít),
  VAGY ha a PostgREST valaha superuser-jogú kapcsolattal futna — akkor a fenti
  „nincs kitettség" indoklás elévül.
- **Maradó kockázat, amit tudni kell:** aki közvetlen superuser-kapcsolatot kap
  az adatbázishoz (pl. egy Studio SQL-editor munkamenet), egy `set role anon` +
  elzárt függvényhívással le tudja állítani a példányt. Ez nem
  jogosultság-emelés, csak rendelkezésre-állási bosszúság — de fejlesztés
  közben érdemes rá emlékezni, ha az adatbázis „magától" újraindul.

### F1.10-05 · Captcha (bot-védelem) nincs élesítve — **ELFOGADOTT KOCKÁZAT a jelszó-kapu mögött**

- **Állapot:** a Turnstile-integráció KÉSZ (`@core/auth/turnstile.tsx`, 3 űrlap:
  `/belepes`, `/regisztracio`, `/elfelejtett-jelszo`), de éles kulcs nélkül a
  `isTurnstileEnabled()` kikapcsolja — az űrlapok captcha nélkül működnek.
- **Miért elfogadható MOST:** az oldal HTTP Basic auth mögött van, nyilvános
  forgalom nélkül. Nincs mit védeni.
- **Mi a valódi kockázat élesítés UTÁN:** nem adatszennyezés (a bot-regisztráció
  megerősítetlen marad, és az `is_email_confirmed()` gate + RLS nem enged neki
  írást), hanem az **e-mail-kvóta kimerítése** — egy spam-hullám elhasználja a
  napi/órás küldési keretet, és onnantól a VALÓDI felhasználó nem kapja meg a
  megerősítő levelét.
- **Kiváltó ok (mikor kötelező):** a `SITE_PUBLIC=true` beállításával EGYIDŐBEN.
  Felvéve a `RUNBOOK.md` élesítési checklistjébe. Felhasználói döntés
  (2026-07-27): a fiók-regisztráció akkor történik meg.
- **Ha akkor sem lesz captcha:** a Supabase Dashboard → Auth → Rate Limits
  értékeit kell szigorítani (IP-alapú sign-up/e-mail limitek) — gyengébb
  védelem, de nem nulla.

### F1.10-06 · Éles e-mail-küldés: beépített Supabase SMTP — **NYITOTT (élesítési blokkoló)**

- A regisztráció-megerősítő, magic link és jelszó-visszaállító levél jelenleg a
  Supabase **beépített** küldőjén megy, amit a dokumentáció kifejezetten
  próbára szán: néhány levél/óra, „best-effort" kézbesítés, idegen feladó-domain
  (a spam-mappa reális kimenetel).
- **Következmény élesben:** a regisztráció ténylegesen elromlik terhelés alatt —
  ez üzemeltetési hiba, nem sérülékenység, de a captcha-kockázattal ÖSSZEÉR
  (mindkettő ugyanazt a kvótát fogyasztja).
- **Terv (felhasználói döntés, 2026-07-27):** saját SMTP a **Resend**-en át.
  Előfeltétele saját domain (DNS-alapú domain-hitelesítés) — lásd a
  `RUNBOOK.md` élesítési checklistjét.

### F1.12-01 · Az analitika-végpont kívülről is hívható — **ELFOGADOTT KOCKÁZAT**

- A `record_analytics_event()` RPC-nek `anon` EXECUTE-joga van, mert az
  SSR-réteg a kérés saját (anon vagy authenticated) jogaival hív — a projekt
  szándékosan NEM tart szerver-oldali titkos kulcsot a Netlify-on.
- **Következmény:** bárki küldhet valótlan eseményt, ahogy minden webes
  analitikánál (Plausible, GA). A kár STATISZTIKA-SZENNYEZÉS, nem adatszivárgás:
  a tábla olvasása admin-only, a sorokban nincs személyes adat, és a
  bemenetet a függvény ÉS a tábla-kényszerek is szűrik (zárt eseménynév-lista,
  útvonal-alak, props-méret).
- **Ami NEM lehetséges:** közvetlen `insert`/`update`/`delete` a táblára (nincs
  policy), tetszőleges mező írása, vagy más adat kiolvasása a végponton át.
- **Ha valaha zavaró lesz:** rate limit a Supabase oldalán, vagy az esemény-írás
  átköltöztetése egy hitelesített Edge Functionbe. Az F1-es forgalomnál ez
  fölösleges bonyolítás lenne.

## Korábbi fázisokból hozott, már lezárt tételek

- **F1.9:** az `upsert_push_subscription()` RPC-t az anon szerep is hívhatta
  (a Supabase `alter default privileges` miatt) — explicit `revoke ... from
  anon` (migráció `20260717090700`). Tanulság: a public sémában létrehozott
  függvény ALAPBÓL anon-hívható, a `revoke ... from public` NEM elég.
- **F1.4:** `getSpotBySlug` nyers slug a PostgREST `.or()` szűrő-stringben →
  slug-alak-guard (`^[a-z0-9-]+$`) + negatív tesztek. Ugyanez a minta a
  catalog és providers modulokban is.
- **F1.1:** `safeRedirect` nyílt-redirect (`//host` ÉS `/\host`) — javítva,
  regressziós teszttel.
- **F1.2:** orders pénzügyi mezők user-írhatósága; `providers.tier`
  önemelés → column-védő triggerek + negatív pgTAP-tesztek.

## Nyitott higiéniai tételek (nem sérülékenységek)

- A `.env`-beli Supabase access token forgatható (korábbi munkamenetben
  fájlba/beszélgetésbe került).
- A `~/.zshrc` globális `SUPABASE_ACCESS_TOKEN` exportja (régi fiók)
  kivehető, ha a régi projektekhez már nem kell.
- Titkot tartalmazó CLI-parancsot **soha ne `npm run`-on át** (az npm kiírja a
  parancssort) — közvetlenül `bash scripts/sb.sh`, exportált env-változóval.
- **ESLint-őr a `.server` importra** (F2.1-05 nyomán): jelenleg semmi nem tiltja,
  hogy kliens-komponens `.server` modult importáljon — a vite-build csak a
  route-okon fogja meg. Egy `no-restricted-imports` szabály a `src/**/*.tsx`
  kliens-fájlokra olcsó védőháló lenne.
