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

### F2.1-03 · Fejlesztői függőségek: 1 kritikus + 5 magas — **ELFOGADOTT KOCKÁZAT, ütemezett frissítéssel**

- **Forrás:** `snyk_sca_scan --dev` (2026-08-23), 14 tétel.
- **A kritikus:** `esbuild@0.25.12` — „Resources Downloaded over Insecure
  Protocol" (CWE-426/494). Javítás: `vite@7.3.6` (esbuild 0.28.1).
- **Magas:** `brace-expansion` (×2), `browserslist` (prototype pollution +
  DoS), `js-yaml`, `nanoid`, `undici` (×2).
- **Miért elfogadható MOST:** mind BUILD-IDEJŰ eszköz. A termelési fába
  egyik sem kerül be — ellenőrizve: `snyk_sca_scan` termelési fán
  `severity_threshold=high` → **0 tétel**, `npm audit --omit=dev` → 0.
- **A kockázat, ami MARAD:** ellátási lánc. Az `esbuild` telepítő-szkriptje
  bináris letöltést végez; egy kompromittált CDN a FEJLESZTŐI gépet és a CI
  runnert érinti, ahol a `SUPABASE_SERVICE_ROLE_KEY` is jelen van.
- **Teendő:** `vite@7.3.6`+ frissítés a következő karbantartási körben; a
  többi tétel a lockfile újragenerálásával rendeződik.

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
