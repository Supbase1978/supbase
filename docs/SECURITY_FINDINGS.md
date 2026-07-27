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
| **Snyk** | függőség + SAST | **még nincs bekötve** — `SNYK_TOKEN` repository secret kell |

Helyi futtatás:

```bash
semgrep scan --config=p/typescript --config=p/react --config=p/secrets \
  --config=p/owasp-top-ten --config=p/sql-injection \
  --exclude=node_modules --exclude=build --exclude=.react-router
npm audit --omit=dev
```

## Findingok

### F1.10-01 · react-router RSC-mód CSRF-megkerülés — **ELFOGADOTT KOCKÁZAT**

- **Súlyosság:** high (GHSA-qwww-vcr4-c8h2, CWE-352)
- **Érintett:** `react-router >=7.12.0 <8.3.0` — a projekt 7.18.1-en van.
- **Miért nem érint minket:** a sérülékenység **kizárólag RSC-módban**
  (React Server Components) él. A projekt framework-módú SSR-t használ, RSC
  nincs bekötve — sem `@react-router/rsc` függőség, sem `unstable_RSC` API
  nem fordul elő a kódbázisban (ellenőrizve grep-pel, 2026-07-25).
- **Javítás elérhető?** Csak a **8.3.0** főverzióban. A 7.x ágon nincs
  patch-kiadás (a legfrissebb 7.18.1).
- **Döntés:** a főverzió-emelés F1 zárása előtt aránytalan kockázat (breaking
  change-ek a route-konfigban és a típusokban). **F2-re ütemezve**, addig a
  kitettség nulla.
- **Újraértékelés kiváltó oka:** ha RSC-módot vezetünk be → AZONNAL frissíteni
  kell 8.3.0+-ra, még a bevezetés ELŐTT.

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

### F1.10-04 · Snyk nincs bekötve — **NYITOTT**

- A 10. fejezet heti Snyk függőség-auditot ír elő. A CLI/MCP
  **fiók-hitelesítést** igényel (`snyk auth`), ami felhasználói döntés.
- Amíg nincs: az `npm audit --omit=dev` a helyettesítő (ez fedte fel az
  F1.10-01 findingot is).
- **Teendő:** Snyk-fiók + `SNYK_TOKEN` repository secret → külön heti
  ütemezett workflow.

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
