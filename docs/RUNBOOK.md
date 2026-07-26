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

## Web push — kézi verifikáció

A push végponttól végpontig NEM automatizálható (headless Chromiumnak nincs
push-szolgáltatása). A kézi menet a `docs/PROGRESS.md` F1.9-szakaszában van
lépésről lépésre.
