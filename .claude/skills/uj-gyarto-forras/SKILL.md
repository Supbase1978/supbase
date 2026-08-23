---
name: uj-gyarto-forras
description: Új SUP-gyártó vagy bolt bekötése a catalog-watch figyelőbe. Akkor használd, ha egy márkát fel kell mérni ("be tudjuk hozni a X márkát?"), új forrást kell felvenni, vagy egy meglévő forrás kevés/hibás adatot ad. Tartalmazza a sitemap-felderítés helyes menetét és az élesben mért kinyerési csapdákat.
---

# Új gyártói forrás bekötése

## Mikor jó ez

Ha egy márkáról el kell dönteni, behozható-e, vagy egy forrás gyanúsan keveset
ad. **Ne a `probe` nemleges verdiktjével zárd le a kérdést** — ez a skill épp
azért készült, mert kétszer is tévesen mondtam ki, hogy egy márka nem
behozható.

## 1. lépés — a sitemap felderítése RENDESEN

A `probe` a robots.txt `Sitemap:` sorait és a `/sitemap.xml`-t nézi. **Több
gyártónál ez kevés**, és a nemleges válasza félrevezet.

Ha a `probe` nem talál termék-URL-t, próbáld VÉGIG ezeket:

| Út | Kinél volt ez a nyerő |
|---|---|
| `/sitemap_index.xml` | **Jobe** — a `/sitemap.xml` 404, az index viszont 3044 URL |
| `/sitemap_<nyelv>.xml` | Jobe: `sitemap_en.xml` (nyelvenkénti bontás) |
| `/__sitemap__/content-<régió>-<nyelv>.xml` | **Duotone/Fanatic** (Nuxt) |
| `/wp-sitemap-posts-<típus>-1.xml` | **Gladiator** (WordPress: `…-catalog-1.xml`) |
| `/sitemap-index.xml` | Decathlon |

```bash
node tools/catalog-watch/cli.ts probe --url https://gyarto.com \
  --sitemap https://gyarto.com/sitemap_en.xml --pattern "-sup-"
```

**A sitemap-indexet OLVASD VÉGIG, ne csak az elejét.** Élesben ez háromszor
bukott meg: a Fanatic indexében a 14. bejegyzés a
`__sitemap__/products-eu-en-0.xml` (530 termék), az első 13 csak
tartalom-lista nyelvenként. Az első pár sor alapján tévesen mondtam ki, hogy
nincs termék-sitemap.

**A minta-illesztés részstring**, nem regex. Élesben mért hiba: a `sup-board`
minta KIHAGYTA a `…-sup-lite-board-…` URL-eket (a Jobe egész Lite szériáját).
Nézd meg a valós URL-alakokat, mielőtt mintát adsz — a `-sup-` jobb volt.

Ha a lista JS-ből épül (a nyers HTML-ben nincsenek termék-linkek), ott a
böngésző kell (`/chrome`), vagy a kategória-oldalak kézi végigjárása.

**Ha a terméklista JS-ből épül**, a termék-URL mintája kideríthető böngészővel:
nyisd meg a kategória-oldalt Playwrighttal, görgess, és kattints egy
termékkártyára — az URL elárulja a mintát (Fanatic: a kártyák NEM linkek,
kattintásra viszont `/en/products/<slug>-<cikkszám>` jön ki).

## 2. lépés — válaszd ki a MÓDSZERT

Nincs univerzális kinyerő, és nem is érdemes olyat gyártani — a forráshoz
alkalmazkodunk. A sorrend a legolcsóbbtól a legdrágábbig megy, és **az első
működő nyer**:

| # | Ha a forrásnál… | akkor |
|---|---|---|
| 1 | van `/products.json` | **Shopify-mód** (`--shopify`) — 1-2 kérés az EGÉSZ katalógus, a galéria ingyen jár |
| 2 | van Product JSON-LD **mérettel** | JSON-LD-ág (alapértelmezés) |
| 3 | a spec címkézett szövegként ott van | `--html-only` — ez **ÜT** a JSON-LD-n |
| 4 | a spec csak renderelés után létezik | `--render-when-empty` (a fallback görget is) |
| 5 | egy oldal több méretet ad | méretenkénti bontás, `?size=…` egyedi URL-lel |
| 6 | a kategória | KÜLÖN katalógusa van — ld. a következő szakaszt |

A 2. pontnál **nézd meg, hogy a JSON-LD tényleg ad-e méretet.** Élesben
(fanatic.com) kitesz nevet és árat, de egyetlen méretet sem — ott a `--html-only`
kellett, különben a féladat nyert volna.

## 2/b lépés — a KATEGÓRIA módszerei: próbáld végig

**Ne találgass, mérj.** Egyetlen paranccsal végigfut mind a hét módszer, és
mindegyik BIZONYÍTÉKKAL válaszol:

```bash
node tools/catalog-watch/cli.ts probe-methods --source "Márka" --url "<TERMÉK-URL>"
```

```
  pinnedUrl        —
  nameAndUrl       —
  categoryLine     —
  breadcrumb       —
  usageBars        —
  prose            —
  multiUseProse    allround, touring    Ideal for both all-around paddling and touring…
```

Ami talált, azt írd a receptbe (`categoryMethods`), a MEGBÍZHATÓSÁG
sorrendjében. **Lista hiányában mind fut** — a szűkítés mérés után történik,
nem előre.

### A módszer-katalógus

| Módszer | Mit feltételez | Kinél vált be | Tipikus csapdája |
|---|---|---|---|
| `pinnedUrl` | a gyártónak van külön aktivitás-taxonómiája, amit böngészővel ki lehet olvasni | **Gladiator**, **Zray** | az alias-URL-ek (`gladiator-elite-11-6` vs `elite-11-6`) és a csomag-utótagok |
| `nameAndUrl` | a kategória-szó a névben vagy az URL-szegmensben áll | **Aqua Marina** (`/products/all-around/`) | a marketing-slug (`/products/glowing/`) semmit nem mond a használatról |
| `categoryLine` | a termékfejlécben ott a gyártó saját felirata | **Fanatic** (`ALL-AROUND / WINDSURF`) | a felirat SORRENDJE dönt, és MINDEN tagja számít |
| `breadcrumb` | a morzsamenü kimondja a kategóriát | **Zray** | JS-ből épülő morzsamenüt a crawler nem lát (Zray új modelljei) |
| `usageBars` | a gyártó pontozza a használatot | **Aqua Marina** (4 sáv) | ha a SZÖRF vezet, a termék kimarad — az nem a mi taxonómiánk |
| `prose` | a leírás kimondja, FŐNÉVVEL | Gladiator régi modelljei | a teljes oldalszövegen fut, tehát hosszú navigációs blokkon is |
| `multiUseProse` | a gyártó KETTŐT mond egy mondatban | **Jobe**, **Gladiator**, Starboard, Bluefin | a `river` helynév is: „choppy waters or rivers" ≠ vadvízi deszka |

**A mérés eredménye, amit ne feledj:** öt gyártó — öt különböző út. Egyetlen
módszer sem működik mindenhol, ezért nincs univerzális megoldás. Ha egyik sem
visz eredményre, **írj újat**, tedd a `methods/catalog.ts` polcra, és a
következő gyártónál már próbálható lesz.

## A recept a REPÓBAN él

A beállítás nem az adatbázisban születik, hanem
`tools/catalog-watch/sources/<gyarto>.ts`-ben — a MIÉRT-tel együtt (melyik
mért viselkedés indokolja). Onnan megy az adatbázisba:

```bash
node tools/catalog-watch/cli.ts sync-sources            # dry-run: mi változna
node tools/catalog-watch/cli.ts sync-sources --apply
```

A szinkron **soha nem töröl**: a recept nélküli forrást csak jelenti.

## Mentsd el a forrást a REGRESSZIÓ-HÁLÓBA

Amint a kinyerés jó, rögzíts egy valós termékoldalt:

```bash
node tools/catalog-watch/cli.ts capture-fixture --source "Márka" \
  --url "<TERMÉK-URL>" --teaches "mit tanít ez az oldal"
```

Ez menti az oldalt (gzip-elve, teljes egészében) és a VÁRT kinyerést. Innentől
minden `npm test` megmondja, ha egy általános javítás elrontotta ezt a gyártót
— hálózat nélkül, másodpercek alatt. **Ez váltja ki a kézi újraellenőrzést**,
amiből egyetlen napon ~15 kör ment el.

A `--teaches` mondat kötelező: bukáskor EZ mondja meg, mi veszett el.

**A kiírt elvárást olvasd el, mielőtt commitolod** — ha a kinyerés most hibás,
a fixtúra a hibát betonozná be.

## 3. lépés — mérj egy VALÓDI TERMÉKOLDALON

**Ez a másik hely, ahol kétszer is elrontottam.** A kategória-oldal és a
kiegészítő semmit nem árul el a deszkák adatáról:

- a FunWatert azért írtam le, mert egy **bodyboardot** mintáztam — a
  SUP-termékoldalon a teljes spec ott volt;
- a Jobe-nál a probe a **német kezdőlapot** mintázta.

```bash
curl -sL -A "SupTimeBot/1.0 (+https://suptime.hu/robot)" "<TERMÉK-URL>" -o /tmp/p.html
```

Majd futtasd rá a kinyerőt (`extractProductFromPage`), és nézd meg **mind a hat
mezőt**: hossz, szélesség, vastagság, űrtartalom, súly, teherbírás. A
jóváhagyáshoz **űrtartalom ÉS teherbírás** kell — e kettő nélkül a deszka a
moderációs sorban marad, és a Deszkaválasztó sem ajánlja.

## 4. lépés — a csapda-lista

Mind élesben mért eset. Ha valamelyik mező üres vagy gyanús, itt keresd:

**Méret**
- `354 х 86 х 15` — **cirill „х"**, nem latin x (Gladiator). Vizuálisan
  megkülönböztethetetlen.
- `10′6″ * 33″ * 6″` — **tipográfiai prime** (′ U+2032, ″ U+2033) és
  **csillag** szorzójel (FunWater).
- `463 х 91 (36”) х 15 cm` — **zárójel a hármas KÖZEPÉN** (Gladiator).
- `8'6" x 28" x 4,75" | 2,59m x 71,12cm x 12cm` — **kettős írásmód**, kevert
  egységgel (Jobe).
- `10′6″ * 33″ * 6″ for Adults,` + új sorban `8′ * 30″ * 4″ for Youth` —
  **két készlet egymás alatt** (FunWater).

**Címke**
- `Dimensions (length/width/thickness)` — a **zárójelben álló címkeszó
  MAGYARÁZAT**, nem címke. Élesben ez 354 × 86 × 15 helyett 15 × 15 × 15-öt
  adott: HAMIS adatot, nem hiányt.
- `Volume` / `245` — **címke a saját sorában, alatta puszta szám**, egység
  nélkül (Gladiator). Az egységet a mező adja.
- `Capacity / 330LBS / Weight / 12.5KG` — az ablak **átnyúlhat a következő
  mezőbe**. A súly/teherbírás legfeljebb két sort néz.
- `max. 150 kg teherbírással és mindössze 8,8 kg súllyal` — **magyar
  ragozásnál az érték a címke ELŐTT áll**, és a címke UTÁN már a következő
  állítás száma jön. Élesben (sup-deszka.hu) ez a deszka SÚLYÁT írta a
  teherbírásba: 8,8 kg a valós 150 helyett. A sorrend ezért: közvetlenül a
  címke előtti szám+egység → azonos sor a címke után → következő sor.
  **Kettőspontnál (`Capacity:`) az „előtte" ág nem él** — a kettőspont maga
  mondja ki, hogy az érték utána jön.

**TÖBBES használat a prózából — és a menü-csapda**
- A gyártók a PRÓZÁBAN mondják ki, ha egy deszka többféle célra jó („Ideal for
  both **all-around** paddling **and touring**"), a spec-táblában soha. A
  katalógus halmaz-modellje (`board_types`) ezt el is tudja tárolni.
- **A tárolt `raw.description` erre kevés**: rövid SEO-blurb, medián 196
  karakter — mérve 210-ből 195 semmit nem ad. A teljes termékoldalt kell
  olvasni (`suggest-categories --from-pages`).
- **A TELJES OLDALSZÖVEGRE viszont TILOS kulcsszó-olvasót ereszteni.** A
  navigációs menü minden termékoldalon felsorolja a gyártó ÖSSZES
  kategóriáját („Paddleboards All-round / Wave … Touring … Race"), tehát egy
  ilyen menet MINDEN deszkára MINDEN kategóriát ráírna. Ez a katalógus
  leggyorsabb elrontása.
- A `multiUseFromProse` ezért a MONDAT SZERKEZETÉRE szűr: két kategória-szó,
  **közöttük kötőszó**, egy rövid mondaton belül. A menü nem mondat, és nincs
  benne kötőszó — így nem ugrik rá.
- `river`: az EGYETLEN típus, ami helynév is. „choppy waters or **rivers**" =
  víz, nem besorolás (élesben ebből lett volna vadvízi deszka egy
  túradeszkából). Csak a jelzős alak számít: `river board`, `whitewater`,
  `folyami`.

**Kategória PRÓZÁBÓL**
- `ideális tengerre, tóra vagy folyóra` — a kategória-szó **prózában úti célt
  jelenthet**, nem besorolást. Élesben (sup-deszka.hu) ebből VADVÍZI deszka
  lett egy kezdő allround deszkából — pont a legveszélyesebb irányba. A
  címben/URL-slugban a puszta kulcsszó jó (`guessBoardType`), prózában
  FŐNÉV is kell (`boardTypeFromProse`), és **kötőszó megállítja**: a sorolt
  kategóriák egyike sem A kategória.

**Teherbírás**
- `Recommended rider weight: Up to 160kg` — sok gyártó CSAK ezt közli
  (Jobe). Felhasználói döntés (2026-08-20): ezt vesszük teherbírásnak, mert
  konzervatív (alacsonyabb a teljes terhelhetőségnél).
- `330LBS` — font-only. Átváltjuk, DE csak ha kilogramm sehol nincs.

**Egy oldal, TÖBB méret**
- Van gyártó (fanatic.com), aki EGY oldalon sorolja fel a modellcsalád minden
  méretét egyetlen spec-táblában. A SUP-nál a méret maga a termék, ezért
  méretenként külön jelölt kell (`extractProductsFromPage`) — és a jelölt
  URL-jének is méretenként EGYEDINEK kell lennie (`?size=…`), különben a
  méretek felülírják egymást a jelölt-sorban.

**Csak görgetés után megjelenő spec**
- A Fanatic termékoldalán a `SIZES AND SPECS` tábla LUSTA betöltésű: sem a nyers
  HTML-ben, sem az azonnali render-szövegben nincs ott, csak görgetés után.
  A `render.ts` fallback ezért görget.
- **Ha a nyers HTML SEMMIT nem ad**, a fallback külön kapcsolóra fut:
  `--render-when-empty`. Enélkül a crawl kilép, mielőtt renderelne. Csak szűk
  URL-minta mellé kapcsold be: minden illeszkedő, de terméket nem adó oldal egy
  böngésző-renderelésbe kerül.
- **A `--html-only` ÜT a JSON-LD-n.** A Fanatic kitesz Product JSON-LD-t (név,
  ár), de egyetlen méretet sem — a kapcsoló jelentése épp az, hogy ennél a
  forrásnál a spec a SZÖVEGBEN van.
- A fallback akkor is elindul, ha a kijött méretek ELLENTMONDÁSOSAK
  (`hossz = vastagság`) — a hamis adat rosszabb, mint a hiányzó.

**Kategória (board_type)** — a jóváhagyás EZEN bukik el a leggyakrabban
- A gyártók ritkán írják le, hogy „all-around board". A SAJÁT szavaik:
  **versatile**, **universal**, **entry-level**, és a főnév sem mindig „board",
  hanem „**model**" („a versatile model from the entry-level Origin series").
- **A morzsamenü a legjobb forrás, ha az URL nem árulkodik.** A Zray
  termék-URL-je puszta sorszám (`/productinfo/854740.html`), a morzsamenü
  viszont kimondja: `HOME › EVO COLLECTION › ALL AROUND EVO › Max Azure`.
  Ez azért szabad, amiért a teljes oldalszöveg NEM: a navigációs menü minden
  kategóriát felsorol MINDEN oldalon, a morzsamenü pontosan egyet — azt, ahová
  EZ a termék tartozik.
- **A gyártó KATEGÓRIA-FELIRATA a termékfejlécben** (`--category-class`,
  fanatic.com: `product-overview__line`). A felirat SORRENDJE dönt:
  „TOURING / FREERACING" → túra, nem race — a gyártó az első helyre a fő
  felhasználást írja.
- **VIGYÁZZ a családi örökléssel.** A szabály („ha a család egyik tagjának van
  kategóriája, a többi is azt kapja") az Aqua Marinára készült, ahol a családnév
  használatot jelent (All Star = race). A Gladiatornál viszont az
  `Elite`/`Pro`/`Origin` KIVITELI vonal: egy családon belül van túra- és
  allround-deszka is. Élesben ez az EGYETLEN „touring" tagtól ~35 deszkát
  jelölt volna túrásnak. Ha a leírás-alapú besorolás működik, a család
  ellentmondásossá válik, és a szabály — helyesen — elhallgat.
- **A tartozék neve NEM kategória.** Minden Gladiator-oldal oldalsávjában ott
  áll a „ELITE **Touring** Fin 9″" — a szigorú minta (kategória-szó + főnév)
  védi ki.

**Kép**
- Ha a `<title>` oldal-szintű utótagot visel (`- Jobesports.com`), add meg a
  `--title-suffix`-szel, különben a modellnév része lesz. **Egy oldalon több
  cím-sablon is lehet** — a Jobe-nál kettő volt.
- Ha a képfájl neve a **cikkszámot** viseli, és a cikkszám ott van a termék
  URL-jében is (Jobe), az a legerősebb horgony — és ilyenkor a GALÉRIA is
  gyűjthető HTML-forrásból. Enélkül a pozíció-fallback a fejléc kosár-ikonját
  adhatja termékképnek.
- Shopify-forrásnál a `/products.json` `images[]` tömbje ingyen adja a
  galériát (7–22 kép/termék).

## 5. lépés — felvétel és ellenőrzés

```bash
node tools/catalog-watch/cli.ts add-source --name "Márka" --url https://gyarto.com \
  --kind brand_site --country EU --html-only \
  --sitemap <SITEMAP> --pattern "<MINTA>" \
  --default-brand "Márka" --title-suffix " - Gyarto.com" \
  --notes "mit tud és mit nem a forrás"

node tools/catalog-watch/cli.ts crawl --dry-run --source "Márka" --max 10
```

A dry-run kimenetében **nézd meg a modellneveket és a hat mezőt**. Csak akkor
futtasd élesben, ha a minta tiszta.

Ha a forrás korlátoz (`429 Too Many Requests` — Zray), állíts nagyobb szünetet:
`--delay 3000`.

Crawl után:

```bash
node tools/catalog-watch/cli.ts approve-candidates      # dry-run: mi lenne
node tools/catalog-watch/cli.ts backfill-gallery        # Shopify-forrásnál
node tools/catalog-watch/cli.ts sync-unpublished        # ha van nem közölt mező
```

## Olvasd el a crawl MEZŐSORÁT

Minden forrás összefoglalója kiír egy lefedettségi sort. **Ez mondja meg, hogy
egyedi hibával vagy a kinyerés hibájával állsz-e szemben:**

```
    mezők: hossz ✓ · szél ✓ · vast ✓ · térf n.a. · súly ✓ · teher 5/6
```

| alak | jelentése |
|---|---|
| `✓` | minden terméknél megvan |
| `5/6` | EGY termék ügye — nézd meg azt az oldalt |
| `0/15` | a KINYERÉS hibája ennél a forrásnál — ne termékenként javítsd |
| `n.a.` | a recept szerint a gyártó nem közli — várt hiány |

A `GYANÚS —` sorok ugyanitt jelennek meg, indoklással. Nem hibák: olyan
értékek, amik nem férnek össze a katalógus valóságával (lehetetlen űrtartalom,
a kategóriájához képest túl rövid deszka, a deszka súlya a teherbírásban,
ellentmondás a már ismert deszkával). A megjelölt jelölt **kimarad a tömeges
jóváhagyásból** — moderátori döntés kell hozzá.

Ha gyanú-jelet látsz, **először a termékoldalt nézd meg**: gyakran egyetlen
modell HTML-je tér el a többitől. Ha viszont sok terméknél jön, akkor a recept
vagy a kinyerés a hibás.

## NYISS BÖNGÉSZŐT, mielőtt tovább próbálkozol a crawlerrel

**Ha a forrás kizár (`429`), vagy a keresett adat JS-ből épül, a következő
lépés a böngésző — nem a crawler újrafuttatása.** Élesben (zraysports.com,
2026-08-22) ezt elmulasztottam: a felhasználó kétszer is jelezte, hogy van
böngésző, én mégis a crawlerrel próbálkoztam tovább, amíg a forrás
`429 Too Many Requests`-tel ki nem zárt minket. A böngésző UGYANAKKOR
gond nélkül betöltötte ugyanazt az oldalt.

```
mcp__playwright__browser_navigate  → betölti az oldalt JS-sel együtt
mcp__playwright__browser_evaluate  → kiolvassa, amit a crawler nem lát
```

Az `evaluate`-en belül **`fetch` is használható**: az oldal saját eredetéből
kérve egyetlen hívással végigjárható az összes kategória-oldal, DOM-mal
együtt (`new DOMParser().parseFromString(html, "text/html")`).

### A taxonómia kiolvasása többet ér, mint egy rendereléses menet

Ha a kategória JS-ből jön, két út van:

| | költség | tartósság |
|---|---|---|
| rendereléses crawl-menet (`renderWhenEmpty`) | MINDEN futásnál böngésző | a forrás bármikor kizárhat |
| a **taxonómia** egyszeri kiolvasása → `boardTypeByUrl` | egyszeri | a receptben marad, verziózva |

A második a jobb, és háromszor bizonyított: **Gladiator**
(`/catalog_activity/…`), **Zray** (`/ProductInfoCategory?categoryId=…`),
**Starboard** (a fejléc-menü modellcsalád→kategória bontása).

A menetrend: nyisd meg a kategória-oldalt böngészővel → gyűjtsd ki a
`termék-URL → kategória` párokat → írd be a recept `boardTypeByUrl`
mezőjébe, a leképezés INDOKLÁSÁVAL (mit jelent a gyártó saját kategóriája a
mi taxonómiánkban).

**A gyártó kategórianeve nem mindig a használat.** A Zray „Vigour"
kollekciója a saját leírása szerint „balance training… for fitness and yoga
enthusiasts" — az `yoga`, nem egy „vigour" nevű új típus. Olvasd el a
kollekció leírását, mielőtt leképezed.

## „Nem találom" kontra „a gyártó nem közli"

**Mielőtt egy hiányzó mezőt hibaként kezdesz javítani, nézd meg a gyártó
oldalán, hogy egyáltalán közli-e.** A kettő gyökeresen más:

- ha a kinyerés nem találja → javítandó, és a fixtúra rögzíti a javítást;
- ha a gyártó nem teszi közzé → nincs mit javítani, ez maga a tény.

Élesben mért eset: a **Bluefin egyetlen modelljénél sem ad űrtartalmat**
(méretet és teherbírást igen). A 15 deszkája enélkül örökre „hiányos" maradt
volna, és a mezőlefedettségi jelentés minden futásnál anomáliát jelzett volna
ott, ahol nincs.

A tény a receptbe kerül, indoklással és dátummal:

```ts
crawlConfig: {
  unpublishedFields: ["volumeL"],
  notes: "…ŰRTARTALMAT NEM KÖZÖL (2026-08-21, gyártói oldalon ellenőrizve)…",
}
```

Innen `sync-unpublished --apply` viszi a katalógus-sorokra, és az adatlap
„a gyártó nem közli" felirattal mutatja — nem üres helyként, hogy az olvasó
tudja: nem a mi adatunk hiányzik.

**Ez NEM feljogosítás becslésre.** A hiányzó érték hiányzó marad; a
geometriából számolt űrtartalom kitalált biztonsági adat lenne.

A deklaráció ELLENŐRIZHETŐ állítás: a fixtúra-teszt megköveteli, hogy a
deklarált mező tényleg üres legyen. Ha a gyártó egyszer közölni kezdi, a teszt
bukik, és szól, hogy vedd le a deklarációt.

## Amit SOSE tegyél

- **Ne találgass mértékegység nélküli HOSSZBÓL** — 32 hüvelyk kontra 32 cm.
  (Térfogatnál és teherbírásnál a mező adja az egységet, ott szabad — de csak a
  szigorú kétoszlopos alakzatban.)
- **Ne gyűjts galériát pozíció vagy modellnév alapján HTML-forrásból** — a
  „Related Products" blokk MÁS termékek fotóit is felkínálja. Csak
  cikkszám-horgonnyal.
- **Ne kerüld meg a robots.txt-t.** Ha nem elérhető, a forrás kimarad
  (Aquatone: a domain DNS-ből sem oldódik fel).
- **Ne írj bolti árat gyártói forrásból** — az ár-megjelenítési politika és a
  pénznem miatt is.
