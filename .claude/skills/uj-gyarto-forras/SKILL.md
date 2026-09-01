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
| `/sitemap_<nyelv>.xml` vagy `/<nyelv>/sitemap.xml` | Jobe: `sitemap_en.xml`; **Bestway**: a `/sitemap.xml` a NÉMET URL-eket sorolja (2999 db, egyetlen `/en/` sincs benne), az angol ág saját indexe a `/en/sitemap.xml` — és a két nyelv slugja NEM egymásból származik (`…-mit-sitz-335-x-91-5-x-15-cm` kontra `…-with-seat-335-x-91.5-x-15-cm`), tehát átírni sem lehetne |
| `/__sitemap__/content-<régió>-<nyelv>.xml` | **Duotone/Fanatic** (Nuxt) |
| `/wp-sitemap-posts-<típus>-1.xml` | **Gladiator** (WordPress: `…-catalog-1.xml`) |
| `/sitemap-index.xml` | Decathlon — **de a benne hirdetett 8665 URL között EGYETLEN termékoldal sincs** |
| `/sitemap.xml` (az INDEX, nem a gyerek) | **FunWater** (Shopify): a `sitemap_products_1.xml` közvetlenül **400**-at ad, mert aláírás-paramétert vár (`?from=…&to=…`) — az indexből viszont mindig a friss alak jön |

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

## Ha a GYÁRTÓNAK nincs bejárható oldala

Nem minden márkának van termékoldala spec-táblával. Élesben (**Bestway**,
2026-08-29) a `bestway.com` katalógusa nem ad SUP-termékoldalakat — a
**hivatalos regionális bolt** viszont igen (`bestwaystore.de`, „Official
Bestway® Store"). Ez legitim forrás: a gyártó saját adatát közli, csak nem a
gyártó domainjén. A recept `kind`-ja ilyenkor `shop`, a `notes`-ban pedig ki
kell mondani, MIÉRT nem a gyártói oldal a forrás.

**Ugyanannak a márkának több boltja is lehet — mérd meg, melyik ad többet.**
A Bestway UK-boltja (`bestwaystore.co.uk`) Shopify, a `/products.json` szolgál
is — de a specifikáció ott csak a marketing-prózában áll (`body_html`:
„12cm thick… up to 120kg"), táblázatban nem. A német bolt ANGOL ága viszont
címkézett spec-blokkot ad (`Inflated size … cm`, `Weight capacity … kg`).
Ez a `/products.json`-csapda újabb megerősítése: a Shopify önmagában nem ok
a Shopify-módra.

**AZ URL-MINTA LEGYEN STRUKTURÁLIS SZŰRŐ, ha megteheted.** A Bestway-boltban
~55 Hydro-Force PÓTALKATRÉSZ van, köztük „replacement board" tételek, amik a
NEVÜKBEN deszka-méretet viselnek (`…-replacement-board-for-hydro-force-sup-
oceana-305-x-84-x-12-cm`) — pont az a fajta, amit a `classifyProduct` nehezen
szűr. A deszkák viszont kivétel nélkül egy közös előtag alatt élnek
(`/en/hydro-force-sup-…`), a pótalkatrészek pedig másik alatt
(`/en/bestway-spare-part-…`). A szűk minta így strukturálisan zár ki, nem
heurisztikával.

## 2. lépés — válaszd ki a MÓDSZERT

Nincs univerzális kinyerő, és nem is érdemes olyat gyártani — a forráshoz
alkalmazkodunk. A sorrend a legolcsóbbtól a legdrágábbig megy, és **az első
működő nyer**:

| # | Ha a forrásnál… | akkor |
|---|---|---|
| 1 | van `/products.json` **specifikációval** | **Shopify-mód** (`--shopify`) — 1-2 kérés az EGÉSZ katalógus, a galéria ingyen jár |
| 2 | van Product JSON-LD **mérettel** | JSON-LD-ág (alapértelmezés) |
| 3 | a spec címkézett szövegként ott van | `--html-only` — ez **ÜT** a JSON-LD-n |
| 4 | a spec csak renderelés után létezik | `--render-when-empty` (a fallback görget is) |
| 5 | egy oldal több méretet ad | méretenkénti bontás, `?size=…` egyedi URL-lel |
| 6 | a spec a SOROZAT leírásában van, nem a terméken | `seriesTextByUrl` — ld. lent |
| 7 | a kategória | KÜLÖN katalógusa van — ld. a következő szakaszt |

**A „Shopify" önmagában nem elég ok a Shopify-módra.** Élesben
(funwaterboard.com): a bolt Shopify, a `/products.json` szolgál is — de a
`body_html` CSAK marketingszöveg, a variánsok pedig `Default Title`-ök (nem
méretek). Se méret, se teherbírás, se súly. A teljes spec a TERMÉKOLDAL nyers
HTML-jében volt, tehát a helyes út a `--html-only` maradt. Mielőtt Shopify-módot
választasz, **nyiss meg egy `/products.json`-t és keresd meg benne a méretet** —
ha nincs, a mód féladatot gyártana.

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
  labeledUse       allround, yoga       Versatility: All-around, ideal for…
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
| `labeledUse` | a gyártó CÍMKÉZETT használat-mezőt ad a spec-táblában | **FunWater** (`Versatility: All-around…`), **Red Paddle** (`Rider Style: All Round`) | a címke pontos egyezést kíván; szabad szövegben a „best for" fordulat nem mező |
| `nameAndUrl` | a kategória-szó a névben vagy az URL-szegmensben áll | **Aqua Marina** (`/products/all-around/`) | a marketing-slug (`/products/glowing/`) semmit nem mond a használatról; a SEO-név egyenesen TÉVESZT (FunWater: „Island Explorer" → túra, holott all-round) |
| `categoryLine` | a termékfejlécben ott a gyártó saját felirata | **Fanatic** (`ALL-AROUND / WINDSURF`) | a felirat SORRENDJE dönt, és MINDEN tagja számít |
| `breadcrumb` | a morzsamenü kimondja a kategóriát | **Zray** | JS-ből épülő morzsamenüt a crawler nem lát (Zray új modelljei); **ha MINDEN termék UGYANABBA a levélbe esik, az menü-elhelyezés, nem besorolás** — a Decathlon mind a hat deszkáját „Túra SUP" alá teszi, a 80 kg-ig ajánlott kezdő szettet is |
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

## RECEPT-VÁLTOZÁS UTÁN ÚJRA KELL FUTTATNI A BEJÁRÁST

A recept csak a KÖVETKEZŐ kinyerésre hat. A már meglévő jelölt-sorok
`extracted` mezője a crawl pillanatában FAGYOTT BE — a moderátor tehát
továbbra is a régi (hibás) modellnevet látja, és jóváhagyáskor az kerül a
katalógusba.

Élesben (2026-08-31): a Red névszabályát javítottuk (`titleKeepSize`, a
„paddle co" zajszó, a márkanév „Red"), a moderációs sorban álló 10 Red-jelölt
viszont változatlanul „Red Paddle Co · Ride MSL" maradt — a felhasználó vette
észre: „a jóváhagyandó deszkáknál a Red nevei nem változtak meg".

```bash
node tools/catalog-watch/cli.ts sync-sources --apply      # ELŐSZÖR EZ!
node tools/catalog-watch/cli.ts crawl --source "<Márka>"
```

**A `sync-sources` NEM hagyható ki.** A crawl az ADATBÁZISBAN tárolt receptet
használja, nem a repóbelit — enélkül a bejárás a RÉGI beállítással fut, és a
javítás nyomtalan marad. Élesben (2026-08-31) pont ez történt: a recept a
repóban már jó volt, a crawl mégis a régivel dolgozott.

**A `--max` a sitemap ELEJÉTŐL számol.** A Red 309 termék-URL-jéből csak 18 a
deszka, és a lista elején kulacsok meg köntösök állnak — `--max 40`-nel a
bejárás NULLA deszkát ad, ami regressziónak látszik, pedig csak nem ért el
odáig. Teljes forrásnál ne szűkítsd.

A crawl a FÜGGŐ jelölteket frissíti (a már elbíráltakat szándékosan nem
támasztja fel). A javítás tehát KÉT lépés: recept + újracrawl — és ha a hiba
már a katalógusba is bekerült, egy harmadik: a meglévő sorok átnevezése.

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
  SUP-termékoldalon a teljes spec ott volt (2026-08-28-án be is került: mind a
  hat mező kijön, az űrtartalmat a gyártó tényleg nem közli);
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
- `Hosszúság: 14' (426 cm)` — **a gyártó SAJÁT zárójeles átváltása**
  (Decathlon). Ez ÜT mindenen: a `Vastagság: 4'75" (12 cm)` alakot a
  láb-hüvelyk minta 4 láb + 75 HÜVELYKNEK olvasta (312 cm egy 12 cm vastag
  deszkára), és a `Szélesség` ablaka ÁTNYÚLT a következő sorba, ahonnan a
  KÖVETKEZŐ mező láb-értékét szedte fel. Közvetlenül egy imperiális érték után
  álló `(… cm)` csak annak az átváltása lehet.
- `Felfújt deszka:` … `Táska az összehajtott SUP-pal:` — **a deszka után a
  TÁSKA adatai jönnek, ugyanazokkal a címkékkel** (`Magasság`, `Szélesség`,
  `Vastagság`, `Súly: 500 g`). A deszka blokkja mindig elöl áll, és a
  címke-kereső az ELSŐ találatot veszi — ezen múlik, hogy nem a táska mérete
  kerül be.

**A címke és az érték SORRENDJE — a legdrágább csapda-család**
Élesben (funwaterboard.com) EGY oldalon ÖT változatban fordult elő ugyanaz: a
spec-tábla UTÁN álló reklámmondat, ahol MINDHÁROM érték a címkéje ELŐTT áll.
Ez EGGYEL ELCSÚSZTATJA a méret-hármast (a hosszba a szélesség kerül), és
FELÜLÍRJA a spec-táblából már helyesen kiolvasott értéket, mert a címke-alapú
olvasás előbb fut. Csendes, hihetőnek látszó adathiba, pont a Deszkaválasztó
bemenetén. A változatok:

| alak | mi kellett hozzá |
|---|---|
| `The 10'6" length, 33" width, and 6" thickness` | imperiális jelek az „érték a címke előtt" mintában |
| `Its 11’6” length and 33” width` | a **görbe idézőjel** (`’` U+2019) is láb-jel |
| `Its 11 feet length, 32 inches width` | a **kiírt** `feet`/`foot`/`ft` is mértékegység |
| `11'6"(335cm) length 33"(83cm) width` | **zárójeles átváltás** ékelődik közéjük |
| `11 feet (335 cm) in length, 33 inches (84 cm) in width` | **elöljáró** (`in`/`of`) is közéjük ékelődik |

- **A `’` bevezetése egy MÁSIK gyártót rontott el.** Az Indiana MINDKÉT
  írásmódot kiteszi egymás mellett (`Length CM: 347,5 cm Length Foot/Inch::
  11’5''`), és a szűk ablakba mindkettő belefér — a származtatott láb-hüvelyk
  (348) ütötte a gyártó saját metrikus számát. A `’` ezért CSAK akkor láb-jel,
  ha a szövegben nincs centiméter. Két tágabb megoldás (cm-előresorolás; „a
  címkéhez legközelebbi érték nyer") TÖBB gyártót tört el — a fixtúra-háló
  mindet azonnal megfogta. **Itt tessék mérni, nem elvet választani.**
- **A melléknévi alak (`33" wide`) is címke** — de a `thick` NEM: kipróbálva
  elrontotta a Jobe-t (ott a próza az anyagvastagságról ír). A szimmetria
  csábító, a mérés viszont dönt.

**Ha a próza és a spec-tábla ELLENTMOND, a táblázat nyer**
- Élesben (funwaterboard.com, Fishing Cetus): a leírás `Its 12" length` —
  a gyártó HÜVELYK-jelet írt LÁB helyett, a saját táblája ugyanott helyesen
  `12' × 34″ × 6″`. A prózából 30,5 cm „hossz" lett.
- A védelem GEOMETRIAI, nem ízlés kérdése: **a hossz nem lehet kisebb a
  szélességnél.** Ha mégis, az összevont spec-tábla hármasa írja felül.

**Láthatatlan és nem-ASCII írásjelek**
- `Capacity： 300 Pounds` — **TELJES SZÉLESSÉGŰ kettőspont** (U+FF1A). Kínai
  eredetű sablonoknál ez az alapértelmezés. Nem csak a spec-tábla felismerését
  rontja: a kettőspont hiányában a parser azt hiszi, hogy az érték a címke
  ELŐTT áll, és a szomszéd mező adatát veszi.
- `Item Weight: ‎28 Pounds` — **LTR-jel** (U+200E) az érték előtt. A szemnek
  nincs ott. Az `htmlToText` mostantól törli (a lágy elválasztójellel és a
  BOM-mal együtt).
- `Kilograms` / `Pounds` KIÍRVA — a rövidítés-only minta ezeket nem látta.

**A TARTOZÉK tömege sem a deszkáé**
- `Súly (csak a deszka): 8,4 kg` / `Deszka + szkeg + leash + hátizsák együtt:
  9,6 kg` / `Az evező súlya: 1,2 kg` / `A pumpa súlya: 1200 g` — NÉGY tömeg
  egymás alatt (Decathlon), plusz a lap alján a technikai mező a TELJES SZETT
  tömegét ismétli. A puszta „súly" needle az EVEZŐÉT adta. A gyártó zárójeles
  elhatárolása (`súly (csak a deszka)`) a legspecifikusabb címke, ezért áll
  elöl; az `evező`/`pumpa` kizáró előtag.
- **Az angol `paddle` NEM lehet kizáró előtag**: kipróbálva elrontotta az Aqua
  Marina Hungaryt, ahol a címke `paddleboard súlya: 11 kg` — ott a „paddle"
  nem tartozék, hanem a DESZKA neve.

**A CSOMAG adatai nem a deszkáéi**
- `Item Weight: 28 Pounds` és alatta `Package Weight: 18.87 Kilograms` — a
  második a szállítási doboz, tartozékokkal. Ugyanígy a `Package Dimensions`.
  Kizárva (`PACKAGE_QUALIFIERS`); ahol a gyártó CSAK a csomag tömegét közli, ott
  a deszka súlya helyesen HIÁNYZIK.

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
- **A „maximális terhelhetőség" NEM mindig teherbírás.** Élesben
  (decathlon.hu) a gyártó két számot ad: `Max. 140 kg-ig ideális` és
  `Max. terhelhetőség, AMÍG A VÍZFELSZÍNEN MARAD: 335 kg`. A második
  ARKHIMÉDÉSZ: pontosan annyi kg, ahány LITER a deszka térfogata (350 l →
  350 kg, 335 l → 335 kg, 245 l → 245 kg), vagyis a teljes elmerülés pontja.
  A Deszkaválasztó 0,66-os szorzóval veti össze az evezős súlyával — a 350-es
  szám egy 231 kg-os evezősnek is zöld utat adna egy 140 kg-ra tervezett
  deszkán. **Ha a terhelési szám megegyezik a literben mért térfogattal,
  gyanakodj: az felhajtóerő, nem terhelhetőség.**
- `Max. 140 kg-ig ideális` — a magyar `-ig` rag MAGA a felső korlát,
  címkeszó nélkül. **Megerősítő szó kell hozzá** (`max.` elöl, vagy
  `ideális`/`tervez` utána): a puszta „130 kg-ig" a KAPCSOLÓDÓ TERMÉKEK
  címeiben is ott áll ugyanazon az oldalon, és a szövegben ELŐBB, mint a
  termék saját adata.
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

**A SPEC A SOROZAT LEÍRÁSÁBAN VAN, nem a termékoldalon** (`seriesTextByUrl`)
- Élesben (rocoutdoors.com, 2026-09-01): a gyártó a sorozat minden tagját
  ugyanabban a méretben árulja, csak a színük más, ezért az adatot EGYSZER
  írja le — a kollekció leírásában. A `10' Explorer` termékoldalán a
  `capacity` szó ELŐ SEM FORDUL; a `/collections/explorer-series` leírása
  viszont kimondja: „…are 10' tall, 32 inches wide with a **weight capacity of
  350 pounds**". A Scout lapjáról még a VASTAGSÁG is hiányzik.
- A recept `seriesTextByUrl`-je termék-URL-részletet képez le a sorozat
  leírását adó címre; a szöveg a termékoldalé UTÁN kerül, tehát csak a MÉG
  ÜRES mezőket tölti. Egy sorozat leírását a bejárás EGYSZER kéri le.
- **A kollekció HTML-LAPJA erre alkalmatlan.** Ugyanazon a lapon ott áll a
  TÖBBI sorozat leírása is (az Explorer lapján a Scout „10' tall, 33 inches
  wide" mondata) — a hozzáfűzés a SZOMSZÉD sorozat méretét szórná be. A cím
  ezért Shopify-nál a `/collections/<slug>.json`: egyetlen `description` mező.
- **Mérd meg, hogy tényleg ad-e valamit.** A ROC hat sorozatából csak három
  leírása mond többet a termékoldalnál; a `cruiser-series`-nek NINCS is
  leírása. Kérést indítani a többire ingyen sem érne semmit.

**MÉRET MELLÉKNÉVI LÁNCBÓL, spec-tábla NÉLKÜL**
- Van gyártó, aki spec-táblát EGYÁLTALÁN nem ad: a méret a leírás egyetlen
  mondatában áll, az érték a címkéje ELŐTT, melléknévi alakban —
  `At 10' tall, 32" wide, and 6" thick` /
  `Measuring 10'6" long by 33" wide and with a thickness of 6"`.
- A `wide` régóta címke volt, a `tall`/`long`/`thick` nem: a ROC hat
  modelljéből EGYNÉL SEM jött ki a HOSSZ, ami kizáró mező — a forrás nulla
  terméket adott volna.
- **A `thick` puszta címkeként továbbra is TILOS** (elrontja a Jobe-t: ott a
  próza a deckpad ANYAGÁRÓL ír, `5mm thick`). A védelem ezért nem szóválasztás,
  hanem ALAKZAT: a hossz és a szélesség tagjának EGYMÁS UTÁN, ebben a
  sorrendben, egy mondatnyi távolságon belül kell állnia, és a hossz nem lehet
  kisebb a szélességnél. Árva `5mm thick` sosem indítja el a láncot.
- A vastagság tagja opcionális: a pár (`10'6" long and 33" wide`) is elég.

**A KÖTŐJEL IS ELVÁLASZTÓ a szám és az egysége között**
- `with a 350-pound weight capacity` — a jelzői alakot az angol így írja, és a
  `\s*` ezt nem fogja meg. A mező NÉMÁN üresen maradt.

**A GYIK ÉS A MARKETINGSZÖVEG ELLENTMONDHAT A SPEC-RÁCSNAK**
- Élesben (funwaterboard.com, Island Explorer): a gyártó rácsa `Capacity
  350LBS`, a lap alján a GYIK viszont „a weight capacity of up to **420 lbs**".
  Amikor a specifikusabb `weight capacity` címke ELŐRE került a needle-listán,
  a GYIK száma nyert — a fixtúra-háló azonnal megfogta.
- A szabály ugyanaz, mint mindenütt: **a szerkesztett rács ÜT a prózán**, tehát
  a rács címkéje megy elöl a listán, akkor is, ha rövidebb.

**A LAP ELSŐ `<title>`-je NEM feltétlen az, amit a grep talál**
- A Shopify-sablonok SVG-ikonjai saját `<title>` elemet viselnek (`Facebook`,
  `Toggle menu`, `Visa`) — tucatnyit. A valódi cím a `<head>`-ben van, tehát
  elöl, de TÖBB SORBA tördelve: a soron belüli `grep '<title>[^<]*</title>'`
  emiatt az első IKON címét mutatja. A kinyerő `[\s\S]*?` mintája jól veszi;
  ez a jegyzet a KÉZI ellenőrzésnek szól, ahol kétszer is félrevitt.

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

**A SZŰRŐ-OLDALSÁV UGYANAZOKAT A CÍMKÉKET VISELI, mint a spec**
- Élesben (u1.net.pl) a termékoldalon ott a kategória szűrő-panelje, és
  felsorolja az ÖSSZES lehetséges értéket: `Typ deski` ⏎ `Deski SUP – Allround`
  ⏎ `… – Gigant` ⏎ `… – Race`, valamint `Waga użytkownika` ⏎ `… – 100kg` ⏎
  `… – 120kg`. Ráadásul ELŐBB, mint a termék saját adata.
- Az eredmény: MINDEN deszka „allround" lett a valódi `Typ deski: Touring`
  helyett, és a szűrőből 100 kg került a deszka TÖMEGÉBE.
- Ez a navigációs-menü csapda testvére, csak a CÍMKÉZETT mezőket találja el.
  A védelem ugyanaz az elv, ami a `valueAfterLabel`-nél már megvolt: a
  KETTŐSPONTOS alak (`Typ deski: Touring`) megy előbb, azt csak a spec írja.

**UGYANAZ A CÍMKE KÉTSZER, KÉT JELENTÉSSEL — inkább maradjon üres**
- A u1.net.pl lapján KÉT `Waga` sor van: az első a kiszállított SZETT tömege
  (15 kg), a második a deszkáé (10,5 kg) — szövegben megkülönböztethetetlenül.
- Ilyenkor NE vedd át a mezőt. A csomag tömege a deszka súlyaként rosszabb,
  mint a hiány. És ez NEM `unpublishedFields`: a gyártó KÖZLI, csak mi nem
  tudjuk biztonságosan kiolvasni — a kettő nem ugyanaz, és a recept
  fejlécében külön kell kimondani.

**A SZÓ SZERINTI FORDÍTÁS FÉLREVEZET**
- Lengyelül a `grubość` = „vastagság", de a u1.net.pl-en az az ANYAG
  vastagsága, milliméterben (`Grubość burty: 0.75mm`) — abból 0,08 cm-es
  deszka lenne. A deszka vastagsága ott `Wysokość` („magasság").
- Idegen nyelvű címkénél mindig nézd meg az ÉRTÉKET is, ne csak a szót.

**A HIÁNYZÓ MEZŐT MÁSIK FORRÁS PÓTOLHATJA — de csak ha EGYEZIK a többiben**
- Élesben: a Bestway hivatalos boltja űrtartalmat és deszka-súlyt nem közöl, a
  magyar **aqualing.hu** viszont igen — és a MÉRET meg a TEHERBÍRÁS pontosan
  egyezik a gyártóival. Ez a döntő: nem másik igazságot ad, hanem kiegészíti.
- Ahol ELTÉR, ott ne fésülj: ugyanannak a méretnek (381×79×15) az egyik
  boltban „Glider Elite / 150 kg", a másikban „Aqua Excursion / 120 kg" a
  neve és az adata — az két külön modell, nem elírás.
- **A bolti „Súlya: 11,6 kg" gyakran a SZETT tömege** (a lap alatta sorolja a
  tartalmat: deszka, evező, pumpa, hátizsák). Csak a kimondott alak fogadható
  el: „Deszka nettó tömege", „Tábla súlya".

**A SZERKESZTETT TÁBLÁZAT ÜT A PRÓZÁN — és ezt sorrendben kell kikényszeríteni**
- Élesben (aqualing.hu) a `Vastagság (cm) / 12` cellából **12000** lett: a
  szabad szövegben kereső, lazább minta FELÜLÍRTA a táblázatból már helyesen
  kiolvasott értéket, mert az értékadás akkor is lecsapott, ha a laza minta
  szemetet adott.
- A javítás kétrészes: a táblázat-olvasó fut ELŐBB, és a lazább menetek csak a
  MÉG ÜRES mezőket töltik. Ez az elv a fájlban máshol már ki volt mondva — itt
  a méreteknél hiányzott.

**AZ EGYSÉG A CÍMKÉBEN IS ÁLLHAT**
- `Hosszúság (cm)` ⏎ `:` ⏎ `305`. A méretet egyébként sosem olvassuk puszta
  számból (32 hüvelyk kontra 32 cm) — de ez NEM találgatás: a bolt kiírta az
  egységet, csak a címkébe. Enélkül az egész attribútum-tábla használhatatlan
  volt, és mivel a méret hiánya kizár, a lapok fele NULLA terméket adott.
- **A címke, a kettőspont és az érték KÜLÖN SORBAN is állhat** (külön
  táblacellák). A „következő sor az érték" olvasó enélkül a kettőspontot veszi
  értéknek. Egy magában álló kettőspont sosem érték.

**A `<title>` NEM MINDIG A MODELLNÉV — a JSON-LD gyakran igen**
- Élesben (boteboard.com, 2026-08-29) a címek termékenként MÁS SEO-sablont
  követnek, és kettő egyenesen kárt okozott: az EasyRider Aero címe a
  modellnevet KI SEM MONDJA („Beginner Inflatable Paddle Board — SUP & Kayak |
  BOTE"), a LowRider Aero Tandemé pedig a „Kayak" szót viseli — attól a
  `classifyProduct` KAJAKNAK nézte és eldobta a deszkát. Mindkettő NULLA
  jelöltet adott, pedig a spec-blokkjuk hibátlan volt.
- Ugyanezeken az oldalakon a `Product` JSON-LD `name`-je pontosan a
  katalógusnév. Erre való a `modelNameFromJsonLd`: a spec marad a SZÖVEGBŐL
  (`htmlOnly`), CSAK a nevet vesszük át a JSON-LD-ből. **Ha a címek zajosak,
  nézd meg a JSON-LD-t, mielőtt `titleCutAfter`/`titleNoiseWords` sorozatot
  írsz** — ott sokszor készen áll a tiszta név.

**EGY OLDAL, TÖBB MÉRET — MÁSODIK ELRENDEZÉS: MEGISMÉTELT CÍMKÉZETT BLOKK**
- A Fanatic-féle transzponált tábla (fej + méretsorok) mellett van egy másik
  alak: a gyártó a TELJES címkézett blokkot megismétli méretenként, egy
  méret-fejléc alatt (`10′4″ Specs` … `11′4″ Specs`). A szokásos,
  első-találat-nyer olvasás ilyenkor a MÁSODIK méretet NÉMÁN elveszti — a WULF
  Aero 11'4"-e külön deszka, 315 LBS teherbírással a 10'4" 250-je helyett.
  Ezt a `parseLabeledSpecsBySize` bontja.
- **A fejléc alakja UGYANAZON A BOLTON belül változhat**: a WULF-nál
  `10′4″ Specs` (tipográfiai jel), a Breeze-nél `10'6" BREEZE AERO` (egyenes
  jel + modellnév).
- **A VARIÁNS-VÁLASZTÓ gombjai alakra ugyanolyan fejlécek** (`10'4"`, `11'4"`),
  csak nincs mögöttük spec-blokk. A védelem nem a fejléc alakja, hanem az
  EGYEZÉS: a fejléc kimondja a hosszt, és a blokkból kiolvasott hossznak ezzel
  egyeznie kell.

**A `boardTypeByUrl` KULCSA RÉSZSTRING — a slug kevés lehet**
- Élesben (boteboard.com) a `kids-fLOWRIDER-AERO-HYBRID-PADDLE-BOARD` URL
  TARTALMAZZA a `lowrider-aero-hybrid-paddle-board` kulcsot, ezért a
  gyerekdeszka `allround` lett `kids` helyett. A `/products/` előtaggal
  megadott TELJES útvonal zárja ki. Ugyanez az URL-mintáknál: az
  `-aero-hybrid-paddle-board` minta épp a `lowrider-aero-TANDEM-hybrid-…`
  deszkát hagyta ki, mert a változat neve beékelődik.

**FEJETLEN (headless) BOLT: a spec a `<script>`-ben van, nem a szövegben**
- Élesben (islesurfandsup.com) a HTML egy React-váz: a `/products.json` 404,
  a `htmlToText` a spec-ből SEMMIT nem lát, a JSON-LD csak nevet és árat ad.
  A teljes tábla — mind a hat mező, űrtartalommal — egy beágyazott
  API-válaszban áll, CSV-alakban:
  `"sizes":{"value":"Length,Width,Thick,…\n10'6\",34\",6\",…"}`.
- **Ne írj rá külön kinyerőt.** Az `embedded.ts` `címke: érték` SOROKKÁ
  alakítja, és a MEGLÉVŐ `parseSpecsFromText` elé fűzi — így a font-átváltás,
  a csomag-kizárás és a láb-hüvelyk olvasás mind érvényben marad.
- **HORGONY NÉLKÜL ROSSZ DESZKÁT AD.** Ugyanazon a lapon több ilyen blokk áll,
  a termékajánlóké is: az `explorer-pro-2` lapján HÁROM, és az ELSŐ a szomszéd
  modellé. Keress olyan JSON-kulcsot, ami oldalanként PONTOSAN EGYSZER fordul
  elő és a termék sajátját vezeti be (`embeddedSpecAnchor`).
- Ha egy fejetlen boltnál üres a kinyerés, **grepelj a nyers HTML-ben egy
  ismert értékre** (`"285 LBS"`, `"326"`) — a JSON-ban ott lesz.

**GALÉRIA: A GYÁRTÓ SAJÁT KÉP-KONTÉNERE (`galleryClass`)**
- A galéria sokáig KÉT úton jöhetett — Shopify `/products.json` és
  cikkszám-horgony —, és a forrásaink FELE egyiket sem adja: a katalógus 273
  deszkájából 160 egyetlen képpel állt.
- A tiltás továbbra is él: a lap ÖSSZES képét begyűjteni tilos (a „Related
  Products" MÁS termékek fotóit is hozza). A megoldás ugyanaz, mint a
  kategóriánál: nevezd meg a gyártó SAJÁT elemét a receptben. A konténeren
  BELÜL minden kép ezé a termékéé — ezt a gyártó DOM-ja garantálja.
- MÉRVE (2026-08-30): `product__main-gallery` (Gladiator) 6 kép ·
  `w-bigimglist` (Zray) 5 · `thumbnails-carousel` (Fanatic) 5 ·
  `hdt-slider__container` (Starboard) 3–4 · `page_artdet_altpic`
  (aquamarinahungary) 5.
- **EGY OSZTÁLYT TÖBB ELEM IS VISELHET.** A Starboardnál a
  `hdt-slider__container` HÁROMSZOR fordul elő: kétszer a variáns-bélyegek
  csíkjaként (2-2 kép), egyszer a termék galériájaként (8 kép). A LEGTÖBB
  képet adó nyer — az osztálynevet a recept már leszűkítette.
- **A KONTÉNERT TAG-MÉLYSÉG szerint kell kivágni**, nem karakter-ablakkal: egy
  slider tetszőlegesen mély.
- **NE ADJ MEG TÁG OSZTÁLYT.** Az Indiana `gallery-placeholder`-e 8 képet ad,
  de köztük sapkát, ponchót és evezőt: az a kapcsolódó termékek területe is.
  Ott inkább maradjon kevesebb kép.

**TÖBB DESZKÁN UGYANAZ A KÉP — nézd meg, ÁTLÉPI-E A CSALÁDHATÁRT**
- Élesben 273 deszkából 130 osztott képet egy másikkal — de ebből **157
  megosztás a modellcsaládon BELÜL** maradt (Whopper 11'0" és 9'0" ugyanaz a
  „Blue Carbon" fotó). Az nem a mi hibánk: a gyártó SAJÁT variáns-képe is ez,
  mert KIVITELENKÉNT fotóz, nem méretenként.
- **Csak 5 lépte át a családhatárt, és mind az öt valóban hibás volt**: egy
  All Star fotója a Sprinten, egy marketing-GIF három BOTE-modellen, egy
  leash- és egy uszony-fotó két ISLE-deszkán, plusz egy `vector-33.svg`
  sablon-ikon két márkánál.
- A `prune-shared-images` ezért CSAK a családhatáron átnyúlót vágja ki.
  Kivétel: ha a fájlnév megnevezi a gazdáját (`…-All-star-3.jpg`), ott marad.
- **A BORÍTÓHOZ ne nyúlj**: a megosztott borítók kivágásával 73 deszka maradt
  volna kép NÉLKÜL — az rosszabb, mint egy családon belül ismétlődő fotó.

**UGYANAZ A KÉP TÖBB ALAKBAN — az azonosság az ÚTVONAL**
- `…/3469216.jpg` és `…/3469216.jpg?x-oss-process=image/resize,h_200,w_200`
  ugyanaz a fotó (Zray); `…/AMB930068_altpic_1/AMB930068.jpg` és
  `…/AMB930068_altpic_1/80x52/AMB930068.jpg` szintén (aquamarinahungary).
- A galéria ezért a lekérdező rész NÉLKÜL, a `\d+x\d+` alakú MÉRET-KÖNYVTÁRAKAT
  kihagyva, és a FÁJLNÉV végi `-800x800` utótagot levágva azonosítja a képeket
  (a WordPress/WooCommerce így generálja a kicsinyítéseket).

**A GYÁRTÓ NEM MINDIG KÖZÖL ELEG KÉPET — nézd meg a BOLTOT**
- Élesben (aquamarina.com) a gyártó modellenként 1-2 fotót ad, a magyar
  viszonteladó viszont ötöt (`_altpic_1..4`). A `backfill-gallery` ezért
  MINDEN elbírált forrást végigpróbál a rangsor szerint, nem áll meg az
  elsőnél — a gyártói oldal elsőbbsége nem jelentheti azt, hogy az üres
  eredménye után feladjuk.

**FEJETLEN BOLTNÁL A KÉPEK IS A BEÁGYAZOTT JSON-BAN VANNAK**
- Élesben (islesurfandsup.com) NÉGY deszka borítója egy ORSZÁGZÁSZLÓ-ikon lett
  (a pénznem-választóé), a többié életkép: a pozíció-fallback a lapon TALÁLT
  első képet adja, a termékfotók viszont csak a beágyazott adatban vannak.
- A gyártó rendezett képlistája ugyanabban a blokkban áll, közvetlenül a spec
  ELŐTT — az UTOLSÓ `media.nodes` a horgony előtt a terméké; ami utána jön, az
  már az ajánlóké. Az első elem a borító, a többi a galéria.
- **A JÓVÁHAGYOTT jelöltet egy újracrawl NEM írja felül**, tehát a már
  katalógusba került sorok galériája nem onnan pótolható — a
  `backfill-gallery` ilyenkor a TERMÉKOLDALRÓL olvas.

**A „KAYAK" SZÓ NEM MINDIG KAJAK**
- A SUP–kajak HIBRID deszka: állva evezhető, csak ülés is tehető rá. Élesben
  (islesurfandsup.com) a SUP-kollekció FELE ilyen, és mind kiesett a
  `NEVER_BOARD_KEYWORDS` kajak-szaván — hibátlan spec-blokk mellett. Ugyanez
  vitte el a BOTE LowRider Aero Tandemjét is.
- A kivétel szűk: a kajak-szó akkor nem kizáró, ha a termék KIMONDJA, hogy
  hibrid, ÉS deszkának is nevezi magát. A tiszta kajak egyiket sem teszi.

**A CÍMKÉZETT `Type:` MEZŐ ÜT a szövegen (felfújható kontra kemény)**
- Ahol a forrás kimondja (`Type: Inflatable`), ott nincs mit következtetni — és
  a szöveg-alapú olvasás épp ott téved: vegyes katalógusban MINDEN termékoldal
  említi a másik ágat is, ezért mindegyik `null`-t kapna.
- **Az „Inflatable Hardboard" FELFÚJHATÓ**: az ISLE konstrukció-neve a
  merevebb szériára, a „hardboard" a keltett ÉRZETRE utal. Ha az érték
  felfújhatót is mond, felfújható.

**VEGYES TÖRT a méretben: `4 1/2"` = 11,4 cm**
- Az amerikai gyártók a vastagságot így írják. A minta nélkül a hüvelyk-olvasó
  a NEVEZŐT vette értéknek (5,1 cm) — hihető szám, csendes hiba.
- **A törtnek az érték-ablak ELEJÉN kell állnia.** Szabadon eresztve a
  VASTAGSÁG törtje a hosszba és a szélességbe is beszivárgott: 11,4 × 11,4 ×
  11,4 cm lett egy 317 × 81 × 11 cm-es deszkából.

**ELTÉRŐ KÖZÖLT ADAT = MÁS DESZKA (a dedupe-nál)**
- A hossz és a név nem mindig különböztet meg: az `Explorer Pro v1` és az
  `Explorer Pro 2` ugyanolyan hosszú és majdnem azonos nevű — a jóváhagyó
  össze is vonta őket. A gyártó viszont 330 kontra 365 litert és 325 kontra
  425 fontot ír. Ugyanez a `Switch` és a `Switch Pro`.
- Ahol MINDKÉT jelölt közli ugyanazt a mezőt és 5% fölött eltér, nincs
  összevonás. A kerekítés és a font-átváltás belefér (élesben 1% alatt).

**A SPEC-TÁBLA PLATFORM-TÁBLA LEHET, NEM KÍNÁLAT**
- Élesben (boteboard.com) a kemény „Gatorshell" ág lapjain a tábla a
  modellcsalád MINDEN méretét felsorolja, a bolt viszont csak EGYET árul: a
  Breeze Gatorshell táblája 10'6"-ot ÉS 11'6"-ot ír, a variáns-választón csak
  a 10'6" áll. **Két nem létező deszka került emiatt a katalógusba** — a
  felhasználó vette észre a kollekció-oldal darabszámából.
- A felfújható ágon UGYANEZEN A FORRÁSON a tábla és a kínálat egybeesett,
  ezért a hiba egy ágból nem látszott volna. **Ha a spec-tábla több méretet
  ad, mint amennyit a variáns-választó kínál, a VÁLASZTÓ az igazság.**
- A megkülönböztetés alaki: a kínált méret PUSZTA sorként áll (`10'6"`), a
  spec-fejléc mindig visel mellette valamit (`10'6" Breeze Gatorshell`,
  `10′4″ Specs`). Ugyanaz a gomb-sor okozza a hamis fejléceket is — a két
  jelenség ugyanannak a ténynek a két oldala.
- **Ellenőrizd a darabszámot a kollekció-oldalon**, mielőtt lezárod a
  bekötést: a `/collections/<slug>/products.json` egyetlen kéréssel megadja a
  termékek listáját és a `Length` variánsait.

**VEGYES KATALÓGUS: a FELFÚJHATÓSÁGOT a teljes oldalszöveg NEM dönti el**
- Élesben (boteboard.com) a márka felfújható (`-aero-`) és KEMÉNY
  (`-gatorshell-`) deszkát is árul. A kemény deszkák lapján is ott a navigáció
  „Inflatable Paddle Boards" menüpontja, ezért a `detectInflatable` egynél
  `true`-t adott, négynél `null`-t — és a jóváhagyás a `null`-t `true`-ra oldja
  fel. Mind az öt kemény deszka FELFÚJHATÓKÉNT került volna be.
- Ez a navigációs-menü csapda újabb alakja, és a védekezés is ugyanaz: a gyártó
  SAJÁT, termékspecifikus jele üt a szövegen. Erre való a `rigidUrlPatterns`.
- **A trigram-egyeztető is elbukik itt**: a „Rackham Gatorshell" nevének
  hasonlósága a „Rackham Aero"-hoz magas, ezért mind a hat kemény deszkát a
  felfújható testvérére javasolta összevonásra (a „HD Gatorshell 10'6\""-t
  ráadásul a „Breeze Aero 10'6\""-ra). A `constructionConflicts` mostantól
  kizárja az ellentmondó szerkezetű párokat — ha MINDKÉT oldal állít valamit.

**FEL NEM OLDOTT SABLON-HELYŐRZŐ a kép `src`-jében**
- `<img src="{{ firstImageSrc }}">` — a bolt sablonjának egy darabja nyersen
  kikerült a HTML-be. Abszolutizálás után ez SZINTAKTIKAILAG ÉRVÉNYES URL
  (`…/products/%7B%7B%20firstImageSrc%20%7D%7D&width=200`), ezért minden
  korábbi szűrőn átment, és törött kép került volna a katalógus-sorra. A
  `%7B%7B` alak azért alattomos, mert a kapcsos zárójel a kódolás után nem
  látszik. **Ha egy kép-URL gyanúsan hosszú és `%7B`/`%24` szekvenciát visel,
  az sablon, nem kép.**

**A `multiUseProse` A VÁSÁRLÓI ÉRTÉKELÉSEKRE IS RÁUGRIK**
- Élesben (boteboard.com) a Rackham Aero kategóriáját egy REVIEW CÍMÉBŐL adta:
  „Ultimate Fishing and Exploration Inflatable SUP" — Donovan S. Történetesen
  jót mondott, de az vélemény, nem gyártói állítás, és a következő értékelés
  bármit írhat. Ahol az oldal értékeléseket is renderel, mérd le a módszert, és
  a `categoryMethods`-ból hagyd ki.

**A `<title>` LEHET FIX HOSSZRA VÁGVA**
- A shop a saját címét csonkolja, ezért a végén az utótagnak csak egy DARABJA
  marad: `… 12 cm - a`, `… 274x76x12 cm - aquali`, sőt olykor a méret közepén
  vág (`… evezővel 340`). Pontos utótagként ez nem adható meg — a
  `titleSuffixes` ezért a leghosszabb olyan darabot is levágja, ami az utótag
  ELEJE (min. 4 karakter).
- A címben maradt árva méret-szám bennmarad; a modellnév ettől eltér a gyártói
  forrásétól („FREESOUL TECH 340" kontra „Freesoul Tech"). Ez moderátori
  összefésülés, nem kinyerési hiba.

**A NYELVI ÁG NEM GARANCIA — maradhat idegen nyelvű spec-blokk**
- Élesben (bestwaystore.de) a tíz Hydro-Force deszkából EGYNÉL az ANGOL
  oldalon is NÉMET a spec: `Maximale Belastbarkeit: 120 kg` a `Weight
  capacity` helyett (a bolt fordítása ennél a modellnél hiányos).
- **Ez a legalattomosabb fajta hiány:** a MÉRET átjött, mert a
  `305 x 84 x 12 cm` hármas nyelvfüggetlen — a TEHERBÍRÁS viszont némán üresen
  maradt, és az KÖTELEZŐ mező (nélküle a Deszkaválasztó kizárja a deszkát).
  A mezősor `teher 9/10`-e volt az egyetlen jel.
- A megoldás egy-egy címke hozzáadása (`belastbarkeit`, `tragkraft`), nem a
  forrás elejtése.

**CSONKA HTTP-VÁLASZ — féladat, nem üres eredmény**
- Élesben egy termékoldal első letöltése 79 kB-ot adott a 820 helyett, egy
  `href="…` attribútum közepén elvágva. A kinyerés NEM üresen tért vissza: a
  méretet a CÍMBŐL még kiolvasta, a teherbírás viszont hiányzott — vagyis egy
  hihetőnek látszó, féladatos sor.
- **Ha egy lap váratlanul kevesebb mezőt ad, mint a többi, ELŐSZÖR töltsd le
  újra.** Ugyanezen a forráson a sitemap-letöltés is bukott egyszer (`0 URL`),
  a következő futás hibátlan volt.

**Modellnév: VÉDJEGY-JELEK ÉS A CÍMBEN ÁLLÓ MÉRET-HÁRMAS**
- `Hydro Force® SUP all-round board set Aqua Drifter™ with seat 335 x 91.5 x
  15 cm` — a `®`/`™` sosem a modellnév része, és a márkanév levágása után árva
  jelként marad a név elején (`™ Touring Board Freesoul™ Tech`).
- A méret-hármast EGYBEN kell kivenni: a darabonként illesztő minta csak az
  egységes tagot (`15 cm`) vitte el, és a névben ott maradt a csonk
  (`Aqua Drifter with seat 335 x 91.5 x`).

**Modellnév: A MÉRET LEHET AZ EGYETLEN MEGKÜLÖNBÖZTETŐ JEGY**
- A `cleanModelName` alapból kiveszi a láb-hüvelyk méretet a névből. A
  Decathlonnál viszont két külön deszka címe a méret nélkül EGYARÁNT „100"
  lenne (a 9'6-os és a 10'6-os szett is „100-as" sorozat) — összeolvadnának a
  duplikátum-felismerésben. Erre való a `titleKeepSize`.
- A vesszős felsorolásból (a magyar boltok címei ilyenek) a zajszavak
  kivétele után ÁRVA VESSZŐK maradtak a névben („, , , 100"). A vessző is
  elválasztó.

**Modellnév: SEO-szóhalmaz**
- Van forrás, ahol a cím nem modellnév, hanem kulcsszó-lista: „Cheap Polar Bear
  10′6″ Touring", „Best Paddle Boards Smiling Face Touring", „Stand Up For Sale
  Arrow 12′7″ Racing". Erre való a `titleNoiseWords` — FORRÁS-szintű zajszó-lista
  a globális mellé. A szavak nagy része máshol valódi modellnév-rész (a
  „touring" az Indianánál az), ezért globálisan tilos kivenni.
- A `|` jel UGYANAZON az oldalon kétféle szerepben állhat: márkanév-ELŐTAG után
  (`Funwater | …`) és reklám-UTÓTAG előtt (`… | SUP for All Skill Levels`). A
  `titleCutAfter` ezt megkülönbözteti: ha az elülső darab a márkanév, a jel
  MÖGÖTTI rész a modell.
- **Egybetűs szót SOHA ne vágj le a név széléről.** A SUP-nál az egybetűs
  végződés VARIÁNS-jelölés (Zray `Max Azure M2 A`, `Kids Saffron K8 B`) — a
  levágás két külön deszkát olvasztana össze.

**A HOSSZ nincs mezőben — a címben van**
- Van gyártó (red.equipment), aki a hosszt EGYETLEN mezőben sem közli, mert a
  modellnév ELEJE a méret (`10'8" Ride MSL…`). A kinyerő ilyenkor EGYETLEN
  terméket sem ad (a hiányzó hossz kizár). Erre való a `lengthFromTitle`.
- **De a cím sokszor MÁS méretet visel.** Élesben ugyanezen a boltok a
  KIEGÉSZÍTŐK címében ott a deszka mérete, amihez valók: `FFC Carbon Rod for
  Elite` → 381 cm „deszka", `Compact Backpack` → 269 cm. A gyanú-jelzés NEM
  fogja meg őket, mert a szám hihető. Ezért a szabály csak akkor él, ha a
  spec-blokk SZÉLESSÉGET is adott — azt a deszka mindig kiírja, a hátizsák nem.

**Feloldatlan HTML-entitás a címben**
- Élesben (red.equipment) a `<title>` így áll: `… Package&ndash; Red Equipment
  - ROW`. A `&ndash;` feloldatlanul a `–` SOSEM jelenik meg a szövegben, tehát
  a `titleCutAfter: ["–"]` némán nem csinál semmit — és a bennmaradó „Red
  **Equipment**" a `NEVER_BOARD_KEYWORDS` gyűjtőlap-szűrőjére esik. A forrás
  így NULLA terméket ad, teljesen félrevezető okból. Ha egy forrás váratlanul
  üres, **nézd meg a nyers `<title>`-t entitásokra.**

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
- **A galéria akkor is jár, ha a crawl `htmlOnly`.** A `backfill-gallery` a
  BOLTOT nézi, nem a bejárás módját: a BOTE-nál a spec a szövegből jött, a
  3–8 képes galéria mégis egyetlen paranccsal megvolt. Shopify-boltnál tehát
  a `--html-only` út SEM jelent kép-lemondást.

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

## Ha a forrás MINDEN HTTP-kérést kizár (robot-védelem)

Van forrás, ahol nem hiányos az adat, hanem az oldalig sem jutunk el. Élesben
(**decathlon.hu**, 2026-08-28): MINDEN HTML-oldal `403` + Cloudflare
„Just a moment…". A `robots.txt` és a sitemapok viszont NORMÁLISAN
kiszolgálódnak — ez tehát robot-védelem, nem tiltás.

**Amit mérj le, ebben a sorrendben** (a fejlécek cserélgetése nem visz előre):

| próba | eredmény élesben |
|---|---|
| `curl` saját UA-val | `403` |
| `curl` böngésző-UA-val | `403` — nem a UA a szűrő |
| FEJ NÉLKÜLI chromium / Chrome | `403`, **30 s alatt sem oldódik meg** |
| **FEJES Chrome** | **200, 2 másodperc alatt** — és a további oldalak már ellenőrzés nélkül jönnek ugyanabban a kontextusban |

Erre való a `browserFetch: true` a receptben (`browser-fetch.ts`): nem
fallback, hanem az EGYETLEN csatorna — ugyanazt a `FetchText` szerződést
teljesíti, ezért a `crawl.ts` egy sorát sem kell hozzáigazítani. **Egyetlen
böngésző-kontextus** megy a teljes forrásra, hogy a robot-ellenőrzés egyszer
fusson le.

**Az ára, amit ki kell mondani:** fejes böngésző kell, tehát a HAVI
CI-futásban ez a forrás NEM megy át. A bejárás lokális, kézi menet; a bevitt
adatot viszont a `verify-specs` zárolja, tehát egyszeri gyűjtés után marad.

**A listaoldalról szedett `href` KÉT kezelést kíván** (mindkettő általános):
* **entitás-feloldás** — az attribútumban `&amp;` áll, feloldás nélkül a
  lekért URL egy nem létező paramétert visel;
* **a töredék eldobása** — a `…#reviews-floor` ugyanaz az oldal.
A lekérdező rész forrásfüggő: a Decathlonnál színváltozat (`?mc=…&c=zöld`),
ezért ott `stripUrlQuery: true`; máshol a paraméter MAGA a termék (`?size=…`).
Enélkül ugyanaz a deszka háromszor került a sorba.

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

**A HARMADIK eset: a gyártó KÖZLI, de HIBÁSAN.** Élesben (decathlon.hu,
„SUP, kompakt - 100-as") a lap `Vastagság: 14' (35,5 cm)`-t ír — a 14
HÜVELYKET váltották át lábként, a deszka 15 cm vastag —, az űrtartalom sora
pedig `Szélesség: 325 liter.` címkével áll, ezért a térfogat üresen marad. Ezt
**nem lehet szabállyal javítani**, és nem is szabad: kitalálnánk a gyártó
helyett. A helye a recept fejlécében van, hogy a moderátor tudja, mit írjon
felül `verify-specs`-szel.

**Amit itt megpróbáltam és MEGBUKOTT** (hogy ne próbáld újra): egy „vastagság
felső küszöbe" gyanú-jel, hogy a 35,5 cm kiessen. A `suspicion.test.ts`
azonnal megfogta — a valós Sprint versenydeszka **27 cm vastag**, tehát nincs
olyan küszöb, ami a gyártói hibát elkapja, de a legitim deszkát átengedi. A
küszöbök ott MÉRTEK; ne írj föléjük hipotézist.

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
