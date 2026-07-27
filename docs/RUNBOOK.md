# SUP Platform — üzemeltetési runbook

> Kézi, éles műveletek lépésről lépésre. Minden művelet **felhasználói
> jóváhagyással** fut (lokál-first munkamenet).
>
> A Supabase CLI-t KIZÁRÓLAG a wrapperrel hívjuk: `npm run sb -- <parancs>`.
> **Titkot tartalmazó parancsnál NE az npm-en át** (az kiírja a parancssort a
> naplóba) — akkor `bash scripts/sb.sh …`, exportált env-változóval.

## GDPR — felhasználó anonimizálása

Az `anonymize_user(uuid)` **SECURITY DEFINER** függvény, amit szándékosan
**csak a `service_role` hívhat** — REST-ről még admin sem (`revoke execute …
from anon, authenticated`). Ez azért van így, mert a művelet
visszafordíthatatlan, és a jogosultságát nem szabad a webes admin-felület
kompromittálódásához kötni.

**Mit csinál:** a véleményeket MEGTARTJA (a Közös nevező torzulna, ha
eltűnnének), de a szerzőt egy sentinel-profilra írja át; a leadeket és az
advisor-sessionöket null-ozza; a push-feliratkozásokat törli.

**Helyes hívás — Edge Functionből vagy service-role klienssel:**

```ts
// A kliensnek service_role kulccsal kell készülnie (Edge Function env).
const { error } = await supabase.rpc("anonymize_user", { target_user: userId });
```

**Ami NEM működik (és nem is szabad, hogy működjön):**
- böngészőből / a webes admin-felületről,
- a publishable (anon) kulccsal,
- bejelentkezett admin JWT-vel a REST-en át.

**Ellenőrzés futtatás után:** a `profiles` sorban a sentinel-adat, a
`board_reviews` sorok megmaradtak, a `push_subscriptions` üres az adott userre.

## Migrációk kitolása élesbe

```bash
npm run sb -- migration list          # mi van kinn, mi hiányzik
npm run sb -- db push                 # a hiányzók kitolása
```

Ha a helyi migrációk időbélyege KORÁBBI, mint a távoli utolsó migrációé, a CLI
`--include-all` flaget kér. Ez normális, ha a fájlneveket témák szerint
számoztuk (core/modul/gdpr blokkok) — de a push előtt nézd át a listát.

## Edge Functionök deploy + secretek

Lásd `supabase/functions/README.md` (weather-sync, storm-alert, VAPID-kulcsok,
cron-beállítás).

## Netlify deploy

Site: **supperz.netlify.app** (repo: `github.com/Supbase1978/supbase`).

**Az auto-deploy KI van kapcsolva.** Build csak akkor fut, ha a legutolsó commit
üzenete tartalmazza a `[deploy]` jelölőt (`netlify.toml` `ignore` parancsa).
Ellenőrizve (2026-07-26): a jelölő nélküli pushok a Netlify felületén
`Canceled` státusszal jelennek meg, **build-idő nélkül** (a publikáltaknál
látszik a „Deployed in Xs", a canceled soroknál nem) — tehát build-percet nem
fogyasztanak. A GitHub-integráció minden pushra létrehoz egy sort; ez normális,
nem jelent lefutott buildet.

**Ezért a repót NEM kötöttük le.** A kapu megoldja a költség-kérdést, a lekötés
viszont elvenné a PR-enkénti deploy previewt és a `[deploy]`-jelölős élesítést.
Ha mégis kell még egy réteg: a Netlify UI-ban a **Deploy Previews kikapcsolása**
(egy kapcsoló) sokkal olcsóbb, mint a repo elszakítása.

### Elő-éles jelszó-kapu

Az oldalt HTTP Basic auth védi (`netlify/edge-functions/basic-auth.ts`), mert a
Netlify beépített jelszó-védelme fizetős csomag-funkció. A kapu az EGÉSZ oldalt
fedi (`/*`), az SSR-route-okat és a statikus assetet is.

**FAIL-CLOSED:** ha a `SITE_PASSWORD` nincs beállítva, az oldal **503-at ad** —
nem válik publikussá. Az elfelejtett beállítás így feltűnő hiba, nem csendes
szivárgás.

Netlify env-változók a kapuhoz:
- `SITE_PASSWORD` — kötelező
- `SITE_USERNAME` — opcionális (default `sup`)
- `SITE_PUBLIC=true` — a kapu teljes kikapcsolása **élesítéskor**. Fontos: a
  nyilvánossá tétel NEM a jelszó törlése (az 503-at adna), hanem ez a külön,
  tudatos kapcsoló.

> Ez a kód CSAK a Netlify Deno-edge-én fut, ezért automata teszt nem fedi.
> Az első deploy után kézzel ellenőrizd: jelszó nélkül 401, `SITE_PASSWORD`
> nélkül 503, helyes jelszóval betölt.

**Fontos:** a `VITE_` prefixű értékek BUILD-IDŐBEN épülnek a bundle-be — ha
utólag állítod be őket, ÚJRA kell buildelni (a puszta újradeploy nem elég).
A `SITE_*` változók viszont futásidőben olvasódnak, azokhoz nem kell újrabuild.

### Élesítési (publikussá tételi) checklist

A `SITE_PUBLIC=true` NEM önmagában álló lépés — ezekkel EGYÜTT érvényes.
A sorrend számít: a domain a többi tétel előfeltétele.

1. **Saját domain** (pl. `supperz.hu`) — a Netlify-hoz kötve, `VITE_PUBLIC_SITE_URL`
   erre állítva (a canonical/OG/sitemap ehhez igazodik → ÚJRABUILD kell).
   Előfeltétele a 2. és 3. pontnak is: a `*.netlify.app` aldomainen nincs
   DNS-jogod, tehát levél-feladóként nem hitelesíthető.
2. **Éles SMTP (Resend)** — a beépített Supabase-küldő próbára való (néhány
   levél/óra, best-effort kézbesítés, idegen feladó). Menet: Resend-fiók →
   domain hozzáadása → a kapott SPF/DKIM DNS-rekordok felvétele → SMTP-adatok a
   Supabase Dashboard → Authentication → SMTP Settings alá, feladó a saját
   domainről. Utána a Rate Limits értékei is emelhetők (a szigorú alapérték a
   beépített küldőhöz tartozik). Lásd `SECURITY_FINDINGS.md` F1.10-06.
3. **Turnstile éles kulcs** — Cloudflare-fiók (ingyenes, a domain NEM költözik
   sehova) → widget a saját domainre → `VITE_TURNSTILE_SITE_KEY` a Netlify-ba
   (**újrabuild**), a SECRET a Supabase Dashboard → Authentication →
   Bot and Abuse Protection alá. Kulcs nélkül a captcha kikapcsolva marad, az
   űrlapok működnek — a védelem hiánya viszont az e-mail-kvótát teszi ki
   spamnek (`SECURITY_FINDINGS.md` F1.10-05).
4. **Cégadatok** a jogi oldalakon (`src/core/legal/entity.ts` `[KITÖLTENDŐ: …]`)
   — impresszum-kötelezettség; a `LEGAL_VERSION` emelése re-consentet vált ki.
5. **`SITE_PUBLIC=true`** a Netlify env-ben (a jelszót NE töröld — az 503-at adna).
6. **Éles teljesítmény-mérés:** `PERF_BASE_URL=https://<éles> npm run e2e:perf`.

## Vizuális regresszió (release előtt)

A token-kritikus komponensekről (vízfelszín-vonal, vízmérce, riasztás,
státusz-jelvény, értékelő-sáv, gombok, betöltés-jelző) referencia-képek
készülnek, és eltérésnél a teszt elbukik.

```bash
npm run dev                    # kell hozzá futó dev-szerver
npm run e2e:visual             # összevetés a referenciákkal
npm run e2e:visual:update      # SZÁNDÉKOS designváltozás után: referenciák frissítése
```

**Miért külön projekt, és miért nem fut a CI-ban:** a Playwright a
referencia-képeket platformonként tárolja (`-darwin` / `-linux`), mert a
betűrenderelés eltér. A jelenlegi referenciák macOS-en készültek. Linuxos
CI-hoz egyszer le kell generálni a cél-platformon
(`npx playwright test --project=visual --update-snapshots` a CI-futón), és
commitolni. A 10. fejezet a vizuális kaput amúgy is „release előtt"-re teszi,
nem minden PR-re.

**A harness** (`/dev/vizualis`) FIX propokkal renderel, és **produkcióban 404**
— élő adatról (óránként változó SUP-index, aszinkron térkép-csempék) készült
kép óránként eltérne, és a teszt hamis riasztásokat adna.

**Küszöb:** `threshold: 0.05`, `maxDiffPixelRatio: 0.002`. A Playwright gyári
`0.2`-es küszöbe MÉRÉSSEL bizonyítottan elnyelte, amikor az „Óvatosan"-jelvény
háttere a `safe` tokenre váltott (két világos pasztell érzékelt különbsége a
küszöb alatt maradt). Ha valaha lazítani kell rajta, előbb ellenőrizd, hogy
egy szándékos token-csere még mindig megbuktatja-e a tesztet.

## Teljesítmény-budget (release előtt)

LCP + kliens-JS mérése a PRODUKCIÓS build ellen, Lighthouse-mobil fojtással
(150 ms RTT / 1,6 Mbps / 4× CPU).

```bash
npm run e2e:perf                 # buildel, elindítja a produkciós szervert, mér
PERF_BASE_URL=https://… npm run e2e:perf   # az ÉLES oldal mérése (nincs helyi build)
```

**Miért nem a dev-szerver ellen:** a dev nem bundle-öl, nem minifikál, és
HMR-kódot is szállít — abból mért LCP semmit nem mondana. A futtatót a
`scripts/serve-build.mjs` adja (statikus fájl + SSR-handler, br/gzip
tömörítéssel, mint a Netlify).

**A tömörítés nem kényelmi kérdés:** fojtott hálózaton ez a legnagyobb egyetlen
tényező. Amíg a szerver nem tömörített, a `/spotok` LCP-je 2764 ms volt (a
2500-as budget fölött); tömörítéssel ugyanaz a build 944 ms. Tömörítetlen
kiszolgálóból tehát hamis riasztás jött volna.

**Mért alapérték (2026-07-27, macOS):** `/` 584 ms · `/deszkak` 528 ms ·
`/deszkavalaszto` 588 ms · `/spotok` 944 ms — mind a 2500 ms-os cél alatt.
JS (brotli): 130 / 132 / 135 / 395 kB.

**Amit a kapu NEM ígér:** ez nem field-LCP (nincs HTTP/2, nincs CDN-távolság,
nincs valós eszköz-szórás). Regressziót fog — például ha a MapLibre kikerülne a
dinamikus importból, és minden oldal megfizetné. **CI-ban nem fut:** az osztott
futók CPU-ja ingadozik, időalapú küszöb ott hamis pirosat adna.

## Web push — kézi verifikáció

A push végponttól végpontig NEM automatizálható (headless Chromiumnak nincs
push-szolgáltatása). A kézi menet a `docs/PROGRESS.md` F1.9-szakaszában van
lépésről lépésre.
