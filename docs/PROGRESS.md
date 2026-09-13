# SUP Platform — PROGRESS

> Session-átvihetőség: keret-elfogyás vagy compact után a karmester (Fable 5,
> hiányában Opus 4.8) INNEN veszi fel a fonalat. Minden fázis végén frissítendő.

## Állapot-összkép

| Lépés | Állapot | Megjegyzés |
|---|---|---|
| F1.0 Projekt-setup | ✅ kész (2026-07-17) | részletek lent |
| F1.1 Core (auth, i18n, ui-primitívek…) | ✅ kész (2026-07-17) | reviewer-jóváhagyással; részletek lent |
| F1.2 DB (séma + RLS + seed) | ✅ kész (2026-07-18) | reviewer-jóváhagyással; futási verifikáció a CI rls-tests jobban |
| F1.3 Weather + SUP-index | ✅ kész (2026-07-19) | reviewer-jóváhagyva; Edge Functionök deployolva, cron aktív, élesben end-to-end verifikálva |
| F1.4 Spots + térkép | ✅ kész (2026-07-19) | scaffolder+ui-builder+karmester; MapLibre-térkép, adatlap, spot_reports; élesben verifikálva (m5 „Tilos" éles II. fokon) |
| F1.5 Catalog + Reviews | ✅ kész (2026-07-21) | catalog+reviews modulok, deszka-lista/adatlap, „Közös nevező"-blokk RatingBar-okkal (átnevezve: Népítélet→Közös nevező, színkiemelt evező-szójáték), e-mail-gate-elt vélemény+flag flow, admin-moderáció, catalog-watch séma-előkészítés. Vélemény-flow bejelentkezett teszt-fiókkal ÉLESBEN verifikálva (Közös nevező adattal renderel) |
| F1.6 Advisor | ✅ kész (2026-07-21) | algo-engineer (kétrétegű algoritmus) + ui-builder/karmester (wizard + eredmény + route + session-log); wizard end-to-end élesben verifikálva. Admin-moderáció böngészőben VERIFIKÁLVA (2026-07-24, lásd F1.6-szakasz) — az admin-ág teljesen zöld |
| F1.7 Providers | ✅ kész (2026-07-24) | directory-lista + profil + lead-form + saját-listing (claim/regisztráció) + admin-hitelesítő panel; mind az 5 flow böngészőben élesben verifikálva. Részletek lent |
| F1.8 SEO-réteg | ✅ mag kész (2026-07-24) | loader-alapú meta+hreflang, JSON-LD, sitemap+robots, consent (user_consents migráció + regisztrációs checkbox + re-consent), ÁSZF+adatvédelmi. HÁTRA: OG-kép-generálás + persona-landingek (F1.8b) + a consent-migráció éles push. Részletek lent |
| F1.9 Push + viharjelzés | ✅ kész (2026-07-25) | teljes web push-pipeline (VAPID + RFC 8291 natív Web Cryptóval, npm nélkül), storm-alert push-ág, feliratkozó-UI, m4 `observed_at`. Élesítve (5 migráció + secretek + deploy) és **böngészőben végponttól végpontig verifikálva: a viharjelzés-push megérkezett**. Részletek lent |
| F1.11 Folyó-vízállás (5.1/6) | ✅ kész + élesítve (2026-07-27) | vizugy.hu (OVF) REST API, HIVATALOS árvízvédelmi készültségi küszöbökkel; a fix −1 folyó-büntetés helyett fokozat-alapú index-plafon. Élesben verifikálva, cron írja. + F1.11b: póráz-figyelmeztetés folyóvízre |
| F1.12 Analitika (süti-mentes) | ✅ kész + élesítve (2026-07-28) | `analytics_events` + definer-RPC + `/admin/analitika`. Nincs süti/IP/azonosító → nincs egyéni tölcsér, csak darabszám. Robot/DNT/dev nem számol |
| F2.2 Visszajelzés-csatorna | ✅ kész + ÉLESBEN BÖNGÉSZŐBEN VERIFIKÁLVA (2026-07-31) | `/visszajelzes` (hiba · hiányzó bolt · hiányzó modell) + `/admin/visszajelzesek`. Teljes kör próbálva: beküldés → admin-listában megjelenés → állapotváltás+jegyzet mentése, mind sikeres. HÁTRA: `RESEND_API_KEY` ha kell e-mail-értesítés (opcionális) |
| F2.1 catalog-watch piacfigyelő | ✅ ÉLESBEN MŰKÖDIK (2026-08-15) | 4 forrás bekötve: Bluefin, Aqua Marina Hungary, sup-deszka.hu, Indiana Paddle & Surf (**172 jelölt pending**). Útközben 12 valós hiba javítva. **Munkafolyamat-váltás (F2.1-utó-10), ÉLESÍTVE + végponttól-végpontig verifikálva:** fél-automata — a crawler felfedez, a hiányzó specifikációt a felhasználó gyártói forrásból gyűjti, `verify-specs`-szel épül be és ZÁROLÓDIK (a crawler többé nem írja felül, élesben igazolva egy valós újra-crawllal); `list-incomplete` a havi munkalista (pending + élő board szakasz); a cron havi ritmusra állítva (minden hó 5.), ld. F2.1-utó-11. HÁTRA: a pending jelöltek moderációja + GH Actions secretek |
| F2.3 Felszerelés (kiegészítők), 1–3. szakasz | ✅ kész + élesítve (2026-07-29) | 1.: `/felszereles` útmutató-oldalak. 2.: `kind`/`would_recommend` migráció (élesítve, REST-tel verifikálva) + `kind='board'` szűrő mindenhol + `/felszereles/:kategoria/:slug` termékadatlap. 3.: catalog-watch `classifyProduct` (evező/mentőmellény/pumpa jelöltté válik) + admin deszka/kiegészítő kapcsoló. Valós forrás-adat MEGÉRKEZETT (2026-07-31, ld. F2.1) — evező/mentőmellény/pumpa jelöltek a 168 pendingben, moderációra várnak |
| F2.4 Direkt bolti ár eltávolítása | ✅ kész (2026-07-30) | A deszka- és kiegészítő-adatlapról (fejléc-ár + „Hol kapható" blokk + JSON-LD `offers`) eltávolítva — felhasználói döntés, ld. F2.4-szakasz. A `board_prices` gyűjtés (catalog-watch) VÁLTOZATLAN, a Deszkaválasztó budget-szűrője/eredmény-ára is VÁLTOZATLAN (felhasználói döntés szerint) |
| F1.10 Záró audit + élesítés | ✅ audit **26/26** (2026-07-27) | **`docs/AUDIT_F1.md`**: az audit két mérés-jellegű hiánya pótolva (vizuális regresszió 07-26, teljesítmény-budget 07-27). HÁTRA az F1 lezárásához a publikussá tétel — a lépések a `RUNBOOK.md` **élesítési checklistjében** (domain → Resend-SMTP → Turnstile → cégadatok → `SITE_PUBLIC=true`), mind felhasználói döntés/adat |
| F2.5 Alapvető információk | ✅ kész + BŐVÍTVE (2026-08-29) | Statikus SUP-szabály/biztonság/gyakorlati-infó oldalak a Spotok modulban, `/alapinfo` + `/alapinfo/:viz`. Kezdetben 4 vízre (2026-08-13), **2026-08-29-től 10-re**: + RSD, Hármas-Körös, Velencei-tó, Fertő tó, Szigetköz, Orfű. Kétkörös forráskutatás (jogszabály-hivatkozásokkal); bizonytalan tények szándékosan kihagyva. hu/en kulcs-paritás ellenőrizve. Források: `docs/VIZTESTEK_KUTATAS.md` |

## ITINER a következő sessionnek (2026-07-28-i állapot)

**HOL TARTUNK:** az F1 funkcionálisan LEZÁRVA (fázis-záró audit 26/26,
`docs/AUDIT_F1.md`). Az oldal a `supperz.netlify.app`-on él, HTTP Basic
jelszó-kapu mögött. Azóta három továbbfejlesztés ment ki élesbe: folyó-vízállás
(F1.11), póráz-figyelmeztetés (F1.11b) és süti-mentes analitika (F1.12).
2026-07-28: elkészült az **F2.1 catalog-watch piacfigyelő** (kód kész, éles
futás még nem volt) és az **F2.2 visszajelzés-csatorna**. 2026-07-29: elkészült
az **F2.3 Felszerelés** mind a 3 szakasza (útmutató · `kind`-diszkriminátor +
termékadatlap · catalog-watch besorolás), és **mindhárom nyitott migráció
(feedback + a két F2.3-migráció) éles push-olva + REST-tel verifikálva**.
2026-07-30: **F2.4** — direkt bolti ár eltávolítva az adatlapokról
(felhasználói döntés: az ár sosem friss, a részleges bolt-lefedettség
igazságtalan, az ár/érték ítélet a közösségi reviewé). 2026-07-31: **az első
éles catalog-watch forrás lefutott** — Bluefin (gyártói D2C oldal) bekötve,
**15 jelölt vár moderációra** a `/admin/katalogus`-on (F2.1-utó szakasz).
Két valós hibát fogott a próbafutás (nyelvi URL-duplikáció, hibás
márkanév-adat a forrás oldalán) — mindkettő javítva, kapuk zöldek.

**A PUBLIKUSSÁ TÉTEL a felhasználón múlik** — a lépések sorrendben a
`docs/RUNBOOK.md` „Élesítési checklist" szakaszában:
domain → Resend-SMTP → Turnstile-kulcs → cégadatok (`@core/legal/entity.ts`) →
`SITE_PUBLIC=true` → éles LCP-mérés. Egyik sem fejlesztői feladat.
Felhasználói döntések (2026-07-27): a domain regisztrációja folyamatban
(a név **Suptime**); a Turnstile-fiók a publikussá tételkor jön létre; a
cégadatok addig várnak, amíg eldől a vállalkozási forma.

**Fejlesztési irányok, amelyekből választani lehet** (a legutóbbi körben a
felhasználó a HydroInfo-t választotta, majd az analitikát):

1. ~~**Biztonsági kiegészítők teljes blokkja**~~ — **KÉSZ + ÉLESÍTVE (F2.3,
   mind a 3 szakasz, 2026-07-29)**: a domain-review 2.8 pontja lezárva. Ami
   hátra van, az nem fejlesztés: valós HU-forrás bekötése úgy, hogy evező/
   mentőmellény/pumpa jelöltek is érkezzenek — ez ugyanaz a lépés, mint a
   2. pont.
2. ~~**catalog-watch piacfigyelő pipeline** (F2)~~ — **ELSŐ ÉLES FORRÁS FUT
   (2026-07-31)**: Bluefin bekötve, 15 jelölt vár a `/admin/katalogus`-on.
   Ami hátra van, az nem fejlesztés: **a jelöltek jóváhagyása** (admin-
   bejelentkezés kell) + GitHub-secretek ellenőrzése a heti cronhoz (részletek
   az F2.1-utó szakaszban). Ez tölti fel a katalógust (most 20
   deszka + 0 kiegészítő), ami EGYBEN előfeltétele az advisor ár-padló
   tételének (20 elemen az eloszlás-alapú küszöb zajos).
3. **Capacitor natív build** (F2 nyitása) — a `build:native` SPA-mód megvan,
   a wrapper nincs.
4. **react-router 8 frissítés** — `SECURITY_FINDINGS.md` F1.10-01 (RSC-módú
   CSRF; minket NEM érint, de a 7.x ágon nincs patch). Kiváltó ok: ha RSC-t
   vezetnénk be.

**F2.1-utó-47 — FunWater bekötve (2026-08-28).** A táblázatból (`Kezdők_tanácsok/
nepszeru_sup_markak_es_forgalmazok.md`) hiányzó öt márka közül az első. A forrás
Shopify, de a `/products.json` NEM ad specifikációt (csak marketingszöveget,
`Default Title` variánsokkal) — a spec a termékoldal nyers HTML-jében van, KÉT
külön sablonban. Amit a bekötés hozott, mind általános javítás:
- **`labeledUse`** — új kategória-módszer: a gyártó saját címkézett használat-
  mezője (`Versatility: All-around, ideal for cruising, exploring, and yoga`).
  Erősebb a névből tippelésnél, ami itt TÉVEDETT (az „Island Explorer" all-round).
- **Csupasz sor-címkék egységgel** (`Weight` ⏎ `12.74KG`) — a súly enélkül
  `0/7` volt, ami a kinyerés hibája, nem termékenkénti ügy.
- **Prózai inverzió imperiális jelekkel** (`The 10'6" length, 33" width…`) — a
  spec-tábla után álló reklámmondat EGGYEL elcsúsztatta a méret-hármast, és
  felülírta a helyes 320 cm-t 83,8-cal.
- **Teljes szélességű kettőspont** (`Capacity：`) és **láthatatlan LTR-jel**
  (U+200E), **kiírt egységnevek** (`Pounds`/`Kilograms`), **`Package Weight`**
  kizárása (az a csomagé).
- **`titleNoiseWords`** — forrás-szintű zajszó-lista a SEO-címekhez.
- **A renderelés bukása nem viszi a futást**: a `close()` a sikertelen
  böngésző-indítás elutasított ígéretét várta meg, és az EGÉSZ crawlt
  megállította a második URL-nél.

Eredmény 25 termékoldalon: `hossz ✓ · szél ✓ · vast ✓ · térf n.a. · súly ✓ ·
teher ✓`. Három fixtúra őrzi (mindkét sablon + a prózai inverzió).

**Az ÉLES futás (200 URL) többet mutatott, mint a minta.** 13 gyanús tétel jött,
amiből 4 valóban nem deszka (bögre, ajándékdoboz, gördeszka, jógamatrac —
helyesen megjelölve), a többi viszont a MI hibánk volt: ugyanaz a prózai
inverzió, öt további alakban (görbe idézőjel `’` mint láb-jel; kiírt
`feet`/`ft`; zárójeles átváltás és elöljáró a címke előtt; `33" wide`
melléknévi címke). Plusz: ahol a próza ELLENTMOND a spec-táblának (a gyártó
`12"`-ot írt `12'` helyett), a táblázat nyer — a védelem geometriai, a hossz
nem lehet kisebb a szélességnél. Két tanulság ára: a `’` bevezetése önmagában
elrontotta az Indianát (ott a spec mindkét írásmódot kiteszi, és a származtatott
láb-hüvelyk ütötte a gyártó saját cm-ét), a `thick` melléknévi címke pedig a
Jobe-t — mindkettőt a fixtúra-háló fogta meg azonnal. Gyanús: 13 → 4.

**F2.1-utó-48 — Red Paddle Co bekötve (2026-08-28).** A DOMAIN volt a kulcs: a
`redpaddleco.com` a régi WordPress-oldal (minden válaszát PHP-figyelmeztetések
vezetik be, és a sitemap-indexében nincs termék-bejegyzés); az élő bolt a
`red.equipment` (Shopify). Négy általános javítás kellett hozzá:
- **`lengthFromTitle`** — a gyártó egyetlen mezőben sem közli a hosszt, az a
  modellnév eleje (`10'8" Ride MSL…`). Enélkül a forrás NULLA terméket adott.
- **`riders up to`** teherbírás-címke — terhelési mező sincs, a leírás mondja
  ki. Ugyanaz az eset, mint a Jobe „Recommended rider weight"-je.
- **`Rider Style`** a `labeledUse` címkelistájára (a gyártó saját besorolása).
- **TIPOGRÁFIAI ENTITÁSOK** (`&ndash;`, `&mdash;`, `&times;`, idézőjelek) az
  entitás-feloldásba. Ez volt a legalattomosabb: a cím `… Package&ndash; Red
  Equipment - ROW` alakú, feloldatlanul a `–` SOSEM jelenik meg, tehát a
  `titleCutAfter: ["–"]` némán nem csinált semmit — és a bennmaradó „Red
  **Equipment**" a gyűjtőlap-szűrő „equipment" szavára esett. A forrás emiatt
  teljesen félrevezető okból adott nulla terméket.

A próbafutás rögtön megmutatta a `lengthFromTitle` árnyoldalát is: a bolt
KIEGÉSZÍTŐI a címükben viselik a deszka méretét, amihez valók (`FFC Carbon Rod
for Elite` → 381 cm, `Compact Backpack` → 269 cm), és a gyanú-jelzés sem fogta
meg őket, mert a szám hihető. Őrszem: a cím-alapú hossz CSAK akkor él, ha van
SZÉLESSÉG is — a deszka mindig kiírja, a hátizsák nem; plusz `backpack` és
`camera mount` a kizáró kulcsszavakra.

Eredmény 200 URL-en: 23 „termék" → **17 valódi deszka, 0 gyanús**,
`hossz ✓ · szél ✓ · vast ✓ · térf 6/17 · súly ✓ · teher 15/17`. Az űrtartalmat
modellenként változóan, prózában közli (`295L of volume`) — ezért NEM
`unpublishedFields`. Két fixtúra őrzi.

**F2.1-utó-49 — Aquatone bekötve (2026-08-28).** A DOMAIN itt is a kulcs volt:
a márkatáblázat `aquatoneair.com`-ot ír, ami DNS-ből sem oldódik fel (emiatt
írtuk le korábban a márkát); az élő oldal a `aquatone.com`. Ez a HARMADIK
forrás, ahol a rossz domain miatt vesztünk időt (FunWater, Red Paddle, Aquatone).

- **NINCS `robots.txt` ÉS NINCS SITEMAP**: mindkét út 200-zal felel, de a
  tartalmuk egy 1,5 kB-os kínai hibaoldal (`系统发生错误`). Ez hiány, nem
  tiltás — robots.txt híján a bejárás megengedett.
- **`productListUrls`** — új felderítési mód sitemap HELYETT. A terméklista
  JS-ből épül, de a mögötte álló végpont sima GET-tel is kiszolgál
  (`/index.php/Products/getList.html?…&cateid=24`). A megadott listaoldalak
  minden `href`-je átmegy a szokásos minta-szűrésen. A bolt SAJÁT listáját
  kérjük le, ugyanazt, amit a böngésző; az ID-tér végigpróbálása lett volna a
  kerülőút.
- **ESCAPE-ELETLEN `<` A TARTALOMBAN** — a legalattomosabb csapda eddig. A
  gyártó így írja a terhelést: `<p>< 75 kg / 165 lbs</p>`. A naiv
  `<[^>]+>` minta a `< 75 kg / 165 lbs</p>` darabot EGY tagnek vette és
  eldobta: a teherbírás nyomtalanul eltűnt, pedig ott volt a letöltött
  HTML-ben — teherbírás nélkül pedig a Deszkaválasztó kizárja a deszkát.
  A szabály most: `<` után szóköz nem tag-kezdet.
- **Kettős írásmódú érték-sorok** (`6.8 kg / 15 lbs`) az önálló érték-sor
  mintájában, a `kg` elsőbbségével.

Eredmény 45 URL-en: 11 deszka + 2 pumpa, **0 gyanús**, `hossz ✓ · szél ✓ ·
vast ✓ · térf ✓ · súly ✓ · teher 9/11` — az ELSŐ forrás, ahol mind a hat mező
megvan. Teherbírásnak a `REC. PAYLOAD` kerül be (elöl áll, és konzervatívabb
a MAX-nál) — ugyanaz a döntés, mint a Jobe rider-weight-jénél.

**F2.1-utó-50 — Itiwit/Decathlon bekötve (2026-08-28).** A MÁRKANÉV MÁR NEM
ITIWIT: a decathlon.hu mindenütt `DECATHLON` márkanevet tesz ki ugyanezekre a
deszkákra, ezért a forrás neve Decathlon. Két olyan akadály volt, amilyen még
nem: egyik sem a kinyerésé, mindkettő a HOZZÁFÉRÉSÉ.

- **NINCS TERMÉK-SITEMAP, pedig van sitemap.** A `robots.txt` két sitemapot
  hirdet; a működő index öt gyerek-sitemapot sorol, összesen **8665 URL-lel —
  amiből NULLA a `/p/` termékoldal**. A felderítés ezért kategória-oldalról
  megy (`productListUrls`, az Aquatone-nál bevezetett mód).
- **CLOUDFLARE ROBOT-ELLENŐRZÉS MINDEN HTML-OLDALON.** Mérve: sima `curl`
  (saját és böngésző-UA-val is) `403`; **fej nélküli Chrome 30 s alatt sem
  jutott át**; FEJES Chrome 2 másodperc alatt igen, és a további oldalak már
  ellenőrzés nélkül jönnek ugyanabban a kontextusban. A `robots.txt` és a
  sitemapok viszont normálisan kiszolgálódnak — ez robot-védelem, nem tiltás.
  Új modul: **`browser-fetch.ts`** (`browserFetch: true` a receptben) — nem
  fallback, hanem az EGYETLEN csatorna ennél a forrásnál, és ugyanazt a
  `FetchText` szerződést teljesíti, ezért a `crawl.ts` egy sorát sem kellett
  hozzáigazítani. **ÁRA: a havi CI-futásban ez a forrás nem megy át** (a runner
  fej nélküli), a bejárása lokális, kézi menet; a `verify-specs` zárolása
  viszont megőrzi a bevitt adatot. A `/hu/ajax/nfs/…` JSON-végpontok, amikből
  az oldal épül, NEM járhatók: a `robots.txt` tiltja a `/hu/ajax/`-ot.

Általános javítások, amiket a forrás kikényszerített:
- **A gyártó SAJÁT zárójeles átváltása üt** (`Hosszúság: 14' (426 cm)`). A
  `Vastagság: 4'75" (12 cm)` alakot a láb-hüvelyk minta 4 láb + 75 HÜVELYKNEK
  olvasta (312 cm egy 12 cm vastag deszkára), és a `Szélesség` ablaka átnyúlt a
  következő sorba, ahonnan a KÖVETKEZŐ mező láb-értékét szedte fel.
- **A tartozék tömege sem a deszkáé**: négy tömeg áll egymás alatt (deszka /
  teljes szett / evező / pumpa), a puszta „súly" needle az EVEZŐÉT adta. Az
  angol `paddle` kizáró előtagként MEGBUKOTT — az Aqua Marina Hungary címkéje
  `paddleboard súlya`, ott a „paddle" a deszka neve. A fixtúra-háló fogta meg.
- **A „maximális terhelhetőség" ARKHIMÉDÉSZ, nem teherbírás.** Pontosan annyi
  kg, ahány LITER a térfogat (350 l → 350 kg, 335 l → 335 kg, 245 l → 245 kg),
  és a gyártó ki is mondja: „amíg a vízfelszínen marad". A Deszkaválasztó
  0,66-os szorzójával ez egy 231 kg-os evezősnek adna zöld utat egy 140 kg-ra
  tervezett deszkán — biztonsági hiba, nem pontatlanság. A valós korlát a
  magyar `Max. 140 kg-ig ideális` idióma (megerősítő szóhoz kötve, mert a
  puszta „130 kg-ig" a kapcsolódó termékek címeiben is ott áll, ELŐBB).
- **`titleKeepSize`**: a méret az egyetlen megkülönböztető jegy (két külön
  szett neve a méret nélkül egyaránt „100" lenne). Plusz a vesszős címekből
  árván maradt vesszők tisztítása.
- **`stripUrlQuery` + entitás-feloldás + töredék-vágás a listaoldal `href`-jein**:
  ugyanaz a deszka HÁROMSZOR került a sorba (csupaszon, `?mc=…&c=zöld`
  színváltozattal és `#reviews-floor` töredékkel), és az `&amp;` feloldatlanul
  egy nem létező paramétert vitt a lekérésbe.

**Kategória kézzel (`boardTypeByUrl`)**: a morzsamenü MIND A HAT deszkán
ugyanazt mondja („… › Túra SUP"), a 80 kg-ig ajánlott kezdő szettet is
beleértve — ez menü-elhelyezés, nem besorolás. A gyártó saját leírása dönt
(Explo 900 és 12'6 500-as → túra, a többi → allround).

Eredmény 8 URL-en: **6 deszka, 0 gyanús**, `hossz ✓ · szél ✓ · vast ✓ ·
térf 5/6 · súly ✓ · teher ✓`. Élesben lefutott, a 6 jelölt a moderációs sorban.
Három fixtúra őrzi. **A hiányzó térfogat és egy hibás vastagság a GYÁRTÓ saját
adathibája** („SUP, kompakt - 100-as": `Vastagság: 14' (35,5 cm)` — a 14
hüvelyket váltották át lábként; az űrtartalom sora `Szélesség: 325 liter.`
címkével áll). Ezt nem javítjuk szabállyal — a moderáció írja felül
`verify-specs`-szel. Egy „vastagság felső küszöbe" gyanú-jel meg is bukott a
mérésen: a valós Sprint versenydeszka 27 cm vastag.

**F2.1-utó-51 — Bestway / Hydro-Force bekötve (2026-08-29). A MÁRKATÁBLÁZAT
TELJES.** A gyártónak NINCS bejárható D2C oldala (a bestway.com katalógusa nem
ad SUP-termékoldalakat spec-táblával); a forrás a hivatalos európai bolt
ANGOL nyelvi ága (`bestwaystore.de/en`, „Official Bestway® Store").

- **NYELVENKÉNTI SITEMAP.** A `/sitemap.xml` a NÉMET URL-eket sorolja (2999 db,
  egyetlen `/en/` sincs benne); az angol ág saját indexet kap
  (`/en/sitemap.xml`). A két nyelv slugja NEM egymásból származik, tehát
  átírni sem lehetne — a jó sitemapot kell megtalálni.
- **A Shopify-testvérbolt kevesebbet ad.** A `bestwaystore.co.uk` Shopify, a
  `/products.json` szolgál is — de a spec ott csak marketing-prózában áll. A
  `/products.json`-csapda újabb megerősítése.
- **AZ URL-MINTA STRUKTURÁLIS SZŰRŐ.** A boltban ~55 Hydro-Force pótalkatrész
  van, köztük „replacement board" tételek a NEVÜKBEN deszka-mérettel — a
  deszkák viszont kivétel nélkül `/en/hydro-force-sup-…` alatt élnek. A szűk
  minta zár, nem a `classifyProduct` heurisztikája.

Általános javítások:
- **Védjegy-jelek** (`®`/`™`/`©`) a modellnévből — a márkanév levágása után
  árva jelként maradtak (`™ Touring Board Freesoul™ Tech`).
- **Méret-hármas EGYBEN** a névből: a darabonkénti minta csak az egységes
  tagot (`15 cm`) vitte el, és ott maradt a csonk (`Aqua Drifter with seat
  335 x 91.5 x`).
- **Német terhelési címkék** (`belastbarkeit`, `tragkraft`). MIÉRT: az ANGOL
  oldalon is maradhat NÉMET spec-blokk — tíz deszkából egynél (2025-ös Oceana)
  `Maximale Belastbarkeit: 120 kg` áll. A méret ettől még kijött (a hármas
  nyelvfüggetlen), a teherbírás viszont némán üresen maradt, és az KÖTELEZŐ
  mező. A mezősor `teher 9/10`-e volt az egyetlen jel.
- **Márka-aliasok**: `bestway`/`hydro force`/`hydroforce` → `Hydro-Force`, és
  — az előző lépés következményeként — `itiwit` → `Decathlon` (a decathlon.hu
  ma ezt a márkanevet teszi ki ugyanazokra a deszkákra, tehát különben ugyanaz
  a deszka két márka alatt szóródna szét).

Eredmény 10 URL-en: **10 deszka, 0 pótalkatrész, 0 gyanús**, `hossz ✓ · szél ✓
· vast ✓ · térf n.a. · súly n.a. · teher ✓`. Élesben lefutott, a 10 jelölt a
moderációs sorban. Két fixtúra őrzi (angol spec-blokk + a német spec-blokkos
Oceana). **ŰRTARTALMAT ÉS DESZKA-SÚLYT a gyártó NEM közöl** (négy termékoldalon
ellenőrizve; a műszaki adatlap PDF, amit a robots.txt kizár) — a
`sync-unpublished --apply` a jóváhagyás UTÁN jelöli meg a sorokat.

**ÉLESBEN MÉRT, NEM A FORRÁS HIBÁJA:** egy termékoldal első letöltése CSONKA
válasz volt (79 kB a 820 helyett). A kinyerés nem üresen tért vissza: a méretet
a CÍMBŐL még kiolvasta, a teherbírás viszont hiányzott — hihetőnek látszó,
féladatos sor. Ha egy lap kevesebb mezőt ad, mint a többi: előbb töltsd le újra.

**F2.1-utó-52 — Aqualing bekötve: a Hydro-Force hiányzó mezőiért
(2026-08-29).** A gyártói bolt űrtartalmat és deszka-súlyt nem közöl; a magyar
`aqualing.hu` viszont IGEN, címkézett attribútum-táblában — és a MÉRET meg a
TEHERBÍRÁS pontosan egyezik a gyártóival, tehát nem másik igazságot ad, hanem
kiegészíti. Csak a Hydro-Force ágat gyűjtjük róla (a Gladiatort a gyártótól).

Eredmény 32 URL-en: **15 deszka, 0 gyanús**, `hossz ✓ · szél ✓ · vast ✓ ·
térf 11/15 · súly 3/15 · teher ✓` — a térfogat 0-ról 11-re. Élesben lefutott,
két fixtúra őrzi. A bolt 5 olyan modellt is visz, ami a gyártói boltban nincs
(Huaka'i Tech, White Cap, White Cap Convertible, FastBlast Tech, Aqua Wander…).

Általános javítások, mind élesben mért hibára:
- **A SZERKESZTETT TÁBLÁZAT ÜT A PRÓZÁN.** A `Vastagság (cm) / 12` cellából
  12000 lett, mert a szabad szövegben kereső, lazább menet FELÜLÍRTA a
  táblázatból már helyesen kiolvasott értéket. A javítás kétrészes: a
  táblázat-olvasó fut előbb, és a lazább menetek csak a MÉG ÜRES mezőket
  töltik. Az elv a fájlban máshol ki volt mondva — a méreteknél hiányzott.
- **Az egység a CÍMKÉBEN is állhat** (`Hosszúság (cm)` ⏎ `:` ⏎ `305`). A
  méretet egyébként sosem olvassuk puszta számból, de ez nem találgatás. A
  címke, a kettőspont és az érték KÜLÖN SORBAN áll (külön táblacellák), ezért
  a „következő sor az érték" olvasó a kettőspontot vette értéknek.
- **Csonkolt `<title>`**: a bolt fix hosszra vágja a saját címét, így az
  utótagnak csak egy darabja marad („… 12 cm - a", „… - aquali"). A
  `titleSuffixes` mostantól a leghosszabb olyan darabot is levágja, ami az
  utótag ELEJE (min. 4 karakter).
- **Magyar címkék**: `űrtartalom` (térfogat), `nettó tömeg` (deszka-súly),
  `Típus` (labeledUse). A `Max. evezős súly` NEM a deszka tömege — a
  tartozék-kizárás védi.

**AMIT NEM VETTÜNK ÁT** (sportvilag.com, ugyanezért felmerült): a bolti
„Súlya: 11,6 kg" ott a SZETT tömege (a lap alatta sorolja a tartalmat), és
ugyanaz a 381×79×15-ös méret az egyik boltban „Glider Elite / 150 kg", a
másikban „Aqua Excursion / 120 kg" — az két külön modell, nem elírás. Csak a
kimondott alakot fogadjuk el („Deszka nettó tömege", „Tábla súlya").

**F2.1-utó-53 — Uone (u1.net.pl) bekötve, lengyel gyártó (2026-08-29).**
Felhasználói lelet. A LEGJOBBAN SZERKESZTETT spec-tábla eddig: a „Parametry"
fül a NYERS HTML-ben adja mind a hat mezőt, címkézve, plusz a `Typ deski`
besorolást. Eredmény 11 URL-en: **10 deszka, 0 gyanús**, `hossz ✓ · szél ✓ ·
vast ✓ · térf ✓ · súly 0/10 · teher ✓`. Élesben lefutott, két fixtúra őrzi.

- **SZŰRŐ-OLDALSÁV-CSAPDA**: a termékoldal szűrő-panelje UGYANAZOKAT a
  címkéket viseli, mint a spec, és felsorolja az összes lehetséges értéket
  (`Typ deski` ⏎ `Deski SUP – Allround` ⏎ …; `Waga użytkownika` ⏎ `… 100kg`),
  ráadásul ELŐBB. Emiatt minden deszka „allround" lett a valódi
  `Typ deski: Touring` helyett, és a szűrőből 100 kg került a deszka tömegébe.
  A `labelledUseText` mostantól KÉTMENETES: a kettőspontos alak megy előbb —
  ugyanaz az elv, ami a `valueAfterLabel`-nél már megvolt.
- **Lengyel címkék**: `długość`, `szerokość`, `wysokość` (= a deszka
  VASTAGSÁGA), `pojemność`, `obciążenie`, `typ deski`, és a `litr…` tő a
  térfogat egységéhez. A `grubość` SZÁNDÉKOSAN kimarad: az a szó szerinti
  „vastagság", de ott az ANYAGÉ, milliméterben — abból 0,08 cm-es deszka lenne.
- **Teherbírás**: `150kg/ 300kg` egy mezőben, az AJÁNLOTT áll elöl és az kerül
  be — a 300 kg a 350 literes térfogathoz tartozó merülési határ. Ugyanaz az
  arkhimédészi csapda, mint a decathlon.hu-n.
- **A DESZKA SÚLYÁT szándékosan nem vesszük át**: két `Waga` sor van, az első a
  szett tömege (15 kg), a második a deszkáé (10,5) — megkülönböztethetetlenül.
  Ez NEM „a gyártó nem közli" eset, ezért nem `unpublishedFields`.

**F2.1-utó-54 — BOTE (boteboard.com) bekötve, amerikai gyártó (2026-08-29).**
Felhasználói lelet. Shopify-bolt, de a `/products.json` SPEC NÉLKÜLI (marketing-
próza + szín-variánsok), a teljes „Technical Specs" viszont ott a nyers HTML-ben
— tehát `htmlOnly`, sokadszor. Eredmény 9 URL-en: **11 deszka, 0 gyanús**,
`hossz ✓ · szél ✓ · vast ✓ · térf n.a. · súly ✓ · teher ✓`. Élesben lefutott,
négy fixtúra őrzi, a galéria (3–8 kép/deszka) is megvan.

- **A `<title>` NEM a modellnév — a JSON-LD igen** (új kapcsoló:
  `modelNameFromJsonLd`). Két deszka NULLA jelöltet adott hibátlan spec-blokk
  mellett: az EasyRider Aero címe a nevet KI SEM MONDJA („Beginner Inflatable
  Paddle Board — SUP & Kayak"), a LowRider Aero Tandemé pedig a „Kayak" szót
  viseli, amitől a `classifyProduct` kajaknak minősítette és eldobta. A
  `Product` JSON-LD `name`-je mind a 9 modellnél pontosan a katalógusnév. A
  spec marad a szövegből; CSAK a nevet vesszük át.
- **EGY oldal, KÉT deszka — új elrendezés**: a gyártó méretenként MEGISMÉTLI a
  teljes címkézett blokkot egy méret-fejléc alatt (`10′4″ Specs` …
  `11′4″ Specs`). Az első-találat-nyer olvasás a nagyobb méretet NÉMÁN
  elvesztette — pedig a WULF Aero 11'4" külön deszka, 315 LBS teherbírással a
  10'4" 250-je helyett. Erre való a `parseLabeledSpecsBySize`. A fejléc alakja
  UGYANAZON A BOLTON belül kétféle (`10′4″ Specs` kontra `10'6" BREEZE AERO`),
  és a VARIÁNS-VÁLASZTÓ gombjai alakra ugyanolyan fejlécek — a védelem ezért
  nem a fejléc alakja, hanem az EGYEZÉS: a fejléc kimondta hossznak és a
  blokkból kiolvasottnak meg kell egyeznie.
- **`Avg. Weight`** — új címke a deszka saját tömegére. Mellette ott a
  `Loaded Bag Weight` (becsomagolt szett) és a `Seat Weight` (tartozék ülés);
  egyikbe sem illik bele az „avg", ezért a szűk címke elhatárol.
- **A RÉSZSTRING-illesztés kétszer harapott**: a `kids-fLOWRIDER-AERO-HYBRID-…`
  URL tartalmazza a `lowrider-aero-hybrid-paddle-board` kulcsot (a gyerekdeszka
  `allround` lett `kids` helyett → a kulcs mostantól teljes útvonal), az
  `-aero-hybrid-paddle-board` minta pedig épp a `lowrider-aero-TANDEM-hybrid-…`
  deszkát hagyta ki, mert a változat neve beékelődik.
- **A `multiUseProse` a VÁSÁRLÓI ÉRTÉKELÉSRE ugrott rá** („Ultimate Fishing and
  Exploration Inflatable SUP" — Donovan S). Történetesen jót mondott, de az
  vélemény, nem gyártói állítás — a `categoryMethods` ezért itt `pinnedUrl` +
  `nameAndUrl`, a besorolás pedig a gyártó saját `activity:` címkéiből
  (`All Purpose`/`Recreation`/`Leisure` → allround, `Expedition` → touring,
  `Fishing` → fishing; a `Family Fun` célközönség, nem használat).
- **Űrtartalmat a márka egyetlen modellnél sem közöl** (mind a 9 termékoldalon
  ellenőrizve) — `unpublishedFields: ["volumeL"]`.
- **A galéria `htmlOnly` mellett is jár**: a `backfill-gallery` a BOLTOT nézi,
  nem a bejárás módját — Shopify-boltnál a `--html-only` út SEM jelent
  kép-lemondást.
**F2.1-utó-54/b — a BOTE KEMÉNY („Gatorshell") ága (2026-08-29).** Felhasználói
kérésre ugyanaznap. 14 URL → **15 deszka összesen**, 0 gyanús, a mezősor
változatlanul teljes. A vegyes katalógus három olyan hibát hozott felszínre,
ami egyetlen felfújható-only forráson sem jött volna elő:

- **A felfújhatóságot a teljes oldalszövegből nem lehet eldönteni** (új
  kapcsoló: `rigidUrlPatterns`). A kemény deszkák lapján is ott a navigáció
  „Inflatable Paddle Boards" menüpontja: a Breeze Gatorshell ettől `true`-t
  kapott, a másik négy `null`-t — amit a jóváhagyás `true`-ra old fel. MIND AZ
  ÖT kemény deszka felfújhatóként került volna a katalógusba. Ez ugyanaz a
  navigációs-menü csapda, ami a kategória-kinyerésnél már ismert, és a
  védekezés is ugyanaz: a gyártó SAJÁT, termékspecifikus jele (az URL-szegmens)
  üt a szövegen.
- **A trigram-egyeztető MIND A HATOT a felfújható testvérére javasolta
  összevonásra** — a „HD Gatorshell 10'6""-t ráadásul a „Breeze Aero
  10'6""-ra, tehát még a modellcsalád is más volt. A moderátori sor helyesen
  elkapta őket, de hat hamis javaslat maradt volna benne. Új, KEMÉNY kizáró
  szabály (`constructionConflicts`): két deszka, amiről a forrás egyiknél
  felfújhatót, másiknál keményet állít, sosem lehet ugyanaz a katalógus-sor.
  Nem küszöb-hangolás — tény. `null` mellett nem zárunk ki semmit.
- **FEL NEM OLDOTT sablon-helyőrző a képben**: a HD Gatorshell lapján
  `<img src="{{ firstImageSrc }}">` állt, amiből abszolutizálás után
  `…/products/%7B%7B%20firstImageSrc%20%7D%7D&width=200` lett — szintaktikailag
  ÉRVÉNYES URL, ezért minden korábbi szűrőn átment. A `%7B%7B` alak azért is
  alattomos, mert a kapcsos zárójel a kódolás után nem látszik. A
  `displayImageUrl` mostantól elutasítja a Liquid/Handlebars/JS-sablonok
  jelöléseit, kódolva és nyersen egyaránt.

**A NEGYEDIK hiba a felhasználótól jött, és a legfontosabb volt: a spec-tábla
PLATFORM-tábla, nem kínálat.** „Ahogy én látom, a solid SUP-ok a BOTE-nál 5
deszkát fednek le és kettő van csomagban" — a kollekció-képernyőkép ezt
igazolta. A kemény ág lapjain a tábla a modellcsalád MINDEN méretét felsorolja,
a bolt viszont csak egyet árul belőlük:

| termék | ELADÓ méret | spec-tábla |
|---|---|---|
| Breeze Gatorshell | 10'6" | 10'6", **11'6"** |
| HD Gatorshell | 12' | **10'6"**, 12' |
| Rackham Gatorshell | 12' | 12', **14'** (a 14' saját URL-en) |
| WULF Aero / Breeze Aero | mindkettő | ugyanaz a kettő |

A vastagon szedett méretek NEM léteznek a boltban — kettő közülük már a
katalógusba is bekerült. A felfújható ágon a tábla és a kínálat EGYBEESETT,
ezért a hiba ott nem derült ki: egy forráson belül is kellett a másik ág, hogy
látszódjon. A kínálatot a variáns-választó mondja meg, ahol a méret PUSZTA
sorként áll (`10'6"`), míg a spec-fejléc mindig visel mellette valamit
(`10'6" Breeze Gatorshell`, `10′4″ Specs`) — és mert ugyanez a gomb-sor okozta
a hamis fejléceket is, a két jelenség ugyanannak a ténynek a két oldala. Ha
egyetlen puszta méret-sor sincs (JS-ből épülő választó), NEM szűrünk.

A javítás mellékhatásaként a méret-bontás EGY méretnél is lefut: a 12 és a 14
lábas „Rackham Gatorshell" külön termékoldalon él, mindkettő egyetlen kínált
mérettel, és a JSON-LD mindkettőt ugyanúgy nevezi — méret nélkül két azonos
nevű sor születne, 61 cm hosszkülönbséggel. Ezzel a többes számú URL kizárása
is FÖLÖSLEGESSÉ vált, és vissza lett véve: minden lap pontosan azt adja, amit
árul.

A két nem létező sor törölve (nem volt rajtuk vélemény és ár), a
`rackham-gatorshell-paddle-boards` visszavéve. **Végállapot: 15 deszka** —
11 felfújható + 4 kemény. A **Rackham Gatorshell APEX**-et a jóváhagyás
összevonta a 12 lábassal: a spec-je betűre ugyanaz, az eltérés (pedálhajtás)
pedig olyan tulajdonság, amire a katalógusnak nincs mezője — így lesz az 5
kemény termékből 4 katalógus-sor.

Mellékesen mérve: a `-gatorshell-` minta önmagában TÚL TÁG (a
`rover-gatorshell-micro-skiff` egy csónak), ezért az URL-minta a `paddle-board`
szegmenst is megköveteli; a NAGYBETŰS címkéket (`DIMENSIONS:`) és a láb-hüvelyk
közti szóközt (`10′ 6″ L`) a meglévő olvasó vitte, javítani nem kellett.

**F2.1-utó-56 — Galéria az egész katalógusra (2026-08-30).** Felhasználói
kérés a validálás előtt: „szeretnék legalább 3-5 képet mindegyikről". A
kiindulás: **273 deszkából 133-nak EGYETLEN galériaképe sem volt**, 27-nek
csak 1-2.

Az ok szerkezeti: a galéria eddig KÉT úton jöhetett — a Shopify
`/products.json`-ból és a cikkszám-horgonyból —, és a forrásaink fele egyiket
sem adja. A tiltás viszont továbbra is érvényes: a lap ÖSSZES képét begyűjteni
tilos, mert a „Related Products" blokk MÁS termékek fotóit is felkínálja.

A megoldás ugyanaz az elv, ami a kategóriánál (`categoryClass`) már bevált: a
recept megnevezi a gyártó SAJÁT kép-konténerét (`galleryClass`). A konténeren
BELÜL minden kép ezé a termékéé — ezt a gyártó DOM-ja garantálja, nem a mi
heurisztikánk. Mérve:

| forrás | konténer | kép |
|---|---|---|
| Gladiator | `product__main-gallery` | 6 |
| Zray | `w-bigimglist` | 5 |
| Fanatic | `thumbnails-carousel` | 5 |
| Starboard | `hdt-slider__container` | 3–4 |
| Aqua Marina Hungary | `page_artdet_altpic` | 5 |

Négy mért részlet, ami nélkül rossz lett volna:

- **Egy osztályt TÖBB elem is viselhet.** A Starboardnál a
  `hdt-slider__container` háromszor fordul elő: kétszer a variáns-bélyegek
  csíkjaként (2-2 kép), egyszer a termék galériájaként (8 kép). Az elsőt véve a
  galéria fele elveszne — a legtöbb képet adó nyer.
- **A konténert tag-MÉLYSÉG szerint kell kivágni**, nem karakter-ablakkal: egy
  slider tetszőlegesen mély, a fix ablak vagy levágná a végét, vagy átnyúlna a
  következő blokkba.
- **Ugyanaz a kép több alakban is szerepel**: `…/3469216.jpg` és
  `…/3469216.jpg?x-oss-process=image/resize,h_200,w_200` (Zray), illetve
  `…/AMB930068_altpic_1/AMB930068.jpg` és ugyanaz `…/80x52/…` alatt
  (aquamarinahungary). A képazonosság ezért a lekérdező rész NÉLKÜL és a
  `\d+x\d+` alakú méret-könyvtárakat kihagyva dől el.
- **Tág osztályt nem szabad megadni.** Az Indiana `gallery-placeholder`-e 8
  képet ad — köztük sapkát, ponchót és evezőt, mert az a kapcsolódó termékek
  területe is. Ott inkább maradjon kevesebb kép; a három Indiana-deszka a
  cikkszám-horgonyra marad.

**A GYÁRTÓ NEM MINDIG KÖZÖL ELEGET — a bolt pótolja.** Az aquamarina.com
modellenként 1-2 fotót ad (a 2026-os lapokon 3 életképet, a régebbieken
egyet sem), a magyar viszonteladó viszont ötöt (`_altpic_1..4`). A
`backfill-gallery` ezért MINDEN elbírált forrást végigpróbál a rangsor
szerint, nem áll meg az elsőnél: a gyártói oldal elsőbbsége nem jelentheti
azt, hogy az üres eredménye után feladjuk. Ez a 43 Aqua Marina deszkából
8-on segít — a többinek nincs bolti jelöltje.

## HOL TARTUNK — a katalógus-validálás (2026-08-31, folyamatban)

A felhasználó VÉGIGMEGY a moderációs soron (`/admin/katalogus`). A munkamenet:
jegyzetel a kártyák alján → a ragadós sávban egy gombbal átadja a köteget →
`list-notes` mutatja forrásonként → javítás → `list-notes --resolve`.

**Az első köteg (12 jegyzet) feldolgozva** — ld. F2.1-utó-57 alatt. Ami MÉG
NYITOTT, és csak akkor derül ki, ha valaki elolvassa:

1. **Red-evező névismétlés.** A `Kids Cruiser Tough 3pc Fibreglass Paddle
   Paddle Paddle` — a gyártó címe `… SUP Paddle | Red Paddle SUP Paddle`
   alakú, és a márkanév („Red") levágása után a „Paddle" háromszor marad. A
   hivatalos név a felhasználó szerint: „Cruiser Tough 3-Piece Adjustable
   Fibreglass SUP Paddle". KIEGÉSZÍTŐKNÉL jön elő, deszkánál nem — több példa
   kell hozzá, mielőtt szabályt írunk rá.
2. **Göndör idézőjel a Red-neveknél.** `12’0″ All Ride MSL` és `17’0″ XL Ride
   MSL` a `10'6"` alakkal szemben — a gyártó saját írásmódja a címben.
   Egységesítendő, ha zavar.
3. **`14'0" Sport+ MSL800`** (függő jelölt) a katalógusban lévő
   `14'0" Sport+ MSL 800`-hoz tartozik, de a szóköz hiánya miatt a
   duplikátum-őr nem köti össze — MODERÁTORI összefésülés kell.
4. **Kép-borítók.** 22 deszkán reklám- vagy csomagfotó a borító, ebből 15-höz
   van tisztább jelölt a galériában — de a csere NEM automatizálható (mérve:
   több „tisztább" jelölt rosszabb volt, pl. másik modell fotója vagy
   technológia-ábra). Az admin galéria-szerkesztőjében, kézzel.
5. **Galéria-visszatöltés.** Az újonnan jóváhagyott sorok egy képpel érkeznek;
   érdemes időnként `backfill-gallery --apply`-t futtatni.

**RUTIN minden nagyobb jóváhagyási kör után:**
`check-duplicates --fix` — ahogy új deszkák kerülnek be, újabb függő jelöltek
válhatnak „pár nélkülivé", és egy kattintás duplikátumot csinálna belőlük.

---

**F2.1-utó-57 — 20 duplikátum a katalógusból, és a forrásuk elzárva
(2026-08-31).** Felhasználói észrevétel: a rácsban kétszer szerepelt a
`BLADE Windsurf`. A keresés 18 további csoportot talált, **20 fölösleges
sorral** — zömmel Starboard (Whopper, GO, iGO, Generation, Touring), plusz a
Uone SPRINT (háromszor!) és az Aqua Marina BLADE. Egy párnál a két sor
UGYANAZT a slugot viselte, ami a slug egyediségét sérti.

**A párok mindenben egyeztek, EGYETLEN mezőt kivéve: a deszka súlyát**
(10,7 kontra 10,9 kg; 8,76 kontra 9,67). Ugyanaz a deszka a gyártó KÉT
modellévi termékoldaláról, ahol a közölt súly picit változott. A csoportok
kétharmadánál a név is csak `X` kontra `x` írásmódban tért el — a Starboard a
2024-es és a 2025-ös lapon másképp írja.

**A FORRÁS:** a jelölt `matched_board_id`-ja a CRAWL pillanatában fagy meg. Ha
a párja csak KÉSŐBB kerül a katalógusba (mert egy másik jelöltből épp akkor
hagytuk jóvá), a régi jelölt továbbra is „új típusként" áll a moderátor előtt,
és egy kattintás új sort csinál belőle. Az admin-felület itt nem véd: a
`matchedBoardLabel` a TÁROLT párt mutatja, a `findDuplicateHints` pedig
jelölt↔jelölt átfedést néz, nem jelölt↔élő deszkát. Élesben **11 függő jelölt
állt pontosan ebben a helyzetben**.

**A takarítás nem veszített adatot**: a gazdagabb sor maradt (több kitöltött
mező, majd több kép, majd a `-2` nélküli slug), a törlendő HIÁNYZÓ mezőit és
képeit pedig átvette — a meglévőt sosem írva felül.

Új őr: `check-duplicates` (`duplicates.ts`, tiszta modul + 9 teszt). Két
ellenőrzést végez — ami már bent van kétszer, és ami MOST hozna létre
duplikátumot —, a `--fix` pedig az utóbbi párját írja be. Katalógus-sort SOHA
nem töröl: az moderátori döntés.

**A NÉV-EGYEZÉS SZIGORÚ, és ez mérésen alapul.** A trigram-hasonlóság ehhez
kevés: élesben az `iCON 12'0" X 33" Deluxe` 82%-kal az `iGO 12'0" X 33"
Deluxe`-ra illeszkedett (MÁS modell), az `iGO … 11'2"` pedig a `10'8"`-ra. Egy
téves pár-javaslat rosszabb, mint a hiánya — a moderátor arra kattint rá.

**MEGOSZTOTT KÉPEK — felhasználói észrevétel: „több deszkához ugyanaz a kép
nagyon félrevezető".** Igaza volt, és a mérés két, gyökeresen eltérő esetet
talált: 273 deszkából 130 osztott legalább egy képet egy másikkal, de ebből

- **157 megosztás a MODELLCSALÁDON BELÜL marad** — a Starboard Whopper 11'0"
  és 9'0" ugyanazt a „Blue Carbon" fotót viseli. Ez NEM a kinyerés hibája: a
  gyártó SAJÁT variáns-képe is ez (a `/products.json` `variants[].image_id`-ja
  ugyanarra a képre mutat), mert a Starboard KIVITELENKÉNT fotóz, nem
  méretenként. Ilyen fotó nem létezik — a kivágás kevesebb képet adna, nem
  pontosabbat.
- **5 megosztás CSALÁDHATÁRT lép át**, és mind az öt valóban hibás: egy All
  Star fotója a Sprinten, egy közös marketing-GIF három BOTE-modellen, egy
  leash- és egy uszony-fotó két ISLE-deszkán, továbbá egy `vector-33.svg`
  SABLON-IKON két különböző márkánál.

A szabály ezért: a családhatáron átnyúló megosztás kiesik, a családon belüli
marad (`prune-shared-images`, `image-sharing.ts`). Kivétel, ha a FÁJLNÉV
megnevezi a gazdáját — az `…-All-star-3.jpg` az All Staré, hiába szerepel a
Sprint galériájában is. **A BORÍTÓHOZ nem nyúlunk**: ha a megosztott borítókat
is kivágnánk, 73 deszka maradna kép NÉLKÜL, ami rosszabb, mint egy családon
belül ismétlődő fotó. Az SVG mostantól sosem termékfotó.

**KÉT KÉPFORRÁS, AMI EDDIG KIMARADT.** A gyártó nem mindig közöl eleget
(aquamarina.com: modellenként 1-2 fotó), a bolt viszont igen — a
`backfill-gallery` ezért MINDEN elbírált forrást végigpróbál a rangsor
szerint, és **a bolti ÁR-SORT is képforrásnak veszi**: ha egy bolti termék a
crawl idején már ISMERT deszkára illeszkedett, jelölt-sor nem születik
(`refreshOnly`), a bolt URL-je viszont ott marad a `board_prices` sorban — és
az a lap tartalmazza a fotókat.

**F2.1-utó-55 — ISLE (islesurfandsup.com) bekötve, FEJETLEN bolttal
(2026-08-29).** Felhasználói lelet. Az eddigi LEGJOBB adatú forrásunk:
15 deszka, **mind a hat mezővel — űrtartalommal együtt** (`hossz ✓ · szél ✓ ·
vast ✓ · térf ✓ · súly ✓ · teher ✓`). Csak épp egyik adat sem ott volt, ahol
eddig kerestük.

- **A HTML egy React-váz.** A `/products.json` 404, a `htmlToText` a
  spec-ből SEMMIT nem lát: a teljes tábla egy `<script>`-be ágyazott
  API-válaszban áll, CSV-alakban (`"sizes":{"value":"Length,Width,Thick,…\n
  10'6\",34\",6\",…"}`). Az új `embedded.ts` ezt `címke: érték` SOROKKÁ
  alakítja, és a MEGLÉVŐ `parseSpecsFromText` elé fűzi — így minden korábbi
  tudás érvényben marad (font-átváltás, a `Complete Package Weight`
  csomag-kizárása, láb-hüvelyk olvasás), és nem született párhuzamos,
  karbantartandó második kinyerő.
- **A horgony nélkül némán ROSSZ deszkát adna.** Ugyanazon a lapon több ilyen
  CSV áll, a termékajánlóké is: az `explorer-pro-2` lapján HÁROM van, és az
  ELSŐ a szomszéd modellé (31,5" a 31" helyett). A `productBoxAccordionItems`
  kulcs oldalanként pontosan egyszer fordul elő — a recept ezt adja meg
  (`embeddedSpecAnchor`), találgatni nem szabad.
- **A „kayak" szó a kollekció FELÉT kizárta.** Hat deszka SUP–kajak HIBRID
  (`Switch Paddle Board Kayak Hybrid`, `Explorer Pro Hybrid SUP-Kayak…`) —
  deszkák, amikre ülés is tehető, a gyártó SUP-kollekciójából, hibátlan
  spec-blokkal. Ugyanez a szó vitte el korábban a BOTE LowRider Aero Tandemjét
  is. A kivétel szűk, és a `hasRigidClaim` „like"-kivételének alakját követi:
  a kajak-szó akkor nem kizáró, ha a termék KIMONDJA, hogy hibrid, ÉS
  deszkának is nevezi magát. A `flywater-micro-skiff-kayak` egyiket sem teszi,
  tehát változatlanul kiesik.
- **A CÍMKÉZETT `Type:` mező ÜT a szövegen.** MINDEN ISLE-termékoldal említi a
  kemény modelleket is, ezért a szöveg-alapú `detectInflatable` minden deszkára
  `null`-t adott volna. Az „Inflatable Hardboard" a gyártó konstrukció-neve a
  merevebb Pro-szériára — az FELFÚJHATÓ; a `Versa 2.0` az egyetlen valóban
  kemény (`Type: Hardboard`).
- **VEGYES TÖRT a méretben**: `4 1/2"` = 11,4 cm. Enélkül a hüvelyk-olvasó a
  NEVEZŐT vette értéknek (5,1 cm) — hihető szám, csendes hiba. A mintának az
  érték-ablak ELEJÉN kell állnia: szabadon eresztve a vastagság törtje a
  hosszba és a szélességbe is beszivárgott (11,4 × 11,4 × 11,4 cm).
- **`Ideal For: Long Distance Paddling`** — ugyanaz a használat, más szóval,
  mint a „touring". A kategória-felirat szótára ezzel bővült; egyúttal a
  KÉTSZER, szó szerint duplán álló szabálylista egyetlen közös konstanssá vált
  (egy bővítés eddig némán érinthette az egyiket és a másikat nem).
- **ELTÉRŐ KÖZÖLT ADAT = MÁS DESZKA.** A jóváhagyó összevonta az
  `Explorer Pro v1`-et az `Explorer Pro 2`-vel (azonos hossz, hasonló név) —
  pedig a gyártó 330 kontra 365 litert és 325 kontra 425 fontot ír. Ugyanez a
  `Switch` és a `Switch Pro`. Ahol mindkét jelölt közli ugyanazt a mezőt és 5%
  fölött eltér, ott nincs összevonás; a kerekítés és a font-átváltás belefér
  (élesben 1% alatt), a modellkülönbség nem (11% és 31%).

**HIBÁS GYÁRTÓI ADAT, amit nem javítunk ki**: a `Sportsman` hossza `11.6"` —
hüvelyk-jel láb helyett, ebből 29,5 cm lesz a valós 350 helyett (a saját
`switch-isup` lapján ugyanez a szám helyesen `11'6"`). A gyanú-jelzés két
indokkal is elkapta, és kivette a tömeges jóváhagyásból — moderátori döntés.

**A KÉPEK IS A BEÁGYAZOTT JSON-BÓL (2026-08-30, felhasználói kérésre).** A
`backfill-gallery` a `/products/<handle>.json` végpontra épült, ami itt 404 —
és a borítók sem voltak jók: **négy deszkáé egy ORSZÁGZÁSZLÓ-ikon** lett (a
pénznem-választóé), a többié életkép. Fejetlen boltnál a pozíció-fallback a
lapon TALÁLT első képet adja, a termékfotók viszont csak a beágyazott adatban
vannak.

A gyártó saját, rendezett képlistája ugyanabban a blokkban áll, közvetlenül a
spec ELŐTT — az `embeddedImageUrls` az UTOLSÓ `media.nodes`-t veszi a horgony
előtt (ami utána jön, az már az ajánlóké). Az első elem a borító, a többi a
galéria. Eredmény: **mind a 15 deszka valódi termékfotót és 8 képes galériát
kapott.**

Két járulékos tanulság:
- **A jóváhagyott jelöltet egy újracrawl szándékosan nem írja felül**, tehát a
  már katalógusba került sorok galériája nem onnan pótolható. A
  `backfill-gallery` ezért kapott egy második utat: ha a forrásnak van
  beágyazott-horgonya, a TERMÉKOLDALRÓL olvassa ki a listát.
- **A `flag-icons` útvonal sosem termékfotó** — a `displayImageUrl` mostantól
  elutasítja, hogy ez a csapda más forrásnál se jöhessen elő.

**A Sportsman hossza javítva** (felhasználói ellenőrzés: 11'6"). A
`verify-specs` a jelöltre írta és ZÁROLTA a mezőt; a következő crawl a
zárolást tiszteletben tartotta (a képeket frissítette, a hosszat nem), a
deszka pedig bekerült a katalógusba. A forrás továbbra is hibás adatot közöl,
ezért a crawl összefoglalója továbbra is gyanúsnak jelöli — az a NYERS
kinyerésről szól, nem a tárolt sorról.

**Amit MEGVIZSGÁLTUNK ÉS ELVETETTÜNK** (rendeljkinait.hu „2025 legjobb
termékei" cikk, felhasználói lelet): szponzorált, másodlagos kompiláció. Négy
ellenőrizhető modellből egy egyezett a saját, elsődleges forrásból mért
adatunkkal; **kettőnél 20 kg-mal TÚLBECSÜLTE a teherbírást** (Gladiator Elite
11,6: 220 kontra 200; Starboard iGO 10'8": 120 kontra 100), a Bestway Aqua
Journey-nél pedig 95 kg-ot ír a két független forrásunk egybehangzó 100-a
helyett. Épp az a mező, amire a Deszkaválasztó kemény biztonsági szűrőt épít.

**F2.1-utó-62 — modellévek: mikor egy sor, mikor kettő (2026-09-13).**
Moderátori kérdés a Starboard-soron: „ezek az évjáratok valódi dolgokban is
különböznek, vagy csak névben?" A válasz mérésből jött, és a feltevés
ellenkezőjét adta.

**126 Starboard-modell szerepel több modellévben.** Mezőnként összevetve, a
hüvelyk→cm átváltás kerekítési zaját LEVÁLASZTVA (`20` ⇄ `20,1` cm és
`14,2` ⇄ `14,22` kg nem termékváltozás — 40 ilyen eset volt):

| | |
|---|---|
| minden mérhető mező azonos | 65 |
| csak a HIÁNYZÓ adat tér el | 15 |
| **érdemben különbözik** | **46** |

Az eltérés ott sem kozmetikai: **tömeg 32 modellnél** (10,1 → 9,3 kg),
**TEHERBÍRÁS 15-nél** (85 → 120, 155 → 115, 90 → 70 kg), **vastagság 5-nél**
(15 → 12 cm, azaz 6" helyett 4,75" — áttervezés). A teherbírás BIZTONSÁGI
mező: a modellévek vak összevonása ugyanaz a hiba lett volna, mint a
kiviteleké, csak súlyosabb — egy 70 kg-os deszka 90-esként jelent volna meg.

**FELHASZNÁLÓI DÖNTÉS**: „mivel korábbi évjáratokat is nézhetnek a használók",
ahol SEMMI különbség nincs, ott EGY sor áll, és a felirat kötőjellel felsorolja
az összes évjáratot (`2024-2025`) — így a vevő látja, hogy azok között nincs
eltérés. Ahol van, ott évjáratonként külön sor marad a saját adatával.

Ehhez új oszlop (`20260717099500`): **`model_years int[]`**. A `model_year`
EGYETLEN szám marad, mert a Deszkaválasztó frissesség-pontozása azzal számol —
az összevont sornál ez a legfrissebb év. A felirat a `model-years.ts`
`modelYearLabel`-jéből jön, és HÁROM helyen kell: a moderációs
merge-legördülőn, a publikus deszka-kártyán és az adatlapon — ezért nem a
`.server.ts`-ben él. A felirat NEM rövidít tartományt: a hiányzó közbenső évet
nem hidalja át, mert az olyat állítana, amit nem mértünk.

**A MODELLNÉV NEM VISELI AZ ÉVET.** Egy forrása van az igazságnak: a nevet a
gyártói cím adja, az évjáratot a `model_years`. A két külön sor slugja
különbözik (`…-asap-2024`), a nevük azonos, és a felirat különbözteti meg őket.

**AMIT A FELIRAT HIÁNYA OKOZOTT.** A merge-legördülő eddig `Márka Modellnév`
volt, évjárat nélkül — a moderátor tehát a döntés pillanatában azonos feliratot
látott a kártya címén ÉS a felkínált merge-célponton, vagyis a „Jóváhagyás — új
deszka" és az „Összefésülés" ugyanarra a névre mutatott. Így keletkezett két
duplikátum-pár (`Whopper 10'0" X 34" Lite Tech` és `Blue Carbon`). Az évjárat
most ott van a feliratban.

**VISSZAÁLLÍTVA**: az F2.1-utó-61-ben összevont `Whopper 10'0" X 34" ASAP` és
`Rhino` 2024-es sora újra létezik — mindkettőnél a teherbírás 110 ⇄ 120 kg, ami
a mostani szabály szerint érdemi eltérés. Az adat a jelöltek `extracted`
mezőjéből jött vissza; ez a befagyás egyszer végre javunkra vált.

**F2.1-utó-61 — Zray-névszabvány, Starboard-kivitelek, és a moderátor által
LÁTOTT adat (2026-09-08…09-11).** A felhasználó végigvitte a Zray sorát; 15
jegyzet érkezett három forrásból.

**A FELÜLET HAZUDOTT — ez szülte a jegyzetek harmadát.** Három jegyzet arról
szólt, hogy „a hossz nem lehet 396 cm" és „max terhelés 150 kg egy pumpánál?",
miközben az élő sorokra ekkor MÁR `null` ment: az F2.1-utó-60 óta a jóváhagyás
leszedi a kiegészítőkről a deszka-mezőket. A kártya viszont a jelölt `extracted`
mezőjét rajzolta ki, ami a CRAWL IDEJÉN fagyott be — a moderátor tehát olyan
adatról írt jegyzetet, ami sosem került volna be. A szűrő ezért kiköltözött egy
közös modul-fájlba (`catalog/accessory-specs.ts`), amit a `.server.ts` ÉS a
kártya is használ. Tanulság a visszacsatornáról: **ha a javítás csak az írási
ágon áll, a moderátori sor tovább termeli a fantom-jegyzeteket.**

**A STARBOARD-UTÓTAG NEM SZÍN, HANEM KIVITEL.** A felhasználói feltevés szerint
„a modellek és méretek egyezésekor az utótag csak színbeli eltérést jelent". A
gyártó saját `/products.json`-ja megcáfolta: a variáns-tengely neve `Construction`
(`Blue Carbon`, `Starlite`, `Lite Tech`, `ASAP`, `Rhino`), és ugyanazon a
304,8 × 86,4 cm-es, 172 literes hajótesten **10,1 – 11,9 kg** a szórás. Az
összevonás öt deszkából egyet csinált volna, és eltüntette volna a márka fő
ár-differenciálóját — ezért a kivitelek MARADTAK.

A jegyzetek viszont valós hibát fogtak, csak más okból: mind a három pár
**azonos modell + méret + kivitel, két MODELLÉVBŐL** (`Whopper 10'0" X 34"
ASAP` 2024 és 2025). A modellnév nem viseli az évet, ezért ütköztek. Két élő
pár összevonva (a 2025-ös maradt, nála megvan a 172 l; a `Rhino`-nál ez egy
13,2 → 11,9 kg-os adatjavítás is), a jelölt-hivatkozások átmutattak.

**MIÉRT NEM SZÓLT A FELÜLET**: a duplikátum-gyanú `if (a.sourceId === b.sourceId)
continue`-val ÁTUGROTTA az azonos forrásból jövő párokat — a jelzés két BOLT
fedő katalógusára készült (F2.1-utó-8). A gyártó viszont maga is háromszor adja
ugyanazt a deszkát: `2024-`, `2025-` és `2026-` termékoldalon. Azonos forráson
belül mostantól is jelez, de csak TELJES névazonosságnál — a modellnév a
méretet és a kivitelt is viseli, így a `Whopper 10'0"` ⇄ `Whopper 11'0"` nem
kerülhet össze. Ez 21 fölösleges pending jelöltet is megjelöl. A régi teszt
épp a megcáfolt feltevést rögzítette („a crawler már véd a saját duplikátumai
ellen"); átírva a mért viselkedésre.

**ZRAY: A GYÁRTÓI CÍM MÁR A KÍVÁNT NÉV VOLT.** Hat jegyzet kérte a
`Max Canary 11'6 - M2-B` alakot — és a nyers `<title>` pontosan ez. A
`cleanModelName` rontotta el két lépésben: levágta a méretet, majd a kötőjelet
szóközre cserélte (`Max Canary M2 B`). A Zraynál viszont a TÍPUSKÓD azonosít
(ugyanaz a modellnév két méretben és két kódon fut), tehát egyik sem zaj itt.
Új forrás-szintű kapcsoló: `titleKeepHyphen` (a `titleKeepSize` párja).

A kötőjel KÉT dolgot jelöl, és meg kell különböztetni őket: amelyiknek van
szóköz legalább az egyik oldalán, az ELVÁLASZTÓ (` - `), amelyiknek egyik
oldalán sincs, az a név/kód része (`M2-B`, `X-RIDER`). Enélkül `M2 - B` lett
volna.

**A GYÁRTÓ NÉGYFÉLEKÉPPEN ÍRJA UGYANAZT**: `10'10" - X2`, `10'10'' -- X2`,
`10 '2"`, `11' 8"- F4-A`. A `titleKeepSize` mellett ezekből NÉGY KÜLÖNBÖZŐ
modellnév lett volna egyetlen deszkára, ezért a méret-írásmód egységesítése a
kapcsolóval együtt kellett: kettős aposztróf → hüvelyk-jel, szóköz a szám és a
láb-jel közül, szóköz a láb és a hüvelyk közül, több kötőjel → egy. A `”`-t
SZÁNDÉKOSAN nem írjuk át: az már érvényes jel, és az átírása az Aqua Marina
bevált nevét változtatta meg (regressziós teszt fogta meg).

Eredmény: 54 élő sor átnevezve + slug, 0 ütközéssel; a művelet idempotens.

**A `boards.slug` MOSTANTÓL EGYEDI** (`20260717099400`). A migráció indoklása a
fájlban; élesben ellenőrizve, hogy a dupla beszúrást az adatbázis utasítja el
(`23505 … boards_slug_hu_unique_idx`). Előfeltételként a `zray-vigour-airmat`
árva ikersora törölve (felhasználói döntés).

**A FELHASZNÁLÓ VISSZAVONTA A SZÍN-FELTEVÉST (2026-09-11), a gyártó saját
spec-táblája alapján.** A `TALLTWIN` táblázatán látszik, hogy a kivitel nem
csak tömegben tér el: MÁS a fin box és az uszonykészlet is (`Carbon Reflex:
1 × FCSII Center` kontra `Xtec Carbon: 1 × Surf Box Center`). Rögzítve:
**a Starboard-kiviteleket SOHA nem vonjuk össze.** A duplikátum-jelzés ezt
szerkezetileg nem is tudja: azonos forráson belül TELJES névazonosságot kér, a
kivitel pedig a modellnév része.

**EGY MEZŐ HIÁNYA majdnem rossz katalógus-döntést okozott.** A moderációs
kártya a hosszat, szélességet, vastagságot, térfogatot, teherbírást és évjáratot
mutatta — ezek a Whopper mind a hat kivitelén AZONOSAK. A tömeg, az egyetlen
eltérő mező (10,1 – 11,9 kg a 10'0" × 34"-en), nem volt a kártyán. A moderátor
ezért jogosan látta ugyanannak a hat deszkát. A `spec.weight` kulcs létezett,
csak a kártya nem használta.

### NYITOTT SZÁLAK a következő munkamenetnek

- **`Whopper 10'0" X 34" Rhino`: a 2024-es lap 13,2 kg-ot adott, a 2025-ös és a
  2026-os 11,9/11,85-öt.** A modellév-összevonáskor a 2025-ös maradt. A 13,2
  vélhetően kinyerési hiba, nem termékváltozás: ugyanarról a 2024-es lapról a
  TÉRFOGAT is hiányzott, a Shopify-variánsok súlya pedig mindenhol `0` (a
  spec-táblát JS tölti). Ha kiderül, hogy valós, a jelölt `extracted` mezője
  megőrizte az adatot, tehát a sor visszaállítható.
- **A `VIGOUR AIRMAT` besorolása nyitva** (felhasználói döntés: „egyelőre
  semmi"). Az `airmat` 2026-08-22 óta a „sosem deszka" listán van, ez a jelölt
  viszont 08-20-án került be, és a besorolása a crawl idején befagyott.
- **21 pending Starboard jelölt** modellév-duplikátum; a felületen mostantól
  meg vannak jelölve, az összevonás moderátori döntés. A tömeges jóváhagyó nem
  tudja rendezni őket: mind a 82 pending fennakad hiányzó biztonsági mezőn.
- A 2026-09-11-i Zray-crawl hat lapon hálózati hibával elszállt (`fetch
  failed`, `This operation was aborted`), és a `last_crawled_at` frissítése sem
  ment át — a forrás erősen korlátoz.
- Egy élő Zray-sorhoz nem tartozik jelölt, ezért az átnevezés kihagyta.

**F2.1-utó-60 — Jobe-validálás: színváltozat, hírrovat, evező — és a
kiegészítőkre szivárgott deszka-méret (2026-09-06).** A felhasználó a Jobe
sorát végigvitte (7 jegyzet), közben pedig jóváhagyott egy Zray pumpa-adaptert,
aminek „nem stimmelt a hossza". A kettő független, de mindkettő ugyanazt a
mintát mutatja: a besorolás védelme önmagában kevés, ha a hamis adat utána is
rajta marad a soron.

**A ZRAY-ADAPTER: 396 cm „hosszú" pumpa.** A gyártó kiegészítő-oldalain nincs
saját spec-blokk, a „Related Products" viszont deszkákat sorol fel
(`X-RIDER XL 13' - X5 … 13' x 36" x 6"`) — és 13' = 396,2 cm, 30" = 76,2 cm.
Ezt a szivárgást 2026-08-20-ban MÁR MEGFOGTUK, de csak félig: a
`classifyProduct` geometriai rövidzára helyesen KIEGÉSZÍTŐNEK sorolta be a
pumpát (nem lett belőle hamis deszka), a szomszéd deszka mérete viszont
ott maradt a jelölt `specs` mezőjében, és a jóváhagyás beírta a
`boards.length_cm`-be. **A besorolás helyes volt, az adat nem** — a moderátor
a soron egy hihető méretet látott, és leokézta.

Az új `stripBoardOnlySpecs` ezt a felet zárja le: ha a termék nem deszka, a
deszka-szabályokkal olvasott méret nem róla szól. A vágás KÉTSZINTŰ, mert a
kiegészítőnek is van valódi mérete (Jobe `SUP Pump 12V`: 29,5 × 13,5 × 16 cm —
ez a pumpa doboza, jó adat):

* a **térfogat és a teherbírás** deszka-fogalom, kiegészítőn sosem értelmes →
  mindig kiesik (innen jött a „150 kg teherbírású pumpa" is);
* a **méret-hármas** csak akkor, ha bármelyik tagja eléri a `BOARD_LENGTH_MIN_CM`
  (240 cm) határt: egy KÖVETETT kiegészítő (evező, mentőmellény, pumpa) sosem
  2,4 m-es. Mindhárom tag megy, mert ugyanabból a félreolvasott hármasból jön.

**A KAPU KÉT HELYEN ÁLL**, és ez nem óvatoskodás: a jelölt `extracted` mezője a
CRAWL IDEJÉN fagy be, tehát a figyelő-oldali javítás a MÁR SORBAN ÁLLÓ
jelölteken nem segít. Ezért a jóváhagyási ág (`approve.ts` és a modul
`candidates.server.ts`-e) is átereszti rajta a specs-et. A modul-szerződés
miatt a modul nem importálhat a `tools/`-ból, ezért ott a függvény és a 240-es
küszöb szándékosan duplán szerepel.

Adatoldalon: a `Air Pump Adaptor` 396 × 396-ja és a `Double Action Air Pump`
150 kg-ja törölve. A két 76 cm-es „hossz" (`Double Action`, `Portable Electric`)
az általános szabályon ÁTMENT volna — 76 cm hihető egy pumpánál —, de a Zraynál
tudjuk, hogy a kiegészítő-lapokon egyáltalán nincs saját adat, tehát az is a
szomszéd deszka 30"-ja: külön, forrás-ismereten alapuló javítással törölve.

**JOBE — a 7 jegyzet négy csoportban.**

*Színváltozat (4 jegyzet).* A Jobe címsablonja `… Package <Szín>`, és ugyanaz a
deszka két-három színnel is szerepel a sitemapben (`Aero Yarra … Package Purple`
és `… Package Steel Blue`). A szín a `titleNoiseWords`-be került — SORREND
SZÁMÍT, a „steel blue" a „blue" ELŐTT áll, különben árva „Steel" maradna a
névben. A moderátor a párokat már összefésülte (mindkét pár ugyanarra a
`matched_board_id`-ra mutat), így csak az élő sorok átnevezése maradt:
`Aero Duna Board 11.6 Purple` → `Aero Duna Board 11.6`,
`Aero Yarra Board 10.6 Steel Blue` → `Aero Yarra Board 10.6`, slugostul.
A `boards.colors` mező továbbra is nyitott tétel — addig a szín a névből kimarad.

*Hírrovat termékként.* A `/en/newsflash/introducing-the-sup-concept-series-3019/`
a `-sup-` befoglaló mintára illeszkedett, és a cikk prózájából 23 cm „hossz"
lett. Egy cikk sosem termék: `excludeUrlPatterns: ["/newsflash/"]`, ami erősebb
a befoglaló mintánál. A bejárás 81 URL-re szűkült.

*Evező deszkaként.* A `Jobe Freedom Stick SUP Paddle Kids` `kids` DESZKAKÉNT
jött be, 137 × 18 cm „mérettel". A csupasz „paddle" szándékosan nincs a
kiegészítő-kulcsszavak közt — a „paddle board" is tartalmazza, és MÁRKANÉV is
lehet (`Red Paddle Co`) —, a `sup paddle` viszont a gyártók evező-címeinek
állandó fordulata. Ezért az `evezo` szabály mostantól regexet is elbír:
`/sup paddle(?!\s?board)/`. A negatív előretekintés az `Inflatable SUP Paddle
Board` alakot zárja ki, ami deszka. **Az újracrawl 15 evező-jelöltet hozott be**
(Stream Carbon, Fusion Stick, Bamboo Classic…) — ezek eddig hiányoztak a
felszerelés-ágból.

*Csomag-változat.* A `Mohaka 10.2 + Sail 3.5 m2` már helyesen ugyanarra a
deszkára van fésülve, mint a `Mohaka 10.2` — a jegyzet megerősítés, nincs teendő.

### NYITOTT SZÁLAK a következő munkamenetnek

- **Két `Jobe Pump 12V` élő sor AZONOS sluggal** (`jobe-pump-12v`, mindkettő
  2026-09-06). A `resolveUniqueSlug` ezt megelőzné, tehát vagy egyidejű
  jóváhagyás, vagy két külön termék-URL ugyanarra a pumpára. Törlés =
  moderátori döntés.
- **A `check-duplicates` a KIEGÉSZÍTŐKET nem nézi** — a fenti azonos slugú párt
  nem jelentette. A deszka-ág duplikátumait viszont igen (`WIND 11.6`,
  `ORIGIN 12.6S`, `Manta Ray 10'`).
- **A `list-notes --resolve` mindent lezár, szűrni nem lehet.** A Jobe-köteg
  ezért célzott frissítéssel lett készre jelölve, hogy a -59 kör valódi nyitott
  szálai (FunWater `Manta Ray`, Red szörf-SUP, Aquatone `SUPERPUMP V2`) a listán
  maradjanak. Ha ez ismétlődik, a parancs megérdemel egy `--source` kapcsolót.
- A `Paddle Float Support` `evezo`-ként jött be — evező-úszó, valójában más
  kategória. Moderátori döntés.

**F2.1-utó-59 — validálási kör: névszabvány, geometriai kapu, slugok
(2026-09-01…09-06).** A felhasználó három kötegben adott át összesen 23
moderátori jegyzetet. Amit a feldolgozásuk hozott:

**A NÉVSZABVÁNY, és miért nem tartalmazza a márkát.** A moderációs felület és
a kártya is `márka + modellnév`-et fűz össze (`admin.katalogus.tsx`,
`BoardCard.tsx`), ezért a jegyzetekben látott teljes név (`Funwater Mariner
10'6"`) NEM a `model_name`-be megy — különben duplázódna a márka. A tárolt
alak: FunWaternél `<modell> <hossz>` (`Mariner 10'6"`), ROC-nál és Rednél
`<hossz> <modell>` (`10'6" Kahuna`, `10'6" Ride MSL`). Átnevezve 32 + 3 élő
sor és 39 függő jelölt.

**A KÖTŐJEL-JAVÍTÁS EGY MÁSIK GYÁRTÓT IS MEGJAVÍTOTT.** A `350-pound` miatt
bevezetett `[\s-]*` a FunWater `Mariner` szélességét is helyretette: a lap
prózája `Its 33-inch width…`, és a kötőjel hiányában a parser a címke MÖGÖTTI
`10'6"`-ot vette, amiből 320 cm SZÉLES deszka lett (a hossz értéke). Ez a
fajta hiba csendes: minden más mező hihető marad mellette.

**GEOMETRIAILAG LEHETETLEN KERESZTMETSZET ELDOBÁSA** (`dropImpossibleCross-
Section`). Élesben (FunWater `Zone 11'`) a gyártó a SAJÁT spec-táblájában írja
`Dimensions: 11'×30'×6'` alakban — láb-jelet mindhárom tagon, holott a
szélesség és a vastagság hüvelyk. Ebből 335 × 914 × 183 cm lett. Kijavítani
helyette nem szabad (találgatás volna), de LEHETETLEN értéket tárolni sem: a
Deszkaválasztó a szélességre stabilitást számol. Ha a szélesség eléri a
hosszt, a szélesség ÉS a vastagság is kiesik — mindkettő ugyanabból a
félreolvasott hármasból jön. Őrszem: csak HIHETŐ hossz mellett dönt, különben
a fordított esetet (`Its 12" length` = 30 cm egy 86 cm széles deszkán)
rontaná el. A 45 függő FunWater-sorból egyet sem érintett a Zone-on kívül.

**„EZ NEM SUP, EZ SÁTOR."** A `tent`, `gift box` és `magnetic cup` bekerült a
`NEVER_BOARD_KEYWORDS`-be. Az ok tanulságos: a sátor 580 × 440 × 205
méret-hármasa ÖNMAGÁBAN ELLENTMONDÁSMENTES (a hossz a legnagyobb), ezért a
geometriai rövidzár átengedte — a nevén kívül semmi nem árulta el.

**AQUATONE: nem duplikátum, hanem MÉRET.** A „miért van ebből kettő?" kérdésre
a válasz: a `WAVE` és a `WAVE PLUS` két-két külön MÉRET (320/305 és 366/335
cm), az Aquatone `<title>`-je viszont puszta modellnév méret nélkül. A
`titleKeepSize` itt NEM segít (a címben nincs méret); a nevekbe kézzel került
be a hossz. Valódi duplikátum csak a `SUPERPUMP V2` (kétszer, azonos adattal).

**SLUG-ÚJRAGENERÁLÁS.** 50 slug újraszámolva a `slugify(márka + modellnév)`
szabállyal — ugyanaz, amit a jóváhagyás használ. Menet közben 11
Starboard-sorról lejött az árva `-2` utótag: azok a duplikátum miatt kaptak
sorszámot, a duplikátumot viszont azóta összevonták. A művelet idempotens (a
második futtatás 0 változást javasol).

**A SZÍNVÁLTOZAT-KÉRDÉS: a mérés cáfolta a feltevést.** A felhasználó úgy
látta, hogy a FunWater külön termékoldalon listázza a színváltozatokat. Mind a
39 függő lap `Color` mezőjét kigyűjtve kiderült, hogy **a színek EGY lapon
belül állnak** (`Courage 10'6"`: 7 szín, `Camouflage 10'`: 5, `Manta Ray 10'`:
4). A külön oldalak tehát nem egymás színváltozatai. A valódi szerkezet más:
a FunWater TÖBB ALMÁRKÁT forgalmaz — a spec-tábla `Brand` mezője hol
`Feath-R-Lite`, hol `Tuxedo Sailor` —, ezért van ugyanazon a 320 × 83,8
hajótesten 8,7 és 12,5 kg-os deszka is.

**EGY MODERÁTORI JEGYZET TÉVEDETT, és a mérés a fordítottját adta.** A jegyzet
szerint „a gyártói oldal csak Funwater Tiki 10'6"-ként nevezi" az `Ocean
Tiki`-t. A gyártói `<title>` viszont szó szerint `Ocean Tiki 10'6" Stand Up
Paddle Board`; a MÁSIK deszka az, amit a gyártó `New Tiki 10'6"`-nak hív
(`…-tiki-deepblue-…`). Az átnevezés két külön deszkát olvasztott volna egy
névre (320×81, 8,6 kg, 127 kg kontra 320×84, 12,5 kg, 150 kg), és a slug is
ütközött volna. Az `Ocean Tiki` maradt, a `Tiki 10'6"` lett `New Tiki 10'6"`.

### NYITOTT SZÁLAK a következő munkamenetnek

- **`Manta Ray 10'` KÉTSZER szerepel élő sorként, azonos néven**
  (`funwater-manta-ray-10`: 32" széles, 10 kg · `funwater-manta-ray-10-2`:
  31", 10,25 kg). A gyártó két külön oldalon árulja; a 3%-os eltérés a dedupe
  5%-os küszöbe ALATT van, tehát összevonhatók — moderátori döntés.
- **Összevonásra váró FunWater-hármas** (azonos hajótest, súly ÉS teherbírás):
  `New Tiki 10'6"` + `Tiki Blue 10'6"` + `Courage 10'6"`; továbbá
  `Azure Glide 10'` + `Rainbow Snake 10'`.
- **Red `8'10" Compact MSL Pact`**: szörf-SUP, ilyen `board_type` nincs
  (`allround · touring · race · yoga · kids · fishing · river`). Felhasználói
  döntés szerint EGYELŐRE besorolatlan marad.
- **`Aquatone SUPERPUMP V2` kétszer** — valódi duplikátum, összevonandó.
- **`Sunstream All Around for Beginners…`** új FunWater-jelölt teherbírás
  nélkül; a lapja JS-ből rendeli a spec-rácsot.
- A 2026-09-03-i FunWater-crawl ~6 lapon `fetch failed`-del elszállt (Falcon,
  Manta Cruise, Blue Cruise, …) — azok a sorok a korábbi adatukkal maradtak.
  A skill szabálya szerint ez „először töltsd le újra" eset.
- A `boards.colors` mező továbbra is nyitott fejlesztési tétel.

**F2.1-utó-58 — ROC Outdoors bekötve, és a SOROZAT-SZINTŰ leírás
(2026-09-01).** Felhasználói lelet: „a leírás sorozatonként van megadva
általános szövegben". Pontosan így van, és ez a forrás fő tanulsága.

A gyártó a sorozat minden tagját ugyanabban a méretben árulja, csak a színük
tér el, ezért a specifikációt EGYSZER írja le — a kollekció leírásában:
„The Explorer series boards … are 10' tall, 32 inches wide with a **weight
capacity of 350 pounds**". A `10' Explorer` termékoldalának TELJES HTML-jében
a `capacity` szó ELŐ SEM FORDUL, a négy `10' Scout` színváltozat lapjáról
pedig még a VASTAGSÁG is hiányzik. Teherbírás nélkül a deszka a moderációs
sorban ragad és a Deszkaválasztó sem ajánlja — vagyis a gyártó KÖZLI az
adatot, csak nem ott, ahol kerestük.

Erre való az új `seriesTextByUrl` (`series-text.ts`): termék-URL-részlet → a
sorozat leírását adó cím. A szöveg a termékoldalé UTÁN kerül, tehát csak a MÉG
ÜRES mezőket tölti; egy sorozat leírását a bejárás EGYSZER kéri le.

**A kollekció HTML-LAPJA erre alkalmatlan** — ez a mechanizmus alakját
meghatározó mérés. Ugyanazon a lapon ott áll a TÖBBI sorozat leírása is (az
Explorer lapján a Scout „10' tall, 33 inches wide" mondata), tehát a
hozzáfűzés a SZOMSZÉD sorozat méretét szórná be. A cím ezért a Shopify
`/collections/<slug>.json`: egyetlen kérés, pontosan egy `description`.
Ugyanez a mérés mondta meg, mire NE indítsunk kérést: a ROC hat sorozatából
csak három leírása mond többet a termékoldalnál, a `cruiser-series`-nek nincs
is leírása.

**SPEC-TÁBLA EGYÁLTALÁN NINCS.** A méret a leírás egyetlen mondatában áll,
MELLÉKNÉVI alakban, az érték a címkéje ELŐTT: `At 10' tall, 32" wide, and 6"
thick`. A `wide` már címke volt, a `tall`/`long`/`thick` nem — **mind a hat
modellnél hiányzott a HOSSZ**, ami kizáró mező: a forrás nulla terméket adott
volna. A `thick` puszta címkeként viszont továbbra is TILOS (elrontja a
Jobe-t, ahol a próza a deckpad ANYAGÁRÓL ír, `5mm thick`), ezért nem
szóválasztás, hanem ALAKZAT védi: a hossz és a szélesség tagjának egymás
után, ebben a sorrendben, egy mondatnyi távolságon belül kell állnia, és a
hossz nem lehet kisebb a szélességnél. Árva `5mm thick` sosem indítja el a
láncot; a vastagság tagja opcionális (az Abyss mondata pár, nem hármas).

Két kisebb, mért javítás:
- **A KÖTŐJEL is elválasztó a szám és az egysége között**: `with a 350-pound
  weight capacity`. A `\s*` ezt nem fogta, a mező NÉMÁN üresen maradt.
- **A GYIK ellentmondhat a spec-rácsnak.** Amikor a specifikusabb `weight
  capacity` címke ELŐRE került a needle-listán, a FunWater Island Explorerénél
  a GYIK „up to **420 lbs**"-e ütötte a gyártó saját rácsának `Capacity
  350LBS`-ét. A fixtúra-háló azonnal megfogta; a szerkesztett rács ÜT a
  prózán, tehát a rács címkéje maradt elöl.

**Eredmény:** 14 URL · 14 termék · 14 új jelölt · `hossz ✓ · szél ✓ ·
vast 13/14 · térf n.a. · súly 0/14 · teher 7/14`. Hat modell: Explorer (10'),
Kahuna, Cruiser, Horizon, Abyss Coastline (10'6"), Scout (10'). A Horizon 6, a
Scout 4 SZÍNVÁLTOZATA külön termékoldal, azonos speckel — összefésülés a
moderátoré (a `boards.colors` mező még nyitott tétel).

**A három hiány három KÜLÖNBÖZŐ eset** — és ezt szét kell tartani:
- **űrtartalom:** a gyártó sehol nem közli → `unpublishedFields`, deklarálva;
- **teherbírás a Cruisernél és a hat Horizonnál:** a `cruiser-series`-nek
  nincs leírása, a `horizon-series`-é a teherbírást kihagyja, a termékoldalukon
  sincs. Ez NEM `unpublishedFields`: a márka a másik négy modellnél KÖZLI
  (350 pounds), tehát forrás-szintű hiányként deklarálni hazugság lenne — a
  `teher 7/14` a helyes, moderátori döntést kérő állapot;
- **súly:** közli (18 pounds), de két különböző prózai fordulatban („each
  board weighs only…", „lightweight at just…"). Mintát írni rá találgatás
  lenne.

A fixtúra-háló ezzel a sorozat-szöveget is menti (`<slug>.series.txt.gz`) —
enélkül a ROC fixtúrája a TEHERBÍRÁS NÉLKÜLI kinyerést rögzítené elvárásként,
vagyis épp azt a hiányt betonozná be, ami miatt a mechanizmus megszületett.

**A `Kezdők_tanácsok/nepszeru_sup_markak_es_forgalmazok.md` mind a 12 márkája
be van kötve** (+ az Indiana, az Uone és három bolt a táblázaton kívül).

**F2.5-utó — a vízlista 4-ről 10-re, és hét új spot (2026-08-29).** A
felhasználó kérésére felkutattuk, hol lehet még SUP-ozni és milyen szabállyal
(`docs/VIZTESTEK_KUTATAS.md`). A kutatás fő eredménye nem egy-egy szabály,
hanem a RENDEZŐELV: melyik jogi rétegbe esik a víz.

1. **Víziút-e?** A `17/2002. (III. 7.) KöViM r.` 3. sz. melléklete dönti el —
   ott a Hajózási Szabályzat él, tehát mentőmellény vagy leash. Az **RSD
   (58–0 fkm)** és a **Hármas-Körös (91–0 fkm)** is víziút; a Rába, a Maros és
   a kisebb tavak nem.
2. **Fürdőeszköz-réteg** (`46/2001. BM r.`) — szó szerint kiolvasva.
3. **Helyi réteg** — nemzeti parki engedély, önkormányzati rend, horgászrend.

Két ponton pontosította a meglévő tartalmat: a viharjelző szolgálat **NÉGY
vízen** működik (Balaton, Velencei-tó, Tisza-tó, Fertő tó — `4. § (1)`), és a
Velencei-tóra a jogszabály **nem ad általános parttávolság-korlátot** (az
„500 méter" ott az I. fokú viharjelzés tilalma).

Új oldalak: **RSD · Hármas-Körös · Velencei-tó · Fertő tó · Szigetköz · Orfű.**
A megosztott jogi lista negyedik tétellel bővült (17/2002. KöViM r.). Az Orfű
`legalBasis: false` — ott nem a Hajózási Szabályzat a kiindulópont.

**Hét új spot, migrációban élesítve** (`20260717092900`, `--include-all`-lal,
mert a GDPR-migráció sorszáma elé esik): Ráckeve (Ráckevei-Duna) ·
Gyomaendrőd (Hármas-Körös) · Szarvas (Holt-Körös) · Körös-torok (Csongrád) ·
Fadd-Dombori (Holt-Duna) · Gyékényesi-tó · Szentendre (Szentendrei-Duna).
Élesben verifikálva: **22 spot**, mind renderel, a szabályoldal-link jó.
A vízmérce csak Gyomaendrődhöz került (2756 „Gyoma", KF 550/650/750) — a
Ráckeve és a Szentendre mérce jó folyón van, de NINCSENEK készültségi
szintjei, és a `pickRiverAlertLevel` ilyenkor konstans 0-t adna, azaz „nincs
készültség"-et állítana ott, ahol nem tudjuk.

**Javítás:** az „Orfűi-tó" spot valójában a PÉCSI-TAVON van, és a SUP-os víz
is az — az Orfűi-tavon a horgászrend minden vízi járművet tilt. Átnevezve
„Orfű (Pécsi-tó)"-ra, slugostul (biztonságos, mert az oldal még nem publikus).

Új regressziós háló: `waterinfo.test.ts` — a spot→víz leképezés név-alapú ága
SORRENDFÜGGŐ („Ráckevei-Duna" ⊃ „Duna"), ezt teszt őrzi.

**Nyitva maradt** (a kutatás záró szakasza sorolja): az Orfűi-tó rekreációs
SUP-ja, a Pécsi-tó hivatalos szabályzata, a Dráva, a Deseda, a Szelidi-tó és a
gemenci engedélyeztetés menete. Bizonytalan tény nem kerül ki az oldalra.

**Nyitott kis tételek (nem blokkolók):**
- **Advisor ár-padló** (domain-review 2.5): NEM ár-büntetés kell, hanem
  rendeltetés-jelzés („alkalmi, strandolós használatra jó"), a küszöb pedig a
  katalógus saját ár-eloszlásából — ezért vár a katalógus bővülésére.
- **Kezdő → felfújható preferencia** (2.7): ma nulla hatású (20/20 felfújható).
- **MapLibre null-warning**: külső stílus-kifejezésből jön, nem a mi kódunkból.
- **Snyk nincs bekötve** (F1.10-04): fiók-hitelesítés kell, felhasználói döntés.
- **Persona-landingek** (F1.8b): terméki definíció kell hozzá.
- A vízhozam/vízhő adat hézagos a mércéinken — ha sűrűbb lesz, bekötendő
  (F1.11).

**Teszt-fiókok:** admin = `endre.sztellik@gmail.com` (profiles.role='admin');
teszt-user = `teszt@sup-platform.test` / `Teszt_1234`.

**MUNKAMÓD (fontos):** lokál-first. Minden lépés zárása: `npm run typecheck` ·
`npm run lint` · `npm test` zölden, PROGRESS frissítve, commit. Netlify-build
CSAK `[deploy]` jelölős commit-üzenetre indul. Éles műveletet (migráció-push,
függvény-deploy, adat-módosítás) KIZÁRÓLAG felhasználói jóváhagyással.
A verifikáció MÉRÉSSEL zárul (parancs-kimenet), nem szemrevételezéssel — a
legutóbbi három körben ez fogott meg egy blokkolót és két valódi hibát.

**Környezet-emlékeztetők:** Supabase CLI CSAK `npm run sb --` wrapperrel
(CLAUDE.md, zshrc-csapda; a `db push`-hoz `--include-all` kell a 099000-es
migráció magasabb időbélyege miatt) · a gépen nincs Docker/helyi Postgres —
pgTAP-verifikáció a CI `rls-tests` jobban · a szolgáltatói kulcs a Management
API-ból kérhető le (`/v1/projects/<ref>/api-keys?reveal=true`), titkot ne írj
a terminálra és ne `npm run`-on át adj át.

## F2.1 — catalog-watch piacfigyelő pipeline (2026-07-28)

Kiosztás: karmester. Terv: `docs/CATALOG_WATCH_TERV.md` (a séma F1.5 óta kész,
migráció élesben). Kapuk zöldek: typecheck · lint · **693 vitest** (+150 új).

**Elkészült — a figyelő (`tools/catalog-watch/`, a `src/modules`-on KÍVÜL):**
- Minden döntés TISZTA függvény, az I/O injektált (az Edge Functionök `_shared`
  mintája) → a teljes futás hálózat és adatbázis nélkül tesztelhető.
- `robots.ts` (leghosszabb-minta illesztés, `*`/`$`, Crawl-delay) · `sitemap.ts`
  (sitemapindex is) · `jsonld.ts` + `html.ts` (schema.org `Product`) ·
  `normalize.ts` (márka-alias, modellnév-tisztítás, spec/ár/elérhetőség) ·
  `match.ts` (pg_trgm-kompatibilis trigram) · `crawl.ts` (hibatűrő orchestrátor) ·
  `store.ts` (az EGYETLEN író fájl, service-role) · `cli.ts`.
- CLI: `list-sources` · `add-source` · `crawl [--dry-run] [--source] [--max]` ·
  `lifecycle`. Node 22 natívan futtatja a TS-t, build nincs.
- Heti cron: `.github/workflows/catalog-watch.yml` (hétfő hajnal UTC +
  `workflow_dispatch` dry-run kapcsolóval, `concurrency` védelem, SHA-pinnelt
  action-ök).

**Elkészült — a kapu (`/admin/katalogus`, catalog adminPanel):**
- `catalog/data/candidates.server.ts`: jelölt-lista (forrás + javasolt pár),
  **jóváhagyás** (márka-feloldás vagy -létrehozás, ütközésmentes slug, ársor),
  **összefésülés** meglévő deszkába, **elutasítás**, **kifutás** megerősítése.
- A route `requireRole('moderator')` a loaderben ÉS az actionben; a jelölt-
  kártyán a kinyert adatok, a típus-választó (a figyelő tippje csak elő-
  választás) és a merge-legördülő.

**Két sérthetetlen szabály a kódban:**
1. **A figyelő SOHA nem publikál magától** — `boards` sort nem hoz létre, minden
   új típus a moderációs sorba kerül (ez a dupla-név elleni védelem).
2. **Státuszt sem állít**: a kifutás-jelölt csak jelentés, a `discontinued`-ot
   ember erősíti meg. Amit a figyelő SOHA nem látott (`last_seen_at IS NULL`,
   pl. a seed-sorok), ahhoz hozzá sem nyúl.

**Modul-szerződés (1.3) — duplikáció helyett core/domén (3 helyen):**
- `slugify` a providersből → `@core/text/slug` (két modulnak kell; a RatingBar
  mintája, F1.6-utó).
- A kifutás-felismerés a **catalog modul** `lifecycle.ts`-ébe került; a figyelő
  onnan importálja — egy implementáció szolgálja a CLI-t és az admin felületet.
- A `catalog_candidates.extracted` jsonb szerződése EGYETLEN típus
  (`ExtractedBoardData` a catalogban), amit a figyelő is onnan vesz.

**VALÓS HIBÁT FOGOTT A MUNKA KÖZBEN (env-árnyékolás, `tools/catalog-watch/env.ts`):**
a gép shell-profilja globálisan exportál egy **IDEGEN projekt**
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` párosát — ugyanaz a zshrc-csapda,
amit a CLAUDE.md a Supabase CLI-nél ír le, csak más változókkal. A CLI első
futása emiatt az idegen projektre csatlakozott (olvasás volt, nem írt semmit —
a hiba „nincs ilyen tábla" volt). Javítva: a repo `.env`-je az AUTORITÁS, a
szolgáltatói kulcs `ref` claimjét összevetjük a cél-projekttel, eltérésnél a
futás **leáll**, és minden futás kiírja, melyik projekttel dolgozik.
**Tanulság a jövőre:** ha egy új eszköz `SUPABASE_*` env-változót olvas,
először az árnyékolásra gyanakodj — a gépen több változó is idegen fiókra mutat.

**Verifikáció (mérés, nem szemrevételezés):**
- 150 új Vitest a tiszta logikára (robots-illesztés, sitemap, JSON-LD-hibatűrés,
  spec-parse, trigram-egyezés, teljes crawl-menet hamis hálózattal).
- `tools/catalog-watch/cli.ts` natívan fut Node 22-n (súgó + hibaágak).
- Az env-őr élesben kipróbálva: a foreign-kulcsos futás LEÁLL.
- `catalog_candidates` és `catalog_sources` tábla ÉL az éles projekten
  (anon REST → `[]`, tehát létezik és az RLS zár).
- `/admin/katalogus` kijelentkezve → **302** a belépőre (guard áll).

**HÁTRA (ekkor még nyitva, lásd lent az F2.1-utó szakaszt):** valós forrás
bekötése, admin böngésző-verifikáció, GitHub-secretek.

### F2.1-utó — az első éles forrás: Bluefin (2026-07-31)

Terv: `~/.claude/plans/crystalline-wobbling-aho.md` (Plan mode-ban jóváhagyva).
A forrás-stratégia (megbeszélve, `ar-megjelenites-politika` memóriához
kapcsolódóan): mivel az ár nem cél (F2.4), a **gyártói/márka-saját oldalak**
(`kind: "brand_site"`) az ELSŐDLEGES forrás — kanonikus modell-adat, ár
nélkül is teljes értékű. Bolt-források (SUPshop.hu, GONG Galaxy) EBBŐL A
KÖRBŐL KIMARADTAK — ld. a terv „Kifejezetten NEM része" szakaszát.

**Próbázás (`cli.ts probe`, adatbázis nélkül) három jelölten:**

| Forrás | Eredmény |
|---|---|
| **Bluefin** (bluefinsupboards.eu) | ✅ 8/8 mintán JSON-LD, helyes `DESZKA`-besorolás |
| GONG Galaxy | ⚠️ Kevert fólia/szárny/szörf/SUP kínálat, nem tiszta minta — kimaradt |
| SUPshop.hu | ❌ Nincs JSON-LD egyetlen `/termek/`-oldalon sem — a mai crawler nem tudja olvasni, kimaradt |

**Bluefin bekötve és lefuttatva élesben:**
- `add-source --kind brand_site --pattern paddleboard --pattern paddle-board`.
- **Dry-run két hibát fogott, mielőtt bármi éles írás történt volna:**
  1. A sitemap 5 nyelvi verziót ad ugyanarra a termékre (`/de/`, `/es/`,
     `/fr/`, `/it/`, `/nl/`) → 42 „új" jelölt jött ki 15 valós deszkából
     (kb. 3x duplikáció). Javítva: `excludeUrlPatterns` a `catalog_sources`
     sorban (a CLI-nek nincs `edit-source` parancsa, ezért egyszeri
     karbantartó szkripttel, a meglévő `resolveSupabaseTarget`/
     `createServiceClient` függvényeken át — ugyanaz a védett env-feloldás,
     mint a CLI-ben). Újra-dry-run: **15 tiszta jelölt, duplikáció nélkül**.
  2. A valós crawl után kiderült: a Bluefin JSON-LD-je a 15 termék nagy
     részén **„Bluefin-testing"** márkanevet ad (a bolt oldalán maradt
     teszt-adat) — enélkül egy hibás „Bluefin-testing" nevű márka jött volna
     létre jóváhagyáskor. Javítva a `BRAND_ALIASES`-ban (`normalize.ts`,
     ugyanaz a minta, mint „Gladiator SUP" → „Gladiator"), teszttel fedve,
     kapuk zöldek (761 vitest), commitolva + pusholva. Újra-crawl frissítette
     a már bent lévő 15 pending jelöltet a helyes márkanévvel (REST-tel
     ellenőrizve: mind a 15 sor `brandName: "Bluefin"`).
- **Eredmény: 15 pending jelölt a `catalog_candidates`-ben**, moderációra
  vár a `/admin/katalogus`-on. Ez a katalógus ELSŐ valós bővülési lehetősége
  a piacfigyelő-pipeline-on át.

**Szolgáltatói kulcs pótolva a `.env`-ben** (a legacy JWT `service_role`
kulcs, NEM az újabb `sb_secret_...`, mert az `env.ts` ref-ellenőrzése csak
JWT-nél működik) — Supabase Management API-ból (`projects api-keys`) kérve
le a `scripts/sb.sh` wrapperen át, a titok SOSEM jelent meg terminál-
kimenetben (fájlba írva egy Node-szkripttel, ami csak a kulcs prefixét/hash-
csonkját írta ki visszaigazolásként). `.env` gitignore-olt, nincs a git
státuszban.

**Megjegyzés — a Supabase MCP a ROSSZ fiókhoz kapcsolódik** (`Viz-Monitor`/
`inlight` projekteket lát, a `pycsqnthxaytwaptbiph` „Supbase"-t nem) —
pontosan a memóriában dokumentált idegen-fiók csapda. NEM használt sem
olvasásra, sem írásra; helyette a catalog-watch saját, bevált env-feloldása
szolgálta ki az egyszeri karbantartó műveletet is.

**Moderáció folyamatban (a felhasználó böngészőben):** 5 Bluefin-jelölt már
jóváhagyva (Cruise Blue, Blue Lagoon Lite, Pink Coral Lite, Mammoth, Cruise
Volt Limited Edition Premium) — **valódi katalógus-sorok**, nem teszt-adat.

### F2.1-utó-2 — spec-parse hibák, élesben talált (2026-07-31)

A felhasználó jelezte: a jóváhagyott deszkák specifikációja nem egyezett a
valós termékoldallal (rossz hossz, hiányzó szélesség/vastagság/teherbírás).
Három valós hiba, mindegyik javítva a `tools/catalog-watch/normalize.ts`-ben
(commit `62c2496`, 7 új teszt, kapuk zöldek — 767 vitest):

1. **"Paddle Length" ütközés**: a bare `length` címke a deszka+evező
   csomag-oldalon az EVEZŐ saját "Paddle Length" sorára illeszkedett, és
   annak számát (210cm) írta a deszka hosszaként a valós 325cm helyett.
   Javítva: `valueAfterLabel` most `excludePrecededBy` paraméterrel a
   "paddle" előzményű találatot kihagyja, és a KÖVETKEZŐ előfordulást
   keresi (nem csak az elsőt nézte eddig).
2. **"Max User Weight" nem illeszkedett** a `maxLoadKg` címke-listára (csak
   "max weight" volt benne, "max user weight" nem részstringje). Felvéve.
3. **Összevont "Dimensions: 325 x 82 x16cm" formátum** — a Bluefin nem
   külön "Szélesség"/"Vastagság" címkével adja meg ezeket, hanem egy sorban.
   Új `parseTripleDimensionCm` szétbontja, csak a KÜLÖN címkével meg nem
   talált mezőket tölti ki (a specifikusabb címke elsőbbséget élvez).

**A már jóváhagyott 5 deszka specifikációja utólag kijavítva** (közvetlen
`boards`-frissítés a helyes, újra-kinyert adatokkal — ugyanaz az env-
feloldás/service-client, mint a többi egyszeri karbantartó művelethez):

| Deszka | Hossz/Szél/Vast (cm) | Súly (kg) | Teherbírás (kg) |
|---|---|---|---|
| Cruise Blue | 325 / 82 / 16 ✅ teljes | 9.1 | 150 |
| Cruise Volt Limited Edition Premium | 325 / 82 / 16 ✅ teljes | 9.1 | 150 |
| Cruise Rush Limited Edition Premium | 325 / 82 / 16 ✅ teljes (7. hiba: a régi hibás 210-es adat maradt a jóváhagyáskor, utólag javítva) | 9.1 | 150 |
| Tandem | 457 / 89 / 15 ✅ teljes | 14.2 | — |
| Mammoth | 549 / — / — | 40.3 | — |
| Orange Carbon Premium | 366 / — / — | 11.15 | — |
| Mint Carbon Premium | 366 / — / — | 11.15 | — |
| Rogue Performance Touring | 381 / — / — | 10.3 | — |
| New Lite Carbon Premium | 345 / — / — | 8.9 | 120 |
| Sprint High Performance Touring | — / — / — | 11.2 | — |
| Blue Lagoon Lite | — / — / — | 9.5 | 120 |
| Pink Coral Lite | — / — / — | 9.5 | 120 |

**Teljes körű ellenőrzés (2026-07-31, mind a 15 jóváhagyott deszkára):** a
felhasználó jelezte, hogy a jóváhagyás után is szükség lesz a helyes
alapadatokra — emiatt mind a 15 board élő oldalát újra lekértük és
újra-kinyertük a javított parserrel. **7/15 deszkánál hiányzik a
szélesség/vastagság** (nem 2/15, ahogy elsőre tűnt) — ez tehát NEM egy
elszigetelt termékvonal sajátossága, hanem a Bluefin oldal TÖBB
sablonjában visszatérő minta: a méret-adat KIZÁRÓLAG egy
`window.productShopStape.metafields[...]` JavaScript-változóban van, nem a
látható HTML-ben — a crawler szándékosan nem parse-ol script-tartalmat
(kockázatos/törékeny lenne). Ezekben az esetekben a mező **null marad** (a
tool filozófiája: „inkább hiányozzon, mint tévedjen") — a moderátor kézzel
pótolhatja, ha fontos.

### F2.1-utó-3 — böngésző-renderelt fallback megépítve (2026-07-31)

A felhasználó explicit kérte: „ne hagyjuk lezáratlanul" — a hiányzó
méret-adatokat most, aktívan orvosoltuk, nem csak dokumentáltuk. Kapuk
zöldek: typecheck · lint · **772 vitest** (+9 új), commitok `2b8bc13` +
`80475fd`.

**Megépült `tools/catalog-watch/render.ts`:** lusta indítású Playwright-
Chromium fallback — ha egy termék MINDHÁROM méret-mezője hiányzik a sima
HTML-ből, a `crawl.ts` egyszer újralekéri az oldalt renderelve, és a JS
lefutása UTÁNI, EMBERI szemnek szánt szöveget (`document.body.innerText`)
adja a MEGLÉVŐ címke-alapú parsernek. **Nem** Scrapling/Python — a
Playwright már meglévő TS/Node-natív devDependency (`npm run e2e`), így
nem kellett új nyelvi stack. A `catalog-watch.yml` heti cron is kapott
`playwright install --with-deps chromium` lépést.

**Első hiba a bevetéskor, azonnal javítva:** a `waitUntil: "networkidle"`
megbízhatóan időtúllépett háttér-widgetes (chat, analitika) oldalakon,
amik sosem engedik nyugalmi állapotba a hálózatot — `domcontentloaded` +
1500ms várakozásra cserélve (commit `80475fd`).

**Eredmény a 8 hiányos deszkán:** 2 (Blue Lagoon Lite, Pink Coral Lite)
TELJES adatot kapott (305/86/15 cm, a korábban csak hüvelykben publikált
méretből átváltva — ehhez a `parseTripleDimensionCm` bővült inch-only
formátumra is, "120 x 34 x 6 Inches"). A maradék 6-nál (Mammoth, Orange/
Mint Carbon Premium, Rogue/Sprint Performance Touring, New Lite Carbon
Premium) a render sem hozott eredményt — Playwright-tal manuálisan
megnézve kiderült: ott a "Board Specs" egy **fül-navigáció mögött** van
(What's In The Box / Accessory Specs / Material fülekkel egy sorban), a
tartalom csak KATTINTÁS UTÁN jelenik meg a látható szövegben.

**Tudatos megállás itt:** a fül-kattintás-szimuláció egy továbbival
bolt-specifikusabb, törékenyebb réteg lenne (nem "várd meg a renderelést",
hanem "találd meg és kattints a megfelelő UI-elemre") — ez már nem éri meg
az erőfeszítést a jelenlegi haszonért. **Végállapot: 9/15 Bluefin-deszka
teljes adattal** (a Cruise-család 6 + Tandem + a két "Lite" most javítva),
6-nál a szélesség/vastagság/néhol teherbírás null marad — dokumentált,
szándékos hiány, nem hiba.

**HÁTRA (felhasználói lépés — admin-bejelentkezés kell):**
- A maradék 10 Bluefin-jelölt átnézése és jóváhagyása/elutasítása a
  `/admin/katalogus`-on — színváltozatoknál **Összefésülés** a kanonikus
  színre (ld. `szinvaltozat-lista-terv` memória — a `boards.colors` mező
  KÜLÖN fejlesztési kör, most halasztva).
- Böngésző-verifikáció: a jóváhagyott deszkák megjelennek-e a `/deszkak`
  listán/adatlapon a helyes specifikációval, ár NÉLKÜL (F2.4 szerint).
- **GitHub Actions secretek** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) a
  heti cronhoz — ellenőrzés/beállítás a repo Settings → Secrets and
  variables → Actions alatt. Ezt nem lehet automatizálni innen (a jelenlegi
  GitHub PAT 403-at ad a secrets API-ra, és titkot amúgy sem kezelnénk
  MCP-n át).
- Ha ez a ciklus jól záródik: természetes következő lépés további gyártói
  oldalak keresése/bekötése (GONG Galaxy más mintával, vagy új márkák).

### F2.1-utó-4 — magyar piaci HU-források (2026-07-31)

A felhasználó a magyar piacon népszerű márkákra (Aqua Marina, Jobe,
Gladiator, WattSUP) kérte a következő kört. Eredmény: **egyik hivatalos
gyártói oldal sem használható** (Aqua Marina globális, Jobe, WattSUP: nincs
Product JSON-LD; Gladiator: a domain az OROSZ piaci oldalra mutat) — de a
felhasználó két HU-viszonteladót adott meg, amik igen:

| Forrás | Kind | Eredmény |
|---|---|---|
| **aquamarinahungary.com** (Sportstore.hu Kft) | `shop` | ✅ 9/10 JSON-LD, valós HUF-ár |
| **sup-deszka.hu** | `shop` | ✅ 8/8 JSON-LD, több márka (Aqua Marina, TooMuch, Coasto, Flowa) |

**Etikai megállás a Gladiatornál:** a robots.txt explicit AI-ellenes
`Content-Signal: ai-train=no` szabályt tartalmaz, néhány AI-bot (ClaudeBot,
GPTBot) név szerint tiltva. A `SuptimeCatalogBot` nincs név szerint tiltva
(általános `Allow: /`), és a cél termék-katalogizálás (nem AI-tanítás) —
felhasználói jóváhagyással folytattuk a próbázást, de végül a domain
technikai okból (orosz piac, nincs JSON-LD) úgyis kiesett.

**Két valós hiba a bevetéskor, javítva (commit `07e59bf`):**
1. **Gzippelt sitemap** (aquamarinahungary.com): a sitemap-lánc gyereke
   `.xml.gz`-ként, `content-type: application/x-gzip` fejléccel érkezett,
   `Content-Encoding` NÉLKÜL — a `fetch()` automata kicsomagolása nem
   futott le. A `cli.ts` `realFetch`-e mostantól kézzel kicsomagolja
   (`node:zlib gunzipSync`), hibatűrő visszaeséssel.
2. **Magyar "Mérete" címke** (nem csak "Méretek") felvéve az összevont
   dimenzió-parse címke-listájára.

**Mennyiségi szűrés (felhasználói döntés — „csak SUP legyen"):** a
sup-deszka.hu multi-márka bolt kajakokat/csónakokat/kenukat is árul — a
`excludeUrlPatterns: ["kajak", "csonak", "transom", "kenu"]` beállítással
kiszűrve a forrás `crawl_config`-jában (a CLI-nek nincs `edit-source`
parancsa, ezért a Bluefin-nél már bevált egyszeri karbantartó szkript-
mintával).

**Éles crawl mindkét forráson (felhasználói jóváhagyással):**
- Aqua Marina Hungary: **63 új jelölt** (111 termékoldalból 48 kiegészítő/
  ruházat). Zaj: néhány uszony és ruházati cikk (rövidnadrág, felső) is
  bejelöltként került be — a moderátor triviálisan elutasítja.
- sup-deszka.hu: **105 új jelölt** (170 URL, 6 átmeneti hálózati hiba
  hibatűrően kihagyva). Zaj: 2 kajak-termék (URL-jükben nincs "kajak" szó,
  ezért a kizárás nem fogta meg), a kenuk/csónakok/nagyobb kajak-kör már
  kiszűrve.

**Végállapot: 183 jelölt/deszka összesen a `catalog_candidates`-ben**
(15 Bluefin, MÁR JÓVÁHAGYVA + 63 Aqua Marina Hungary + 105 sup-deszka.hu,
MINDKETTŐ `pending`, moderációra vár).

**HÁTRA (felhasználói lépés — admin-bejelentkezés kell):**
- **168 pending jelölt** átnézése a `/admin/katalogus`-on — jelentős
  moderációs munka, a zaj (ruházat, uszony, néhány kajak) egyszerű
  elutasítással kezelhető.
- GitHub Actions secretek (változatlanul nyitva, ld. fent).

### F2.1-utó-5 — Indiana Paddle & Surf + defaultBrandName + osztályozási hiba (2026-08-12)

Az SSD-megszakadás utáni újraindítás után a felhasználó a folytatást kérte:
vagy fejlesztés, vagy — mivel ez is a munka része — további katalógus-forrás
keresése a 168 pending mellé. A user a forráskeresést választotta. Kapuk
zöldek: typecheck · lint · **776 vitest** (+6 új), commit `f65da4e`.

**Kutatás (RRD, Zray, F2 Boards, Indiana):** csak az **Indiana Paddle &
Surf** (indiana-paddlesurf.com, svájci gyártó) bizonyult használhatónak.
Zray-nek nincs JSON-LD-je (mint korábban SUPshopnak), F2 Boardsnak sincs
(Magento-alapú, JS-renderelt), RRD-nek VAN JSON-LD-je, de a méret-tábla
láb/hüvelyk formátumban, TÖBB méretvariánst egyetlen JSON-LD `Product`
alá sűrítve — ez a mai parserünkkel nem bontható szét megbízhatóan, ezért
kimaradt (nem hiba, tudatos megállás, mint korábban a Bluefin fül-mögötti
specifikációknál).

**Indiana erőssége:** tiszta `Product` JSON-LD + a statikus HTML-ben
CÍMKÉZETT, METRIKUS spec-tábla (`Length CM:`, `Width CM:`, `Thickness/
Height CM:`, `Volume L:`, `Product weight:`, `Rec. rider weight (kg):`) —
pontosan a meglévő `SPEC_LABELS`/`toNumber` (vesszős tizedesjel is kezelt)
mintájába illik, ÚJ parser-kód nem kellett hozzá. Az ár CHF (nem HUF) —
a meglévő `parsePriceHuf` ezt helyesen null-ra hagyja (F2.4-nek amúgy sem
kell ár).

**Valós hiba #1 — hiányzó márka (JAVÍTVA, `crawl_config.defaultBrandName`):**
Indiana JSON-LD-je EGYETLEN mintán sem ad `brand`/`manufacturer` mezőt (a
saját gyártói bolt magától értetődőnek veszi) — enélkül
`approveCandidate` mindenhol `admin.error.noBrand`-ot adott volna. Új,
OPCIONÁLIS `CrawlConfig.defaultBrandName` mező (+ CLI `--default-brand`)
— csak akkor él, ha a JSON-LD hallgat, a saját mezője mindig elsőbbséget
élvez. 3 új teszt (`normalize.test.ts`), élesben verifikálva: mind a 17
Indiana-jelölt helyes „Indiana" márkanévvel érkezett.

**Valós hiba #2 — angol „Board Bag" deszkának minősült (JAVÍTVA):** a
`taska` kiegészítő-kategória kulcsszólistája csak magyart ismert
(`taska`, `hatizsak`, `backpack`) — egy angol „11'6 Touring Board Bag"
termék a `BOARD_NOUNS` „board" szaván át DESZKÁVÁ minősült (az első
próbafutásban a 9 jelöltből 5 hordtáska volt). Felvéve: `"board bag"`,
`"carry bag"`. 2 új táblázatos teszt reprodukálja az esetet. A javítás
UTÁN a 200-mintás dry-run 168/183 terméket helyesen `ignore`-olt (168
kiegészítő/ruházat/nem-SUP, korábban csak 51 volt ugyanezen minta egy
részén — a hordtáskák eltűntek a hamis jelöltek közül).

**Ismert, tudatosan NEM javított apróság:** egyetlen „Race Board Handle"
(hordófül) ugyanígy „board"-ként minősül (a `taska`-listához hasonló
angol kulcsszó hiányzik a „handle"-höz) — de ez a 200 mintából 1 eset,
a moderátor egy kattintással elutasítja; a jelenség ÁLTALÁNOSABB
korlátja (bármilyen „X Board Y" elnevezésű nem-deszka termék) nem éri
meg a további parser-bővítést ennyi haszonért.

**Éles crawl (felhasználói jóváhagyással, `max 200` a 425 URL-ből):**
**17 új jelölt** (10 deszka + 7 kiegészítő/pumpa), mind „Indiana"
márkanévvel. Köztük egy **bizonytalan egyezés** egy meglévő deszkával
(„12'6 Touring" — moderációkor érdemes megnézni, összefésülés-e vagy
valódi új modell). Két „Surf Hardboard" (5'8/5'10) valószínűleg NEM
SUP-deszka (sima szörfdeszka, a „board" szó miatt került be) — moderátor
dolga eldönteni.

**Végállapot: 185 jelölt/deszka a `catalog_candidates`-ben** (168 korábbi
+ 17 Indiana, mind `pending`).

**HÁTRA (felhasználói lépés — admin-bejelentkezés kell):** a pending
jelöltek moderációja (változatlanul a fő nyitott tétel) + GitHub Actions
secretek (változatlanul nyitva).

### F2.1-utó-6 — moderáció közben talált hibák + adattakarítás (2026-08-13)

A felhasználó éles moderációt kezdett a 185 pendingen, és zajt/hibát jelzett
("sok duplikáció van és hiba benne... hiányosak az adatok"). Kapuk zöldek:
typecheck · lint · **784 vitest** (+10 új), commitok `f65da4e` (Indiana-kör
lezárása) és `d03a448`.

**A "duplikáció" gyanú vizsgálata:** azonos forráson belüli pontos
márka+modell egyezésre kerestem — 5 találat, de mindegyik VALÓDI külön
SKU (más méret ugyanabból a modellcsaládból, pl. "HYPER 350cm" vs
"HYPER 381cm"), nem hibás duplikátum. A tényleges probléma máshol volt.

**4 valós hiba, mindegyik javítva:**
1. **Az Aqua Marina Hungary forrás MIND A 63 jelöltje `brandName: null`-lal
   érkezett** (2026-07-31 óta) — a JSON-LD nem ad `brand` mezőt. Emiatt
   EGYIK sem volt jóváhagyható (`approveCandidate` `admin.error.noBrand`-ot
   ad hiányzó márkánál) — ez volt a moderáció fő blokkolója. Javítás:
   `crawl_config.defaultBrandName: "Aqua Marina"` a forráson (egyszeri
   karbantartó szkripttel, mint korábban az `excludeUrlPatterns`-nél).
2. **Címkézetlen "NNNxNNxNN cm" méret-hármas** felismerése új fallbackként
   (`findBareTripleDimension`, pozíció-alapú táska/csomag-kizárással) —
   aquamarinahungary.com a "Mérete" címke UTÁN elgépelt "m" egységet ír
   ("Mérete (366m x 84x 15m)"), miközben a helyes "cm"-es forma címke
   nélkül, korábban a szövegben is szerepel.
3. **Rendszerszintű osztályozási hiba**: a `guessBoardType` a TELJES
   oldalszöveget nézte (`pageText`), ami a navigációs menüt is
   tartalmazza — egy "Touring SUP / Race SUP / Yoga SUP" kategória-menüvel
   rendelkező bolton ez GYAKORLATILAG BÁRMIT (ruházatot is) deszkának
   minősített a `hasSup && boardType !== null` ágon át. Javítva: mostantól
   csak cím+leírás alapján dönt.
4. **"board"-szótő ruházatban/tartozékban** ("Boardshorts", "Board
   Handle", "Board Nose Handle") — felvéve a `MISC_NON_BOARD_KEYWORDS`-be.

**Adattakarítás (felhasználói jóváhagyással):**
- Aqua Marina Hungary forrás **újra-crawlolva** a javított kóddal — a
  meglévő pending sorok a `saveCandidate` update-ágán frissültek (a
  `catalog_candidates` már NEM újra-teremt sort ismert URL-re, hanem
  felülírja az `extracted` mezőt). Első próbálkozás hálózati hibába
  futott (0 siker, "fetch failed" mindenhol) — a második futás tiszta
  volt. Eredmény: a márka nélküli sorok száma **65-ről 8-ra csökkent**.
- **15, a MAI kóddal már `ignore` lenne stale jelölt** (9 ruházat, 1 túl
  nagy — 550cm — deszka, 1 biztonsági zsinór, 1 elektromos SUP-motor
  kiegészítő, 2 Indiana "Board Handle") egyszeri szkripttel `rejected`
  állapotba állítva. **Fontos korlát dokumentálva**: az újra-crawl
  ÖNMAGÁBAN nem takarítja ezeket — ha egy URL ma `ignore`-ra minősül, a
  crawl csendben kihagyja, de a régi, hibásan `pending` sort NEM törli/
  módosítja. Ehhez a külön takarító-lépés kellett.
- **Tudatosan NEM auto-szűrve**: 4 tiszta kajak-jelölt (Aqua Marina Hungary,
  a `kajak` URL-minta a JÖVŐBELI crawlokat már kizárja, de a meglévő
  sorokat nem érinti) + 2 SUP/kajak KOMBI evező, ami VALÓS SUP-kiegészítő
  lehet — a "kajak" szó önmagában nem elég megbízható jel az
  automatizáláshoz (lenne belőle hamis negatív is), ezért ez a 6 sor
  marad kézi moderátori döntésre.

**Végállapot:** 170 pending (185 − 15 takarítva), 15 approved, 35 élő
deszka. Márka nélküli sor: 8 (a 65-ből maradt, kézi döntést igénylő
eset — 4 kajak, 2 kombi-evező, 1 forrás-oldali félrecímkézés [horgászbot
"SUP Deszka" néven sup-deszka.hu-n], 1 mentőmellény anomális JSON-LD-vel).

### F2.1-utó-7 — felhasználói adatgyűjtés egyeztetve + 1 újabb valós hiba (2026-08-13)

A felhasználó saját kézzel gyűjtött SUP-adatokat (`Kezdők_tanácsok/SUP
adatok.docx`, 75 tétel, vegyes formátum) állított össze a moderáció
közben — ezt egy fork egyeztette a `catalog_candidates`/`boards`
táblákkal, párhuzamosan az F2.5 vízismereti munkával. Kapuk zöldek:
typecheck · lint · **789 vitest**, commitok `a0af362` (parser-fix).

**Egyeztetés eredménye:** 75 doksisor → 56 tisztított rekord (irodalmi
duplikátumok összevonva, multi-variáns sorok szétbontva, a felhasználó
saját "nem SUP"/"már szerepelt" jelölései változtatás nélkül elfogadva).
**19 pending jelölt frissítve** hiányzó specifikáció-mezőkkel (Too Much,
Indiana, Aqua Marina). Élő deszkán 0 javasolt frissítés (nincs egyezés).
**27 mezőütközés SZÁNDÉKOSAN nem írva felül** (DB és doksi ellentmond) —
emberi döntésre vár. 3 hamis egyezést a fork kézzel kizárt (túl megengedő
név-alapú párosítás lett volna). 4 genuinely új tétel nincs sehol a
rendszerben (TooMuch Element/Nimbus Navigator/Wave Explorer, Flowa Akahi).

**Valós hiba #9 (JAVÍTVA, `a0af362`):** az egyeztetés közben kiderült,
hogy 4 Indiana jelölt `widthCm`-je képtelen szám (850–2286 cm) — a
`parseDimensionCm` a dupla-aposztrófos hüvelyk-jelet (`32''`, gyakori
ASCII-helyettesítő) LÁB-jelként olvasta (a második aposztróf "elveszett"
karakterré vált), 32 hüvelyk (81,3cm) helyett 32 LÁBBÁ (975cm) alakítva.
Ráadásul a hibás láb-találat MEGELŐZTE a szövegben korábban álló, helyes
cm-értéket is (a feetInches-ellenőrzés minden más előtt fut). Javítás:
`(?!')` védelem — 2 új teszt. **Indiana forrás újra-crawlolva a javítással**
a 4 érintett jelölt frissítésére.

**Külön hiba, amit a fork talált, de NEM javított (kívül esett a
feladatán):** néhány sup-deszka.hu-s Aqua Marina jelöltnél (Monster,
Alani, Fusion, Vibrant) a hossz/szélesség/vastagság mezők egy pozícióval
csúsznak (pl. "Monster 12'0"" DB-ben `lengthCm=84`) — nyitva maradt.

**Felhasználói hiba korrigálva:** a korábbi (F2.1-utó-6) automata
elavult-jelölt-takarítás **tévesen elutasította** az „Aqua Marina SUP
MEGA 18'1"" jelöltet (550cm-es óriás többszemélyes deszka) — a mai
osztályozó a hossz-küszöb (240–520cm) fölé esik és nincs "board"/"deszka"
szó a rövid nevében, ezért `ignore`-nak minősült, holott VALÓS termék (a
felhasználó doksija teljes, hiteles specifikációval hozta: 550×152×20cm,
650kg teherbírás). **Kézzel visszaállítva `pending`-re**, a doksi teljes
specifikációjával feltöltve. Tanulság: a hossz-küszöb + "board"-szó
heurisztika nem tökéletes a szokatlanul nagy, több fős deszkákra — egyedi
eset, nem indokol küszöb-változtatást.

**HÁTRA:** a 27 mezőütközés és a 4 új tétel átnézése (emberi döntés), a
sup-deszka.hu mező-csúszás hiba kivizsgálása, a pending jelöltek
moderációja (változatlanul a fő nyitott tétel).

## F2.5 — Alapvető információk: vízenkénti SUP-szabályok (2026-08-13)

Felhasználói kérés a katalógus-moderáció közben: egy „Tudod-e?"/„Alapvető
információk" menü a legfontosabb vizekhez (Balaton, Tisza-tó, Duna,
Tisza) — hajózási/használati szabályok, biztonsági tudnivalók, gyakorlati
infó (kifejezetten NEM könnyed érdekesség-tartalom). Kiosztás: karmester
(fork). Kapuk zöldek: typecheck · lint · **789 vitest**, commit `f81f520`.

**Kétkörös forráskutatás, mert biztonsági/jogi tartalomról van szó:**
1. kör (fork): Balaton, Tisza-tó, Duna, Tisza szabályai — a fő találat:
   a SUP jogi besorolása vizenként ELTÉR (Balaton/Velencei-tó =
   „fürdőeszköz", mellény nem kötelező; Duna/Tisza/Tisza-tó = „vízi
   sporteszköz", mellény kötelező) — de csak 3 másodlagos forrásból, nem
   elsődleges jogforrásból.
2. kör (a felhasználó 4 további linket adott: viziturazz.hu/vizitura-kresz,
   suplife.hu, supshop.hu, supbazis.hu): **konkrét jogszabály-hivatkozást**
   hozott (2000. évi XLII. törvény 87. § 43. pont, 57/2011 NFM rendelet,
   46/2001 BM rendelet) — a Tisza-tavi SUP Bázis (helyi üzemeltető) SAJÁT
   oldala paragrafus-pontosan idézi ugyanazt a mentőmellény-vagy-póráz
   szabályt, amit a viziturazz.hu is ír, feloldva egy korábbi forrás-
   ütközést. A tervezet 5→3 nyitott pontra csökkent (csak az alkoholhatár,
   a Tiszabecs-mérce száma, és az "érdemes elsődleges jogforrást is
   átfutni" maradt).

**Tartalom-tervezet átnézésre:** Artifact (2 revízióval, a 2. kör után
frissítve) — a végleges HTML forrás
`tools`-on kívül, a fork a Write-tal írt fájlból dolgozott tovább.

**Szerkezeti döntés (felhasználói jóváhagyással):** a Spotok modulhoz
kötve, STATIKUS i18n-tartalomként (nem új DB-tábla) — ugyanaz a minta,
mint a catalog modul `/felszereles` útmutató-oldalai.

**Elkészült:**
- `src/modules/spots/waterinfo.ts`: zárt 4-elemű vízlista
  (`WATER_INFO_SLUGS`), `isWaterInfoSlug` őr, `WATER_INFO_COUNTS`
  (vizenként eltérő lista-hosszak, mert a `t()` nem ad típusbiztos
  tömböt — számozott i18n-kulcsokkal olvassuk be), és
  `waterInfoSlugForSpot` — egy spot a saját vizéhez (Balaton/Tisza-tó a
  `storm_warning_region` mezőből, Duna/Tisza a spot NEVÉBŐL, mert
  folyóknál a storm-region mindig null).
- `app/routes/alapinfo.tsx` (áttekintő) + `app/routes/alapinfo.$viz.tsx`
  (vízenkénti oldal: szabályok + jogszabály-hivatkozások, biztonsági
  blokk `SafetyNote`-tal — Balaton/Tisza-tónál a viharjelző-táblázattal —,
  gyakorlati infó, kapcsolódó linkek `/felszereles/poraz`,
  `/felszereles/mentomelleny`, `/spotok`), ismeretlen vízre 404
  (`isWaterInfoSlug` őr, a `felszereles.$kategoria.tsx` mintája).
  **Tudatos döntés**: a `SafetyNote` itt semleges (`sand`) kiemeléssel
  fut, NEM a védett `--safe`/`--caution`/`--danger` biztonsági
  tokenekkel — azok élő állapotjelzésre vannak fenntartva (CLAUDE.md),
  ez statikus referencia-tartalom.
- `src/modules/spots/module.ts`: `alapinfo`/`alapinfo/:viz` route +
  `nav.spots` mögé `order: 21`-es nav-bejegyzés.
- `app/routes/spotok.$slug.tsx`: link a spot saját vízének infó-oldalára,
  ha az a 4 ismert víz egyike.
- `src/core/seo/sitemap.ts`: `/alapinfo` + a 4 vízoldal felvéve.
- i18n: `spots` namespace `waterInfo.*` fája hu+en, **kulcs-paritás
  ellenőrizve szkripttel (82=82, nincs eltérés)**.

**Tartalmi óvatosság (safety-token szemlélet, statikus tartalomra
alkalmazva):** a bizonytalan tények KIMARADTAK vagy puhítva kerültek be
— nincs konkrét Balatoni alkoholhatár-szám, nincs konkrét Tiszabecs-
mérce-tartomány (helyette élő vízállás-forrásra mutató link és
minőségi — nem számszerű — veszély-leírás). Minden vízoldal alján
„utoljára ellenőrizve" jelölés.

**Munkamenet-jegyzet:** a fork, ami ezt építette, a végén (kapuk
futtatása/commit előtt) 600 másodpercre elakadt és leállt — a
karmester vette át onnan: átnézte a már elkészült fájlokat (minőség
rendben, hu/en paritás igazolva), lefuttatta a 3 kaput, és commitolt.

**HÁTRA (felhasználói döntés, nem fejlesztői feladat):** ha a felhasználó
később szeretné, az elsődleges jogforrás (net.jogtar.hu) közvetlen
átfutása a mentőmellény-szabályra, mielőtt a `SITE_PUBLIC` élesítéskor
ez az oldal is nyilvánossá válik.

### F2.1-utó-8 — jelölt↔jelölt duplikátum-gyanú az admin-moderációban (2026-08-14)

A felhasználó a docx-egyeztetés közben észrevette: "ezek jórésze szerepel
[a dokumentumban], így nem lehet 172 függő deszka" — helyes megérzés.
Kiosztás: karmester (fork). Kapuk zöldek: typecheck · lint · **795
vitest** (+6), commit `706f4be`.

**Mennyiségi visszaigazolás** (a `tools/catalog-watch/match.ts` meglévő
trigram-pontozójával, páronként az összes pending jelöltre): az Aqua
Marina Hungary és a sup-deszka.hu forrás NAGYRÉSZT UGYANAZT az Aqua
Marina-katalógust árulja — deszka-szinten **65 forrásközi pár ≥0,45**
pontszámmal, ebből ~25-30 a ≥0,5 tartományban (Fusion, Beast, Super
Trip, Vapor, Monster, Hyper, Breeze, Island, Coral, Rapid, Atlas — mind
mindkét forrásból, csak eltérő megfogalmazással: BT-kód vs méret+súly).
**Becslés: a 172 pendingből valószínűleg csak 60-90 az EGYEDI termék.**
A kiegészítőknél (evező/pumpa) még súlyosabb az átfedés, de ott a
tranzitív klaszterezés (union-find) hamis pozitívokat termelt (17 elemű
"evező" blob — különböző konkrét evező-modellek estek egybe a közös
"evező"/"Aqua Marina" szavak miatt), ezért ott NEM klasztereztem, csak
páronkénti pontozás maradt.

**A gyökér-ok:** a `matchCandidate` (crawl-idejű) csak jelölt↔ÉLŐ-deszka
egyezést keres — jelölt↔jelölt között sosem volt ellenőrzés. Két,
ugyanazt a terméket fedő pending sor egyaránt jóváhagyható lett volna,
valódi duplikátumot hozva a `boards` táblába.

**Megoldás — TARTÓS funkció, nem egyszeri takarítás:**
- Modul-szerződés-refaktor: a `trigrams`/`similarity` primitív a
  `tools/catalog-watch/match.ts`-ből `src/core/text/similarity.ts`-be
  költözött (a `slugify` mintája, F2.1 óta ismert minta közös igényre) —
  a catalog modul nem importálhat `tools/`-ból. A `match.ts` RELATÍV
  (nem `@core/*` alias) importtal veszi át, mert sima `node`-dal fut a
  CLI-n/cronon, nem a Vite-bundleren át. Viselkedés-megőrzés igazolva: a
  181 catalog-watch teszt változatlanul zöld a mozgatás után.
- ÚJ `src/modules/catalog/data/duplicate-hints.ts`: `findDuplicateHints`
  (tiszta függvény), `DUPLICATE_HINT_THRESHOLD = 0.5` (a mai mintavételből
  kalibrálva, kommentben dokumentálva miért pont ennyi). Ugyanazokat a
  súlyokat tükrözi, mint a `match.ts` `scorePair`-je (modul-határ miatt
  nem importálható, szándékos duplikáció, kommentezve).
- `/admin/katalogus`: a jelölt-kártyán, ha van elég erős gyanú, egy sor
  jelzi ("Lehet, hogy ugyanaz a termék, mint »X« (forrás) — Y% egyezés")
  — CSAK jelzés, a jóváhagyás/elutasítás/összefésülés gombok viselkedése
  változatlan, a moderátor dönt (a figyelő „soha nem dönt magától"
  szemlélete admin-oldalra is érvényes).
- 6 új teszt: valódi élesben mért pár felismerve, azonos forrás sosem
  párosul, deszka sosem párosul kiegészítővel, eltérő kiegészítő-
  kategória sosem párosul, zajos hasonlóság kiszűrve, 3+ forrásból a
  legerősebb pár választva.

**HÁTRA:** a kiegészítő-kategória (evező/pumpa) duplikátum-gyanúja még
nyitott — a mai `findDuplicateHints` MŰKÖDIK rájuk is (páronkénti, nem
klaszterezett pontozással), csak a pontos küszöb ott még nincs annyira
mintavételezve, mint a deszkáknál; ha a moderáció során sok hamis
pozitív/negatív derül ki, érdemes külön kalibrálni.

### F2.1-utó-9 — a felhasználó rákérdezett: tényleg bekerültek a paraméterek? (2026-08-15)

Direkt kérdés: "az eszközök listája bővült a megfelelő paraméterekkel...
ezek beépültek?" Őszinte válasz: RÉSZBEN — a kérdés maga 2 további valós,
élesben aktív hibát fogott ki. Kapuk zöldek: typecheck · lint · **799
vitest** (+5 új), commit `cff7431`.

**2 újabb valós hiba a `parseSpecsFromText`-ben, mindkettő javítva:**
1. **Szállítási/csomagolási méret a deszka méretének véve** — az
   aquamarinahungary.com egyes oldalain "paddleboard szállítási méretei:
   38x20x85 cm" (DOBOZMÉRET, nem a deszkáé!) a "szállítás" szó hiánya
   miatt tévesen bekerült — 4 candidate-en (HYPER×2, BEAST, FLOW YOGA)
   AZONOS hibás 38×20×15 érték volt, ami önmagában is gyanús jel volt.
   Emellett a tegnapi ragozott-alak-védelem (ld. utó-7) túl szigorúnak
   bizonyult: a "méret" címke birtokos alakjait (mérete/méretei) is
   kizárta, pedig ezek szokásos formák — szűkítve csak az instrumentális
   `-val/-vel` (aval/evel) mintára. Új PÁR-fallback
   (`parsePairDimensionCm`): ha a "méretei" alatt csak hossz×szélesség áll
   (a vastagság külön címkével jön), azt is felismeri.
2. **Fordított próza-sorrend** ("320 cm hosszúság, 84 cm szélesség és 15
   cm vastagság" — a szám a címke ELŐTT áll) — próbáltam egy általános
   javítást (ha a címkét szám előzi meg, ugorja át), de ez ÚJ
   regressziót okozott (jó, listaszerű adatokat is kizárt, pl. "381 x 79
   cm\nVastagság 15 cm"-nél a vastagságot). **Visszavonva** — a
   felhasználó eközben egyértelművé tette: a doksijából származó adatok
   gyártói/bolti forrásúak, nem szorulnak további "ellenőrzésre", hanem
   közvetlenül be kell épüljenek. Ennek megfelelően az érintett
   konkrét tételeket (Wave Explorer, Nimbus Navigator, Yoga Dock×2,
   ALANI — mind a doksiban szerepelt pontos adattal) EGYENESEN a doksi
   értékeivel patch-eltem, a hibás parser-kimenetet felülírva — nem
   várva egy általánosabb parser-javításra.
3. Emellett 3 evező súlyadat is pótolva a doksiból, ami korábban kimaradt
   a nagy egyeztető körből (Ace Kids 0.54kg, Carbon X 0.55kg, Carbon Pro
   0.75kg).

**Tanulság a jövőre:** a `parseSpecsFromText` heurisztikái (címke UTÁN
keres) törékenyek a magyar próza szabad szórendjével szemben — minden
újabb élesben talált minta egy újabb speciális esetet ad hozzá. Ha ez a
minta tovább szaporodik, érdemes lehet egy MÁSFAJTA, robusztusabb
megközelítést fontolóra venni (pl. LLM-alapú kinyerés a szabad szöveges
leírásokra), ahelyett hogy minden egyes új prózaformát külön regex-
szabállyal kergetnénk — de ez jelentős architektúraváltás lenne, nem
egy soros javítás.

**Még nyitva (nincs doksi-forrás hozzá, JOB nem javítva):** „VIBRANT
TOURING 10'0"" és „WIKIWIKI 10'10"" (sup-deszka.hu) — ugyanaz a fordított
próza-hiba érinti, de a doksiban nem szerepelnek, így nincs megbízható
adat a közvetlen felülíráshoz.

### F2.1-utó-10 — fél-automata munkafolyamat: mezőnkénti adatzár (2026-08-15)

A felhasználó a mai hibavadászat-sorozat után ("hagyd jóvá, mielőtt
elveszne" → "lehet, hogy máshogy kellene hozzáállni") egy STRUKTURÁLIS
váltást kért: a rendszer maradjon csak FÉLIG automatizált — a crawler
felfedez és a lehető legtöbb adatot kinyeri magától, de a hiányzó
specifikációt a felhasználó GYÁRTÓI/kereskedői forrásból gyűjti kézzel,
és ami egyszer emberi kézzel bekerült, azt a crawler TÖBBÉ NE ÍRJA
FELÜL. Terv (Plan mode, kétkörös egyeztetéssel): `~/.claude/plans/
viszont-akkor-lehet-hogy-fancy-origami.md`. Kapuk zöldek: typecheck ·
lint · **808 vitest** (+13), commit `57b903a`.

**A közvetlen kiváltó ok:** a "SUP MEGA 18'1"" jelölt kézzel visszaállított
specifikációja egy KÖZBENSŐ crawl miatt újra nullázódott — a
`saveCandidate` egy ismert `pending` URL-re MINDIG felülírta a teljes
`extracted` payloadot, függetlenül attól, hogy valaki már javított rajta.

**Két KÜLÖN mechanizmus, két új oszlop** (`catalog_candidates.
locked_fields text[]` + `data_verified_at timestamptz`, migráció:
`20260717092400_catalog_candidates_locked_fields.sql`, MÉG NEM TOLVA KI
élesre):
- `locked_fields`: MEZŐNKÉNTI védelem — melyik `extracted`-mezőt ne írja
  felül többé a crawler. `tools/catalog-watch/lock.ts` `applyFieldLocks`
  (tiszta függvény, 4 teszt) — a `saveCandidate` ezt hívja update előtt.
- `data_verified_at`: JELÖLT-SZINTŰ "kész" jelölés — mikor nyilvánította
  valaki lezártnak az adatgyűjtést, AKKOR IS, ha objektíven nem tölthető
  ki minden mező (egy bolt egyszerűen nem publikálja a súlyt). Amíg
  `null`, a jelölt a hiányos-listán marad.

**Két új CLI-parancs** (`tools/catalog-watch/cli.ts`), amik felváltják az
ezidáig használt ad-hoc, egyszer-használatos scratch-szkript mintát:
- `verify-specs --set path=érték... (--url/--candidate | --board)
  [--done] [--reopen]` — kézi adat beépítése. Pending jelöltnél
  (`--url`/`--candidate`) a beírt mezőt zárolja is; élő boardnál
  (`--board <slug>`) közvetlenül a `boards` snake_case oszlopát írja
  (nincs zár-mechanizmus, mert élő boardot a crawler eleve nem ír felül
  teljesen). `--done`/`--reopen` a "kész" állapotot állítja/törli.
- `list-incomplete [--source NÉV]` — a mai `hianyos-deszkak.md` tartós,
  parancsosított verziója, KÉT szakaszban: pending jelöltek (`data_
  verified_at IS NULL` ÉS van hiányzó mező) és MÁR ÉLŐ boardok hiányzó
  mezővel. `tools/catalog-watch/report.ts` `formatIncompleteReport` +
  `missingSpecLabels` (tiszta függvények, 5 teszt).

**Második brainstorming-kör (ugyanaznap) pontosította a modellt:**
1. Hiányos adattal is SZABAD publikálni — a felhasználó döntése: jobb, ha
   a nyilvános lista minél teljesebb és véleményezhető, a hiányt pedig a
   `list-incomplete` ÉLŐ-board-szakasza teszi láthatóvá, nem a jóváhagyás
   blokkolása.
2. Egyéni dokumentumok (PDF/DOCX/Excel) kezelése NEM igényel új kódot — a
   felhasználó megerősítette: marad a szabad-formátumú minta (Claude
   olvassa/értelmezi bármilyen dokumentumot, `verify-specs`-szel építi be).
3. Mindkét mechanizmus UTÓLAG korrigálható — nincs "lezárt, nem javítható"
   állapot.

**ÉLESÍTVE ÉS VÉGPONTTÓL-VÉGPONTIG VERIFIKÁLVA (2026-08-15, felhasználói
jóváhagyással):** a migráció kitolva (`npm run sb -- db push
--include-all`). Élő próba a "SUP MEGA 18'1"" jelölten:
1. `verify-specs --candidate <id> --set specs.lengthCm=550 ...` — 4 mező
   beírva és zárolva.
2. **Valós `crawl --source "Aqua Marina Hungary"` UTÁN a 4 mező
   VÁLTOZATLAN maradt** (a `locked_fields` a válaszban is látszott) — ez
   pontosan az eredeti hiba (a mai nap elején elveszett kézi javítás)
   ellenpróbája, sikeresen.
3. `verify-specs --board bluefin-tandem --set max_load_kg=999` majd
   `=null` — a `--board` ág is működik, a `list-incomplete`-ről el is
   tűnt/vissza is került a teszt közben (érték visszaállítva, nincs kitalált
   adat az élő katalógusban).
4. `--done`/`--reopen` is kipróbálva és helyesen viselkedett.
5. **Útközben talált és javított hiba:** a `boards.slug` FORDÍTHATÓ jsonb
   (`{"hu":..., "en":...}`), nem sima szöveg — a `verify-specs --board` és
   a `list-incomplete` élő-szakasza ezt eredetileg simán stringként
   kezelte (`[object Object]` jelent meg a riportban). Javítva: `hu`
   alszlug az elsődleges CLI-referencia.

**HÁTRA (nem blokkoló, később):**
- Admin UI jelzés a zárolt/hiányos mezőkön — tudatosan KIHAGYVA ebben a
  körben, a `list-incomplete` parancs kimenete egyelőre elég visszajelzés.
- Visszamenőleges zárolás a meglévő 172 jelöltre — a felhasználó
  kifejezetten csak az EZUTÁN gyűjtött adatokra kérte.

### F2.1-utó-11 — böngészős HTML-riport a for_validate/ munkafolyamathoz (2026-08-16)

A felhasználó kérése: a terminál-kimenet helyett sima böngészőben
megnyitható, checkbox-os HTML legyen, dátumozott fájlnévvel egy ÚJ
`for_validate/` mappában (repo gyökér, git-követés NÉLKÜL — személyes
munkafájl, mint a `Kezdők_tanácsok/`-beli doksik). Kapuk zöldek:
typecheck · lint · **823 vitest** (+8), commit `6138a96`.

**`list-incomplete --html [ÚTVONAL]`**: alapértelmezetten
`for_validate/<ma>-validalando-deszkak.html`-t ír (`report.ts`
`formatIncompleteReportHtml`, önálló fájl, nincs külső erőforrás).
Minden sorhoz checkbox — localStorage-ban perzisztál, DE csak SAJÁT
munkaközbeni jegyzetként: a mérvadó "kész" állapotot a `verify-specs`
adja. Ha egy kör félbemarad, a KÖVETKEZŐ, újabb dátumú riport a még
hiányos tételeket úgyis újra tartalmazza (checkbox-állapottól
függetlenül) — pontosan a felhasználó kérése szerint.

**Melléktermékként javítva:** a nem valódi deszka jelöltek (kajak, kötél,
fin, lapát, hordozópánt, horgászbot — `looksLikeNonBoardModel`,
korábban ad-hoc szkriptben élt) mostantól a SIMA szöveges
`list-incomplete` kimenetben is külön "KIHAGYVA" szakaszba kerülnek, nem
keverednek a valódi hiányos deszkákkal.

**Élesben generálva és elküldve:** 41 pending + 7 élő board a
`for_validate/2026-08-16-validalando-deszkak.html`-ban (22 nem-deszka
tétel külön szakaszban).

**Cron heti → havi (2026-08-16):** `.github/workflows/catalog-watch.yml`
`"17 3 * * 1"` (hétfőnként) helyett `"17 3 5 * *"` (minden hó 5.). Indok:
a gyártók szezonálisan adnak ki új modellt, nem hetente; az ár amúgy sem
jelenik meg végfelhasználónak (F2.4); a `locked_fields`/`data_verified_at`
(F2.1-utó-10) már véd a köztes felülírástól, tehát a gyakoriság nem
kockázat kérdése többé, hanem tisztán a moderációs munka üteme — a
felhasználó explicit kérése egy fix, jól ütemezhető havi nap (a hónap 5.).

### F2.1-utó-12 — élő Bluefin-boardok hiányzó specifikációi beépítve (2026-08-16)

A felhasználó a `2026-08-16-validalando-deszkak.html` munkalista mind a 7
"élő board" sorát begyűjtötte a Bluefin gyártói oldaláról
(`Kezdők_tanácsok/SUP adatok_élő.docx`) és átadta beépítésre. Mind a 7
tétel `verify-specs --board <slug> --set ...`-tal frissítve
(`width_cm`/`thickness_cm`/`max_load_kg`, a Sprint Touringnál
`length_cm` is):

- `bluefin-new-lite-carbon-premium`: szélesség 76cm, vastagság 15cm
- `bluefin-orange-carbon-premium`: szélesség 81cm, vastagság 15cm, teherbírás 175kg
- `bluefin-mint-carbon-premium`: szélesség 81cm, vastagság 15cm, teherbírás 175kg
- `bluefin-sprint-high-performance-touring`: hossz 430cm, szélesség 76cm, vastagság 16cm, teherbírás 190kg
- `bluefin-mammoth`: szélesség 153cm, vastagság 20cm, teherbírás 500kg
- `bluefin-tandem`: teherbírás 240kg
- `bluefin-rogue-performance-touring`: szélesség 76cm, vastagság 16cm, teherbírás 170kg

A már meglévő mezők (hossz, súly) minden sorban egyeztek a docx-ben
szereplő gyártói adattal — eltérés nem volt. Verifikálva: `list-incomplete
--source bluefin` a frissítés után **0 pending + 0 élő boardot** mutat.
A pending jelöltek (41 db, más forrásokból) érintetlenek, azok
moderációja külön tétel.

### F2.1-utó-13 — pending Aqua Marina/Indiana jelöltek adatai (2026-08-17)

A felhasználó a `Kezdők_tanácsok/SUP adatok_2.docx`-ben 33 tételben (több
alváltozattal) gyűjtötte be a hiányzó Aqua Marina- és Indiana-specifikációkat
gyártói forrásból. A pending jelöltek 41 hiányos tételéből **23 candidate**
`verify-specs --candidate <id> --set specs.<mező>=<érték>`-tal lezárva (a
docx táblázatai/számai a meglévő DB-adattal — hossz/szélesség/vastagság/súly
— kereszt-ellenőrizve, csak egyértelmű egyezésnél töltve):

- **Aqua Marina** (teherbírás, néhol szélesség/vastagság/hossz/súly is):
  RAY LED, Atlas BT23ATP, Magma, Monster (mindhárom pending példány),
  Breeze, Beast, Super Trip Tandem (2 pending példány), Super Trip 12'6,
  Stand up RACE (mindkét pending példány, súly), Racing Airship (súly),
  Fusion 10'10", MEGA, Vibrant Touring, Turbo AMGO 366PFS, Blade WindSUP
  (hossz is), Glow, Vapor 10'4", NUTS RENTAL, Too Much WIKIWIKI.
- **Indiana Paddle & Surf** (súly, néhol hossz is): 8'6 és 8'1 Wave Carbon,
  5'10 és 5'8 Surf Hardboard (előbbinél hossz is), 12'6 Touring, 11'5 Heavy
  Duty Rent & Station.

**Indiana teherbírás — utólag lezárva (2026-08-17, ugyanaznap):** a docx nem
adott explicit "max load"-ot, csak "Rec. rider weight" TARTOMÁNYT (pl.
70-90 kg). A felhasználó megnézett egy Indiana 2020-as árlista-PDF-et
(supkultur.de) egy külön "max load" mező reményében — az kizárólag
méret/térfogat/ár adatot tartalmaz, teherbírást SEMMILYEN formában nem ad.
Nincs jobb forrás, ezért a felhasználó explicit döntése alapján (2026-08-17:
„a rec jelentése: recommended rider weight, tehát lehet ez a max load")
a **tartomány felső határa került a `maxLoadKg`-ba** a 6 fent frissített
Indiana-tételnél (8'6 Wave Carbon 90kg, 8'1 Wave Carbon 80kg, 5'10 Surf
Hardboard 75kg, 5'8 Surf Hardboard 75kg, 12'6 Touring 110kg, 11'5 Heavy
Duty 120kg) — **KÖZELÍTÉS**, nem hivatalos gyártói "max load" címke, ha
később előkerül pontosabb szám, felülírandó.

**3 nem-deszka tétel elutasítva (2026-08-17, ugyanaznap):** a docx explicit
kérte a kivételüket (a `looksLikeNonBoardModel` szűrő nem kapta el, mert a
névben nincs kulcsszó). Admin-felület helyett — a Chrome-bővítmény ebben a
munkamenetben nem volt elérhető, a felhasználó a közvetlen scriptes utat
választotta — pontosan a `candidates.server.ts` `rejectCandidate()`
logikájával (`catalog_candidates.status='rejected'`,
`reviewed_by=<admin profil id>`, csak `status='pending'` sorra):
`Aqua Marina ISLAND` (felfújható platform, url `AQUA-MARINA-ISLAND-2020`),
`Aqua Marina Motion BT 88821` (gumicsónak, url `aqua-marina-motion-255-cm-bt-88821`),
`Aqua Marina COIL V2 B0303930` (biztonsági kötél/leash, url
`aqua-marina-coil-10-7mm-v2-b0303930`). `list-incomplete` ezután egyiket sem
mutatja (sem hiányzóként, sem kihagyottként).

**Az 5 "duplikátum" tétel közül 2 lezárva hivatalos gyártói forrással
(2026-08-17, ugyanaznap):** a felhasználó kereszt-hivatkozás helyett a
hivatalos `aquamarina.com` termékoldalakat nézte meg — pontosabb, mint a
pending-pending párosítás:
- **ATLAS**: az AMH jelöltnek hiányzó szélessége (86cm) előbb a sup-deszka
  ikerpárból (`Atlas 12'0" BT-23ATP`, azonos vastagság+teherbírás) került
  átvételre, majd a hivatalos `aquamarina.com/products/advanced-all-around/atlas/`
  oldal FÜGGETLENÜL megerősítette (366×86×15cm, 11,8kg, 180kg, BT-23ATP) —
  a kereszt-hivatkozás helyesnek bizonyult.
- **Coral Raspberry (BT-23COPR)**: a hivatalos `aquamarina.com/products/
  advanced-all-around/coral/` oldal a Raspberry változatra PONTOSAN a
  pending jelölttel egyező méretet ad (310×78×12cm, 9,0kg) — a hiányzó
  teherbírás (105kg) közvetlen gyártói adat, nem következtetés.

**A teljes hivatalos katalógus (`aquamarina.com/sup/`) átnézve — még 1
tétel lezárva, 2 nyitva:**
- **AMH "Super Trip Family 12'6"** (836b3476): a hivatalos oldal szerint
  a "Family Series" a **kategórianév**, nem külön SKU — a jelenlegi
  kínálatban EGYETLEN 12'6"-os Super Trip van (`BT-24ST01`,
  `aquamarina.com/products/family/supertrip`: 381×86×15cm, 220kg max),
  ami pontosan egyezik a sup-deszka BT24ST01-es, már korábban lezárt
  jelölttel is. Hossz/szélesség/vastagság/teherbírás beírva (381/86/15/220);
  a súlyt (12,5kg a DB-ben, 11,6kg hivatalosan) NEM írtam felül, mert az
  nem szerepelt hiányzóként.
- **AMH "CORAL Stand up"** (87a721e2) — **LEZÁRVA**: a hivatalos
  `coral-ns` (Night Fade, BT-23COPN) oldal ellenőrzésekor kiderült, hogy a
  Night Fade specifikációja PONTOSAN megegyezik a Raspberryével (310×78×12cm,
  9,0kg, 105kg max) — színtől függetlenül azonos érték, tehát a 105kg
  teherbírás biztonsággal beírható volt akármelyik színváltozatról legyen
  is szó (a jelölt saját 8,6kg súlya változatlan maradt, csak a teherbírás
  íródott be).
- **AMH "Super Trip 12'2"** (8f082d57, 370cm) — **NYITVA**: a hivatalos
  kínálatban NINCS 12'2"-es Super Trip (csak View 11'2"/340cm, 12'6"/381cm
  és Tandem 14'0"/427cm létezik) — nem párosítható megbízhatóan egyikkel
  sem, lehet kifutott/régebbi modell.

**`Aqua Marina HYPER 11'6"` — LEZÁRVA**: a jelölt saját `rawTitle`-je
("Aqua Marina HYPER 11'6" 3.5 m, 150kg-ig teherbírás") tartalmazta az
adatot — beírva.

**Indiana oldalak közvetlen ellenőrzése — blokkolva (2026-08-17)**: a
`indiana-paddlesurf.com` a 3 maradék tételre (5'10 Emilien Badoux
Shortboard, 11'6 Touring Lite, 10'6 Allround Carbon Rental) HTTP 403-mal
válaszolt a `WebFetch`-re (bot-védelem) — ez valószínűleg ugyanaz az ok,
ami miatt eredetileg is kézi gyűjtés kellett hozzájuk. Nyitva maradtak,
csak kézi/gyártói forrásból zárhatók.

**Nyitva maradt tételek (5):**
1. **3 Indiana-tétel adat nélkül**: 5'10 Emilien Badoux Shortboard, 11'6
   Touring Lite, 10'6 Allround Carbon Rental.
2. **Indiana 10'6 Allround Carbon Rental ⟷ docx "10'7 Heavy Duty Rent &
   Station"**: szélesség+vastagság egyezik (81,3×12,7cm), de a név és a
   hossz (320 vs 322,6cm) eltér — bizonytalan, hogy ugyanaz a termék-e, nem
   lett automatikusan összepárosítva.
3. **AMH "Super Trip 12'2"** — ld. fent, nincs ilyen a hivatalos
   kínálatban.
4. **Adatminőségi mellékleletek** (nem blokkoló, csak jelezve): több Aqua
   Marina Hungary jelöltnél `lengthCm`/`weightKg` gyanúsan azonos (pl.
   L=210 vagy 381, Wt=12,5) több, egyébként különböző terméknél —
   feltehetően crawler-parszolási hiba, nem ebben a körben javítva, mert
   a `lengthCm` ezeknél nem szerepelt a „hiányzik" listán (tehát a report
   nem jelezte).

**A fennmaradó 4 tétel lezárva (2026-08-18) — a `list-incomplete` most 0
pending jelöltet mutat.** A `indiana-paddlesurf.com` élő oldala továbbra is
403-mal blokkolja a lekérést (Cloudflare bot-védelem, `WebFetch`-csel is),
de a **Wayback Machine**-en (`web.archive.org`) korábbi, sikeres crawl-ok
találhatók pontosan ugyanahhoz az SKU-hoz, mint a candidate URL-je —
ez lett az elsődleges forrás (nem a docx, amely ezt a 3 Indiana terméket
NEM tartalmazza, ellenőrizve grep-pel a `SUP adatok_2.docx`-ön: a docx
csak rokon, de más SKU-jú "Surf Hardboard"/"Touring Inflatable"/"Heavy
Duty" modelleket sorol, eltérő méretekkel — ezért NEM cserélhetők be):
- **Aqua Marina Super Trip 12'2** (8f082d57, 370cm): a candidate saját
  forrás-oldala (`aquamarinahungary.com`, ugyanaz az URL, amit a crawler
  már látott) NYERS HTML-jében (nem csak AI-összefoglalóban, `curl`-lal
  kikeresztezve) benne volt a korábban hiányzónak jelzett méret+teherbírás:
  „Mérete (370m x 82x 15m) Max. 210kg" — a JSON-LD leírás SKU-ja `BT-21ST01`,
  tehát ez egy valódi, önálló modell (nem hiba/duplikátum), csak a crawler
  parszolása hagyta ki eredetileg. Beírva: hossz 370, szélesség 82,
  vastagság 15, teherbírás 210 kg (súly 12,5 kg már megvolt).
- **Indiana 5'10 Emilien Badoux Shortboard** (3ae7603d, SKU 3130SL): Wayback
  2025-05-19-i mentés — „Weight: 2,5 kg Recommended Rider Weight: 50-80 kg".
  Beírva: súly 2,5 kg, teherbírás 80 kg (a 2026-08-17-i Indiana-döntés
  szerint: rec. rider weight felső határa = max load közelítés).
- **Indiana 11'6 Touring Lite** (3ec73f6e, SKU 1004SQ): a candidate saját
  SKU-ja (`1004sq`) nem archiválva, DE a DB-ben már rögzített méretek
  (350,5×76,2×12 cm, 243 L) BETŰRE egyeznek a testvér-SKU `1004SL` Wayback-
  mentésével (2025-04-28: „Weight: 8,3 kg Recommended Rider Weight:
  50-90 kg") — ez ugyanaz a fizikai deszka, csak színváltozat (a candidate
  saját `rawTitle`-je is „…Inflatable", a `1004SL` oldal `<title>`-je
  szó szerint egyezik). **Fontos: ez NEM ugyanaz, mint a docx „Indiana
  11'6 Touring Inflatable" tétele** (78,7×15 cm, 9,9 kg, 70-100 kg) — az
  a "Lite" jelző nélküli, nehezebb testvérmodell, más méretekkel, ezért
  a docx-adat itt tudatosan NEM lett felhasználva. Beírva: súly 8,3 kg,
  teherbírás 90 kg.
- **Indiana 10'6 Allround Carbon Rental** (82b6ff0c, SKU 2052SN): Wayback
  2025-07-12-i mentés (a legfrissebb, 2025-11-i mentés már csak a
  Cloudflare „Please wait…" közbenső oldalt őrizte) — „Weight: 12 kg
  Recommended Rider Weight: 50-90 kg", szélesség+vastagság (81,3×12,7 cm)
  egyezik a DB-vel. A korábban feltételezett docx-párosítás („10'7 Heavy
  Duty Rent & Station", 13 kg, 50-90 kg) **feleslegessé vált** — a saját
  SKU közvetlen forrása pontosabb, a bizonytalan kereszt-párosítást nem
  kellett felhasználni. Beírva: súly 12 kg, teherbírás 90 kg.

**Módszertani tanulság:** ha egy forrás élőben bot-védelemmel blokkol, a
Wayback Machine CDX API-ja (`web.archive.org/cdx/search/cdx?url=...`)
gyakran talál korábbi, tiszta HTML-mentést UGYANAHHOZ a termék-URL-hez —
érdemes ezt megnézni a kereszt-hivatkozásos párosítás/docx-hiányra
hagyatkozás ELŐTT, mert pontosabb (közvetlen gyártói adat, nem
következtetés).

Ezzel az F2.1-utó-13 kör lezárva: a `list-incomplete` 0 pending jelöltet és
0 hiányos élő boardot mutat.

**A 22 „kihagyva" tétel elutasítva (2026-08-18, felhasználói jóváhagyással).**
Kajak (6), vízi platform (3), uszony/fin (6), biztonsági kötél/pánt (4),
evező (1), horgászbot (1), bokapánt (1) — egyik sem SUP-deszka. Az elutasítás
pontosan a `candidates.server.ts` `rejectCandidate()` szemantikájával ment
(`status='rejected'`, `reviewed_by=b57fc05b…` = a Sztellik_78 admin profil,
`.eq("status","pending")` őrfeltétellel), eldobható scriptből, amely a
`commandListIncomplete` szűrőjét (accessoryType===null + hiányzó mérőszám +
`looksLikeNonBoardModel`) reprodukálta — előbb DRY RUN-nal ellenőrizve, hogy
pontosan a listázott 22 sort érinti. Eredmény: 22/22, a `list-incomplete`
mindhárom szakasza üres.

### F2.1-utó-14 — forrás-felderítés a gyártói anyag alapján (2026-08-18)

A felhasználó összeállította a `Kezdők_tanácsok/nepszeru_sup_markak_es_
forgalmazok.md`-t (12 népszerű márka + hazai forgalmazóik), azzal a céllal,
hogy a deszka-lista sok új modellel bővüljön. Mind a 12 márkaoldal és 6 hazai
forgalmazó **végigprobe-olva** (`probe`, DB-érintés nélkül). Az eredmény
lényege: **a jelenlegi, tudatosan LLM-mentes pipeline-nal szinte egyik új
forrás sem használható**, mert nincs rajtuk Product JSON-LD:

| Forrás | Termék-URL | Eredmény |
|---|---|---|
| star-board.com | 445 | JSON-LD ✓, de spec **renderelés után SINCS** |
| funwaterboard.com | 715 | JSON-LD ✓, de **rossz márkanév** minden terméken |
| gladiatorsup.com | 154 | nincs JSON-LD |
| zraysports.com | 154 | nincs JSON-LD |
| wakeshop.hu | 1991 | nincs JSON-LD; ténylegesen 1 db SUP a kínálatban |
| jobesports.com | 5000 | nincs JSON-LD a mintákon, több oldal 403 |
| redpaddleco.com · redpaddle.hu | 0 | nincs termék-sitemap (404) |
| duotonesports.com · bestwaycorp.com · decathlon.hu | 0 | nincs termék-sitemap |
| aquatoneair.com · jobe.hu · szorfcenter.hu | — | robots.txt nem elérhető |
| **supcenter.hu** | — | **robots.txt: `Disallow: /`** — tiltott, nem crawlolható |

Két megállapítás, amit érdemes megjegyezni:
- **A Starboard a legcsalódtatóbb**: 445 termékoldal, mind deszka, szabályos
  JSON-LD-vel és (az ár-politikának megfelelően) ár NÉLKÜL — de a méret-adat
  sem a nyers HTML-ben, sem a **Playwright-renderelt** szövegben nincs ott
  (ellenőrizve az `F2.1-utó-3` render-fallback tényleges meghívásával két
  terméken: `parseSpecsFromText` mind az 5 mérőszámra `null`-t adott). A
  specifikáció méret-variánsonkénti aloldalon/JS-tabban él. Felvéve 445 üres
  jelöltet gyártana — pont azt a validálási hátralékot, amit most ürítettünk ki.
- **supcenter.hu-t a robots.txt kizárja** (`Disallow: /`), tehát a
  dokumentumban több márkánál is szereplő legfontosabb hazai bolt
  **nem crawlolható** — ezt tiszteletben tartjuk.

**Ami viszont kiderült — a bővítés nagy része MÁR MEGVAN, csak jóváhagyásra
vár:** a `catalog_candidates`-ben **153 pending** sor áll, ebből
**96 deszka-jelölt, MIND az 5 mérőszámmal együtt** (a most lezárt validálási
kör eredménye), plusz 57 kiegészítő (27 pumpa, 25 evező, 5 mentőmellény).
Élő boardból viszont csak **35** van. Tehát a katalógus közel
megnégyszerezhető ÚJ crawl nélkül, pusztán moderálással (`/admin/katalogus`).
Márka szerint a 153: Aqua Marina 110, Indiana 16, Too Much 7, TooMuch 6,
Flowa 4, Coasto 4, PoolStar 2, INTEX 1, márka nélkül 3. (A „Too Much"/
„TooMuch" kettősség márka-összevonást igényel a moderálásnál.)

### F2.1-utó-15 — Shopify-adapter + a Starboard-katalógus behozása (2026-08-19)

**Megépült a Shopify-ág** (`tools/catalog-watch/shopify.ts`, kapuk zöldek:
typecheck · lint · **850 vitest**, +27 új). A részletes indoklás és a
használat a `tools/catalog-watch/README.md` „Shopify-mód" szakaszában;
a lényeg: a Shopify-boltok `/products.json` végpontja strukturáltan adja a
katalógust (`vendor`, `product_type`, `variants[]`), miközben a termékoldal
HTML-jében nincs méret. 445 oldalletöltés helyett 2 lapozott kérés.

Két tervezési döntés, ami a SUP-specifikumból jön:
- **Méretenként külön jelölt**, mert a méret maga a termék (a Deszkaválasztó
  hossz/szélesség alapján pontoz). A KIVITELI változatok (Carbon Reflex /
  Xtec / Rhino) viszont ÖSSZEFÉSÜLŐDNEK — ugyanaz az elv, mint a
  színváltozatoknál. Azonos dimenzió eltérő ŰRTARTALOMMAL két külön deszka.
- **A modellnév a HIVATALOS gyártói név** (felhasználói döntés, 2026-08-19):
  a kereskedői oldalak átnevezik a terméket („ISUP", „2024", csomagajánlat),
  amitől ugyanaz a deszka több néven kerülne be.

**A hiányzó specifikációk vadászata — végigjárva, eredménytelenül.** A
`/products.json` hosszt/szélességet/űrtartalmat ad, de vastagságot, súlyt és
**teherbírást** nem. Amit megnéztem:
- **A gyártó saját oldala**: 0 spec-táblázat a HTML-ben; a Shopify Section
  Rendering API-val előhúzott SPECIFICATIONS fül tartalma a GO-nál szó
  szerint kitöltetlen („Lorem ipsum"). Playwright-renderelés után sem jön
  elő semmi (ellenőrizve két terméken, mind az 5 mérőszám `null`).
- **Európai kereskedők** (felhasználói kérésre): 4 elérhető Shopify-bolt
  (thesupco UK, zzsurf IT, thesupstore UK, pooleharbour UK; a Nootica 403).
  Együtt is csak **40 Starboard-terméket** árulnak a gyártó 97 modelljéhez
  képest, és ebből **mindössze 4** ad BIZTONSÁGOSAN kinyerhető teherbírást.
  A többinél egyetlen leírás 3-5 méretet fed le („Rider Weight Up to 120kg
  Up to 100kg Up to 85kg"), ahol az automata parse az első értéket az
  ÖSSZES méretre ráírná — ez hibás adat lenne, ezért NEM építettem meg.
  Az elv itt kötelező: **inkább hiányozzon, mint tévedjen**.

**Miért nem „fél adattal is jó" (fontos):** a `passesHardFilter`
(`select.ts:143`) KÖTELEZŐ biztonsági mezőként kezeli a teherbírást —
`maxLoadKg === null` esetén a deszka kiesik a kemény szűrőn, tehát **soha
nem kerülhet ajánlásba**. Teherbírás nélkül a Starboard-tételek csak a
listákban látszanának.

**KORREKCIÓ (2026-08-19, ugyanaznap) — a fenti „nem szerezhető meg"
következtetés TÉVES volt.** A felhasználó megmutatta, hogy az iCON
termékoldalán a SPECIFICATIONS fül alatt ott a teljes táblázat. A hibám:
a **GO** terméket vizsgáltam, ahol a fül tényleg kitöltetlen („Lorem ipsum"),
és egyetlen mintából általánosítottam az egész katalógusra.

A tábla egy külső Shopify-app (TablePress, `tablepress.identixweb.com`)
JS-sel betöltött eleme: a nyers HTML-ben 0 `<table>` van, és a Shopify
Section Rendering API sem adja vissza — **böngésző-rendereléssel viszont
pontosan kiolvasható**, méret-oszloponként. Ezért megépült a
`spec-table.ts` (ld. a következő szakaszt), és a hiányzó mezők NAGY RÉSZE
automatikusan kitöltődött. A kereskedői utat tehát végül nem is kellett
használni.

**Behozva a bevált „for_validate" úton (felhasználói döntés):** a crawl
lefutott élesben — 97 termék → 284 méret-variáns → **277 új jelölt** (7 már
ismert deszkára illeszkedett). A munkalista generálva:
`for_validate/2026-08-19-validalando-deszkak.html` (276 tétel, checkboxokkal;
a mappa gitignore-olt). Hiányzik: 268-nál vastagság+súly+teherbírás, 8-nál
ezeken felül a szélesség is. A kitöltés ugyanaz a menet, ami az Aqua
Marina/Indiana körben bevált: a felhasználó gyártói forrásból gyűjti,
a karmester `verify-specs --candidate <id> --set specs.<mező>=<érték>`
paranccsal építi be, és a beírt mezők zárolódnak.

## F2.2 — Visszajelzés-csatorna a fejlesztőnek (2026-07-28)

Felhasználói kérés a katalógus-források felderítése közben: kelljen egy felület,
ahol a felhasználó **hibát jelenthet**, illetve **hiányzó boltot vagy
deszka-modellt javasolhat** — a tartalom NEM a nagyközönségnek, hanem a
fejlesztőnek szól. Minta: a PecApp `send-feedback` megoldása. Kapuk zöldek:
typecheck · lint · **728 vitest**.

**Elkészült:**
- ÚJ core-migráció `20260717092100_core_feedback.sql`: `feedback` tábla
  (kind: bug/shop/board/idea/other, message, page_path, status, admin_note).
  RLS: **írni** csak bejelentkezett, megerősített e-mailű user a SAJÁT nevében;
  **olvasni CSAK admin** (a beküldő a saját sorát sem látja vissza — ez nem
  közösségi felület); **állapotot** csak admin ír. Oszlop-védő trigger
  (a beküldő nem állíthatja magát „kész"-re) + **gyakoriság-korlát
  definer-triggerben** (óránként 5/user).
- pgTAP `07_feedback_test.sql`: saját néven írás, idegen név tiltva,
  e-mail-gate, anonim tiltás, admin-olvasás/állapotkezelés, rate limit,
  hossz- és kind-kényszerek.
- `@core/feedback`: adatréteg + tiszta validálás (13 teszt) és **best-effort
  Resend-értesítés** (13+4 teszt; kulcs nélkül csendben kimarad, a levél HTML-
  escape-eli a beküldött szabad szöveget).
- `/visszajelzes` űrlap (requireUser + e-mail-gate, `?tema=`/`?ut=`
  előválasztással) és `/admin/visszajelzesek` (szűrés állapotra, jegyzet).
  Mindkettő CORE-route, mint az F1.12 analitika — a csatorna keresztmetszeti.
- Belépési pontok: lábléc-link mindenhol, plusz kontextusos hívás a
  `/deszkak` és `/szolgaltatok` lista alján (`FeedbackPrompt`).

**Miért kötelező a bejelentkezés:** a hitelesítés nélküli visszajelzés-végpont
levélbombázható és szemét-özönnel eltömíthető — ez a hiba a testvér-projektben
élesben elő is fordult. A projekt vélemény- és jelentés-folyamatai ugyanígy
e-mail-gate-eltek.

**A gyakoriság-korlát az ADATBÁZISBAN van**, nem az alkalmazásban: a beküldő a
saját sorait sem olvashatja vissza (admin-only select), tehát az app nem tudná
megszámolni őket; és így a korlát a REST-en át is él, nem csak a mi űrlapunkon.

**Verifikáció:** `/visszajelzes` kijelentkezve → 302 a belépőre;
`/admin/visszajelzesek` → 302; a lábléc-link és a `/deszkak` kontextusos hívás
renderel; robots.txt tiltja a `/visszajelzes`-t. A lap-szélesség invariáns
teszt **elkapott két eltérést** (max-w-2xl/4xl a kötelező max-w-5xl helyett) —
javítva.

**Élesítve (2026-07-29):** a migráció kitolva (`npm run sb -- db push
--include-all`, a két F2.3-migrációval együtt); REST-tel verifikálva: anon
SELECT `[]` (RLS admin-only olvasás áll), anon INSERT `401` (bejelentkezés
kell).

**Böngésző-verifikáció (2026-07-31, Playwright, admin-session):** teljes kör
kipróbálva — `/visszajelzes` űrlap kitöltve (`Ötlet, javaslat` + leírás) →
„Köszönjük! Megkaptuk a visszajelzést." → a bejegyzés megjelent a
`/admin/visszajelzesek`-en helyes címkével/időbélyeggel → állapot `Elvetve`-re
állítva + jegyzet mentve, „Mentve." visszaigazolás. A teszt-bejegyzés
szándékosan `[TESZT]`-jelölt és `Elvetve` állapotban maradt (nem törölve, a
csatorna napló-jellege szerint). **HÁTRA:** `RESEND_API_KEY` +
`FEEDBACK_TO_EMAIL` beállítása, ha kell e-mail-értesítés (opcionális, addig a
DB + admin felület a csatorna).

## F2.3 — Felszerelés (kiegészítők) — 1. szakasz: útmutató (2026-07-28)

Terv: `~/.claude/plans/rendben-kezdj-nk-a-2-vel-nested-wand.md` (a munkamenet
egy külső-SSD-megszakadás után folytatódott, a terv a lemezen maradt kész
állapotban). A domain-review 2.8 nyitott tétele (leash/mentőmellény/pumpa/
szárazzsák „legalább annyira fontos, mint a deszka mérete") + vásárlói igény
(„melyik evezőt vegyem?") adja az indokot. Kiosztás: scaffolder. Kapuk zöldek:
typecheck · lint · **737 vitest** (+9 új).

**Elkészült — csak tartalom, séma-módosítás NÉLKÜL:**
- `src/modules/catalog/gear.ts`: zárt 8-elemű `GEAR_CATEGORIES` lista (evező ·
  póráz · mentőmellény · pumpa · szárazzsák · ülés · uszony · táska) +
  `CORE_SAFETY_SOURCE`/`OWN_SAFETY_CATEGORIES` — melyik kategória-oldal
  hasznosítja újra a meglévő core `safety.riverLeash.*` szöveget (póráz,
  mentőmellény), melyiknek van saját catalog-szövege (pumpa, szárazzsák), és
  melyiknek nincs biztonsági tartalma (evező/ülés/uszony/táska — nincs
  `SafetyNote` ezeken, tudatosan nem kitalált tartalom).
- `app/routes/felszereles.tsx` (kategória-áttekintő) +
  `app/routes/felszereles.$kategoria.tsx` (útmutató: mire való · mire figyelj
  vásárláskor · opcionális `SafetyNote` · kapcsolódó linkek; ismeretlen
  kategória-slug → 404 az `isGearCategory` őrrel).
- `src/modules/catalog/module.ts`: `nav.gear` bejegyzés `order: 15` (Deszkák=10
  és Spotok/Szolgáltatók=20 közé — az érték a tényleges module.ts-ekből
  ellenőrizve), a két új route regisztrálva.
- i18n: `catalog` namespace `gear.*` fája hu+en, kulcs-paritás ellenőrizve
  (ad hoc szkripttel — nincs a repóban erre kész teszt, follow-up alább).
- `src/core/seo/sitemap.ts`: a `/felszereles` + 8 kategória-út felvéve a
  `STATIC_SITEMAP_PATHS`-hoz (core fájl, de a minta megegyezik a
  deszkak/spotok/szolgaltatok korábbi bővítésével).

**Integráció a meglévő felületekbe (ez zárja le a domain-review 2.8-at):**
- `app/routes/deszkavalaszto.gear.ts`: TISZTA `recommendGearFor({water, use,
  storage})` — ROUTE-rétegben él (nem catalogban, nem advisorban), mert a
  `GearCategory` (catalog) és a `WaterChoice`/`AdvisorUse`/`StorageChoice`
  (advisor) típusokat köti össze — a modul-szerződés csak itt engedi (F1.5/F1.6
  mintája). Mindig póráz (víztípus szerinti szöveggel) + mentőmellény;
  felfújható-tárolás-preferenciánál pumpa-említés; túra célnál szárazzsák. 7
  unit-teszt. Az „Ez is kell hozzá" `Card`-blokk a Deszkaválasztó eredménye
  alatt, a meglévő folyó-`SafetyNote` alatt jelenik meg.
- `app/routes/spotok.$slug.tsx`: a meglévő folyó-póráz `SafetyNote` linket
  kapott a `/felszereles/poraz`-ra (a szöveg változatlan).

**Tudatos döntés (a terv nem rögzítette egyértelműen):** a `tapasztalat`
(experience) bemenet NEM számít a `recommendGearFor`-ban — a terv 84–87. sora
csak víztípus/tárolás/cél szerint variál, ezt követtük a task-összefoglaló
helyett (a terv az irányadó dokumentum).

**Follow-up (nem blokkoló):** nincs repo-szintű i18n kulcs-paritás teszt (csak
ad hoc szkripttel verifikálva) — érdemes lehet állandó tesztet írni rá, ha ez
elvárás a jövőben. Az `e2e/a11y.spec.ts` és `e2e/public-paths.spec.ts` bővítve
lett az új oldalakkal, de **nem futott** (nincs helyi Playwright-böngésző +
az e2e-suite élő távoli Supabase-seedet igényel) — a CI-ban fut le előbb.

## F2.3 — Felszerelés — 2. szakasz: `kind`-diszkriminátor + adatréteg-szűrés (2026-07-28)

Kiosztás: db-engineer. A terv 97–194. sora. **Csak a migráció + adatréteg-szűrés
készült el ebben a körben, route/UI szándékosan NEM** — a séma-változtatás a
legkritikusabb rész (a Deszkaválasztó SOHA nem ajánlhat kiegészítőt deszkaként),
ezt kellett először stabilan, tesztelve látni. Kapuk zöldek: typecheck · lint ·
**746 vitest** (+8 új). **A migráció NEM lett élesre tolva** (`db push` nem
történt) — az külön, felhasználói jóváhagyással induló lépés.

**Két ÚJ additív migráció** (modul-szerződés: catalog és reviews séma-tulajdona
külön fájlban):
- `20260717092200_catalog_board_kind.sql`: `boards.kind` (`board`/`accessory`,
  default `board` — a meglévő 20 seed-sor érintetlen) + `accessory_type` (zárt
  8-elemű lista, a `src/modules/catalog/gear.ts` `GEAR_CATEGORIES`-ével azonos)
  + `board_type` NOT NULL feloldva + feltételes `boards_kind_shape` CHECK
  (idempotens `do $$` blokk) + `boards_kind_idx`. RLS változatlan (a meglévő
  policyk kind-agnosztikusak).
- `20260717092300_reviews_recommend.sql`: `board_reviews.would_recommend`
  (nullable — régi sorok `null`-lal maradnak, az aggregátor ezekből továbbra is
  a `rating_overall >= 4` szabállyal származtat) + `ratings jsonb` (**egyelőre
  NEM HASZNÁLT**, a jövőbeli kategória-szempontokhoz — a szabály a kódban
  kimondva: a 4 deszka-oszlop marad a kanonikus tároló, minden ÚJ szempont ide
  megy; `jsonb_typeof = 'object'` CHECK az alak védelmére).

**pgTAP bővítés** (`10_catalog_test.sql`, `20_reviews_test.sql`): seed-assert
(0 nem-`board` sor élesben), `boards_kind_shape` pozitív + 4 negatív eset
(23514), RLS kiegészítő-sorra; `would_recommend`/`ratings` saját véleményben
írható, miközben a `verified_owner`/`status` védve marad. **A CI `rls-tests`
jobban fut le** (helyben nincs Docker/Postgres).

**Adatréteg-szűrés — korrektségi invariáns, `kind='board'` mindenhol ahol
deszka-listát ad vissza:**
`catalog/data/boards.server.ts` (`listBoards`, `getBoardBySlug` — kiegészítő
slugjára 404), `catalog/data/candidates.server.ts` (`listBoardChoices`,
`listBoardsForLifecycle`), `tools/catalog-watch/store.ts`
(`listBoardsForLifecycle`, `listBoardsForMatch`). Kivétel, dokumentálva:
`resolveUniqueSlug` szándékosan kind-agnosztikus (a slug az egész táblán belül
egyedi kell legyen).

**Őrszem-teszt** (`app/routes/deszkavalaszto.kind.test.ts`, 8 teszt): ál-Supabase-
kliens vegyes (deszka+kiegészítő) adaton igazolja, hogy a szűrt függvények csak
deszkát adnak vissza; plusz forrás-szintű lefedettség-ellenőrzés, ami minden
`boards`-olvasásra megköveteli a `.eq("kind", "board")`-ot. Mutációs próbával
igazolva: a szűrő kivételekor a teszt elhasal.

**Follow-up (ekkor még nyitva, a folytatásban lezárva — ld. alább):** route+UI a
termékadatlaphoz, `would_recommend` bekötése, 3. szakasz catalog-watch besorolás.

### 2. szakasz folytatása — termékadatlap + „ajánlom/nem ajánlom" (2026-07-29)

A ui-builder subagent munkamenet-kvótába futott a felderítő fázisban (fájlt nem
írt) — a karmester vette át és fejezte be közvetlenül. Kapuk zöldek: typecheck ·
lint · **753 vitest** (+7 új).

**Elkészült:**
- `reviews/aggregate.ts`: a `percentRecommend` az EXPLICIT `would_recommend`
  értéket veszi elsőbbséggel; `null` (bevezetés előtti sor) esetén marad a régi
  `rating_overall >= 4` származtatás — a meglévő százalékok nem torzulnak
  visszamenőleg. Táblázatos teszt a keveredésre.
- `reviews/types.ts`: `getReviewDimensions(target)` — `"board"` a mai 4
  szempont, `"accessory"` `[]` (a terv 166. sora szerinti felkészítés, ZÁRT
  változtatás: a `REVIEW_DIMENSIONS` maga NEM változott, az advisor↔reviews
  őrszem-teszt továbbra is érvényes).
- `reviews/ui/ReviewSummary.tsx`: `dimensions` prop (alapértelmezetten a mai 4
  szempont) — üres tömbre a dimenzió-sávok blokkja nem renderel, csak az
  összesített sáv marad. Új teszt fedi.
- `reviews/data/reviews.server.ts` + `app/routes/deszkak.$slug.tsx`: az
  „Ajánlanád másnak?" választó (igen/nem/—) az űrlapon, `would_recommend`
  mezőként mentve.
- `catalog/data/boards.server.ts`: `getAccessoryBySlug` és `listAccessories`
  (kategória-szűrős VAGY teljes lista) — KÜLÖN függvények a deszka-lekérdezésektől
  (nem bővítjük ki azokat kind-paraméterrel, más invariánst őriznek), mindkettő
  `kind='accessory'`-ra szűr.
- `catalog/ui/AccessoryCard.tsx`: önálló komponens a `BoardCard` helyett (nincs
  `board_type`/stabilitási index, a kártya olvashatóbb, ha ezt eleve nem
  tartalmazza feltételek mögé rejtve).
- `app/routes/felszereles.$kategoria.tsx`: a kategória-oldal most már lekéri és
  kártyarácsban listázza az adott kategória termékeit (üres-állapot üzenettel —
  ma minden kategória üres, nincs még kiegészítő-sor).
- ÚJ `app/routes/felszereles.$kategoria.$slug.tsx`: termékadatlap (specifikáció,
  árak — a meglévő `board_prices`/`listBoardPrices` változatlanul szolgálja ki,
  `board_id`-n keresztül kind-agnosztikus —, Közös nevező dimenziók NÉLKÜL,
  vélemény-lista+flag, egyszerűsített űrlap [összbenyomás + ajánlom/nem ajánlom
  + szabad szöveg, NINCS 4 dimenzió-select], JSON-LD `Product`). Regisztrálva a
  `catalog/module.ts`-ben.
- `core/seo/sitemap.ts` dinamikus loadere (`sitemap-xml.ts`) mostantól a
  kiegészítőket is felveszi (`kind='accessory'`, MOST 0 sor).

**Az őrszem-teszt (`deszkavalaszto.kind.test.ts`) frissítve:** a lefedettség-
ellenőrzés MOST már `.eq("kind", "board")` VAGY `.eq("kind", "accessory")`-t
fogad el (regex) — az invariáns nem az, hogy csak deszkát lehet lekérdezni,
hanem hogy egyetlen `boards`-olvasás se maradjon kind-szűrő NÉLKÜL. Mutációs
próbával újra igazolva (a szűrő kivételekor a teszt elhasal, visszaállítva zöld).

**HÁTRA (ekkor még nyitva, lezárva alább):** 3. szakasz: catalog-watch
`classifyProduct` (szűrés helyett besorolás).

### 3. szakasz — catalog-watch: szűrés helyett besorolás (2026-07-29)

Terv 197–216. sor. Kapuk zöldek: typecheck · lint · **760 vitest** (+12 új).
Migráció nem kellett (a `catalog_candidates.extracted` jsonb-szerződés a
`ExtractedBoardData` típuson át már F1.5 óta rugalmas — az `accessoryType`
mező bővítése nem sémaváltozás).

**Elkészült:**
- `tools/catalog-watch/normalize.ts`: a lapos `ACCESSORY_KEYWORDS` lista
  helyett **kategorizált** `ACCESSORY_CATEGORY_RULES` (specifikus→általános
  sorrend, mint a `guessBoardType`) + `MISC_NON_BOARD_KEYWORDS` (ruházat,
  apróság — ezek EGYIK gear-kategóriának sem felelnek meg). `looksLikeBoard`
  (boolean) → **`classifyProduct`** (`{kind:"board"} | {kind:"accessory",
  accessoryType} | {kind:"ignore"}`).
- **Mennyiségi korlát** (a terv kifejezett kérése): `TRACKED_ACCESSORY_TYPES =
  ["evezo","mentomelleny","pumpa"]` — csak ez a 3 kategória termel jelöltet a
  CRAWL-időben; a többi felismert kategória (póráz/szárazzsák/ülés/uszony/
  táska) `ignore` marad, hogy a moderációs sor ne teljen meg aprósággal. A
  moderátor a jóváhagyáskor bármelyik 8 kategóriát választhatja — a korlát
  csak a jelölt-TERMELÉST szűkíti, a moderáció döntését nem.
- `extractProduct` a besorolást is elvégzi és az `ExtractedBoardData.accessoryType`
  mezőbe írja (bővített típus, `src/modules/catalog/types.ts`) — ez adja az
  admin UI kategória-legördülőjének előválasztását, ugyanúgy, ahogy a
  `boardType` tipp is előválasztás.
- `crawl.ts`: a `looksLikeBoard` elágazás helyén `classifyProduct`, `ignore`-nál
  `skippedNonBoard++`, egyébként (board VAGY accessory) jelölt-sor.
- `probe.ts`+`cli.ts`: a próba-kimenet a besorolást mutatja
  (`DESZKA`/`kiegészítő (kategória)`/`figyelmen kívül hagyva`), a verdict-szöveg
  frissítve.
- `candidates.server.ts`: ÚJ `buildAccessoryInsert` (a `buildBoardInsert` párja,
  szándékosan KÜLÖN függvény — más alakot ír, nem közös feltétel-erdő),
  `approveCandidate` mostantól diszkriminált union bemenetet vesz
  (`{kind:"board", boardType}` | `{kind:"accessory", accessoryType}`), ÚJ
  `listAccessoryChoicesByCategory` (egyetlen lekérdezés, kategóriánként
  csoportosítva a merge-célpontokhoz).
- `/admin/katalogus`: a jelölt-kártyán ÚJ **deszka/kiegészítő kapcsoló** (a
  figyelő tippje előválasztja, `extracted.accessoryType`-ból), kiegészítőnél
  kategória-legördülő; az összefésülés-legördülő a kapcsoló szerint vált
  `boardChoices`/`accessoryChoicesByCategory` között (kliens-oldali `useState`,
  a lista már a loaderben lekérve).

**Verifikáció:** 12 új teszt (`classifyProduct` táblázatos + 2 új
`crawlSource`-eset: KÖVETETT evező → jelölt `accessoryType`-tal, NEM követett
táska → `skippedNonBoard`, nem jelölt) + `buildAccessoryInsert` 3 teszt. A
`deszkavalaszto.kind.test.ts` őrszem-lefedettség újra lefuttatva az ÚJ
`kind='accessory'`-lekérdezésekre is — zöld, mutációval igazolva korábban.
i18n kulcs-paritás (hu↔en) ellenőrizve szkripttel.

**Élesítve (2026-07-29):** a migráció kitolva (`npm run sb -- db push
--include-all`, 3 migráció együtt a feedbackkel); REST-tel verifikálva: a 20
meglévő deszka-sor változatlanul `kind='board'`, `boards.accessory_type` és
`board_reviews.would_recommend`/`ratings` oszlop olvasható anonként (üres/null
értékkel, ahogy vártuk).

**HÁTRA:** valós HU-forrás bekötése (`add-source` — lásd a korábban elmentett
boltkutatás-jegyzet) és az első `crawl --dry-run` · böngésző-verifikáció, ha
lesz legalább egy valós kiegészítő-jelölt a moderációs sorban.

## F2.4 — Direkt bolti ár eltávolítása (2026-07-30)

Felhasználói döntés a forrás-bekötés előkészítése közben: a platform NE
mutasson direkt bolti Ft-árat, mert (1) sosem friss (akciók, amiket nem
követünk), (2) ha csak néhány boltot kötünk be forrásnak, az igazságtalan/
hiányos képet ad a ki nem választott boltok kárára, (3) az ár/érték ítélet MÁR
MA IS a közösségé (`board_reviews.rating_value` — „ár-érték" dimenzió), a
nyers Ft elrejtése nem veszi el ezt a jelet. Memóriában rögzítve:
`ar-megjelenites-politika.md`. Kapuk zöldek: typecheck · lint · **760 vitest**
(nem csökkent — egyetlen teszt sem hivatkozott a törölt UI-ra).

**Tudatosan KIVÉTEL — a Deszkaválasztó (F1.6) VÁLTOZATLAN marad** (felhasználói
döntés): a budget-szűrés (a felhasználó SAJÁT megadott büdzséjét párosítja a
katalógus áraival) és az eredmény-kártya ár-kiírása más jellegű, mint egy
bolti ár-lista — nem „ez ennyibe kerül" ténymegállapítás, hanem a felhasználó
saját preferenciájának visszaigazolása.

**Elkészült (`app/routes/deszkak.$slug.tsx` + `felszereles.$kategoria.$slug.tsx`,
azonos mintával mindkettőn):**
- A fejléc „X Ft-tól" jelvénye eltávolítva.
- A teljes „Hol kapható" `Card`-szekció (bolti ár-lista + kimenő linkek)
  eltávolítva.
- A `productJsonLd(...)` hívásból az `offers` mező törölve — a JSON-LD-ben sem
  jelenik meg ár (a keresőmotorok se mutassanak elavult/hiányos ár-snippetet).
- A loaderek már nem hívják a `listBoardPrices`-t (a korábban csak
  megjelenítésre szolgáló lekérdezés fölöslegessé vált) — ez NEM érinti a
  `board_prices` ÍRÁSI oldalát: a catalog-watch (`crawl.ts` `recordPrice`,
  `candidates.server.ts` `recordCandidatePrice`) továbbra is csendben gyűjt.
- Az árva i18n-kulcsok (`catalog.detail.prices/priceFrom/noPrices`) törölve
  hu+en-ből, paritás ellenőrizve.
- Az admin-moderáció (`/admin/katalogus`) ÉRINTETLEN — a moderátor a jelölt
  kártyáján továbbra is látja a crawl-olt árat (belső döntéstámogató adat, nem
  nyilvános megjelenítés).

**Nyitott, még el nem döntött irány** (a memóriajegyzetben rögzítve): kimenő
link egy dedikált árfigyelőre (pl. Árukereső) a saját ár-UI helyett — ha ez
megvalósul, a `board_prices.shop_name`/`url` mezőkre hosszú távon nem is lesz
szükség. Ez KÜLÖN döntés, nem ennek a körnek a része.

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
- `seed.sql`: 9 márka, 20 deszka (+20 ár), 15 spot, 5 provider, 32
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
A 12 migráció + seed a távoli projektre kitolva (2026-07-18, `db push
--include-seed`); élesben ellenőrizve: 20 boards / 15 spots / 5 providers /
32 advisor_weights, anon írás 401.

**Megjegyzések a következő lépéshez (F1.3):**
- `supindex.*` kulcsok a seedben — az algo-engineer validálja a sávokat,
  különösen `storm.level2_cap=0` (II. fok → index 0, spec 9. fejezet).
- A Gauge küszöb-defaultjai (F1.1-jegyzet) innen kötendők be.
- Weather-írás kizárólag service_role (nincs write-policy) — az Edge Function
  ehhez igazodjon.

## F1.3 — Weather + SUP-index (folyamatban)

**1. kör kész (2026-07-18, algo-engineer + karmester-integráció):**
- `src/modules/weather/`: route-mentes manifeszt + registry-regisztráció.
- SUP-index (`sup-index/`): tiszta `computeSupIndex` az 5.1 mind a 6 lépésével
  (storm-override a végén alkalmazva; offshore-szektor `angularDelta`-val;
  minden küszöb/súly konfigból). Kimenet: index (1 tizedes) + státusz-enum
  (safe/caution/danger) + flagek (besodró, neoprén, viharfok) + indoklás
  i18n-kulcsként (nem kész mondat). Táblázatos határeset-tesztek (sávhatárok,
  pont 3,9 plafon, pont 15 lökés/offshore-szélminimum, pont 14 °C, 4,0/7,0).
- Konfig: `config.ts` (típus + defaultok, seed-kulcsokkal egyező) +
  `config.server.ts` (advisor_weights `supindex.*` olvasó, fallback defaultokra).
- Open-Meteo adapter: forecast + marine (tengeri vízhő; belvíznél null — F1),
  injektálható fetch, parse fixture-tesztekkel; null-biztos parse (karmester-fix).
- i18n: `weather` namespace (hu forrás + en tükör), bekötés az ÚJ
  `src/modules/registry-i18n.ts`-en át (app/root.tsx importálja; új modul
  fordítása ide kötendő — a registry.ts-be azért nem, mert azt a RR7
  config-loader is behúzza, és a manifesztnek mellékhatás-mentesnek kell lennie).

**2. kör kész (2026-07-18, algo-engineer): Edge Functionök + cron-előkészítés.**
- `supabase/functions/_shared/` — Deno- ÉS Node-semleges tiszta logika (nincs
  Deno API / `jsr:` import / I/O), Vitesttel tesztelve: `types.ts`, `sup-index.ts`
  (a webes `computeSupIndex` bit-azonos portja + `parseSupIndexConfig`),
  `open-meteo.ts` (parse + injektálható fetch), `storm-scrape.ts` (BM OKF
  tag-toleráns parse + `detectStormLevelChanges`), `weather-sync.ts` és
  `storm-alert.ts` (tiszta batch-orchestrátorok injektált I/O-val, hibatűrők).
- `weather-sync/index.ts` + `storm-alert/index.ts` — vékony Deno-héjak (service-
  role kliens, valós fetch); a repo `tsconfig`-jából kizárva (`*/index.ts`),
  a `_shared` viszont typecheckelt + tesztelt.
- Konfig-bővítés: `tsconfig` (`allowImportingTsExtensions`, index.ts-kizárás),
  `vitest` include (`supabase/functions/**/*.test.ts`), eslint Deno-globális.
- 44 új Vitest-teszt (OKF-fixture 3 állapot, szintváltás 0→1/1→2/2→0/nincs,
  batch spot-hibatűrés, storm-override újraszámítás) — hálózat nélkül. Kapuk
  zöldek: typecheck · lint · 212 vitest.
- `supabase/functions/README.md`: deploy (`npm run sb -- functions deploy …`) +
  cron (Dashboard scheduled VAGY pg_cron+pg_net SQL; óránként / 5 perc ápr–okt).
- **Forrás-választás:** OMSZ viharjelzés (`STORM_SOURCE_URL`, default met.hu
  balatoni oldal) — a hivatalos kiadó, és a négy körzet pontosan a
  `storm_warning_region` seed-értékekkel egyezik; a parser szöveg-alapú, forrás-
  váltásra csak env + needle-lista kell.

**Reviewer-kör (2026-07-18): JÓVÁHAGYVA.** A két SUP-index implementáció
bit-azonossága, az adatkor-szabály, a modul-szerződés és a fail-safe viselkedés
tételesen ellenőrizve. Findingok: M1 (storm-scrape tagadás-vakság — a
storm-alert élesítése előtt KÖTELEZŐ; azonnal javítva negáció-kezeléssel +
UNKNOWN állapottal) · m2 (README: a default forrás csak Balaton-körzetet fed —
javítva) · m6 (explicit verify_jwt=true a config.toml-ben — javítva).

**Follow-upok (nem blokkolók, célfázissal):**
- m3 → F1.3-utó: `supindex.stale_minutes` seed-kulcs holt (a stale-küszöb a
  core `STALE_THRESHOLD_MINUTES` konstansa) — bekötni vagy seedből kivenni.
- m4 → F1.9: Open-Meteo `observed_at` (current.time) tárolása/használata a
  `fetched_at` mellett.
- m5 → F1.4 ÁTADÁSI FELTÉTEL: II. foknál (`flags.stormLevel===2`) a UI-nak
  „Tilos" státuszt kell rendernie (i18n `status.forbidden`), NEM a
  danger-„Veszélyes"-t — a status-enum önmagában nem elég.

**Élesítés (2026-07-18/19, felhasználói jóváhagyással) — KÉSZ:**
- Mindkét Edge Function deployolva a „Supbase" projektre (`npm run sb --
  functions deploy weather-sync|storm-alert`).
- Cron aktív (pg_cron + pg_net): `weather-sync-hourly` (`0 * * * *`) és
  `storm-alert-5min-season` (`*/5 * * 4-10 *`). A service-kulcs a Supabase
  **Vaultban** (`edge_invoke_key`) — a cron-parancsok a
  `vault.decrypted_secrets`-ből olvassák, literálként sehol nincs.
- Éles verifikáció: weather-sync → 200, 15/15 spot snapshot + SUP-index
  (3–10 közti értékek); storm-alert → 200, 3 körzet scrape, pozitívan
  megerősített 0-s fokozat, `verify_jwt` 401 auth nélkül.
- **Éles teszt fogta + javítva:** az eredeti forrás-URL 404 volt → valódi
  forrás felderítve: met.hu TAVANKÉNTI `main.php` (Balaton medencénként; 0-s
  állapot szövege: „a viharjelző rendszer ALAPON VAN" — felvéve a pozitív
  minták közé). Körzet→URL forráslista (`DEFAULT_STORM_SOURCES`,
  `STORM_SOURCES` env-felülírás), fokozat-ikon (`viharjelzesN.png`) másodlagos
  jelként, szöveg–kép eltérésnél a magasabb győz. Valódi letöltött fixture-ök.
  **Fertő (2026-08-28-tól fedve):** nincs HungaroMet-forrása, a tavat a
  burgenlandi Landessicherheitszentrale 11 állomása fedi (köztük Fertőrákos) —
  saját parser (`detectLszLevel`), német négyállapotú skálával
  (Bereitschaft/Starkwind/Sturm/Außer Betrieb → 0/1/2/unknown), körzet-szinten
  a maximummal. A jelmagyarázat-csapdát regressziós teszt őrzi (README).

**Megjegyzés:** az 1. kört az algo-engineer session-limit szakította meg (a
hiányzó adapter-tesztet és az i18n-bekötést a karmester pótolta); a forrás-
átállítást session-limit + classifier-kiesés miatt szintén a karmester írta.

## F1.4 — Spots + térkép (2026-07-19)

Kiosztás: scaffolder (modul-váz) → ui-builder (UI) → karmester-integráció +
verifikáció. A ui-buildert session-limit szakította meg; a route-integrációt
(SpotMap/SpotCard/StormAlert bekötése a loaderekbe), az éles verifikációt és a
javításokat a karmester végezte. Kapuk záráskor zöldek: typecheck · lint ·
265 vitest (18 új F1.4-teszt).

**Elkészült:**
- `src/modules/spots/`: route-os manifeszt (`spotok`, `spotok/:slug`) +
  registry- és registry-i18n-regisztráció; `spots` i18n-namespace (hu forrás,
  en tükör; kulcs-paritás ellenőrizve).
- **Modul-szerződés betartva:** a spots-modul NEM importál a weather-modulból —
  a SUP-index kiértékelés (`evaluateSnapshot`) kizárólag a route-rétegben
  (`app/routes/spotok*.tsx`) történik, a spots saját `SpotStatus` típusára
  képezve. Az m5 „forbidden" leképezés (`storm_level===2 → "forbidden"`) is itt.
- `data/wkb.ts`: `parseEwkbPoint` (EWKB hex) + `pointFromGeom` (GeoJSON-objektum
  VAGY hex — az éles PostgREST-forma GeoJSON, lásd follow-up); `data/spots.server.ts`
  injektált klienssel (listSpots, getSpotBySlug slug-alak-guarddal, latest-
  snapshot reduce, reports CRUD).
- `ui/SpotMap.tsx`: MapLibre GL, kizárólag kliens-oldali init (dinamikus import,
  SSR-placeholder), OpenFreeMap kulcs nélküli stílus, OSM-attribúció; token-
  színes + színtévesztő-biztos (eltérő ikon-geometria) markerek, popup
  „Adatlap"-linkkel, réteg-kapcsolók (Spotok/Védett területek).
- `ui/SpotCard.tsx`: Waterline (kártyán VONAL), StatusBadge, DataAge, flag-
  jelvények. `ui/StormAlertScreen.tsx`: teljes képernyős, nem eldugható
  `role="alertdialog"`, 3 MIT TEGYÉL-lépés, amber vízimentő-CTA sötét felirattal
  (`tel:+36303838383`), forrás+időbélyeg.
- Lista-route: térkép + waterType-szűrőchipek (a térkép a szűrt listát kapja) +
  SpotCard-rács. Adatlap-route: fejléc-StatusBadge, Gauge (küszöbök a
  `supindex.*` konfigból), indoklás (weather reason-kulcs a route-rétegben
  fordítva), stale-blokk, besodró/neoprén figyelmeztetések, természetvédelmi
  sáv, mini-térkép, jelentés-lista + űrlap (requireUser + e-mail-gate).
- Fejléc-navigáció: `app/nav.tsx` a modul-manifesztek `primary` nav-
  bejegyzéseiből (registry-vezérelt — új modul automatikusan megjelenik).

**Éles verifikáció (Playwright, dev-szerver a távoli „Supbase" projekttel):**
- Lista: 15 marker renderel a térképen, kártyák helyes SUP-index/státusz/
  adatkor-jelzéssel; a waterType-szűrő a kártyákat ÉS a markereket is szűri.
- **m5 ÁTADÁSI FELTÉTEL ÉLESBEN IGAZOLVA:** a verifikáció közben a storm-alert
  cron valós II. fokot állított a Balatonra → a Balaton-spotok „Tilos · 0,0"-t
  mutatnak (nem „Veszélyes"), az adatlapon a teljes képernyős StormAlertScreen
  renderel (alertdialog, MIT TEGYÉL, vízimentő-CTA, forrás „bm-okf").
- Adatlap: Gauge kitöltött+csíkozott (stale) állapotban, indoklás, adatmezők,
  404 ismeretlen slugra.

**Verifikáció fogta + javítva (a karmester javításai):**
- **BLOKKOLÓ volt:** a térképen 0 marker jelent meg — a PostgREST a `geom`-ot
  GeoJSON-objektumként adja, nem EWKB hexként, amire a `parseEwkbPoint` épült.
  → `pointFromGeom` mindkét formára (GeoJSON + hex), a route-ok erre váltva,
  `SpotRow.geom: unknown`, 4 új teszt. (15/15 marker renderel.)
- **Layout-hiba:** az adatlap mini-térképe 0 magas volt (`h-full` a SpotMap
  bázisán tartalom-magasságú `<section>`-ben 0-ra oldódott) → `h-full` kivéve a
  bázisból, a magasságot a hívó explicit `className`-je adja (a `min-h` alsó
  korlát marad). (240px, a marker a Tiszán renderel.)
- **Biztonsági keményítés:** `getSpotBySlug` a slug-ot nyersen fűzte a PostgREST
  `.or()` szűrő-stringbe → slug-alak-guard (`^[a-z0-9-]+$`) a szűrő-injektálás
  ellen, 4 negatív teszt.

**Follow-upok (nem blokkolók) — az ITINER „Nyitott kis tételek" közé felvéve:**
geom-forma dokumentálva, `listLatestSnapshots` distinct-on-nézetre cserélhető,
MapLibre null-warning az F1.10 auditra.

## F1.5 — Catalog + Reviews (2026-07-19, funkcionális mag)

A scaffolder session-limitbe futott (a subagent-kvóta ezen a napon szűk volt),
így a teljes vázat a karmester írta, az F1.4-mintát követve. A DB-séma és RLS
már F1.2-ben kész (catalog + reviews migrációk), ezért F1.5 UI + route +
adatréteg + i18n, ÚJ core-migráció nélkül. Kapuk zöldek: typecheck · lint ·
276 vitest (11 új). Éles Playwright-verifikáció (dev + távoli „Supbase").

**Elkészült:**
- **Két külön modul** a modul-szerződés szerint: `catalog` (brands/boards/
  board_prices adat + deszka-lista/adatlap) és `reviews` (board_reviews/
  review_flags adat + Közös nevező-aggregátor + admin-moderáció). A catalog NEM
  importál reviews-t és fordítva — a deszka-adatlap a KETTŐT a ROUTE-rétegben
  (`app/routes/deszkak.$slug.tsx`) komponálja (mint a spots↔weather).
- `catalog/data/boards.server.ts`: listBoards (brand-join), getBoardBySlug
  (slug-alak-guard `^[a-z0-9-]+$` a `.or()` szűrő-injektálás ellen, negatív
  teszt), listBoardPrices (legolcsóbb elöl).
- `reviews/aggregate.ts`: tiszta `computeReviewAggregate` (csak publikált sorok;
  count, avgOverall 1–5, dimenzió-átlagok, %ajánlaná, verifiedCount) + `toTen`
  (1–5 → 10-es mérce); táblázatos határeset-tesztek (üres, hidden-szűrés,
  kerekítés 4,55→4,6, null-dimenzió, %recommend, verified).
- `reviews/data/reviews.server.ts`: listReviews (publishedOnly), getUserReview
  (1/deszka), insertReview (rating 1–5 validálás + `23505` unique→„már írtál"),
  insertFlag, és ADMIN: listPendingReviews, listFlaggedReviews (feloldatlan
  jelzés → két lépéses JS-párosítás), setReviewStatus, setVerifiedOwner,
  resolveFlag (moderátori jog, RLS + requireRole a védőháló).
- Route-ok: `/deszkak` (lista), `/deszkak/:slug` (adatlap: hero + spec + Közös nevező
  + vélemény-lista + e-mail-gate-elt vélemény-űrlap + flag + árak; action
  `intent`-tel review/flag), `/admin/velemenyek` (reviews adminPanel,
  requireRole('moderator') loaderben ÉS actionben, moderációs gombok).
- i18n: `catalog` + `reviews` namespace (hu forrás, en tükör, kulcs-paritás
  ellenőrizve); a nav automatikusan hozza a „Deszkák"-at.

**Verifikáció (Playwright + curl):** lista 20 deszkával renderel (típus-badge,
méret + stabilitási index); adatlap: Ride 10'6" fejléc + ár „429 000 Ft-tól",
Paraméterek, Közös nevező ÜRES-állapot, vélemény-űrlap login-gate, árak; admin
route 302 (requireRole átirányít kijelentkezve); 404 ismeretlen slugra; nincs
konzol-hiba.

**Token-megkötés a ui-builder-polishoz (route-kommentben is):** a Közös nevező
mércék NEM a biztonsági Gauge-ot használják (veszély-szemantika), és a `--danger`
(piros) értékelés-sávon TILOS — külön RatingBar kell (petrol/semleges v.
safe/caution), a szám mindig a sáv mellett. A loader már átadja a 10-es
`dimensionsTen`/`overallTen` értékeket.

**UI-polish (2026-07-21):** átnevezés „Népítélet" → „Közös nevező" (színkiemelt
evező-szójáték a blokk-címben, `--caution-text`); új komponensek
`reviews/ui/{RatingBar,ReviewSummary,ReviewCard,FlagButton}` +
`catalog/ui/{BoardCard,BoardHero}`, a route-ok ezekből komponálnak. A RatingBar
NEM a biztonsági Gauge (küszöb-szín ≥7 safe / <7 caution, SOHA danger; a szám
mindig a sáv mellett). 8 új komponens-teszt.

**catalog-watch séma-előkészítés (2026-07-21, `docs/CATALOG_WATCH_TERV.md`):**
ÚJ migráció `20260717091600_catalog_watch.sql` (additív, az F1.2-catalogot nem
bolygatja): boards életciklus-mezők (`status` active|discontinued|unverified +
first/last_seen_at + discontinued_at), `catalog_sources`, `catalog_candidates`
(mindkettő RLS: select ÉS write CSAK moderator/admin — kurált/belső tartalom),
`pg_trgm` + trigram GIN index a modell-névre (fuzzy dedup). pgTAP:
`12_catalog_watch_test.sql` (mod ír/olvas; user/anon se olvas, se ír; boards
default-ok). A `BoardRow` típus bővítve. Migráció NINCS kitolva — CI `rls-tests`
futtatja, éles `db push` a felhasználó jóváhagyásával (lokál-first munkamenet).

**HÁTRA (nem blokkoló):** auth-flow verifikáció teszt-fiókkal (lásd ITINER).

## F1.6 — Advisor / Deszkaválasztó (2026-07-21)

Kiosztás: algo-engineer (tiszta algoritmus-mag) → ui-builder (wizard + eredmény +
route) → karmester-integráció + verifikáció. A ui-buildert a végén kapcsolat-
megszakadás érte (a route-fájl + UI-komponensek a karmester írta). Kapuk zöldek:
typecheck · lint · 335 vitest (~38 új advisor-teszt).

**Elkészült:**
- `src/modules/advisor/select/`: tiszta kétrétegű ajánló (5.2). 1. réteg kemény
  szűrés (térfogat=súly×szint-szorzó, terhelhetőség×0,66≥effektív súly, HU-
  elérhetőség, tárolás, budget, cél→board_type mapping); 2. réteg 0–100
  pontozás (stabilitás-illeszkedés tapasztalat-függő, Közös nevező-átlag ≥5
  vélemény/semleges, ár-érték, cél-fit, elérhetőség/frissesség) — súlyok az
  `advisor_weights`-ből (config.ts/config.server.ts, fail-safe DEFAULT). Az
  algoritmus STRUKTURÁLIS bemeneten dolgozik (`BoardForAdvisor[]`), NEM importál
  catalog/reviews-t; az indoklás determinisztikus {key, params} (level/use
  nested i18n-kulcs). Táblázatos határeset-tesztek.
- `src/modules/advisor/ui/AdvisorWizard.tsx` (5 lépéses kliens-wizard: testsúly+
  utas, tapasztalat, víz, cél, budget+tárolás; progress-bar, opció-kártyák,
  amber CTA sötét felirattal) + `AdvisorResult.tsx` (1 nagy + 2 kompakt ajánlás,
  „X% neked" amber-badge, feloldott indoklások, adatlap-linkek; megosztás
  OG-képe F1.8).
- `app/routes/deszkavalaszto.tsx`: a catalog+reviews+advisor összekötése a
  route-rétegben — boards+legolcsóbb ár+publikált-vélemény-aggregátum →
  `BoardForAdvisor[]` → `recommendBoards` → advisor_sessions insert (anonim is,
  best-effort) → display-DTO. Adat-helperek: catalog `listCheapestPriceByBoard`
  (+pickCheapestPerBoard teszt), reviews `listAllPublishedReviews`.
- advisor i18n (hu forrás + en tükör): nav + wizard.* + result.* + reason/level/use.
- `nav`: „Deszkaválasztó" (order 5) a fejlécben (registry-vezérelt).

**Éles verifikáció (Playwright + dev + távoli „Supbase"):**
- Wizard end-to-end: 85 kg / kezdő / allround / nagy tó lefutás → top ajánlás
  X100 11'0" (65% neked, 189 000 Ft) + 2 kompakt, a feloldott indoklásokkal
  (térfogat/kezdő szint, allround cél, terhelhetőség), adatlap-linkekkel.
- **F1.5 vélemény-flow ÉLESBEN lezárva** a `teszt@sup-platform.test` userrel:
  vélemény beküldve → a Közös nevező „van-adat" nézete renderel (5,0 átlag,
  100% ajánlaná, dimenzió-mércék 10-es skálán), a form „már írtál" + „Köszönjük"
  állapotra váltott.
- **Admin-moderáció verifikáció KÉSZ (2026-07-24, böngésző + éles „Supbase"):**
  a szerep-forrás javítás után `/admin/velemenyek` adminként **200** (korábban
  403). Végigkattintva: jelentés az adatlapról → megjelenik a panel „Jelentett
  vélemények" listájában → **elrejtés** (státusz `hidden`, a vélemény kiesik a
  publikus `published`-only Közös nevezőből) → **újra közzététel** (`published`)
  → **jelzés lezárása** (`resolved`, panel tiszta). Végállapot helyreállítva
  (Közös nevező 5,0 / 1 értékelés). A `verified_owner` kapcsoló csak a
  „Jóváhagyásra vár" (pending) szekcióban látszik — F1.5-ben nincs pending-queue,
  ezért a mostani flow-ban nem elérhető (nem blokkoló, azonos mechanizmus).

## F1.7 — Providers / szolgáltatói directory (2026-07-24)

Kiosztás: karmester (az F1.4/F1.5/F1.6 modul-mintát követve). A DB-séma és RLS
már F1.2-ben kész (providers + provider_spots + provider_leads migráció), ezért
F1.7 = modul + route + adatréteg + UI + i18n, ÚJ migráció nélkül. Kapuk zöldek:
typecheck · lint · 341 vitest (6 új providers-teszt). Éles Playwright-verifikáció
(dev + távoli „Supbase", admin-session).

**Elkészült (`src/modules/providers/`):**
- `types.ts` (ProviderRow/Service-type/Tier/Lead + linked-spot), `module.ts`
  (routes: `szolgaltatok`, `szolgaltatok/uj` [requiresAuth], `szolgaltatok/:slug`;
  adminPanel: `szolgaltatok`; nav order 20), `i18n.ts` + `locales/{hu,en}`
  (kulcs-paritás), registry + registry-i18n regisztráció.
- `data/providers.server.ts`: `listProviders` (+ tiszta `sortProvidersForList` —
  premium elöl, azon belül név), `getProviderBySlug` (slug-alak-guard `^[a-z0-9-]+$`
  a `.or()` szűrő-injektálás ellen), `listLinkedSpots` (provider_spots→spots join),
  `insertLead` (insert-gate: e-mail-forma + RLS `provider_leads_insert_any`),
  `insertProvider` (owner=self; tiszta `slugify` ékezet-hajtással + `resolveUniqueSlug`
  ütközés-feloldás; verified/tier a triggerrel biztonságos defaultra), admin
  `listProvidersByVerified` + `setProviderVerified`. 6 unit-teszt (slugify, sort).
- `ui/ProviderCard.tsx`: név + típus-chipek + „Kiemelt" (semleges chip, NEM
  StatusBadge) + „Hitelesített" (biztonsági StatusBadge safe) / „Hitelesítés
  folyamatban" jelvény + leírás-kivonat.
- Route-ok: `/szolgaltatok` (lista + típus-szűrőchipek + „regisztráld" CTA),
  `/szolgaltatok/:slug` (profil: fejléc + jelvények + elérhetőség + kapcsolódó
  spotok [route-rétegben kötve, a providers NEM importál spots-t] + lead-form),
  `/szolgaltatok/uj` (requireUser; saját listing felvétele → redirect az új
  profilra), `/admin/szolgaltatok` (requireRole('**admin**') — a `verified`
  jelvényt a `protect_provider_columns` trigger CSAK adminnak engedi, a
  moderátor verify-ja némán no-op lenne; verify/unverify).

**Éles verifikáció (Playwright, mind az 5 flow):**
- Directory: 5 seed-szolgáltató, típus-szűrő, kártyák; nav-ban „Szolgáltatók".
- Profil (SUP Balaton): elérhetőség (mailto), kapcsolódó spotok (Balatonföldvár +
  Siófok, /spotok-linkkel), lead-form e-mail-előtöltéssel a session-ből.
- Lead beküldve → „Köszönjük!" (insert-gate zöld).
- Admin-panel: Tisza-tavi hitelesítve → átkerült a „Hitelesített" szekcióba, a
  publikus listán „Hitelesített" StatusBadge jelenik meg (trigger adminnak engedi).
- Új listing: „Balázs SUP TúraBázis" beküldve → slug `balazs-sup-turabazis`
  (ékezet-hajtás), redirect a profilra, „Hitelesítés folyamatban" (a trigger
  user-insertnél verified=false-ra kényszerít ✓). Nincs valós konzol-hiba.

**Follow-upok / nyitott kis tételek (nem blokkolók):**
- **Seed↔trigger interakció:** a `providers` seed közvetlen SQL-inserttel fut
  (nincs `auth.uid()` → `is_admin()`=false), így a `protect_provider_columns`
  trigger a seed `tier='premium'`/`verified` szándékát felülírja `free`/`false`-ra.
  Ezért élesben EGYETLEN provider sem premium/verified alapból. Ha demo-jelleggel
  kell hitelesített/kiemelt példa: seed UTÁNI admin-update, vagy a seed-context
  triggerkerülése (db-engineer, F1.10 seed-revízió). A `sortProvidersForList`
  premium-elöl logikája helyes, csak nincs premium sor az adatban.
- **Meglévő seed-listing „átvétele" (owner=null → user):** a jelenlegi claim =
  önkiszolgáló ÚJ listing (owner=self). A már seedelt, gazdátlan sorok user általi
  átvétele owner-hozzárendelést igényelne, amit az RLS csak adminnak enged — ehhez
  külön `provider_claims` request/approve tábla (ÚJ migráció, db-engineer) kellene.
  Elhalasztva; nem blokkoló.
- **Éles teszt-artefaktumok (a verifikáció hagyta a távoli DB-ben):** „Balázs SUP
  TúraBázis" provider (owner=admin), egy lead a SUP Balatonon, és a Tisza-tavi
  `verified=true`. Ártalmatlan dev-adat; az F1.10 tiszta `db push --include-seed`
  reset-eli. Nincs törlő-UI (admin-panel csak verifikál); DB-törlés a rossz-projekt
  token-csapda miatt szándékosan elmaradt.

## F1.8 — SEO-réteg + consent + jogi oldalak (2026-07-24)

Kiosztás: karmester (scaffolder+auth-security-minta). Kapuk zöldek: typecheck ·
lint · 359 vitest (+15 új: page-seo, sitemap, consent). SSR/curl-verifikáció a
dev-szerveren. A `user_consents` migráció + pgTAP a CI `rls-tests` jobban fut
(lokálisan nincs Docker/Postgres); éles push jóváhagyással.

**Mag KÉSZ (5 al-lépés):**
1. **Loader-alapú meta + hreflang** (`@core/seo/page-seo` `buildPageSeo` +
   `serverT` szerver-oldali fordító + `siteOrigin`/`absoluteUrl`; `VITE_PUBLIC_SITE_URL`
   env vagy kérés-origin fallback). Minden fő route-on (home, deszkak[/:slug],
   spotok[/:slug], deszkavalaszto, szolgaltatok[/:slug]) locale-helyes title/
   description/OG + canonical + hreflang. SEO-kulcsok a namespace-ekben (hu+en).
2. **JSON-LD** az adatlapokon (`@core/seo/json-ld` `<JsonLd>` + a meglévő builderek):
   Product+AggregateRating+Offer (deszka), Place+geo (spot), LocalBusiness (provider).
3. **sitemap.xml + robots.txt** resource route-ok (`@core/seo/sitemap`
   `buildSitemapXml`; dinamikus slugok a 3 modulból; 96 URL). robots tiltja az
   /admin, /auth, /szolgaltatok/uj, /kijelentkezes utakat + sitemapre mutat.
4. **Consent** (verziózott, jövőálló): ÚJ core-migráció `20260717090500_core_user_consents.sql`
   — `user_consents (user_id, kind, version, granted_at)` append-only napló, RLS
   (own select/insert, admin delete), `record_signup_consents` trigger (a
   signup-metaadatból írja, mert az e-mail-megerősítés miatt regkor nincs session).
   `@core/consent` (CONSENT_VERSION="2026-07", REQUIRED=[terms,privacy] + marketing
   jövőre; `getMissingRequiredConsents`/`recordConsents`). Regisztrációs
   **checkbox** (kötelező, ÁSZF+adatvédelmi linkkel, `consent_version` metaadat).
   **Retroaktív re-consent:** `/beleegyezes` route + root-loader banner (bejelentkezett
   usernél a hiányzó consent-et jelzi; fail-safe, ha a tábla még nincs kitolva).
5. **Jogi oldalak** (`@core/legal`): `/aszf` + `/adatvedelem` kétnyelvű, strukturált
   tartalommal (a Hullám-projekt `ÁSZF_SEO/aszf-maradjaktivpecs.md` struktúrája
   alapján, SUP-platformra adaptálva: időjárás/SUP-index-disclaimer, szolgáltatói-
   directory-disclaimer, felhasználói tartalom). Cégadatok `[KITÖLTENDŐ: …]`
   placeholderek (`entity.ts`, verzióhoz kötve). Lábléc a site-wide eléréshez.
   **A közösségi belépésre (Google/Apple) már utal az ÁSZF 7. és az adatvédelmi
   2./4. szakasza** (a most kért reg-bővítéshez).

**Fontos SEO-döntés (javítás):** a `/en/...` route-ok NINCSENEK bekötve (en csak
CEE-terjeszkedésnél élesedik), ezért bevezetve az `activeLocales=["hu"]` — a
hreflang/sitemap CSAK élő locale-t hirdet (nincs 404-es /en URL a crawlernek).
Amikor az en-routing élesedik: `activeLocales`-hez add az `en`-t.

**Jogi tartalom forrás (referencia):** a felhasználó saját, más projektben
használt ÁSZF-anyagai: `/Volumes/Endre_Samsung1T/Hullám/weblap/ÁSZF_SEO/`
(`aszf-maradjaktivpecs.md` kész minta, `aszf-kitoltendo.md` a kitöltendő cégadat-
mezők, `cookie-tajekoztato-maradjaktivpecs.md`). A codesummon.org/terms
GDPR-struktúrája is irányadó volt az adatvédelmihez.

**HÁTRA (F1.8b / F1.10):**
- **OG-kép dinamikus generálás** (advisor megosztás-kártya + deszka-adatlap) —
  technikai döntéssel (satori/resvg vagy edge function). Elhalasztva.
- **Persona-landingek** — terméki definíció kell.
- **`user_consents` migráció éles push** (jóváhagyással) — addig a re-consent
  banner fail-safe kikapcsolt (a tábla hiánya nem crashel).
- **Cégadatok kitöltése** a jogi oldalakon (`entity.ts` `[KITÖLTENDŐ: …]`).

## F1.8b — Regisztráció-bővítés: jelszó-visszaállítás + Google/Apple belépés (2026-07-24)

Kód KÉSZ (a felhasználó kérésére, „mindhárom mód most", együtt az F1.8-cal).
Supabase Auth natív — nem építettünk sajátot. Kapuk zöldek: typecheck · lint · 359 vitest.

**Elkészült:**
- `/auth/oauth` action-route: `signInWithOAuth({provider})` (allowlist: google|apple)
  → provider-redirect; a visszatérést a MEGLÉVŐ `/auth/callback` kezeli
  (exchangeCodeForSession). `safeRedirect` a redirectTo-n (nincs open-redirect).
- `app/auth/OAuthButtons.tsx`: „Folytatás Google/Apple-fiókkal" (POST `/auth/oauth`,
  progressive enhancement) — bekötve a `/belepes` és `/regisztracio` oldalra.
- `/elfelejtett-jelszo`: `resetPasswordForEmail` (Turnstile, user-enumeráció ellen
  mindig „elküldve"; redirectTo = `/auth/callback?redirectTo=/uj-jelszo`).
- `/uj-jelszo`: requireUser (recovery-session a callback után) → `updateUser({password})`,
  min. 8 karakter. „Elfelejtetted a jelszavad?" link a belépőn.
- i18n: auth.oauth / forgotPassword / newPassword kulcsok (hu+en) + error-kulcsok.
- Verifikáció (curl, anon): a gombok + linkek renderelnek, a guardok (302) állnak.

**OAuth↔consent (megoldva):** az OAuth-signup KIHAGYJA a reg-consent-checkboxot,
de az F1.8 retroaktív re-consent bannere elkapja: első belépéskor a `/beleegyezes`
oldalra irányítja. Így a közösségi belépő userek is elfogadják a feltételeket.

**FELHASZNÁLÓI TEENDŐ (Dashboard, kód nélkül nem él élesben):**
- **Google:** Google Cloud OAuth 2.0 kliens (client ID + secret) → Supabase
  Dashboard → Authentication → Providers → Google. Redirect URL: a Supabase
  callback (`https://<project>.supabase.co/auth/v1/callback`). Ingyenes.
- **Apple:** Apple Developer-fiók (~99 USD/év), Services ID + kulcs → Providers → Apple.
- Bekapcsolásig a gombok redirectelnek, de a Supabase provider-hibára fut (a kód kész).

## F1.6-utó/2 — Deszkaválasztó: szakmai kalibráció három forrásból (2026-07-26)

A felhasználó saját kutatása (`Kezdők_tanácsok/sup-kezdo.md`) + két magyar
piaci útmutató (supzone.hu, supshop.hu) alapján összevetettük az algoritmust a
szakirodalommal. Teljes elemzés: **`docs/ADVISOR_DOMAIN_REVIEW.md`**.
Kapuk zöldek: typecheck · lint · 444 vitest · 60 Playwright.

**A vizsgálat MÉRÉSSEL készült** (referencia-esetek végigfuttatva az éles
action-ön), nem szemrevételezéssel — ez fogta meg az alábbi blokkolót.

**BLOKKOLÓ VOLT: 96 kg fölött a kezdő NULLA ajánlást kapott.** Ok: a
`max_load × 0,66` szűrő 96 kg-hoz ≥145 kg terhelhetőséget kér, és az egyetlen
ilyen deszka `fishing` típusú, amit az allround cél-mapping kizárt. Az üres
állapot ráadásul félrevezetett („lazíts az árkereten", holott a felhasználó
nem is állított be árkeretet). **Javítva:**
- `heavyRiderKg` (90) fölött a `fishing` típus is engedélyezett allround/túra
  célra — a források „extra széles allround/fishing, nagy stabilitás, sok
  liter" kategóriaként kezelik;
- `explainNoMatch()` a DOMINÁNS kizárási okot adja vissza, és a terhelhetőségnél
  kimondja, hogy ez **biztonsági korlát, nem érdemes lazítani** rajta.
- Mérve: 100 kg → most Drift 10'10" (52 %); 110 kg → nincs találat, de a
  VALÓDI okkal.

**RENDSZERSZINTŰ JAVÍTÁS: sáv-alapú pontozás a monoton helyett.** A régi logika
szerint „minél nagyobb térfogat és minél szélesebb deszka, annál jobb" — a
szakirodalom viszont OPTIMUMOT ad meg (a túl nagy térfogat lassabb és
szelesebb, a túl széles deszka nagyobb terpeszt kíván). Új `bandScore`
primitíva, erre épül a térfogat-, szélesség-, vastagság- és hossz-illeszkedés.
A `stabilityScore` ezek súlyozott átlaga (45/40/15), és a **tapasztalati szint
nem a képletben, hanem a CÉLOKBAN** jelenik meg (a háromágú switch megszűnt).

**Kalibráció** (mind `advisor_weights`-ből hangolható): 65 kg → 290 L / 81 cm /
320 cm · 85 kg → 330 L / 83,4 cm / 336 cm · 100 kg → 360 L / 85,2 cm / 348 cm.
Egybevág mindhárom forrás méret-tábláival.

**A hossz bázisa a SÚLY lett** (a magasság csak korrigál, 1,2 → 0,5
együtthatóval): a két bemenet erősen korrelál, kétszer nem szabad beszámítani.
Korábban egy nehéz, alacsony evezős túl rövid deszkát kapott (100 kg/170 cm →
314 cm); most 346 cm. Teszt védi.

**Vastagság bekötve** (cél 14 cm ±3): a 12–15 cm-es sáv a jó, a 20 cm-esek
pontot veszítenek (magasabb súlypont). Az adat eddig kihasználatlan volt.

**Eredmény-fejléc:** mind a három cél-méret látszik (hossz cm + láb, szélesség,
térfogat) — a felhasználó lássa, mire méreteztünk.

**Mellékesen javítva:** az üres állapotnak nem volt `h1`-e (a lapnak nem volt
címsora — a11y).

**NYITVA maradt (felhasználói döntésre vár):** ár-padló (a `valueScore` még
mindig a legolcsóbbat jutalmazza, pedig a források szerint a nagyon olcsó szett
gyenge merevsége a STABILITÁST rontja) · kezdő→felfújható preferencia (most
nulla hatású, 20/20 felfújható) · biztonsági kiegészítők blokk (leash,
mentőmellény — termék-bővítés).

## F1.12 — Süti-mentes használati statisztika (2026-07-28)

A 12/6 pont („cookie-mentes analitika preferált, saját eseménynaplózás
Supabase-be") megvalósítva. Eddig SEMMI nem mért: élesedés után visszamenőleg
nem pótolható adatról van szó. Kapuk zöldek: typecheck · lint · **547 vitest**
(+19 új). **Élesítve és verifikálva.**

**A HATÁR, amit tudatosan vállalunk:** nincs süti, nincs eszköz-azonosító,
nincs IP, nincs user_id — még napi rotációjú látogató-hash sem (amit a
privacy-barát eszközök használnak). Következmény: **egyéni tölcsér nem
mérhető**, csak esemény-darabszám. Cserébe az adat nem alkalmas személy
azonosítására, és az adatvédelmi tájékoztatónk ígéretét (analitikai süti csak
külön hozzájárulással) betű szerint tartjuk. A fő kérdésünk így is
megválaszolható: hány kérdőív-megnyitásra hány ajánlás-megjelenítés jut.

**Írás CSAK definer-függvényen át.** A táblára NINCS insert-policy, tehát
közvetlenül senki nem írhat; az egyetlen út a `record_analytics_event()`, ami
zárt eseménynév-listát, útvonal-alakot és props-méretet ellenőriz. Olvasás:
admin-only. Élesben mind a négy viselkedés ellenőrizve (anon insert → 42501,
anon olvasás → üres, ismeretlen név → nem keletkezik sor, query-s útvonal →
levágva).

**A megosztott advisor-link TESTSÚLYT tartalmaz** (`?suly=85&magassag=180`) —
ezért az útvonalról a query-t KÉT helyen is levágjuk: a szerver-oldali
helperben és magában az SQL-függvényben. Élesben ellenőrizve: a tárolt érték
`/deszkavalaszto`, paraméterek nélkül.

**A mérés nem törhet el és nem lassíthat oldalt:** minden hiba elnyelve
(nincs `throw` egyetlen ágon sem), és 1,5 s-os időkorlát — ha a DB lassú, az
esemény elveszik. Ez elfogadható ár egy statisztikáért.

**Nem mérünk:** robotot (`isbot`), `DNT: 1` vagy `Sec-GPC: 1` jelzést küldő
böngészőt, és **dev-módot**. Az utolsót élő próba kényszerítette ki: a lokális
dev-szerver a TÁVOLI adatbázisba ír, tehát a saját kattintgatásom azonnal
bekerült az éles statisztikába (6 sor). Kizárás után három oldalbetöltés
nulla új eseményt adott; a dev-eredetű sorokat töröltem, a tábla üresen várja
az első valódi forgalmat.

**Admin-felület:** `/admin/analitika` (requireRole admin) — tölcsér-arány,
eseményenkénti összeg, napi bontás. Szándékosan grafikon nélkül: a kérdés
egyetlen aránnyal megválaszolható, egy diagram itt díszítés lenne. A
tölcsér-arány 100% fölé is mehet — a megosztott linket megnyitók egyből az
eredményt látják; ez információ, nem hiba (a súgó-szöveg is kimondja).

**Jogi szöveg frissítve** (`@core/legal`, hu+en): az adatvédelmi tájékoztató
5. szakasza most tételesen leírja a süti- és azonosító-mentes mérést, a
DNT/GPC-tiszteletet, és hogy egyéni út nem rekonstruálható.

**Fájlok:** migráció `20260717092000` (tábla + kényszerek + definer-RPC +
admin-only RLS + `analytics_daily` nézet) · `@core/analytics` (events,
analytics.server, analytics-query.server) · `/admin/analitika` route + i18n ·
pgTAP `06_analytics_test.sql` · `SECURITY_FINDINGS.md` F1.12-01 (a végpont
kívülről is hívható — elfogadott kockázat, indoklással).

## F1.11b — Póráz-figyelmeztetés folyóvízre (2026-07-27)

Az F1.11 folytatása: ha már tudjuk, hogy a spot folyó, a legfontosabb
folyó-specifikus SUP-szabályt is ki kell mondani. Kapuk zöldek: typecheck ·
lint · **527 vitest** · **66 e2e**.

**A szabály:** álló vízen a bokapóráz a helyes választás (a deszka a
mentőeszköz), sodró vízen viszont beakadhat víz alatti akadályba, és a sodrás
a víz alá szoríthat — folyón gyorskioldós DERÉKpóráz kell. A felhasználó saját
forrása (`Kezdők_tanácsok/sup-kezdo.md`) ezt óvatosan fogalmazza meg („folyóra
gyakran más megoldás biztonságosabb"); a szövegünk kimondja a konkrét okot is,
mert a „miért" nélkül a tanács nem meggyőző.

**Hol jelenik meg:** a folyó-spotok adatlapján ÉS a Deszkaválasztó eredményén,
ha a felhasználó folyót választott. Tavon egyik helyen SEM — ez nem részletkérdés:
a tavi evezősnek pont hogy RAJTA kell hagynia a bokapórázt, egy oda nem illő
figyelmeztetés tehát rossz irányba terelne. E2E-teszt mindkét irányt őrzi.

**Modul-szerződés:** két modulnak (spots + advisor) kellett ugyanaz a tartalom,
ezért a szöveg a CORE i18n-namespace-ben él, a megjelenítés pedig az új
`@core/ui/SafetyNote` komponensben — ugyanaz a minta, mint a `RatingBar`-nál.

**Token-döntés:** a SafetyNote SZÁNDÉKOSAN nem használ biztonsági színt. A
`--safe/--caution/--danger` család a MÉRT, éppen fennálló állapoté (2. fejezet
3.); egy mindig érvényes szabály ezekben a színekben felhígítaná a
státusz-szemantikát — a felhasználó megszokná a riasztás-színt ott, ahol nincs
friss veszély. Ezért a természetvédelmi blokk semleges `sand` mintáját követi.
Teszt őrzi, hogy ne szivárogjon be `bg-safe/caution/danger`.

**Nyitva marad (termékdöntés):** a teljes kiegészítő-blokk (mentőmellény, pumpa,
szárazzsák, konkrét termékajánlással) — a domain-review 2.8. Most a
biztonságkritikus magot (póráz + mentőmellény-mondat) építettük meg, terméklista
nélkül.

## F1.11 — Folyó-spotok vízállása: a SUP-index utolsó adóssága (2026-07-27)

Az 5.1/6 pont eddig FIX −1 büntetést adott minden folyó-spotra, függetlenül
attól, hogy a folyó nyugodt nyári vízálláson van-e vagy árad. Kapuk zöldek:
typecheck · lint · **524 vitest** (+9 komponens, +16 adapter, +9 index/batch,
+4 árvíz-riasztás) · 64 e2e. **ÉLESÍTVE ÉS BÖNGÉSZŐBEN VERIFIKÁLVA** (lent).

**A FORRÁS-DÖNTÉS a lényeg.** A spec HydroInfo-scrapinget írt elő (a felhasználó
DunApp-projektjéből portolva). A DunApp kódját megnézve kiderült, hogy ott a
JELENLEGI adat már nem scrape-ből jön, hanem a **vizugy.hu (OVF) REST API-ból**
— és ez az API mércénként megadja a **HIVATALOS árvízvédelmi készültségi
küszöböket** (KF1/KF2/KF3 = I./II./III. fok). Ez döntötte el az egész
tervezést: nem kellett cm-sávokat kitalálnunk, a küszöb hatósági érték.
(Ugyanez a „ne gyárts hamis pontosságot" elv, ami az advisor ár-padlóját is
nyitva tartja.)

**Az algoritmus a MEGLÉVŐ vihar-override mintájára épül** (nem új mechanizmus):
I. fok → index-plafon 3,9 · II. fok → 2,0 · III. fok → 0 („Tilos"). Vihar ÉS
árvíz együtt: a SZIGORÚBB plafon marad (`Math.min`). A plafonok
`advisor_weights`-ből hangolhatók, deploy nélkül. A III. fok ugyanúgy „Tilos"
státuszt kap a UI-ban, mint a II. fokú viharjelzés — az m5-minta kiterjesztve.

**FAIL-SAFE minden ponton:** ha a vizugy elérhetetlen, a batch fut tovább (a
vízállás hiánya nem buktathatja az EGÉSZ időjárás-szinkront) · ha a mércének
nincs hivatalos küszöbe, nem találunk ki fokozatot (`null` ≠ 0. fok) · ha nincs
vízállás-adat, marad a régi alap-büntetés, változatlan viselkedéssel.

**A mérce-párosítás nem távolság-kérdés — ezt mérés fogta meg.** Győrnél a
LEGKÖZELEBBI mérce (0,3 km) a **Rábán** van, nem a Mosoni-Dunán: a folyónak is
egyeznie kell. A Római-partnál pedig a közelebbi Óbuda-mércének **nincsenek
készültségi szintjei**, ezért a 8,7 km-re lévő budapesti mérce a helyes forrás.
Végleges hozzárendelés: Szeged/Tisza → 2275 · Győr/Mosoni-Duna → 18 (Bácsa) ·
Római-part/Duna → 1026 (Budapest).

**Élő verifikáció (2026-07-27, valódi API):** auth → 1193 állomás → idősor →
minta+tendencia → fokozat. Mindhárom mércénk 0. fokon (Szeged 61 cm, Bácsa
207 cm, Budapest 36 cm), a küszöbök 650/750/850, 450/550/600, 620/700/800.
A fixture-ök ebből a válaszból készültek — kézzel gyártott mintán a magyar
mezőnevek (`Tsz`, `MdrNev`, `KF1`) eltérése észrevétlen maradt volna.

**Adatkor — külön küszöb, indoklással:** a mércék ÓRÁNKÉNT jelentenek, ezért a
30 perces általános stale-szabály itt minden adatot elavultnak jelölne, és
kiüresítené a jelzést. A vízállás a saját, 150 perces küszöbét kapta (két
kimaradt jelentést tűr), és a MÉRÉS saját időbélyegét mutatjuk, nem a
lekérésünkét. A 30 perces szabály a szél/viharjelzés adatokon ÉRINTETLEN.

**Amit szándékosan NEM használunk:** a vízhozam (m³/s) és a vízhő (°C) hézagos
— az általunk használt mércék közül a hozam csak kettőn, a vízhő egyetlenen
jön óránként. Egy csak néhány spoton működő jelzés rosszabb a semminél, mert
a hiányát a felhasználó nyugalomnak olvasná. Ha később sűrűbb lesz, bekötjük.

**Fájlok:** `_shared/vizugy.ts` (+teszt, valódi fixture-ökkel) · SUP-index
mindkét másolatában az árvízi ág (bit-azonos, külön tesztekkel) ·
`weather-sync` batch + Deno-héj · migráció `20260717091900` (spots.vizugy_tsz,
4 snapshot-oszlop értékkészlet-kényszerrel, nézet-bővítés, seed) · pgTAP-
kiegészítés · `spots/ui/WaterLevel.tsx` + i18n (hu/en).

**ÉLESÍTVE ÉS VERIFIKÁLVA (2026-07-27, felhasználói jóváhagyással):**
1. Migráció kitolva (`db push --include-all` — a 099000-es GDPR-migráció
   magasabb időbélyege miatt kellett a flag, ahogy F1.9-ben is).
2. `weather-sync` újradeployolva; kézi hívás → **15/15 spot OK, `riverGauges: 3`**.
3. Éles adat a snapshotokban: Szeged 62 cm · Bácsa 207 cm · Budapest 34 cm,
   mind 0. fokon, a mérés saját időbélyegével. Az óránkénti cron azóta magától
   írja (a verifikáció közben le is futott, valódi adattal).

**A KIKÉNYSZERÍTETT TESZT AZONNAL FOGOTT EGY VALÓDI HIBÁT.** Mivel élesben
mindhárom mérce 0. fokon áll, a fokozat-ág csak szimulációval ellenőrizhető:
egy ideiglenes sorral (`source='teszt-vizallas'`, 900 cm, III. fok)
kikényszerítettük az állapotot. Ekkor derült ki, hogy a teljes képernyős
riasztás a VIHARJELZÉS szövegét mutatta árvízre: „másodfokú viharjelzés van
érvényben" és „Várható széllökés: 10 km/h" — **szélcsend mellett** —, a
menekülési tanács pedig szél-specifikus volt („csökkentsd a szélfelületet"),
ami áradó folyón félrevezető, sőt veszélyes.
**Javítva:** a `StormAlertScreen` `variant` propot kapott (`storm` | `flood`),
saját i18n-blokkal (hu+en). Az árvíz-változat a sodrásról, az uszadékról és a
vízbe lógó fákról szól, és a vízállást írja ki a széllökés helyett. A keret
(ikon, vízimentő-CTA, forrás-sor) közös. Ha mindkét ok fennáll, a viharjelzés
győz (a szél az azonnal ható tényező). 4 új teszt védi, köztük egy, ami
kimondottan azt őrzi, hogy árvíznél NE szerepeljen a „viharjelzés" és a
„széllökés" szó.

A teszt-sorok törölve (ellenőrizve: 0 maradék), a spotok az éles adatot mutatják.

## F1.10/10 — A termék neve: „Suptime" (2026-07-27)

A felhasználó eldöntötte a nevet (a domaint másnap regisztrálja), így az F1 óta
nyitva álló **`[APPNÉV]` placeholder feloldva** — 28 helyen. Kapuk zöldek:
typecheck · lint · 482 vitest · 64 e2e · 7 vizuális.

**Ez nem kozmetika volt:** a placeholder RÁ VOLT ÍRVA a megosztás-kártyára is,
tehát minden megosztott link „[APPNÉV]"-vel jelent volna meg a Facebookon.

**Hol él a név, és miért pont ott** (`src/core/brand.ts` fejléce is felsorolja):
- **`APP_NAME`** (`@core/brand`) — a TypeScript-kód EGYETLEN forrása; a 10
  route-`meta` innen kapja a címet (eddig mindegyikben be volt égetve).
- **i18n-fájlok** — ott a név lefordított MONDATOK része („… | Suptime"), a
  fordítás pedig nem hivatkozhat kódra. hu + en, 5 namespace.
- **`public/og/default.png`** — a kártyára RAJZOLVA.
- **`public/sw.js`** (a service worker nem éri el a bundle-t) és a
  **`basic-auth.ts` realm-je** (Deno-runtime, külön fordítási egység).
Névváltáskor ez az öt hely a teljes lista: `grep -ri suptime`.

**A megosztás-kártya mostantól ÚJRAGENERÁLHATÓ.** Az F1.10/8-as változatot csak
PNG-ként commitoltuk, a generáló HTML eldobódott — a névváltás ezt azonnal
számon kérte. Most a forrás is bent van (`scripts/og-card.html` +
`node scripts/generate-og.mjs`, a meglévő Playwright-chromiummal).

**A repó és a dokumentáció munkaneve marad „SUP Platform"** — az belső
megnevezés, a felületen nem jelenik meg. A fejlesztési dokumentáció fejléce
rögzíti a döntést.

**Mellékesen javítva (valós, éles adat fogta):** a spot-adatlap e2e-tesztje a
szigorú `h1`-keresővel elhasalt, amikor a mérés közben ÉLESBE váltott egy
II. fokú viharjelzés — a teljes képernyős riasztásnak saját `h1`-e van. Ez
véletlenszerű piros lett volna (a lokális futás a távoli DB-t nézi); a teszt
mostantól az első címsorra vár, kommentben az okkal.

## F1.10/9 — Teljesítmény-kapu: LCP-mérés (2026-07-27)

Az audit UTOLSÓ nyitott hiánya (`AUDIT_F1.md` 6.1) lezárva. Kapuk zöldek:
typecheck · lint · 482 vitest · 64 e2e · 5 perf.

**A mérés a PRODUKCIÓS build ellen megy, nem a dev-szerver ellen.** A dev nem
bundle-öl, nem minifikál és HMR-kódot is szállít — abból mért LCP semmit nem
mondana. Az F1.10/3 óta viszont nincs `npm run start`, ezért új futtató:
`scripts/serve-build.mjs` (statikus fájl a `build/client`-ből + a generált
SSR-handler, ugyanabban a sorrendben, ahogy a Netlify csinálja).

**Fojtás Lighthouse-mobil profillal** (150 ms RTT / 1,6 Mbps / 4× CPU, CDP-n).
Fojtás nélkül minden localhost-mérés pár száz ms lenne, és a kapu semmit nem
fogna meg.

**A módszertan MAGA fogott egy hibát:** az első futásnál a `/spotok` **2764 ms**
LCP-t adott — a 2500-as budget FÖLÖTT. Az ok nem az oldal volt, hanem a mérés:
a lokális szerver tömörítés nélkül szállított, a Netlify viszont br/gzip-pel.
Fojtott hálózaton ez a legnagyobb egyetlen tényező. Tömörítés bekapcsolása után
UGYANAZ a build **944 ms**. Tanulság: egy hűtlen mérőeszköz nem konzervatív,
hanem hamis riasztást ad — és a hamis riasztás pont annyira rombolja a kapu
hitelét, mint az elnézett hiba.

**Alapérték (macOS, 2026-07-27):** `/` 584 ms · `/deszkak` 528 ms ·
`/deszkavalaszto` 588 ms · `/spotok` 944 ms. Kliens-JS (brotli, átvitt):
130 / 132 / 135 / 395 kB.

**Két kapu, két jellegű küszöbbel:** az LCP-budget a SPEC célján marad
(2500 ms) — szorosabb küszöb a gépek közti szórásra bukna, nem regresszióra.
A JS-budget viszont mért értékhez igazított (~35 % fejtér), mert
determinisztikus: ugyanaz a build ugyanannyi bájt. Külön teszt mondja ki, hogy
a **MapLibre csak a térképes útvonalon** töltődik — ha kikerülne a dinamikus
importból, minden oldal megfizetné, és a puszta budget-bukás nem nevezné meg az
okot.

**CI-ban SZÁNDÉKOSAN nem fut** (a vizuális kapuval azonos indok: osztott futók
ingadozó CPU-ja → hamis piros). Release előtti kapu, a runbookban leírva.
Az ÉLES oldal mérése a publikussá tétel után: `PERF_BASE_URL=https://… npm run e2e:perf`.

**Mellékesen javítva:** a `SpotMap.test.tsx` maplibre-mockjából hiányzott az
`once` — a betöltés-jelző (F1.10-es animált hullám) óta minden futás 3 kezeletlen
elutasítást írt. A tesztek zöldek voltak, de a kezeletlen hiba elfedhet valódi
regressziót.

**Élesítési döntések (felhasználóval egyeztetve, 2026-07-27):**
- **Captcha:** a Turnstile-kód kész, de éles kulcs NINCS és egyelőre nem is lesz
  — a jelszó-kapu mögött nincs mit védeni. A felhasználó a publikussá tételkor
  regisztrál a (ingyenes) Cloudflare-fiókra. Tisztázva: a Turnstile **nem
  hosting** — a domain nem költözik sehova; és a Supabase-nek nincs saját
  captchája, csak hCaptcha/Turnstile közül lehet választani. Elfogadott
  kockázatként rögzítve: `SECURITY_FINDINGS.md` **F1.10-05**.
- **E-mail-küldés:** a beépített Supabase-küldő próbára való (néhány levél/óra,
  best-effort). Éles SMTP a **Resend**-en át lesz — előfeltétele a saját domain
  (a `*.netlify.app` aldomain nem hitelesíthető feladóként). `SECURITY_FINDINGS.md`
  **F1.10-06**.
- Mindkettő + a cégadatok + a mérés bekerült a `RUNBOOK.md` **élesítési
  checklistjébe**, sorrendben (a domain a többi előfeltétele).

## F1.10/8 — OG megosztás-kártya (2026-07-27)

**A hiány:** a megosztott linkeknek EGYÁLTALÁN nem volt képük — `og:image` sehol
nem szerepelt. Az F1.1-es `og-image.ts` STUB nem létező útvonalakat adott vissza
(`/og/board/<slug>.png`), és sehol nem volt bekötve.

**Elkészült:**
- Márkázott, 1200×630-as alapértelmezett kártya (`public/og/default.png`), a
  design tokenjeiből (petrol gradiens, hullám-motívum, amber jelvény).
  **Generálás:** a meglévő Playwright-tel, HTML→PNG — így NEM kellett új
  futásidejű függőség.
- `resolveOgImage()`: relatív útvonalat abszolúttá tesz (a crawlerek a
  relatívat nem oldják fel), a már abszolút külső képet érintetlenül hagyja,
  hiányzó képnél az alapértelmezettre esik.
- `buildMeta` kiegészítve: `og:image` + `width`/`height`/`alt` +
  `twitter:card=summary_large_image` (kép nélkül a Twitter/X kis kártyát rajzol).
- A deszka-adatlapok a SAJÁT termékképüket használják. **Jelenleg mind az
  alapértelmezettre esik vissza — helyesen: a katalógusban egyetlen deszkának
  sincs `image_url`-je.** Ez adathiány, nem kódhiba.

**SZÁNDÉKOSAN NEM készült futásidejű, dinamikus kártya** (pl. „X100 11'0" —
76% neked"). Az F1.8-terv ezt említette, de a satori + resvg-wasm páros ~8 MB
függőséget tenne a serverless csomagba, és MINDEN crawler-kérésnél lefuttatná
az ajánló-algoritmust. Ez az arány most nem indokolt; a döntés újranyitható, ha
a megosztás valós forgalmat hoz. (A `og-image.ts` fejléce is rögzíti az okot.)

## F1.10/7 — Megosztható eredmény + működő Megosztás gomb (2026-07-26)

Két, egymással összefüggő hiba a Deszkaválasztó eredményén. Kapuk zöldek:
typecheck · lint · 479 vitest · 64 e2e · 7 vizuális.

**1. Az eredménynek nem volt saját címe.** Az ajánlás KIZÁRÓLAG a POST-válasz
törzsében élt, aminek három látható következménye volt:
- újratöltésnél a böngésző űrlap-újraküldést kért,
- a vissza-gomb után az eredmény elveszett,
- nem lehetett könyvjelzőzni és megosztani.

**Javítás: POST→redirect→GET.** Az `action` mostantól VALIDÁL és átirányít
(`/deszkavalaszto?suly=85&magassag=180&…`), a számítás a `loader`-ben történik
a query-paraméterekből. Új tiszta modul: `select/url.ts` (kódolás oda-vissza,
10 unit-teszttel).

**Ahol a hibás bemenet számít:** az URL nem megbízható. A testsúly az egyetlen
kötelező adat — hiánya/érvénytelensége esetén a WIZARD jelenik meg, nem üres
eredmény vagy hibaoldal. A felsorolás-mezők (szint, cél, víz, utas) ismeretlen
értéknél a józan alapértékre esnek, mert egy megosztott linkből könnyen
kimaradhat vagy elromolhat egy paraméter.

**A session-log az ACTION-ben maradt, nem került a loaderbe** — szándékosan:
egy megosztott linket sokan megnyithatnak, és minden megnyitás új sort írna,
ami torzítaná az elemzést.

**2. A „Megosztás" gomb NEM CSINÁLT SEMMIT** (nem volt `onClick`) — és nem is
lett volna mit megosztania. Az 1. pont után van mit: új `ShareButton` a natív
`navigator.share`-rel, vágólap-tartalékkal és visszajelzéssel. Ha egyik sem
elérhető (régi böngésző), a gomb EL SEM JELENIK — jobb, mint egy gomb, ami
kattintásra nem tesz semmit (pontosan ez volt a hiba).

**Verifikálva:** POST → 302 a paraméteres URL-re; a kapott URL friss
munkamenetben, közvetlenül megnyitva is renderel eredményt; paraméter nélkül a
wizard jön; hibás paraméterek nem törik el az oldalt. Két új e2e-teszt fedi.

## F1.10/6 — FÁZIS-ZÁRÓ AUDIT (2026-07-26)

Teljes riport: **`docs/AUDIT_F1.md`**. Minden pont MÉRÉSSEL zárult
(parancs-kimenettel), nem szemrevételezéssel. **24/26 tétel zöld.**

**Zöld szakaszok:** modul-szerződés (4/4) · RLS-lefedettség (4/4) · biztonság
(3/3) · design+a11y (5/5) · dokumentáció (2/2).

**Kiemelt bizonyítékok:**
- **19 tábla, 19-en RLS** — 0 fedetlen. 10 pgTAP-fájl, 189 assert.
- **Az e-mail-gate KÉT rétegű:** 2 app-route + 7 DB-policy az
  `is_email_confirmed()` helperre — az app-réteg megkerülése sem nyit utat.
- **A biztonsági tokenek bizonyíthatóan érintetlenek:** a `tokens.css`-nek a
  projekt kezdete óta 2 commitja van, MINDKETTŐ 0 TÖRLÉSSEL — egyetlen sor sem
  módosult benne.
- **Semgrep tiszta, Snyk 0 produkciós finding**, nyitott HIGH/CRITICAL nincs.
- **468 unit + 60 e2e (benne axe WCAG 2.1 AA)** — mind zöld.

**KÉT HIÁNY (egyik sem blokkoló, mindkettő mérés-jellegű kapu):**
1. **Vizuális regresszió (screenshot-egyezés) NINCS.** A token-kritikus
   komponensek viselkedését unit- és a11y-teszt fedi, de a vizuális elcsúszást
   nem. **Ez a session két ilyet is felszínre hozott** (mobil nav-túlcsordulás,
   fejléc↔tartalom eltérés) — mindkettőt FELHASZNÁLÓI észrevétel, nem teszt.
   Azóta mindkettőre van regressziós teszt, de a hibaosztály nyitva marad.
   Kockázat: közepes.
2. **LCP-mérés (Lighthouse-budget) NINCS.** Az oldal jelszó-kapu mögött van,
   valós forgalom nélkül — a mérés a publikussá tétel előtt értelmes. Ismert
   terhelő tétel a MapLibre + a külső csempe-CDN. Kockázat: alacsony-közepes.

**Audit közbeni önkorrekció:** a hreflang-ellenőrzésem először 0-t mutatott, és
majdnem hibaként jelentettem — a saját `grep`-em volt kis-nagybetű-érzékeny.
A linkek ott vannak (`hrefLang` alakban), és a HTML attribútumnevek
kis-nagybetű-érzéketlenek, tehát a crawlerek helyesen olvassák.

## F1.10/5 — ELSŐ ÉLES DEPLOY (2026-07-26)

A `supperz.netlify.app` él, **jelszó-kapu mögött**. 11 commit + a `[deploy]`
jelölős commit kitolva; a build lefutott.

**Az első deploy ELHASALT — tanulságos módon.** Minden kérés `500`-at adott
(`uncaught exception during edge function invocation`). Ok: a
`WWW-Authenticate` fejléc realm-jébe **ékezetes karakter és gondolatjel**
került (`"SUP Platform — elő-éles"`), a HTTP-fejléc értéke viszont csak ASCII
lehet — a Deno `Headers` kivételt dob rá MINDEN kérésnél, még mielőtt a 401
elkészülne.

**Amit ez egyben bizonyított:** a kapu tényleg MINDENT lefed (a `/robots.txt`
is 500-at adott, nem tartalmat), és a biztonsági posztúra végig tartott — az
500 sem engedett be senkit. Kellemetlen hiba, de nem nyitotta ki az oldalt.

**Javítás (2. deploy):** ASCII-only realm + védőháló `try/catch`, ami
BÁRMILYEN váratlan kivételnél is ZÁRVA marad (401), nem 500-zal. Így ha később
elszáll valami az edge functionben, az oldal továbbra is védett, és a
böngésző jelszó-ablaka is előjön.

**Verifikálva (jelszó nélkül):** `/`, `/spotok`, `/deszkak`, `/robots.txt`,
`/sitemap.xml`, `/admin/velemenyek` → **mind 401**, helyes
`www-authenticate` fejléccel és `x-robots-tag: noindex, nofollow`-val.

**Tanulság a jövőre:** ez a hibaosztály lokálisan NEM fogható — a kód csak a
Netlify Deno-futtatókörnyezetében fut, ahol a `Headers` szigorúbb, mint
Node-ban. Ezért marad kötelező az első deploy utáni kézi ellenőrzés
(`docs/RUNBOOK.md`).

**HÁTRA (felhasználói lépés):** a HITELESÍTETT út ellenőrzése — helyes
jelszóval betöltenek-e az SSR-oldalak, és él-e a Supabase-kapcsolat
(a `VITE_` értékek build-időben épültek be).

## F1.10/4 — Nyitott kis tételek + Netlify jelszó-kapu (2026-07-26)

Kapuk zöldek: typecheck · lint · 444 vitest. Új dokumentum: **`docs/RUNBOOK.md`**
(éles műveletek lépésről lépésre).

**Netlify-helyzet TISZTÁZVA (felhasználói aggály).** A `supperz.netlify.app`
oldalon **semmi nem szivárgott ki**: minden útvonal (`/`, `/spotok`, `/deszkak`,
`/admin/velemenyek`, `/assets/`, `/robots.txt`, `/sw.js`, `/index.html`) **404**.
Az utolsó publikált verzió (júl. 19.) az SSR-adapter ELŐTTI, és SSR-módban a
React Router nem generál `index.html`-t → a `build/client` csak assetet
tartalmazott, kiszolgálható oldalt nem.
A **`[deploy]`-kapu is működik:** a júl. 19. utáni deployok mind `Canceled`
státuszúak, **build-idő nélkül** (a publikáltaknál látszik a „Deployed in Xs",
a canceledeknél nem) — tehát build-percet nem fogyasztanak.
**Döntés: a repót NEM kötöttük le** — a kapu megoldja a költséget, a lekötés
viszont elvenné a deploy previewt és a `[deploy]`-os élesítést. Ha kell még egy
réteg, a Deploy Previews kikapcsolása olcsóbb.

**ÚJ: elő-éles jelszó-kapu** (`netlify/edge-functions/basic-auth.ts`) — HTTP
Basic auth az EGÉSZ oldalra, mert a Netlify beépített jelszó-védelme fizetős.
**FAIL-CLOSED:** `SITE_PASSWORD` nélkül 503, nem publikus oldal — az elfelejtett
beállítás feltűnő hiba, nem csendes szivárgás. Élesítéskor NEM a jelszót
töröljük (az 503-at adna), hanem `SITE_PUBLIC=true`-t állítunk, hogy a
nyilvánossá tétel tudatos lépés legyen. Deno-runtime → tsc/ESLint kizárás a
Supabase-functionök mintájára. **Automata teszt nem fedi** (csak a Netlify
edge-én fut) — az első deploy után kézi ellenőrzés a runbook szerint.

**Nyitott kis tételek lezárva:**
- **m3 (`supindex.stale_minutes`) — KIVÉVE, nem bekötve.** Az adatkor-küszöb
  (30 perc) **biztonsági invariáns** (2. fejezet 5.), nem hangolható paraméter:
  ha DB-ből állítható lenne, egy elgépelt érték csendben kikapcsolhatná az
  „Elavult adat" jelzést. Kód-konstans marad, a holt seed-kulcs törölve (a
  jelenléte azt a téves benyomást keltette, hogy SQL-ből állítható).
- **`listLatestSnapshots` — NÉZETRE cserélve** (migráció `20260717091800`,
  élesben kitolva és verifikálva: 15 spot → 15 sor, spotonként pontosan egy).
  A régi „utolsó 200 sor + JS-reduce" a spot-szám növekedésével CSENDBEN romlott
  volna el (egyes spotok „nincs adat"-ként jelentek volna meg). A nézet
  `security_invoker = on` → a hívó jogaival olvas, az alaptábla RLS-e érvényes.
- **providers seed↔trigger — JAVÍTVA.** A seed a `protect_provider_columns`
  triggert a beszúrás idejére kikapcsolja, majd VISSZAKAPCSOLJA (a pgTAP-minta
  szerint), és két szolgáltatót `verified=true`-ra állít. Így a „premium elöl"
  rendezés és a „Hitelesített" jelvény éles adaton is látszik.
- **F1.2-reviewer follow-upok:** `amount_huf` update-revert külön assert a
  pgTAP-ban (eddig csak a `status`-t néztük — egy pénzügyi mező szivárgása
  észrevétlen maradt volna); `anonymize_user` runbook-jegyzet a
  `docs/RUNBOOK.md`-ben (service_role-only, mit csinál, mit NEM szabad).

**MEGMARADT nyitott tétel:** cégadatok a jogi oldalakon (`@core/legal/entity.ts`
`[KITÖLTENDŐ: …]`) — a felhasználó adja meg. MapLibre null-warning: külső
stílus-kifejezésből jön, nem a mi kódunkból; nem blokkoló, F2-re hagyva.

## F1.10/3 — Netlify SSR-adapter bekötése (2026-07-26)

Az F1.0 óta halasztott adapter (`@netlify/vite-plugin-react-router` 4.0.0)
bekötve a `vite.config.ts`-be. Kapuk zöldek: typecheck · lint · 444 vitest ·
60 Playwright · Semgrep tiszta.

**Build-kimenet:** `build/client/` (statikus assetek, ez a `publish`) +
`.netlify/v1/functions/react-router-server.mjs` (az SSR-t kiszolgáló Netlify
Function). A függvényt a Netlify automatikusan felismeri.

**Node-runtime, nem Edge — tudatosan:** az Edge (Deno) változat külön
verifikációt igényelne, mert az SSR-loaderek a Supabase Node-kliensét használják.

**A natív (Capacitor) build érintetlen:** az adapter csak akkor aktív, ha
`BUILD_TARGET !== "native"` — SPA-módban nincs SSR, tehát adapter sem kell.

**Füstteszt (nem csak „lefordult"):** a generált függvényt Node-ból meghívtuk
egy valódi `Request`-tel → **200, `text/html`, `<html lang="hu">`, renderelt
navigáció**. Az SSR tehát ténylegesen kiszolgál, nem csak legenerálódik.

**BREAKING a fejlesztői flow-ban: a `npm run start` MEGSZŰNT.** Az adapterrel a
szerver-build serverless handler, nem önálló Node-szerver — a `react-router-serve`
nem tudja futtatni (ezt a build utáni próba mutatta ki). A `@react-router/serve`
függőség is kikerült (így nem marad használatlan produkciós csomag).
Fejlesztés: `npm run dev`; a produkciós futtató a Netlify Function.

**`[deploy]`-kapu megmarad:** a `netlify.toml` `ignore` parancsa minden push
buildjét kihagyja, kivéve ha a legutolsó commit üzenete tartalmazza a
`[deploy]` jelölőt. Új: `NODE_VERSION = "22"` (a `engines` >=22-t ír elő).

**E2E-stabilizálás (valós hibából):** a Vite az ELSŐ oldalbetöltéskor
optimalizálja a függőségeket és újratölti a lapot — a `webServer` health-check
ezt nem várja meg, így a párhuzamos tesztek egy épp újrainduló szerverbe
futottak (lokálisan 9 db `page.goto` timeout, hibátlan kód mellett). Megoldás:
`e2e/global-setup.ts` sorosan bemelegíti a nehéz route-okat, és CI-ban a
teszt-timeout 60 s. Enélkül ez véletlenszerű piros CI lett volna.

**HÁTRA az első éles deployhoz (felhasználói lépések):**
1. Netlify site létrehozása / repo bekötése.
2. Környezeti változók a Netlify UI-ban — a `netlify.toml` alján tételesen
   felsorolva (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `VITE_PUBLIC_SITE_URL`, `VITE_VAPID_PUBLIC_KEY`, `VITE_TURNSTILE_SITE_KEY`).
   **A `VITE_` értékek BUILD-IDŐBEN épülnek be** → utólagos beállítás után
   újra kell buildelni.
3. Egy commit `[deploy]` jelölővel (vagy „Trigger deploy" a UI-ból).

## F1.10/2 — Biztonsági audit: Semgrep-kapu + finding-triage (2026-07-25)

Új dokumentum: **`docs/SECURITY_FINDINGS.md`** — a findingok élő nyilvántartása
(javítva / elfogadott kockázat / nyitott, mindegyik INDOKLÁSSAL). Az
`AUDIT_CHECKLIST.md` 3. pontja innentől ide mutat.

**Semgrep SAST-kapu élesítve** (`p/typescript`, `p/react`, `p/secrets`,
`p/owasp-top-ten`, `p/sql-injection`) — CI-ban minden PR-en, `--error`-ral
(találat = piros CI). A scan a teljes kódbázison (app + core + modulok +
Edge Functionök + SQL) **jelenleg TISZTA**.

**Findingok (részletek a SECURITY_FINDINGS.md-ben):**
- **F1.10-01 — react-router CSRF (high, GHSA-qwww-vcr4-c8h2): ELFOGADOTT
  KOCKÁZAT.** A sérülékenység KIZÁRÓLAG RSC-módban él; a projekt framework-módú
  SSR-t használ, RSC nincs bekötve (grep-pel ellenőrizve). Javítás csak a 8.3.0
  FŐVERZIÓBAN van (a 7.x ágon nincs patch), ezért F2-re ütemezve. **Kiváltó ok az
  azonnali frissítésre:** ha RSC-módot vezetünk be, még a bevezetés ELŐTT.
- **F1.10-02 — `dangerouslySetInnerHTML` a JSON-LD-ben: FALSE POSITIVE.** A
  `<script>`-ből csak `<`-gal lehet kilépni, amit a `jsonLdScript` mind
  escape-el; regressziós teszt védi. `nosemgrep` + indoklás a kódban. Ez a
  projekt EGYETLEN innerHTML-pontja.
- **F1.10-03 — mozgó GitHub Actions tagek: JAVÍTVA.** Minden `uses:` teljes
  commit-SHA-ra pinnelve (a `trivy-action`/`kics-github-action` kompromittálása
  pont mozgó tagen keresztül történt). Frissítéskor a SHA-t is cserélni kell —
  F2-ben Dependabotra bízandó.
- **F1.10-04 — Snyk NINCS bekötve: NYITOTT.** A CLI/MCP fiók-hitelesítést kér,
  ami felhasználói döntés; addig az `npm audit --omit=dev` a helyettesítő (ez
  fedte fel az F1.10-01-et is). Teendő: Snyk-fiók + `SNYK_TOKEN` secret + heti
  ütemezett workflow.

## F1.10/1 — Playwright e2e + axe a11y kapu (2026-07-25)

A 10. fejezet két hiányzó kapuja élesítve. Kapuk zöldek: typecheck · lint ·
433 vitest · **54 Playwright-teszt** (chromium + Pixel 7 mobil).

**Felállás:**
- `playwright.config.ts`: két projekt (desktop chromium + **mobil**, mert a
  projekt mobil-first és a layout-regressziók csak ott jönnek elő).
  `E2E_BASE_URL`-lel külső szerverre irányítható; enélkül maga indít
  `npm run dev`-et.
- **CI-ban LOKÁLIS Supabase-stack ellen fut** (`supabase db start`, ugyanaz,
  amit az `rls-tests` használ): a seed determinisztikus, és a tesztek NEM írnak
  az éles projektbe. A kulcsokat a `supabase status` adja — repository secret
  nem kell. Bukásnál a Playwright-riport artifactként feltöltődik.
- Az assertek VISELKEDÉST rögzítenek, nem darabszámokat: a lokális (távoli DB,
  dev-artefaktumokkal) és a CI-beli (friss seed) adat eltér, de mindkettőben
  igaznak kell lennie.

**Lefedve:** `e2e/public-paths.spec.ts` (nav a modulokból, deszka/spot/szolgáltató
lista→adatlap, 404 ismeretlen slugra, jogi oldalak, robots+sitemap [nincs `/en/`],
jogosultsági kapuk kijelentkezve, `/api/push` → 401 JSON) · `e2e/advisor.spec.ts`
(wizard→eredmény→adatlap, a testsúly+magasság kötelezősége, **a magasság hatása
az ajánlásra**, Közös nevező a kártyán) · `e2e/a11y.spec.ts` (axe WCAG 2.1 AA a
10 kulcsképernyőn).

**Az új kapu AZONNAL fogott 3 valódi hibát (mind javítva):**
1. **`/belepes` és `/regisztracio` cím (`<title>`) NÉLKÜL renderelt** — axe
   „document-title", serious. Képernyőolvasóval megnevezhetetlen lap, és a
   böngésző-előzményben is névtelen. Az F1.8 loader-alapú meta a fő route-okra
   került be, az auth-oldalak kimaradtak → `meta` export (noindexszel, mert
   SEO-értékük nincs).
2. **A Deszkaválasztó wizardnak nem volt `h1`-e** — a címsor-hierarchia h2-vel
   indult (axe „page-has-heading-one"). Kapott látható h1-et.
3. **Két `<nav>` landmark megkülönböztető név nélkül** (fejléc + lábléc) —
   `aria-label` mindkettőre (`nav.primaryLabel` / `nav.footerLabel`, hu+en).

**Regressziós védelem a korábbi hibákra:** külön teszt őrzi, hogy az oldal
SEHOL nem csúszik el vízszintesen (ez volt a mobil nav-hiba), és hogy a
sitemap nem hirdet `/en/` URL-t (F1.8-döntés).

**Tanulság a teszt-írásból:** a `runWizard` helper eleinte „bármilyen h1"-re
várt; amint a wizard maga is kapott h1-et (3. javítás), a helper azonnal
késznek hitte a lapot, és a teszt még a wizardon vizsgálódott. Azóta az
EREDMÉNY-lap konkrét címére vár — általános várakozás helyett mindig a
célállapotra jellemző horgonyt kell figyelni.

**Ami SZÁNDÉKOSAN nincs az automata csomagban:** az auth-os ÍRÁSI folyamatok
(vélemény, flag, moderáció, provider-claim, push-feliratkozás) — éles adatot
írnának, és böngésző-engedélyt/teszt-fiókot igényelnek. Ezeket a PROGRESS
kézi runbookjai fedik (F1.5/F1.6/F1.7/F1.9 szakaszok).

## F1.6-utó — Deszkaválasztó: testmagasság + Közös nevező az eredményen (2026-07-25)

Felhasználói visszajelzésből (kattintgatós körből) jött két hiányosság; mindkettő
javítva. Kapuk zöldek: typecheck · lint · 432 vitest (+15).

**1. Testmagasság mint bemenet (hiányzott).** A SÚLY a térfogatot adja
(felhajtóerő), a MAGASSÁG a deszka HOSSZÁT — magasabb evezősnek hosszabb deszka
fekszik jobban. Bevezetve:
- `AdvisorInputs.heightCm` + `BoardForAdvisor.lengthCm` (a `boards.length_cm`
  már megvolt, séma-módosítás NEM kellett).
- ÚJ, HATODIK rész-pont: `lengthFitScore` — `ideal = clamp(base_length +
  (magasság − base_height) × cm_per_height, min, max)`, a pont pedig
  `1 − |hossz − ideal| / tolerancia`. Defaultok: 175 cm → 320 cm, 1,2 cm/cm,
  290–380 cm korlát, 45 cm tolerancia — **mind az `advisor_weights`-ből
  hangolható** (6 új `advisor.length_fit.*` kulcs + `advisor.weight.length`=10
  a seedben).
- **PUHA szempont, tudatosan:** a hossz SOHA nem zár ki (külön teszt védi) — a
  kemény szűrés kizárólag biztonsági marad (térfogat, terhelhetőség). Hiányzó
  magasság vagy deszkahossz → semleges 0,5, nem büntetjük az adathiányt.
- A súlyok mostantól RELATÍV értékek: a pontszám a tényleges súlyösszeggel
  normálva megy 0–100-ra, ezért az öt eredeti súlyt nem kellett átskálázni.
- Wizard: kötelező magasság-mező (120–220 cm) a testsúly mellett, magyarázó
  súgóval. Az eredmény tetején kiírjuk az ideális hosszt cm-ben ÉS lábban
  (`cmToFeetInches`, mert a piac lábban nevezi a deszkákat) — enélkül a
  felhasználó nem látná, hogy a válasza számított (a rész-pont súlya csak 10 %,
  ezért ritkán kerül a top-2 indoklás közé).
- Élesben ellenőrizve: 85 kg / kezdő / allround inputtal 165 cm → „kb. 308 cm
  (10'1")", a top score 72 %; 192 cm → „kb. 340 cm (11'2")", 76 %, és a további
  ajánlások sorrendje is átrendeződik a hosszabb deszkák felé.

**2. Közös nevező az ajánlás-kártyán (nem jelent meg).** Az algoritmus HASZNÁLTA
a vélemény-átlagot, de az eredmény-képernyő nem mutatta.
- A `RatingBar` **átkerült a `@core/ui`-ba**: két modulnak (reviews + advisor)
  kellett, a modul-szerződés (1.3) szerint a közös igény a core-ba megy —
  modul→modul import tilos lenne.
- Az ajánlás-kártyákon (nagy + kompakt) most 10-es mérce + számérték +
  értékelés-szám látszik, LINKKÉNT a deszka-adatlap Közös nevező blokkjára
  (`/deszkak/<slug>#kozos-nevezo`; a horgony + `scroll-mt` felvéve az adatlapra).
  Értékelés hiányában őszinte üres-állapot („még nincs értékelés"), nem üres sáv.
- Token-szabály betartva: a `RatingBar` NEM a biztonsági Gauge, a `--danger`
  értékelés-sávon tilos, és a szám MINDIG a sáv mellett (szín + szöveg).
- **Bővítés (ugyanaznap, felhasználói kérésre): TELJES bontás a kártyán.** Nem
  csak az összesített szám, hanem a négy rész-szempont (stabilitás, siklás,
  minőség, ár-érték) mércéi + a „hányan ajánlanák" arány is ott van az
  ajánlásoknál — a választáshoz össze kell tudni hasonlítani a jelölteket
  anélkül, hogy mindegyikre át kellene kattintani. A `#kozos-nevezo` link
  megmaradt („Vélemények"), de már nem az EGÉSZ blokk link (a hosszú
  link-tartalom rossz a11y), és az aria-felirat sem ígér kattintást.
- A dimenzió-listát az advisor SAJÁT másolatban tartja
  (`ADVISOR_REVIEW_DIMENSIONS`), mert a reviews-ból importálni tilos —
  a másolat elcsúszását **őrszem-teszt** védi a route-rétegben
  (`app/routes/deszkavalaszto.dimensions.test.ts`), ahol mindkét modulhoz
  szabad nyúlni. Ha a reviews új szempontot vezet be, a teszt elhasal.

**Mellékesen javítva (a mobil-verifikáció fogta):** a fejléc-navigáció 375 px-en
kilógott, és az EGÉSZ OLDAL vízszintesen görgethető lett (minden route-on).
Mostantól maga a nav-sáv görgethető (`overflow-x-auto`, elrejtett scrollbar,
`shrink-0` + `whitespace-nowrap` az elemeken) — a dokumentum nem csúszik el
(ellenőrizve: scrollWidth == clientWidth 375 px-en).

## F1.9 — Web push + viharjelzés-pipeline (2026-07-25)

Kiosztás: karmester (a `web-push` skill Deno-mintája alapján, az F1.3 `_shared`
tiszta-logika + vékony-héj mintát követve). Kapuk zöldek: typecheck · lint ·
417 vitest (+58 új: web-push crypto, push-notify célzás, storm-alert push-ág,
push.server, m4). SSR/curl-verifikáció a dev-szerveren.

**Elkészült — küldő oldal (Edge Function):**
- `_shared/web-push.ts`: VAPID JWT (ES256) + RFC 8291 payload-titkosítás
  (aes128gcm) **natív `crypto.subtle`-lel, npm-függőség NÉLKÜL** (az
  `npm:web-push` Deno edge alatt megbízhatatlan). Node/Vitest-semleges, a
  hálózat injektált `fetch`-en jön. A 404/410 nem hiba, hanem `stale: true`.
- `_shared/push-notify.ts`: TISZTA célzás + üzenet-építés. Feliratkozásonként
  EGY üzenet, a saját spotjaira szabva; **explicit opt-in** (spot nélküli
  feliratkozás nem kap semmit). Üzenetek a 9./3. szerint: II. fok = „Tilos a
  vízen tartózkodni — azonnali partraszállás!" (critical), I. fok = fokozott
  óvatosság, visszaállás = „Újra evezhető"; MINDEGYIKBEN forrás + időbélyeg
  (9./4.). Azonos `tag` → az új riasztás felülírja a régit (nem torlódnak
  elavult üzenetek).
- `_shared/storm-alert.ts`: `notifyStormChange()` + `push` opcionális dep.
  **Fail-safe:** VAPID nélkül a push-ág kimarad; a snapshot-írás hibája NEM
  némítja el a push-t (és fordítva sem); egy feliratkozó hibája nem viszi a
  többit; a 410/404-es feliratkozásokat kitakarítja. Summary: `pushSent`,
  `pushStale`.
- `storm-alert/index.ts`: a push-deps bekötése (`overlaps("alert_spot_ids")`
  célzó lekérdezés, `sendWebPush`, törlés), spot `name`+`slug` a select-be.

**Elkészült — feliratkozó oldal (web):**
- ÚJ migráció `20260717090600_core_push_webpush.sql` (additív, az F1.2-táblát és
  RLS-t nem bolygatja): `endpoint` GENERÁLT oszlop a jsonb tokenből + UNIQUE
  index (egy böngésző-endpoint = egy sor, nincs duplikált riasztás), GIN index
  az `alert_spot_ids`-re, `updated_at`, és `upsert_push_subscription()`
  **SECURITY DEFINER** RPC. A definer-jogkör oka: **eszköz-átvétel** — ha ugyanaz
  az endpoint másik fiókkal jelentkezik be, a régi sort törölni kell, amit RLS
  alatt a hívó nem tehetne meg. A `user_id` MINDIG `auth.uid()`, sosem paraméter.
  pgTAP: `42_push_webpush_test.sql` (9 eset: generált oszlop, nincs duplikálás,
  hibás token, eszköz-átvétel, anon tiltás, idegen sor nem törölhető).
- `public/sw.js`: service worker — CSAK push + notificationclick.
  **Szándékosan nincs fetch-handler/offline cache:** cache-elt viharjelzés soha
  nem jelenhet meg aktuálisként (2. fejezet 5.). `requireInteraction` a kritikus
  riasztásokra. `public/icons/` értesítés-ikon + badge (petrol, hullám-motívum).
- `@core/notifications/web-push.ts`: valódi `WebPushProvider` (engedélykérés,
  igény szerinti SW-regisztráció, PushManager). **DB-t SOHA nem ír közvetlenül** —
  a `/api/push` resource route ír, a kérés cookie-s SSR-sessionjével, RLS alatt.
- `@core/notifications/push.server.ts`: topic-validálás (`storm:<uuid>`, a
  kliens-bemenet nem megbízható), spot-lista összefésülés (feliratkozás nem
  veszít el korábbi spotot), leiratkozásnál az utolsó spotnál a SOR IS törlődik
  (adatminimum).
- `app/routes/api.push.ts`: GET (eszköz feliratkozásai) + POST
  (subscribe/unsubscribe). Bejelentkezés nélkül **401 JSON, nem redirect**.
  A robots.txt tiltja a `/api/`-t.
- `@core/notifications/PushToggle.tsx` + `core` i18n `push.*` (hu+en), bekötve a
  spot-adatlapra — **csak ott, ahol van `storm_warning_region`** (a Fertőnek
  nincs HungaroMet-forrása, F1-korlát: nincs mit riasztani).
- `scripts/generate-vapid.mjs`: npm-mentes VAPID-generátor (Node Web Crypto); a
  privát kulcsot a gitignore-olt `.vapid.json`-ba írja, NEM a terminálra.

**Verifikáció (curl + SSR, dev-szerver):** `/sw.js` 200, ikon 200, `/api/push`
GET anonim → `{subscriptions:[]}`, POST anonim → 401 `push.loginRequired`,
robots.txt tiltja az `/api/`-t, a spot-adatlapon renderel a „Viharjelzés-
értesítés" szekció. Az RFC 8291 helyessége roundtrip-teszttel igazolt (a teszt a
FOGADÓ oldalról fejti vissza a titkosított üzenetet) — ez a kritikus rész, mert
hibás levezetésnél a böngésző némán eldobná az üzenetet.

**ÉLESÍTÉS KÉSZ (2026-07-25, felhasználói jóváhagyással):**
1. VAPID-kulcspár generálva (`.vapid.json`, gitignore-olt); a publikus kulcs a
   `.env`-ben (`VITE_VAPID_PUBLIC_KEY`), a **privát kizárólag** Supabase
   secretben. A kulcspárt egyszer ROTÁLTUK, mert az első `npm run sb --`
   hívásnál az npm kiírta a parancssort a privát kulccsal — azóta a wrapper
   közvetlen (`bash scripts/sb.sh`) hívása megy, exportált env-változóval.
   **Tanulság:** titkot tartalmazó CLI-parancsot ne `npm run`-on át.
2. Secretek beállítva (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`);
   a digestek a lokális kulcspárral egyeznek (ellenőrizve).
3. **5 migráció kitolva** (`db push --include-all` — a régebbi időbélyegek miatt
   kellett a flag): `090500` consent · `090600` push webpush · `090700` RPC-grant
   szigorítás · `091600` catalog-watch · `091700` observed_at.
4. `storm-alert` újra deployolva a push-ággal.

**Éles verifikáció (REST + függvényhívás):**
- `weather_snapshots.observed_at` oszlop létezik (régi sorokon null) ✓
- `user_consents`, `catalog_candidates` táblák elérhetők (F1.8 + catalog-watch
  migráció is kiment) ✓
- `push_subscriptions` anonim olvasás → `[]` (RLS) ✓
- storm-alert hívás → 200, 3 körzet scrape (mind 0 fok), `pushSent: 0`,
  `pushStale: 0` — az ÚJ kód fut élesben ✓
- **Éles teszt fogott egy hiányosságot (javítva, `090700`):** a
  `revoke all … from public` + `grant … to authenticated` NEM zárja ki az anont
  — a Supabase `alter default privileges` beállítása létrehozáskor explicit
  EXECUTE-ot ad anon/authenticated/service_role szerepnek, amit a PUBLIC-revoke
  nem érint. Anonim hívásnál eddig a függvényen BELÜLI `auth.uid()` guard fogott
  (helyes, de csak egy réteg); az explicit `revoke … from anon` után már a
  jogosultsági réteg utasítja el („permission denied for function") ✓
  **Általános tanulság minden jövőbeli RPC-re:** a public sémában létrehozott
  függvény alapból anon-hívható — explicit revoke kell.

**BÖNGÉSZŐ-VERIFIKÁCIÓ KÉSZ (2026-07-25) — a push ÉLESBEN MEGÉRKEZETT.**
Chrome + lokális dev-szerver (a `localhost` biztonságos kontextus, nem kellett
hozzá deploy). Menet:
1. Belépés → `/spotok/balatonfoldvar` → „Értesíts viharjelzésről" → engedély.
   `push_subscriptions` sor létrejött (10:12:39 UTC, FCM-endpoint,
   `alert_spot_ids` = Balatonföldvár).
2. Kikényszerített szintváltás: a spot legutóbbi mérésének másolata
   `storm_level=1`, `source='teszt-viharfok'` sorként (nem hamis szél-adat).
3. A **cron** (5 perc, ápr–okt) 10:15:03-kor észlelte az 1→0 váltást: 6 Balaton-
   spotra bm-okf snapshot (szint 0) + push kiküldve → **az értesítés megérkezett**.
4. Teszt-sor törölve (`source='teszt-viharfok'` — ellenőrizve, 0 maradék).

Ezzel a 9. fejezet push-pipeline-ja végponttól végpontig igazolt: feliratkozás →
RLS-es tárolás → cron-detektálás → célzás → VAPID+RFC 8291 titkosítás → FCM →
service worker → rendszer-értesítés.

**Nem automatizálható (tudatos korlát):** Playwrighttal nem tesztelhető — headless
Chromiumnak nincs push-szolgáltatása. Regresszióhoz a fenti 4 lépéses kézi menet
a runbook (a `docs/PROGRESS.md` ezen szakasza).

**Megjegyzés a nyelvhez:** a push-szöveg magyarul, a `_shared/push-notify.ts`-ben
épül (az Edge Function nem éri el az i18next namespace-eket, és F1-ben csak a
`hu` locale él). Több nyelvnél a feliratkozás locale-ját is tárolni kell (F2).

### F2.1-utó-16 — gyártói spec-tábla beolvasása (2026-08-19)

A hiányzó vastagság/súly/**teherbírás** megszerzése — utóbbi azért kritikus,
mert a `passesHardFilter` (`select.ts`) KÖTELEZŐ biztonsági mezőként kezeli:
`maxLoadKg === null` esetén a deszka kiesik a kemény szűrőn, tehát sosem kerül
ajánlásba. Kapuk zöldek: typecheck · lint · **875 vitest** (+25 új).

**Elkészült:**
- `spec-table.ts` — TISZTA parse: a gyártói tábla méret-OSZLOPONKÉNT egy
  deszka, soronként egy tulajdonság. A méret-kulcs (`normalizeSizeKey`)
  szándékosan ugyanaz az alak, amit a `shopify.ts` variáns-címkéje ad — ez
  köti össze a katalógus-sort a spec-táblával.
- `render.ts` → `renderTables()`: csak BEOLVAS (sor/cella mátrix), nem
  értelmez. A tábla külső appból jön, ezért nem fix várakozás van, hanem
  `waitForFunction` az első kitöltött sorra.
- `crawl.ts`: **TERMÉKENKÉNT EGY renderelés** tölti fel az ÖSSZES méretét
  (nem méretenként!) — ezért fér bele a költség. Csak a HIÁNYZÓ mezőket írja:
  amit a `/products.json` már adott, azt nem bántja.
- A dry-run mostantól KIÍRJA a specifikációkat — írás előtti ellenőrzésre.

**Két élesben mért hiba, amit a dry-run ellenőrzése fogott meg** (mindkettőre
teszt készült; ezek nélkül HIBÁS adat került volna be):
1. **`Gross Load Weight | 130 kg`** (Roamer) a deszka SÚLYÁBA került a
   „weight" részstring miatt — 130 kg-os deszkát írt volna be a valódi
   13,93 kg helyett, és a teherbírás üresen maradt volna. Javítva: a
   „load"/„payload"/„capacity" kizáró szó a `weightKg`-nál, és külön
   címkék a `maxLoadKg`-nál.
2. **`308 lbs / 140 kg`** — a font-értéket vette teherbírásnak. Javítva: a
   `kg`-hoz TAPADÓ szám élvez elsőbbséget.
   Ugyanez a szigorítás oldotta meg a `Xtec Carbon D2: 13.93 kg` esetét is,
   ahol a kivitel nevében lévő számjegy („D2") miatt a cella tévesen
   több-értékűnek látszott.

**Eredmény a Starboardon (97 termékből 90-nél sikerült a spec-tábla):**

| | spec-tábla ELŐTT | UTÁN |
|---|---|---|
| hiányos jelölt | 276 | **144** |
| csak a súly hiányzik | 0 | 109 |
| **teherbírás hiányzik** | 276 | **34** |

A 277 Starboard-jelöltből **243-nak van teherbírása**, és 228-nak MIND az öt
mérőszáma megvan. A maradék 109-nél csak a SÚLY hiányzik — ott a gyártó
kivitelenként sorolja fel (`Blue Carbon: 10.4 kg…Starlite: 11.2 kg…`), amiből
tudatosan NEM tippelünk. A súly nem szerepel a kemény szűrőben, tehát ezek a
deszkák így is ajánlásképesek.

**Aqua Marina — ugyanez a minta, egyszerűbben.** A hivatalos `aquamarina.com`
Elementor-widgetekben, címke–érték párokban közli a specifikációt, SIMA
SZÖVEGKÉNT (nem képen) — a meglévő `parseSpecsFromText` a hosszt/szélességet/
vastagságot/űrtartalmat már vitte, csak két címke hiányzott: `NET WEIGHT`
(deszka súlya) és `MAX. PAYLOAD` (teherbírás). Bekötve, ellenőrizve a
BLAZE 10'4"-en: 315 cm / 79 cm / 15 cm / 315 L / 9,3 kg / **140 kg** — mind
egyezik a gyártói adatlappal.

**Jelenlegi összkép a moderációs sorban:** 430 pending jelölt (277 Starboard +
153 korábbi), ebből **338-nak van teherbírása** és 228-nak teljes az adata.
Munkalista: `for_validate/2026-08-19-validalando-deszkak.html` (144 tétel).

**Következő lépés (nyitott):** az `aquamarina.com` felvétele forrásként, hogy
a 110 kereskedői Aqua Marina jelölt hiányzó mezői is gyártói adatból
töltődjenek.

### F2.1-utó-17 — kivitel-bontás + JSON-LD nélküli gyártói oldalak (2026-08-19)

**1. A kiviteli változatok KÜLÖN deszkák (felhasználói döntés).** Eddig a
Deluxe / Deluxe Lite / Carbon Reflex / Xtec egy jelöltté olvadt össze, ezért a
súlyt üresen kellett hagyni (két érték egy cellában), a teherbírást pedig a
szigorúbb értékre húzni. A felhasználó döntése: külön modellek — „a gyártó
okkal ad meg külön modelleket", és az évjáratok között a különbség nagyobb is
lehet. Élesben ez igazolta magát; ezek az értékek eddig MIND elvesztek:

| Deszka | Súly | Teherbírás |
|---|---|---|
| All Star 14'0" X 26" **Deluxe** | 10,5 kg | 105 kg |
| All Star 14'0" X 26" **Deluxe Lite** | 9,6 kg | 85 kg |
| TallTwin 9'5" X 29.75" **Carbon Reflex** | 7,39 kg | 100 kg |
| TallTwin 9'5" X 29.75" **Xtec Carbon** | 8,94 kg | 100 kg |

- `shopify.ts`: a variáns-kulcs és a modellnév is tartalmazza a kivitelt.
- `spec-table.ts` → `cellForConstruction()`: egy cella több kivitel adatát is
  hordozhatja (`„Deluxe: 60-105 kgDeluxe Lite: 50-85 kg"`), a jelölt a SAJÁT
  szeletét kapja. **A címke nagybetűre horgonyzott**, mert a gyártó elválasztó
  nélkül fűzi össze a szegmenseket (`kgDeluxe`) — kisbetűt is engedve a minta
  a „kg"-ot hinné a következő címke elejének, és levágná az előző érték
  mértékegységét. A `Deluxe` vs `Deluxe Lite` csapdát (a rövidebb név a
  hosszabb ELEJE) teljes egyezés, majd leghosszabb-előtag oldja meg.
- Ezzel a korábbi „szigorúbb érték" szabály már csak végszükség-tartalék
  (ismeretlen kivitelnél).

Starboard újrafuttatva: **97 termék → 455 variáns** (a 284 helyett), +178 új
jelölt.

**2. JSON-LD nélküli gyártói oldalak (`htmlOnly`).** Az `aquamarina.com`
termékoldalain 0 JSON-LD van, a specifikáció viszont címkézett szövegként ott
áll (`NET WEIGHT`, `MAX. PAYLOAD`), amit a `parseSpecsFromText` amúgy is olvas.
Új `extractProductFromPage()` a `<title>` + oldalszöveg alapján, `crawl_config.
htmlOnly` kapcsolóval (CLI: `--html-only`).

**Szemét elleni védelem:** csak akkor ad jelöltet, ha a HOSSZ tényleg kijött.
A sitemap blogot és kategóriaoldalt is tartalmaz — enélkül azok is bekerülnének.
Dry-run 12 URL-en: 8 teljes adatú jelölt, a 4 kategóriaoldal helyesen kimaradt.
Az Atlas értékei (366×86×15, 180 kg) egyeznek az F2.1-utó-13-ban kézzel
ellenőrzöttekkel — független megerősítés a parse helyességére.

**Új forrás:** `Aqua Marina (gyártói)` — `aquamarina.com`, 79 termék-URL,
`--html-only`, sitemap a `wp-sitemap-posts-page-1.xml`.

**Megnézve, de NEM kötve be: ZRay** (`zraysports.com`). A termékoldal nyers
HTML-je 705 bájt (JS-es SPA), renderelve viszont tiszta címkézett szöveg
(`Length: 10'6" / 320 cm … Capacity: up to 152 kg/335 lb`). Bekötéséhez a
render-fallbacket a `htmlOnly` ágba is be kellene húzni (ma csak akkor fut, ha
MÁR van kinyert termék). Egy próbafutás ráadásul RÉSZLEGES renderelést adott
(`volumeL: 7` a valós 337 helyett), tehát a fix 1500 ms várakozás ehhez az
oldalhoz kevés — előbb a várakozási feltételt kellene tartalomhoz kötni.

**Kajak-szűrés — élesben mért hiba, javítva (2026-08-19).** Az Aqua Marina
gyártói katalógusából KAJAKOK kerültek be deszka-jelöltként (Halve, Laxo,
Memba, Betta, Steam, Tomahawk Air K/C, Caliber, Ripple) — ugyanazok a
termékek, amiket korábban kézzel kellett elutasítani a bolti forrásokból.
Oka: a `classifyProduct` ELSŐ szabálya rövidre zár („deszka-tartományú hossz
+ teherbírás → deszka"), márpedig egy kajak pontosan ilyen.

- `NEVER_BOARD_KEYWORDS` (kajak/kayak/kenu/canoe/csónak/equipment) MINDEN más
  szabály ELŐTT dönt.
- `classifyProduct` opcionális `classificationHint`-et kap; a
  `extractProductFromPage` az URL útvonalát ÉS a spec-blokk előtti **szűk,
  140 karakteres fejléc-ablakot** adja jelként.
- **Miért szűk az ablak:** a teljes oldalszöveg használhatatlan — a navigáció
  minden oldalon felsorolja a „Kayak" kategóriát, ezért élesben mérve a
  Blaze DESZKA oldalán is 31 „kayak" szó van. A gyártó viszont a termék fölé
  írja a saját kategóriáját: „LAXO RECREATIONAL KAYAK", „RIPPLE RECREATIONAL
  CANOE" vs. „BLAZE glowing series".

Ellenőrizve 7 valódi oldalon (5 kajak kizárva, 2 deszka átengedve); a 10 már
bekerült tétel elutasítva.

**Állapot a kör végén (2026-08-19):**

| | |
|---|---|
| deszka-jelölt (pending) | **586** |
| ebből teherbírással (ajánlásképes) | **535** |
| ebből teljes adatú (mind az 5 mérőszám) | **493** |
| munkalista (`list-incomplete`) | **93** |

Márkánként: Starboard 454 · Aqua Marina 105 · Indiana 9 · Too Much 10 ·
Flowa 4 · Coasto 4. (A „Too Much"/„TooMuch" kettősség márka-összevonást
igényel a moderálásnál.)

Összevetésül: a kör elején 35 élő deszka és 153 pending jelölt volt, amiből
96 volt teljes adatú. A munkalista 276-ról 93-ra csökkent úgy, hogy közben
a jelöltek száma a négyszeresére nőtt.

### F2.1-utó-18 — az Aqua Marina gyártói forrás teljessé tétele (2026-08-19)

A 79 sitemap-URL végigellenőrizve: melyik NEM lett jelölt és miért. A 33
„kimaradt" közül 30 kategórialap vagy nem-deszka (kajak, platform, csónak,
száraz zsák) — helyesen. Három valódi termék akadt fenn, két külön okból:

**1. NUTS — más lap-elrendezés (javítva).** A lap KÉT HASÁBBAN közli a
specifikációt: az egyik `<div>` MINDEN címkét felsorol, a másik MINDEN
értéket. A szokásos „címke után 40 karakterrel" keresés ilyenkor a KÖVETKEZŐ
CÍMKÉT találja érték helyett, ezért mind a hat mező üres maradt, és a termék
egyáltalán nem lett jelölt.

Új `parseTransposedSpecs()` fallback (csak akkor fut, ha a szokásos parse
üres), két biztonsági feltétellel — különben pozíció-alapú találgatás lenne:
legalább **4 egymást követő** ismert spec-címke, és **pontosan ugyanannyi**
értéksor. Eredmény: NUTS → 320×81×15 cm, 300 L, 9,1 kg, teherbírás 140 kg.

**2-3. MEGA (18'1", 550 cm) és AIRSHIP RACE (22'0", 670 cm) — MEGOLDVA.**
Ezek valódi Aqua Marina SUP-ok, de többszemélyes „mega" deszkák (650 kg és
460 kg teherbírás), és a `BOARD_LENGTH_MAX_CM = 520` szűrőn fennakadtak.
Nem hiba volt, hanem hatókör-kérdés — **felhasználói döntés (2026-08-19):
kerüljenek be a katalógusba, de KÜLÖN KEZELVE.**

- `catalog-watch`: `BOARD_LENGTH_MAX_CM` 520 → **700** (≈23 láb), hogy
  jelöltként bejöjjenek.
- `advisor`: új **`singlePaddlerMaxLengthCm`** (520 cm) kemény szűrő a
  `passesHardFilter`-ben, és a „miért nincs találat" indok-láncban is.
  Konfigurálható (`advisor.single_paddler.max_length_cm`), a többi
  advisor-paraméter mintájára.

**Miért kell külön szabály:** ezek a deszkák a térfogat- és
terhelhetőség-szűrőn ÉPP AZÉRT mennének át, mert sokat bírnak (1400 L,
650 kg) — enélkül az ajánló egy 80 kg-os KEZDŐNEK is felkínálna egy 18
lábas, csoportos deszkát. A katalógusban tehát láthatók, az ajánlásban nem.

**Az Aqua Marina gyártói forrás ezzel kész: 39 jelölt, MIND A 39 teljes
adatú** (mind az öt mérőszám, teherbírással együtt) — ez a legtisztább
forrásunk.

**Állapot a kör végén:** 589 deszka-jelölt · 538 teherbírással
(ajánlásképes) · 496 teljes adatú · munkalista 93 tétel.

### F2.1-utó-19 — tömeges jóváhagyás és duplikátum-összevonás (2026-08-19)

**A kiváltó kérdés (felhasználó):** „ezeket biztosan jóvá kell hagynom?
ekkora adatmennyiségnél ez hatalmas munka". Jogos — 496 tétel egyenkénti
átkattintása értelmetlen. A kapu viszont nem az adatminőségről szól (azt a
gyártói forrás adja), hanem KÉT dologról: a **kategóriáról** (a jóváhagyás
egyetlen emberi bemenete) és a **duplikátumokról** (136 csoport).

**1. A GYÁRTÓ saját kategóriája (Shopify-kollekciók).** A modellnevekben
nincs kategória-szó (Spice, Whopper, Wedge), a találgatás pedig félrevisz.
A gyártói bolt kollekciói viszont a hivatalos besorolást adják — és a
felhasználó gyanúja beigazolódott: **van átfedés.**

| Modell | `all-round / wave` | `surf` |
|---|---|---|
| Whopper, GO Surf | ✓ | ✓ |
| GO | ✓ | — |
| Wedge, Longboard, Pro, Spice, TallTwin | — | ✓ |

A Whoppert a gyártó kifejezetten kezdőknek ajánlja („the go-to board for
first-time paddlers"), a GO Surföt pedig „from learning in the flat" —
tehát sík vízre IS valók. A Wedge viszont CSAK szörf, pedig a neve alapján
allroundnak tűnne. **Ezt heurisztikával nem lehetett volna eltalálni** — a
korábbi, „a szörf-deszkák nem valók a katalógusba" következtetésem téves volt.

**2. Duplikátum-összevonás** (`dedupe.ts`, tiszta modul). A szabály a
felhasználó döntése: a **gyártói jelölt nyer** (ott hivatalos a modellnév),
és a **hiányzó mezőit a kereskedői lapról** töltjük — a saját értékét soha
nem írjuk felül. Biztonsági feltételek: trigram-hasonlóság a `match.ts`
konzervatív küszöbével, egyező márka, ÉS egyező hossz (5 cm tűrés) — a
`12'0"` és a `10'8"` GO két külön deszka, pedig a nevük azonos.

**3. `approve-candidates` CLI**, alapértelmezésben DRY-RUN. Nem sérti a
„figyelő sosem publikál magától" elvet: a parancsot az ADMIN futtatja, a
crawl továbbra sem ír `boards`-ba. Amit NEM hagy jóvá: nincs kategória, vagy
hiányzik a teherbírás/térfogat (a két kemény biztonsági szűrő).

Az app-oldali `buildBoardInsert`-ből másolat kellett (`@core/*` alias sima
`node` alatt nem oldódik fel) — **őrszem-teszt** védi: vitest alatt betölti
az eredetit és mezőről mezőre összeveti.

**A dry-run két hibát fogott meg írás előtt:**
- **HTML-entitás a nevekben:** a Shopify `/products.json` és a JSON-LD `name`
  mezője entitást ad (`Indiana 12&#039;6 Touring`) — nyersen került volna a
  katalógusba. A `cleanModelName` most feloldja; a 15 már tárolt név
  egyszeri scripttel javítva.
- **Zajos bolti nevek és téves kategória** (`Aqua Marina FUSION ( )`,
  `CORAL Stand up` → race). Ezért a futás **csak gyártói forrásra** ment
  (`--brand-site`, felhasználói döntés) — a bolti jelöltek nem vesznek el:
  amint a gyártói deszkák léteznek, a következő crawl őket MÁR ISMERT
  deszkára illeszti (ár + elérhetőség), nem új jelöltként.

**Eredmény — a katalógus 35-ről 104 deszkára nőtt:**

| | |
|---|---|
| élő deszka | **104** (volt: 35) |
| ebből ajánlásképes | **88** |
| jóváhagyva ebben a körben | 69 |
| duplikátum összevonva | 54 |

Márka: Starboard 61 · Bluefin 15 · Aqua Marina 10 · Red Paddle 4 · Fanatic 3
· Indiana 3 · egyéb 8. Típus: túra 41 · allround 33 · race 18 · gyerek 8 ·
jóga 2 · folyami 1 · horgász 1.

**Nyitva maradt:** 524 pending jelölt, túlnyomórészt kategória nélkül (a
Starboard szörf-vonala: Spice, Longboard, Pro, TallTwin — ezekre nincs
kategóriánk) vagy hiányzó biztonsági mezővel.

### F2.1-utó-20 — a szörf/wing vonal kizárva (2026-08-19)

**Felhasználói döntés:** „a szörf kategóriát töröljük és ezeket a jelölteket
ne is vegyük fel. A surf egy teljesen más dolog, mi a SUP-okra fókuszálunk."
Ezzel a korábban felvetett „új szörf BoardType" opció is lekerült a napirendről.

**FONTOS PONTOSÍTÁS az átfedésről.** A kizárás NEM terjed ki azokra a
modellekre, amiket a gyártó az `all-round / wave` kollekcióban IS szerepeltet:

| Modell | gyártói kollekció | döntés |
|---|---|---|
| Whopper, GO Surf | all-round / wave **ÉS** surf | **marad** (a gyártó sík vízre is ajánlja) |
| Spice, Pro, Longboard, Longboard Surf, Wedge, TallTwin, TwinFin | csak surf | kizárva |
| Wingboard | wing | kizárva |

**158 pending jelölt elutasítva** (Spice 45, Pro 34, Longboard 32, Wedge 21,
Longboard Surf 10, TallTwin 7, Wingboard 7, Surf 2). Élő deszkát EGYET SEM
érintett — a szörf-modellek kategória nélkül maradtak, ezért a tömeges
jóváhagyás eleve kihagyta őket.

Két tétel SZÁNDÉKOSAN kimaradt az elutasításból:
- **Surf Pump HP** — pumpa, nem szörf-deszka (a névre illeszkedő minta
  elkapta volna; az `accessoryType !== null` szűrő védte ki).
- **Hyper Nut** (2 db) — a leírása nem mondja ki a szörf-célt, ezért a
  moderátornál marad (inkább hiányozzon, mint tévedjen).

**Beépítve a crawlerbe** (`crawl_config.shopify.excludeCollections`), hogy a
következő futás be se hozza őket. A `collectionTypes` ERŐSEBB a kizárásnál —
ez tartja bent az átfedő modelleket; őrszem-teszt védi mindkét irányt.

**Állapot:** 104 élő deszka (88 ajánlásképes) · 366 pending jelölt ·
84 jóváhagyott + 54 összevont + 207 elutasított.

### F2.1-utó-21 — kategória öröklése a modellcsaládon belül (2026-08-19)

**A probléma:** a gyártói kollekciók csak az AKTUÁLIS évjáratot sorolják fel,
így ugyanannak a modellcsaládnak a régebbi példányai kategória nélkül
maradtak — a 2027-es „All Star" megkapta a `race`-t, a 2024-es ugyanaz a
deszka nem. 251 kategória nélküli jelöltből 153 pontosan ilyen volt.

**A szabály:** ha egy modellcsalád bármelyik példányának van hivatalos
kategóriája, azt a család többi tagja is megkapja. A család kulcsa a márka +
a modellnév SZÁM ELŐTTI része (`All Star 14'0" X 24.5" Wood Carbon` →
`all star`) — a méret és a kivitel épp azért marad ki, mert azok
különböztetik meg a testvéreket, a kategóriájuk viszont közös.

**ÉLESBEN MÉRT HIBA, javítva:** az első változat a BOLTI oldalak téves
tippjét vette át, mert a gyártói jelöltek típusa akkor még `null` volt (az
Aqua Marina crawl a kategória-felismerés bevezetése ELŐTT futott). Ez a
következőket okozta volna:

| Deszka | téves | helyes | a téves tipp forrása |
|---|---|---|---|
| Aqua Marina **Fusion** | kids | allround | sup-deszka.hu cím |
| Aqua Marina **Vapor** | kids | allround | sup-deszka.hu cím |
| Aqua Marina **Atlas** | touring | allround | sup-deszka.hu cím |

Mostantól **csak MEGBÍZHATÓ forrás** adhat kategóriát a családnak: a gyártói
oldal, vagy a már jóváhagyott (moderátor által átnézett) deszka. Ütköző
besorolásnál (`starboard|junior`: kids ÉS race) nem következtetünk.

Az Aqua Marina forrás újracrawlolva, hogy a gyártói jelöltek megkapják az
URL-ből a kategóriájukat.

**Eredmény — a katalógus 166 deszkára nőtt (a kör elején 35 volt):**

| | kör eleje | most |
|---|---|---|
| élő deszka | 35 | **166** |
| ebből ajánlásképes | ~30 | **150** |

Márka: Starboard 108 · Aqua Marina 25 · Bluefin 15 · Red Paddle 4 · Fanatic 3
· Indiana 3 · egyéb 8. Típus: allround 73 · túra 49 · race 27 · gyerek 9 ·
jóga 4 · folyami 2 · horgász 2.

Jelöltek: 146 jóváhagyott · 104 összevont · 207 elutasított · **254 pending**.

### F2.1-utó-22 — a besorolás a GYÁRTÓ használat-értékeléséből (2026-08-19)

**Felhasználói kérés:** „ezeket mentsük el és egy következő gyűjtésnél már ne
legyenek kérdések." Ezért a maradék kategória-kérdéseket NEM eseti döntésekkel
zártuk le, hanem gyártói adatból — így a következő gyűjtésnél maguktól
megoldódnak.

**A felismerés:** az `aquamarina.com` minden deszkát PONTOZ négy használati
mód szerint, százalékos sávokkal:

```
BLAZE:  ALL-AROUND/ENTRY 100% · GUIDE/EXPLORE 60% · SURF/WAVE 80% · RACE/TRAINING 40%
```

Ez a gyártó saját állásfoglalása arról, mire való a deszka — a legerősebb
adja a kategóriát. Erre azért volt szükség, mert a gyártó MARKETING-
kategóriái (`/products/glowing/`, `/products/family/`, `/products/light-weight/`,
`/products/hybrid/`) nem használati kategóriák: a „Glowing" annyit tesz, hogy
világít, nem azt, hogy mire jó.

`usage-rating.ts` — tiszta modul:
- a horgony az `aria-valuetext` attribútum (képernyőolvasóknak szánt,
  ember által olvasható összefoglaló → stabilabb, mint a vizuális markup),
- **döntetlennél nem tippel** (két egyformán erős használatnál a moderátor dönt),
- **más értékelés-készletet figyelmen kívül hagy** — a NUTS és a Revolution
  oldala `TRACKING / MANEUVERABILITY / STABILITY / SPEED` sávokat mutat, azok
  nem használati módok,
- **ha a SZÖRF vezet, a termék KIMARAD** — a szörf-kizárás így gyártói
  adatból jön, nem kézzel karbantartott névlistából.

Ez utóbbi rögtön fogott két tételt: a **Wave** (SURF/WAVE 100%) és a **Blade**
(windsurf-széria, SURF/WAVE 100%) elutasítva.

Elsőbbség: terméknév + URL-kategória → majd a használat-értékelés.

**Amit ez feloldott** — pontosan azok a tételek, amiket egyébként egyenként
kellett volna eldönteni: Glow, Blaze, Ray (`glowing`), Super Trip / View /
Tandem (`family`), Airo, Halo (`light-weight`), Cascade, Cascade Tandem
(`hybrid`), Mega (`multiperson`), AMgo.

**Kategória nélkül maradt (2 tétel, moderátorra vár):** NUTS és Revolution —
az ő oldaluk más értékelés-készletet használ, tehát a gyártó nem mond
használati besorolást.

**A katalógus 178 deszka:**

| | kör eleje | most |
|---|---|---|
| élő deszka | 35 | **178** |
| ebből ajánlásképes | ~30 | **161** |

Márka: Starboard 108 · Aqua Marina 37 · Bluefin 15 · Red Paddle 4 · Fanatic 3
· Indiana 3 · egyéb 8. Típus: allround 84 · túra 50 · race 27 · gyerek 9 ·
jóga 4 · folyami 2 · horgász 2.

Jelöltek: 158 jóváhagyott · 104 összevont · 209 elutasított · 240 pending
(ebből 58 kiegészítő, ~63 hiányzó biztonsági mezővel, a többi bolti forrásból —
azok a következő crawlnál a meglévő deszkákra illeszkednek majd ár- és
elérhetőség-frissítésként).

### F2.1-utó-23 — a maradék két deszka, gyártói szövegből (2026-08-19)

A NUTS és a Revolution oldala más értékelés-készletet mutat
(`TRACKING / MANEUVERABILITY / STABILITY / SPEED`), tehát a használat-sávok
nem adtak kategóriát. A felhasználó bemásolta a hivatalos gyártói leírásokat,
és ez két KÜLÖNBÖZŐ megoldást igényelt:

**NUTS — a leírás kimondja.** „Our NUTS board is the perfect **all-around
board** for first-time paddlers…". Új `boardTypeFromDescription()`: ha a
gyártó prózája nevesíti a kategóriát, azt vesszük.

**SZIGORÚ MINTA:** a kategória-szó után KÖTELEZŐ a „board"/„sup"/„isup".
Enélkül a navigáció kategória-menüje („ALL-AROUND", „RACE") MINDEN oldalon
hamis találatot adna — ugyanaz a csapda, ami a kajak-szűrésnél is előjött.
Több, eltérő kategória említésénél nem tippelünk.

**Revolution — a leírás csak körülír.** „Designed to be stable enough for a
first-time experience but with a shape to entertain the expert paddler with
performance" — általános célú deszka, de kategória-szó nélkül. Ide új
`crawl_config.boardTypeByUrl` (URL-részlet → típus): a **moderátori döntés a
forrás konfigjában marad meg**, tehát a következő gyűjtésnél már nem kérdés
(a felhasználó kifejezett kérése).

Elsőbbségi sor a besorolásnál, a legerősebbtől:
1. `boardTypeByUrl` — moderátori rögzítés,
2. terméknév + URL kategória-szegmens,
3. a gyártó használat-értékelése (százalékos sávok),
4. a gyártó leírásában nevesített kategória.

**Utólagos megerősítés (ugyanaznap):** a felhasználó megtalálta a Revolution
hivatalos kampányanyagát — a szlogen „wonder is **all-around**", a leírás
pedig „wide and ultra stable board series… **Perfect for beginners to
intermediate paddlers**". A rögzített `allround` besorolás tehát gyártói
adattal is alátámasztott.

Megjegyzés a mintához: a szlogenben szereplő „all-around" ÖNMAGÁBAN nem
aktiválja a `boardTypeFromDescription`-t, mert hiányzik utána a kötelező
„board" — ez helyes viselkedés, egy kampány-szlogen nem kategória-állítás.
Ezért volt szükség a kézi rögzítésre.

**A katalógus 180 deszka (163 ajánlásképes); a gyártói forrásokból NEM
maradt eldöntetlen tétel.**

### F2.1-utó-24 — termékképek és a kiegészítők behozása (2026-08-20)

**Felhasználói szempont:** „Kellenének képek a termékekről, mert a felhasználók
sokszor ez alapján döntenek."

**A hiba, amit én okoztam:** a JSON-LD nélküli (`htmlOnly`) ágban
`imageUrl: null`-t írtam, ezért a katalógus 180 sorából 57-nek nem volt képe —
köztük MIND a 39 Aqua Marina deszkának.

Az `aquamarina.com` nem ad `og:image`-et, és 30+ `<img>` van egy oldalon
(fejléc-logók, drónfotók, tartozékok). Ezért HORGONYOKRA megyünk, a
legpontosabbtól: **cikkszám** (`MODEL: BT-26BZ`) → **teljes modellnév** → a
**modellnév első szava** (a fájlnév gyakran csak azt viseli: `Coral-R-1.png`,
`mega_frontback.png`).

Két finomítás élesben mért hibából:
- **Kizárva a logó és a RÉSZLET-/technológia-kép**: a Coralnál a
  `construction-CORAL-Raspberry` nyert volna a termék fő fotója helyett.
- **A WordPress bélyegkép-utótag levágva** (`-222x1024.png` → `.png`), hogy az
  eredeti méret kerüljön be, ne egy apró változat.

**Visszatöltés a már jóváhagyott deszkákra.** Az újracrawl NEM segített, mert
a `saveCandidate` szándékosan nem támasztja fel az elbírált sorokat. Ezért a
pótlás a deszka SAJÁT forrás-oldaláról ment, a `matched_board_id` kapcsolaton
keresztül — így a kép biztosan a helyes termékhez tartozik, nem
hasonlóság-keresés eredménye. (Egy korábbi, hasonlóságra épülő próba
`Drift ← Aqua-Marina-Glow.jpeg` párosítást adott — ezért lett elvetve.)

**Kiegészítők.** A katalógusban 0 volt, miközben 58 jelölt várt — MIND a 58
képpel. Új `approve-candidates --accessories`: itt nincs emberi döntés (a
kategóriát a besoroló adja, biztonsági mérőszám nem kell), csak **márkanév**
kell, ami nélkül a jóváhagyás elakadna.

Két besorolási hiba javítva: az **„evezőtáska"** és az **„evezőtartó"** a
substring miatt EVEZŐNEK látszott (az egyik táska, a másik rögzítő), a
**„KENU EVEZŐ"** pedig kenuhoz való. A táska/tartó minta az `evezo` ELÉ került;
a 4 érintett jelölt elutasítva.

**Állapot:**

| | |
|---|---|
| katalógus | **228 sor** — 180 deszka + 48 kiegészítő |
| ajánlásképes deszka | **163** |
| KÉPPEL | **202 / 228** |

Kiegészítők: pumpa 27 · evező 17 · mentőmellény 4.
Jelöltek: 208 jóváhagyott · 107 összevont · 213 elutasított · 183 pending.

**Nyitva (a következő menetre):**
- **26 kép nélküli sor**: 8 Aqua Marina (a gyártó fájlnevei nem
  horgonyozhatók — pl. a Revolutionnél elgépelés: `revolutiobn.png`), és 15
  régi, még a katalógus-figyelő előttről származó deszka (Red Paddle, Fanatic,
  JP, Naish, Itiwit, Aztron, Gladiator).
- **Az `Aqua Marina Hungary` crawl hálózati hibával elszállt** (`fetch failed`)
  — semmi nem íródott, egyszerűen újrafuttatandó.
- 183 pending jelölt: túlnyomórészt bolti forrásból, hiányzó biztonsági
  mezővel; ezek a következő crawlnál a meglévő deszkákra illeszkednek majd
  ár- és elérhetőség-frissítésként.

### F2.1-utó-25 — EGYSÉGES termékkép + újrafuttatható visszatöltés (2026-08-20)

**Felhasználói szempont:** „a képeket a SUP-deszkákhoz szeretném elsősorban…
amikor majd valaki véleményezi, akkor ez segít neki a modellek között
eligazodni, szóval egységes méretű képek kellenének."

Ez nem szépészeti kérés, hanem funkcionális: a kép a MODELLEK KÖZTI
eligazodás eszköze. Ebből a szempontból nézve derült ki, hogy a képek megléte
volt a kisebbik gond.

**A NAGYOBBIK HIBA — a megjelenítés.** A kártyák `h-32` + `object-cover`-rel
mutatták a képet. A gyártói termékrender viszont erősen ÁLLÓ kép (a SUP
front/back nézete tipikusan 470×1000 px), a bolti életkép pedig fekvő
(1024×683). Egy 128 px magas, vágott sávban az álló renderből csak a KÖZEPE
maradt — vagyis minden deszkából ugyanaz a felismerhetetlen színes csík lett.
Képernyőképen ellenőrizve: az „Airo", az „Airship Race" és négy egymás melletti
All Star megkülönböztethetetlen volt; épp az veszett el (orr-forma,
fedélzet-rajz, arány), ami alapján a véleményező választana.

**A megoldás:** `@core/ui ProductImage` — FIX oldalarányú keret +
`object-contain`. A keret minden kártyán azonos (ez az „egységes méret"), a kép
teljes egészében, torzítás nélkül látszik benne, a kimaradó részt semleges
`--mist` passepartout tölti ki. Bekötve: `BoardCard`, `AccessoryCard`,
`BoardHero`, és a **Deszkaválasztó** találati kártyái — utóbbi a legfontosabb
hely, ott kifejezetten a modellek KÖZTI választás a feladat.

**A forrás-oldal is egységesebb lett.** Két, élesben mért javítás a
`findProductImage`-ben:

1. **Azonos horgonyra a front/back RENDER nyer az életkép előtt** (Nuts, Race
   Elite, Rapid). A fehér hátterű, azonos beállítású gyártói render
   összevethető, a drónfotó nem.
2. **POZÍCIÓ-FALLBACK, ha egyetlen horgony sem talál.** A fájlnév ezen a
   gyártói oldalon NEM megbízható: a Revolution képe `revolutiobn.png`
   (elgépelés), a `/fitness/peace/` és a `/fitness/dock/` hero-képének a
   fájlneve pedig FEL VAN CSERÉLVE — a képeket megnézve mindkét oldalon a
   helyes termék látszik, tehát a POZÍCIÓ helyes, a fájlnév hazudik.
   49 gyártói oldalon mérve: ahol mindkét szabály adott képet, **30-szor
   ugyanazt**; a fallback pontosan ott szólal meg, ahol a horgony néma.

**Új parancs — `backfill-images`.** Az F2.1-utó-24-es visszatöltés egyszeri
szkript volt; mostantól újrafuttatható:

```bash
node tools/catalog-watch/cli.ts backfill-images            # dry-run
node tools/catalog-watch/cli.ts backfill-images --apply
```

A crawl a JELÖLTET írja, a jóváhagyott deszkát nem (a `saveCandidate`
szándékosan nem támasztja fel az elbírált sorokat), ezért a kép a sor SAJÁT
forrás-oldaláról jön, a `matched_board_id` kapcsolaton át. Két szabály védi:
csak **moderátor által elbírált** (`approved`/`merged`) kapcsolatot fogad el (a
`pending` egyezést a trigram-egyeztető csak tippelte), és a **gyártói oldalt
előbb** próbálja, mint a boltit.

**Állapot:**

| | |
|---|---|
| katalógus | **228 sor** — 180 deszka + 48 kiegészítő |
| KÉPPEL | **208 / 228** (deszka 160/180, kiegészítő 48/48) |

Az `Aqua Marina Hungary` crawl (F2.1-utó-24-ben hálózati hibával elszállt)
lefutott: 95 termék · 12 ismert · 12 ársor · 0 új jelölt.

**Amit a kép-kör közben MEGTALÁLTUNK — moderátori döntést kér:**

1. **A 20 kép nélküli sor MIND a katalógus-figyelő ELŐTTI seed-deszka**
   (`b0000001`…`b0000020`). Nincs forrás-oldaluk, ezért képet sem lehet hozzájuk
   találni — és ez a kisebbik baj:
2. **Két seed-sor DUPLIKÁTUM.** A gyártói crawl behozta ugyanazokat:

   | seed (kézi, kép nélkül) | gyártói sor (képpel) |
   |---|---|
   | Dhyana 11'0" — 335×86×15, 300 l, 120 kg | **Dhyana** — 325×87×15, 347 l, 155 kg |
   | Drift 10'10" — 330×90×15, 350 l, 160 kg | **Drift** — 330×97×15, 284 l, 130 kg |

   A méretek ELTÉRNEK, tehát nem elírásról van szó: a seed-adat más (régebbi)
   évjáraté vagy pontatlan. A gyártói sor a mérvadó. A validálás megkezdése
   előtt érdemes rendezni, különben a véleményező két „Dhyana"-t lát.
   (A Starboard `Sprint 14'0"` / `Touring 12'6"` / `iGO 11'2"` seed-sorok
   szélesség nélküli, általános nevek — a gyártói katalógusban ugyanezek
   méret-változatonként szerepelnek; ezek is átnézendők.)

**Márka-lefedettség** (a `Kezdők_tanácsok/nepszeru_sup_markak_es_forgalmazok.md`
12 márkájára, `probe`-bal mérve):

| Márka | Forrás | Állapot |
|---|---|---|
| Aqua Marina | gyártói + HU bolt | ✅ 39 deszka |
| Starboard | gyártói (Shopify) | ✅ 108 |
| Bluefin | gyártói | ✅ 15 |
| Indiana (nincs a listán) | gyártói | ✅ 3 |
| **FunWater** | — | **AZONNAL FELVEHETŐ**: Shopify, 715 termék-URL, Product JSON-LD |
| **Decathlon (Itiwit)** | — | 5000 URL + JSON-LD; termék-minta kell (a próba márka-oldalakat fogott) |
| Gladiator | — | 315 URL, **nincs JSON-LD** → `htmlOnly`-munka |
| Jobe | — | 5000 URL, nincs JSON-LD → `htmlOnly`-munka |
| **ZRay** | — | `zraysports.com`: 154 URL, **nincs JSON-LD** → `htmlOnly`-munka |
| Red Paddle Co | — | a sitemap 0 termék-URL-t ad → explicit `--sitemap` kell |
| Fanatic (Duotone) | — | a sitemap 0 termék-URL-t ad → explicit `--sitemap` kell |
| Bestway | — | még nem próbálva |
| Aquatone | — | **robots.txt nem elérhető → kimarad** (nem találgatunk) |

Vagyis a 12 népszerű márkából **4-nek van forrása**. A `products.json`
(Shopify-mód) csak a FunWaternél él, a többinél egyedi munka kell.

**Jóváhagyandó sor (183 pending):** 180 deszka + 3 kiegészítő. Ebből **68
teljes adatú** (márka + teherbírás + űrtartalom megvan), 112-nél hiányzik
biztonsági mező (javarészt Starboard-Shopify, ami nem ad űrtartalmat és
teherbírást). 38 pendingnek már van párja a katalógusban — azok
ÖSSZEFÉSÜLÉSRE várnak, nem új típusnak.

### F2.1-utó-26 — Zray-forrás, és két hiba, amit a bekötése hozott elő (2026-08-20)

**Felhasználói kérdés:** „A Zray már benne van?" — nem volt, mert egyetlen
forrás sem fedte. A `zraysports.com` sitemapje 138 termék-URL-t ad, Product
JSON-LD nincs, a specifikáció viszont címkézett szövegként ott van, tehát a
`htmlOnly` ág való rá. (A site erősen korlátoz: `429 Too Many Requests`, ezért
3000 ms szünettel fut.)

A bekötés közben **négy hiba** jött elő, ebből **kettő a MEGLÉVŐ forrásokat is
érintő, csendes hiba** volt:

**1. INDEX-ELCSÚSZÁS (általános, súlyos).** A `foldText` NFD-re bont, majd a
diakritikus jeleket törli. Ékezetes latin betűnél ez hossz-semleges („é" →
„e"+U+0301 → „e"), a HANGUL szótagoknál viszont nem: azok 3 nem-diakritikus
jamóra bomlanak. A Zray az ikonjaihoz használ ilyen karaktert (`&#xb133;`), így
a hajtott szöveg két karakterrel hosszabb lett — a `valueAfterLabel` pedig az
abban talált indexszel vágta az EREDETI szöveget. A „Volume: 379L" ablak így
„9L"-ként indult: **9 liter a 379 helyett.** A hajtás mostantól indexhű.

**2. A SZOMSZÉD TERMÉK ADATA.** A termékoldalon a „Related Products" blokk
MEGELŐZI a spec-táblát, és más deszkákról ír: „[HIGHER VOLUME; CAPACITY] The
weight capacity is 152 kg". A címke-keresés emiatt **152 kg-ot olvasott a
valós 170 helyett.** Mostantól kétmenetes: előbb csak a KETTŐSPONTTAL zárt
címke számít (azt csak spec-táblázat írja), és csak utána jön a régi, laza
illesztés — a kettőspont nélküli táblák (aquamarina.com „NET WEIGHT\n9.3 kg")
tehát változatlanul működnek.

Mindkettő **biztonsági mezőt** rontott: a teherbírásra és a térfogatra a
Deszkaválasztó ajánlást épít.

**3. A HASONLAT nem állítás.** „…makes rider feel just like paddling on a
hardboard" — egy FELFÚJHATÓ deszka reklámszövege, amitől a deszka keménynek
látszott. A „like"/„mint" előzményű előfordulás mostantól nem számít
állításnak. A szerkezeti jelek (drop stitch, nagynyomású szelep) viszont
felfújhatót JELEZNEK — ez a Zray-oldalon a döntő, mert az „inflatable" szó
egyszer sem szerepel rajta.

**4. PROTOKOLL-RELATÍV kép-URL** (`//img.website.xin/…`) — így a katalógusból
nem töltődne be. A kép-URL mostantól a termékoldalhoz képest abszolutizálódik.

Új forrás-konfig: **`titleSuffixes`** — a `<title>` oldal-szintű utótagja
(„-Zray Official Site"), enélkül a modellnév „Max Azure M2 A Official Site"
lenne. Forrásonként más, ezért konfig és nem globális zajszó-lista, ami egy
jogos modellnevet is elvághatna.

**Ötödik hiba, már az első crawl EREDMÉNYÉBŐL:** a kiegészítő-oldalakon
(ALUMINUM OARS, Pump, LEASH, vízhatlan táska) nincs saját spec-blokk, a
„Related Products" viszont SUP-deszkákat sorol — a parse onnan szedte a
méretet, és mindegyik kiegészítő „396,2 × 396,2 cm, 150 kg" **deszkaként**
jött be. A `classifyProduct` méret-alapú rövidzára szándékosan erősebb minden
kulcsszónál, de ez azt feltételezi, hogy az adat a TERMÉK SAJÁTJA — mostantól
csak ÖNMAGÁBAN ELLENTMONDÁSMENTES adatra szólal meg: **egy deszka sosem
szélesebb, mint amilyen hosszú.**

**Zray-eredmény:** 138 URL · 80 jelölt · 68 teljes biztonsági adattal · MIND
képpel. Modellcsaládok: X-Rider, Evasion, Fury, Max, Flora, Mehndi, Graffiti,
Dual, Concave, Kids, Rapid Pro, All Around Ultra.

### F2.1-utó-27 — a tömeges jóváhagyó ÚJRA-EGYEZTET (2026-08-20)

**A validálás megkezdése előtt elkapva.** Az `approve-candidates` a mostani
soron **26 ÚJ deszkát** hozott volna létre, köztük egy második ATLAS-t,
BEAST-et, HYPER-t (kétszer), RAPID-ot, MONSTER-t (kétszer), FUSION-t és SUPER
TRIP TANDEM-et — mind olyat, ami a gyártói forrásból MÁR BENT VAN. Ráadásul
BOLTI néven („MAGMA 11'2" 23%", „RAPID BT 22RP , 130kg ig"), tehát a
katalógusban két, egymásnak ellentmondó sor állt volna ugyanarról a deszkáról,
épp amikor a véleményezés indul.

**Az ok:** a jelölt sora a crawl PILLANATÁBAN fagy meg, benne az AKKORI
egyeztetéssel. A bolti jelöltek java KORÁBBAN keletkezett, mint a hozzájuk
tartozó gyártói deszka, ezért `matched_board_id` nélkül várakoznak — a
jóváhagyó pedig ezt „új típusnak" olvasta. (A kód kommentje eddig úgy tudta,
hogy „a következő crawl majd ismert deszkára illeszti" — a MÁR LÉTREJÖTT
jelölt-soroknál ez nem történik meg.)

`planApproval` (tiszta függvény a `match.ts`-ben): jóváhagyás előtt minden
jelöltet újra egyeztetünk az AKTUÁLIS katalógussal, és a `matchCandidate`
három kimenete háromféle sorsot kap:

| egyezés | sors | miért |
|---|---|---|
| `known` | **összefésülés** | a deszka már megvan, új sor nem születik |
| `uncertain` | **marad `pending`** | bizonytalan egyezés = EMBERI döntés |
| `new` | **jóváhagyható** | tényleg új típus |

**Az eredmény a mostani soron: 26 új deszka helyett 8 valóban új, 9
összefésülés, 19 moderátori döntés.**

### F2.1-utó-28 — a fejlesztői seed-adat kivezetése az éles katalógusból (2026-08-20)

**Amit a kép-kör felszínre hozott:** a 20 kép nélküli sor mind a
`b0000001`…`b0000020` azonosítójú **seed-deszka** volt a `supabase/seed.sql`-ből
(11.4) — fejlesztői demo-adat, ami az éles katalógusban ült, és onnan három
irányban ártott:

1. **Kitalált árak, nem létező boltoktól.** A 20 ársor olyan „boltokra"
   hivatkozott, mint az „Olcsó SUP", a „Jóga & Víz", a „Horgász Webshop" és a
   „Vízisport Webshop" — a felhasználó valós piaci adatnak látta volna őket.
2. **Duplikátumok.** A gyártói crawl behozta ugyanazokat a deszkákat
   (Dhyana, Drift), ELTÉRŐ méretekkel — a seed-adat pontatlan vagy más
   évjáraté volt, a gyártói sor a mérvadó.
3. **Rontották az EGYEZTETÉST.** A méret nélküli, általános seed-nevek magukhoz
   vonzották a valódi jelölteket: az `iGO 11'2"`-hez 12, a `Touring 12'6"`-hoz
   és a `Sprint 14'0"`-hez 6-6 Starboard-jelölt kapcsolódott, pedig azok
   méret-változatonként külön deszkák.

**Felhasználói döntés:** törlés (a `seed.sql` marad — a CI KIZÁRÓLAG lokális
Supabase-re futtatja, éles projektre soha).

Törölve: **19 seed-deszka + mind a 20 kitalált ársor**; 27 jelölt leválasztva
róluk (`matched_board_id = null`), így a jóváhagyó a valódi katalógushoz
egyezteti őket újra.

**Egy sor SZÁNDÉKOSAN maradt: a `Decathlon Itiwit X100 11'0"`** — erre van az
egyetlen vélemény az egész rendszerben (5/5, 2026-07-21). Felhasználói
tartalmat nem törlünk automatikusan; a kitalált ára viszont ennek is elment.
A sor sorsa (a vélemény átvezetése egy valódi Itiwit-sorra, vagy a vélemény
törlése) moderátori döntés.

**Ára, tudatosan vállalva:** 7 márka (Red Paddle Co, Fanatic, JP Australia,
Naish, Aztron, Gladiator, Itiwit) 0 deszkára esett vissza, amíg nincs hozzájuk
forrás. Ez az őszintébb állapot: nem mutatunk ellenőrizetlen adatot valós
katalógusként.

**A katalógus a kör végén:**

| | |
|---|---|
| deszka | **161** (képpel 160) |
| kiegészítő | **48** (képpel 48) |
| márka | Starboard 105 · Aqua Marina 37 · Bluefin 15 · Indiana 3 · Itiwit 1 |

### F2.1-utó-29 — a képek MOBILRA igazítása (2026-08-20)

**Felhasználói kérdés:** „ezek a képek megfelelőek mobilra is? hiszen
alapvetően mobile-first alkalmazást és natív appot csinálunk." Két valós hiba
volt, mindkettő MÉRVE.

**1. SÚLY — ezt az F2.1-utó-24 okozta.** Az akkori szabály levágta a WordPress
méret-utótagot, hogy „ne egy apró változat" kerüljön be — csakhogy ezzel a
SZERKESZTŐSÉGI EREDETIT választotta:

| | előtte | utána |
|---|---|---|
| átlag kép | **680 kB** | **248 kB** |
| legnagyobb | **8904 kB** (Aqua Marina Cascade) | 1145 kB |
| 20 kártyás lista | **~13 MB** | **~5 MB** |

Két külön mechanizmus, mert a források másképp méreteznek:

* **`srcset`-választás** (WordPress/gyártói oldalak): a gyártó maga kirakja a
  méret-változatokat; onnan a legkisebb olyat vesszük, ami a legnagyobb
  megjelenítéshez még elég (`DISPLAY_TARGET_WIDTH = 700`). `srcset` hiányában
  marad a régi utótag-levágás — ott a `src` gyakran épp egy pici bélyegkép.
* **`displayImageUrl`** (Shopify-CDN): a `/cdn/shop/` képek `width`
  query-paramétere 768-ra állítva. A Bluefin JSON-LD-je `width=1920`-at írt.
  Bekötve mind a NÉGY helyre, ahol kép-URL keletkezik: JSON-LD-ág, Shopify-mód,
  visszatöltés, és a visszatöltés TÁROLT-URL ága (ez utóbbi külön hiba volt: a
  régi crawlból származó URL normalizálás nélkül ment tovább).

**Amit ez NEM old meg, őszintén:** a FORMÁTUMOT. A `format=webp` paramétert
ezek a boltok nem tisztelik (mérve: marad PNG), ezért a Bluefin nagy, tömör
felületű PNG-i ~1,1 MB-nál nem mennek lejjebb — a 16 megmaradt 800 kB fölötti
kép MIND ilyen. Erre csak ÚJRAKÓDOLÓ kép-CDN
segítene (Netlify Image CDN: forrásonként engedélyezni kell a domaint, és a
natív SPA-buildhez abszolút URL kell) — nem kezdtük el.

**2. ELRENDEZÉS.** A fix négyzetes keret 390 px széles telefonon **egy kártyát**
engedett képernyőnként — 161 deszka között így böngészni nem lehet, pedig épp
a modellek közti eligazodás a cél. A terméklisták (deszka, kiegészítő,
Deszkaválasztó-alternatívák) telefonon kétoszloposak lettek; **kizárólag a
`sm` alatti töréspont változott**, tableten marad 2, asztalon 3 oszlop
(képernyőképpel ellenőrizve mindkettő). Ez egyben a natív shop-appok bevett
mintája.

A keskeny kártyán a modellnév és a típus-badge egy sorban nem fért el (a név 3
sorra tört), ezért ott egymás alá kerülnek; `sm`-től marad az eredeti,
egysoros elrendezés.

**A tárolt kép EGY méret, nem eszközfüggő** — ezt tudatosan vállaljuk. A 768 px
mindhárom célon elég: telefon 2 oszlop (~170 CSS px → 340 px 2×-en), asztali
PWA 3 oszlop (~350 CSS px → 700 px), adatlap-hero. Valódi eszközönkénti
kiszolgáláshoz (`srcset`, WebP/AVIF) vagy több változatot kellene tárolni a
`boards` soron, vagy kép-CDN-t bekötni.

### F2.1-utó-30 — teljes képernyős képnézegető az adatlapon (2026-08-20)

**Felhasználói ötlet:** „a képre kattintva az adatok eltűnnek és a teljes
képernyőt a kép tölti ki… ha van több kép a modellről, akkor azok között
legyintéssel tudnék váltani, illetve újabb koppintással bezárnám."

Ez fizeti vissza a kétoszlopos telefonos rács árát: a rács marad gyors és
ÖSSZEHASONLÍTÓ (két deszka egymás mellett), a részlet pedig egy koppintásra ott
van. A két igény ott válik szét, ahol kell.

**A képek 74 %-a már megvolt, ingyen.** A `shopify.ts` `firstImage()`-e eddig
eldobta a többit (`product.images?.[0]?.src`), pedig a `/products.json`
termékenként **7–22 képet** ad — ugyanabban a válaszban, amit már letöltünk. Ez
a Starboard 105 + Bluefin 15 deszkáját fedi.

**A HTML-forrásokból SZÁNDÉKOSAN nem gyűjtünk többet** (Aqua Marina, Indiana,
Zray): ott a „Related Products" blokk MÁS termékek fotóit is felkínálná —
ugyanaz a csapda, ami az „ALUMINUM OARS 396×396 cm" hibát okozta. Egy rossz kép
rosszabb, mint a hiánya; ezek a deszkák egy képesek maradnak, és a felület ezt
elegánsan kezeli.

**Séma** (20260717092500, additív): `boards.images jsonb` — rendezett tömb,
`[{url, source}]`. A BORÍTÓ marad az `image_url`: a rácsban az összehasonlítás
azon áll, hogy minden kártya ugyanolyan nézetet mutat, ezért a borító külön,
moderátor által választott mező, nem „a tömb első eleme". A lista lekérdezései
így változatlanok. A `source` most került be, pedig egyelőre mindig `brand` — a
véleményezői fotó a platform saját tartalma lesz, jobb, ha nem kell migrálni.

**`@core/ui ProductGallery`** — a meglévő `ProductImage` keretére épül:

| | |
|---|---|
| bezárás | ×, `Esc`, háttérre koppintás, ÉS magára a képre koppintás |
| váltás | legyintés, nyíl-gombok, nyíl-billentyűk |
| jelzés | pöttysor + „N. kép a(z) M-ból" |

Miért nem elég a koppintás-bezárás önmagában: billentyűzettel és
képernyőolvasóval nem lehet „koppintani". Miért nem elég a legyintés: gyors, de
LÁTHATATLAN — sosem lehet az egyetlen mód. A legyintés ráadásul kihagyja a
képernyő szélső 24 px-ét, mert ott a vízszintes húzás iOS-en és Androidon a
RENDSZER vissza-gesztusa.

**Egy képnél** nincs pöttysor, nincs lapozó, nincs legyintés — ez a normál
eset a HTML-forrásoknál, nem hibaállapot.

**A súly-szabályt teszt kényszerítette ki.** Az első változat a zárt
párbeszédablak képeit is a DOM-ban tartotta; egy `display:none` `<img>`
letöltését a böngészők nem egységesen hagyják ki. A párbeszédablak mostantól
CSAK nyitott állapotban létezik, és csak a szomszédos képet tartja benne (n±1).
Élesben mérve az adatlapon (Whopper 11'2", 7 kép): **betöltéskor 1 kép,
nyitáskor 3** — nem mind a hét.

**Új parancs — `backfill-gallery`.** A jóváhagyott sorok jelöltjei nem
frissülnek újracrawlnál, ezért a galéria a Shopify termék SAJÁT JSON-jából
(`…/products/<handle>.json`) jön, termékenként egyetlen kis kéréssel.
Élesben: **108 galéria beírva** · 88 nem Shopify-forrású · 12 üres.

**Moderáció:** az `/admin/katalogus` új szekciójában a moderátor pipával tartja
meg a képeket és rádiógombbal jelöli a borítót; a sorok `<details>`-be zárva,
így a bélyegképek csak kinyitáskor töltenek.

**Mellékesen javítva:** a két visszatöltő parancs nem volt hibatűrő — a 209
soros galéria-futás a MÁSODIK sornál elszállt egy `fetch failed`-del. A crawl
régóta soronként gyűjti a hibát; a visszatöltők most már ugyanúgy.

**Elhalasztva (felhasználói döntés):** a LISTA kártyájáról való nagyítás. Az
adatlapos változat épül meg előbb, és a használat mutatja meg, hiányzik-e.

### F2.1-utó-31 — a 12 népszerű márka felmérése, és a Jobe bekötése (2026-08-20)

**Felhasználói kérdés:** „hogy áll a helyzet a többi márkával?"
(`Kezdők_tanácsok/nepszeru_sup_markak_es_forgalmazok.md`)

Mindegyiket egy VALÓDI termékoldalon mértem, nem csak a sitemapet néztem.
A tanulság: **a szűk keresztmetszet már nem a kinyerő.**

| Márka | Állapot | Az akadály |
|---|---|---|
| Starboard | ✅ 105 deszka | — |
| Aqua Marina | ✅ 37 | — |
| Bluefin | ✅ 15 | — |
| **Jobe** | ✅ **ÚJ forrás** | — (lásd lent) |
| ZRay | ✅ forrás, 82 jelölt vár | 62-nek nincs kategóriája |
| Gladiator | ⚠️ méret KIJÖN | űrtartalom/teherbírás **mértékegység nélkül** (`Volume 245`) |
| FunWater | ⚠️ Shopify, kép van | **spec egyáltalán nincs** (nincs variáns, a leírásban sincs) |
| Itiwit (Decathlon) | ❌ | a sitemap csak KATEGÓRIA-oldalakat listáz |
| Red Paddle Co | ❌ | a szerver **HTTP 500**-at ad a robotunknak |
| Bestway | ❌ | 0 termék-URL a sitemapben |
| Fanatic (Duotone) | ❌ | nincs sitemap-bejegyzés, a szokásos utak sem élnek |
| Aquatone | ❌ | **robots.txt nem elérhető** → a szabályunk szerint kimarad |

Öt márkánál a site zár ki minket, kettőnél az adat hiányzik a forrásból.

#### A Jobe bekötése — három lépés

A felhasználó megadta az oldalt és a 4 szériát. Ami kellett hozzá:

**1. ÉRTÉKENKÉNTI MÉRTÉKEGYSÉGŰ méret-sor.** A Jobe így írja:
`Dimensions: 8'6" x 28" x 4,75" | 2,59m x 71,12cm x 12cm`. Egyik meglévő
mintára sem illeszkedett: az imperiális részen hüvelyk-JEL áll (nem „inch"
szó), a metrikus rész pedig KEVERT egységű. A megoldás nem újabb regex, hanem
a meglévő, bejáratott egy-értékes `parseDimensionCm` darabonként — az már
ismeri mind a négy alakot. A `|` külön kezelést kapott: ugyanazt a méretet írja
le kétféleképp, enélkül a harmadik darab (`4,75" | 2,59m`) a MÁSIK írásmód
hosszát adta volna vastagságként (259 cm a valós 12 helyett).

**2. TEHERBÍRÁS — felhasználói döntés.** A Jobe SEHOL nem ír „max load"-ot,
csak `Recommended rider weight: Up to 160kg`. A felhasználó döntése: ezt
vesszük teherbírásnak. Vállalható, mert az evezős-súlyhatár a gyártó saját
korlátja és KONZERVATÍV (alacsonyabb, mint a felszerelést is beleértő teljes
terhelhetőség), tehát a Deszkaválasztó biztonsági szűrője ezzel inkább kizár,
mint beenged. Precedens: a Bluefin „Max User Weight"-jét ugyanígy vesszük.

**3. CIKKSZÁM-HORGONY — kép ÉS galéria.** A `…-486425010/` termékoldalon a
képek `/uploads/product/486425010-big.jpg` néven futnak: a cikkszám az URL-ben
ÉS a képfájlban is ott van. Ez lett a legerősebb kép-horgony — enélkül a
pozíció-fallback a fejléc **kosár-ikonját** adta termékképnek.

Ez egyben feloldotta a HTML-forrásokra kimondott galéria-tilalmat is: eddig
azért nem gyűjtöttünk onnan több képet, mert a „Related Products" blokk MÁS
termékek fotóit is felkínálná — a cikkszám viszont termék-specifikus, a
szomszéd termék képén más szám áll. A Sava 8'6"-on így **7 galéria-kép** jön be.

**Mérés a 4 szérián (22 termék):** 21-nél helyes a méret, **14 TELJES adatú**
(űrtartalom + teherbírás). A maradék 8-nál a gyártó nem közöl űrtartalmat.

#### Mellékesen: a Gladiator-kör két csendes hibát hozott elő

**Zárójeles címke-magyarázat.** A méret-sor címkéje `Dimensions
(length/width/thickness)`, és a zárójelben ott a „length", „width",
„thickness" szó is. A címke-kereső ezeket VALÓDI címkének vette, és mind a
három mezőbe ugyanazt a 15-öt írta: **354 × 86 × 15 helyett 15 × 15 × 15**.
Nem hiányzó adat lett belőle, hanem HAMIS. Spec-táblázat sosem teszi zárójelbe
a saját címkéjét — a zárójelen belüli címkeszó mostantól nem címke.

**Cirill szorzójel.** A `354 х 86 х 15` szorzójele cirill „х" (U+0445), nem
latin `x`. Vizuálisan megkülönböztethetetlen, tehát a forrás oldalán ez nem is
„hiba", amit kijavítanának — nálunk viszont az egész méret-sor láthatatlan
maradt.

### F2.1-utó-32 — a márka-táblám HIBÁS volt, és miért (2026-08-20)

**A felhasználó szúrta ki:** a saját táblám a Jobe-ról azt írta, „a sitemap
üresen jön vissza a robotunknak" — aztán ugyanabban a körben behoztuk a
márkát. Ha egy sor téves, a többi ugyanazzal a módszerrel készült sor sem
megbízható.

**A módszer volt felületes.** A `probe` a robots.txt `Sitemap:` sorait és a
`/sitemap.xml`-t nézi. Ez több gyártónál kevés:

| Márka | Amit a felületes próba mondott | A VALÓSÁG |
|---|---|---|
| Jobe | „a sitemap üresen jön vissza" | `/sitemap_index.xml` → `sitemap_en.xml`, **3044 URL** |
| Fanatic (Duotone) | „nincs sitemap-bejegyzés" | `/sitemap.xml` → `__sitemap__/content-eu-en.xml`, **1116 URL** |
| Bestway | „0 termék-URL" | a robots.txt rendben, a sitemap 200-at ad — a terméklista JS-ből épül |
| Red Paddle Co | „HTTP 500" | a sitemap-index ÉL, de a benne hirdetett lapok **üresek** (0 `<loc>`) |
| Decathlon | „csak kategória-oldalak" | megerősítve: a robots által hirdetett `/sitemap/index.xml` 404, a működő index csak kategória/márka/tartalom-listákat ad |
| Aquatone | „robots.txt nem elérhető" | megerősítve: a domain **DNS-ből sem oldódik fel** (ENOTFOUND) |

**A másik hibám a MEGFOGALMAZÁS volt.** A Gladiatorra azt írtam, „hiányos
deszkák lennének" — ez összemosta, hogy a FORRÁS hallgat-e, vagy a MI
parserünk nem fogadja el. A gyártó KÖZLI a térfogatot és a teherbírást
(`Volume 245`, `Maximum load capacity 140`), csak mértékegység nélkül. Ez a mi
korlátunk volt, és javítva lett (lásd a mértékegység nélküli kétoszlopos
spec-tábla támogatását) — a Gladiator ezzel TELJES adatú lett.

**Tanulság a következő forrás-felmérésre:** a `probe` verdiktje nem elég, ha
nemleges. Meg kell nézni a `/sitemap_index.xml`-t, a nyelvenkénti
(`sitemap_en.xml`) és a keretrendszer-specifikus (`__sitemap__/…`,
`wp-sitemap-posts-…`) utakat is, és egy VALÓDI termékoldalon lefuttatni a
kinyerőt — a kategória-oldal semmit nem árul el.


### F2.1-utó-33 — a KATEGÓRIA a szűk keresztmetszet (2026-08-21)

**Mérés, mielőtt döntöttünk.** A felhasználó azt kérdezte, melyik irányt
javaslom: a kész jelöltek jóváhagyását, vagy a Fanatic méretenkénti bontását.
A jóváhagyó próbafutása mindkettőt felülírta:

```
Jóváhagyható:  70 jelölt → 35 deszka
Kihagyva:     136 kategória nélkül · 128 biztonsági mező nélkül
```

Nem a források hiányoztak, hanem a besorolás. **És ami rosszabb:** a dry-run
listáján MINDEN Gladiator „touring" volt.

**A hamis címke forrása.** A Gladiator saját leírásai:

| oldal | amit a gyártó ír | helyes |
|---|---|---|
| ELITE 12.6T | „The **touring** SUP board from the Elite series" | túra ✓ |
| ELITE 11.6 | „The **universal** SUP board from the Elite series" | allround |
| PRO 11.6 | „a **versatile** SUP board from the Pro series" | allround |
| ORIGIN 10.6 | „a versatile **model** from the entry-level series" | allround |

A leírás-parser csak az „all-around board" alakot ismerte, ezért ezekből
egyedül a 12.6T kapott kategóriát — a többi üresen maradt, és a CSALÁDI
ÖRÖKLÉS az egyetlen „touring" tagtól az egész `Elite`/`Pro`/`Origin` vonalat
túrásnak jelölte volna. Azok viszont KIVITELI vonalak, nem használati
kategóriák: egy családon belül van túra- és allround-deszka is. A szabály az
Aqua Marinára készült, ahol a családnév használatot jelent (All Star = race).

**Két javítás, mindkettő a forrás SAJÁT szavaira épül:**

1. **Az allround szinonimái**: versatile / universal / all-purpose /
   entry-level. A főnév-lista „model"-lel bővült — a gyártó így is fogalmaz,
   és navigációs menüben ez az alak nem fordul elő. A SZIGORÚ MINTA áll:
   kategória-szó + főnév, különben a minden Gladiator-oldal oldalsávjában ott
   álló tartozék („ELITE **Touring** Fin 9″") sorolna be deszkákat.
   *Eredmény: 72 besorolatlan → 49, és 23 lett allround.*

2. **A MORZSAMENÜ mint kategória-forrás.** A Zray termék-URL-je puszta sorszám
   (`/productinfo/854740.html`), a leírás nem mond kategóriát — a morzsamenü
   viszont igen: `HOME › EVO COLLECTION › ALL AROUND EVO › Max Azure 11'6"`.
   Ez azért szabad, amiért a teljes oldalszöveg NEM: a navigációs menü MINDEN
   kategóriát felsorol minden oldalon, a morzsamenü pontosan egyet — azt,
   ahová EZ a termék tartozik. A sorrendben közvetlenül az URL-szegmens után
   áll, tehát a névből/URL-ből jövő besorolás üt rajta.

**Mellékhatás, ami magától javít:** ha a leírás-alapú besorolás működik, a
Gladiator `Elite` családja ELLENTMONDÁSOSSÁ válik (11.6 allround, 12.6T túra),
és a családi öröklés — helyesen — nem következtet többé. A hibás címkék
forrása nem foltozva lett, hanem megszűnt.

Regresszió-ellenőrzés a meglévő forrásokon (Aqua Marina Cascade és Coral
Touring, Gladiator Elite 11.6/12.6T, Jobe Duna): mind változatlan.

**A javítás után, élesben:**

| | előtte | utána |
|---|---|---|
| Gladiator besorolatlan | 72 | **49** (23 allround lett) |
| Zray kategóriával (a teljes adatúakból) | 8 / 70 | **58 / 70** |
| jóváhagyható deszka | 35 | **65** |
| családból ÖRÖKÖLT kategória (tippelés) | 59 | **14** |

Az ellentmondásos családok listája megkapta a `gladiator|pro`,
`gladiator|origin` és `gladiator|elite` bejegyzést — vagyis a szabály ott
pontosan úgy hallgatott el, ahogy kell.

**A jóváhagyás lefutott: 65 új deszka + 9 összefésülés.** A katalógus
**161 → 226 deszka**:

| | |
|---|---|
| Starboard 105 · **Zray 41** · Aqua Marina 37 · **Gladiator 21** · Bluefin 15 · Indiana 3 · **Jobe 2** · Itiwit 1 · **Coasto 1** | |
| típus | allround 123 · túra 62 · race 24 · gyerek 10 · jóga 3 · folyami 2 · horgász 2 |
| képpel | **225 / 226** |
| galériával | 110 |

Ellenőrzés a gyártónál: a `CAMO GREEN 10'8"` besorolása azért túra, mert a Zray
maga teszi oda (`HOME › SUP › Touring › CAMO GREEN`) — a méret alapján
allroundnak tűnne, de a gyártó saját besorolása az erősebb.

### F2.1-utó-34 — a Gladiator kategória-taxonómiája (2026-08-21)

**A felhasználó vette észre:** a gladiatorsup.com fejlécében ott a kategória-
bontás (`All round · Turing · Sport · Special · Paddles`). A „Turing" a
gyártónál ELGÉPELVE szerepel.

**Ahol a besorolás NINCS:** a termékoldal morzsamenüje a KIVITELI vonalat adja
(`Home › Collection › Elite`), nem a használatot — ezért nem segített a
morzsamenü-szabály. A termékoldalak a saját aktivitás-kategóriájukra sem
hivatkoznak.

**Ahol VAN:** külön taxonómia, `/catalog_activity/{all-round,turizm,sport}/`.
A kategória-oldalak viszont JS-ből épülnek: nyers HTML-ből mindhárom a TELJES
katalógust adta (81/76/84 „termék", azonos listával) — böngészővel jött ki a
valódi, szűrt lista (48 / 28 / 36).

**A kategóriák ÁTFEDNEK.** A gyártó szélesen sorol: 82 termékből **25 egyszerre
több kategóriában** van (az `elite-12-6lt` mind a háromban). Ezeknél nem
döntünk helyette:

| | |
|---|---|
| egyértelmű, rögzítve | **57** — allround 25 · túra 11 · race 21 |
| többértelmű, kihagyva | 25 (marad a leírás-alapú szabálynál) |

A rögzítés a meglévő `boardTypeByUrl` mechanizmussal ment (ugyanaz, mint az
Aqua Marina Revolutionnél): a döntés a FORRÁS KONFIGJÁBAN marad, tehát a
következő gyűjtésnél már nem kérdés.

*Eredmény: a Gladiator besorolatlan jelöltjei 49 → 29, és megjelent a race (7).*

**A maradék a moderátoré, és ez így helyes.** A jóváhagyó most 35 jelöltet ad
át emberi döntésre. Mintavétel a listából:

| jelölt (bolti név) | javasolt pár | pontszám |
|---|---|---|
| Aqua Marina Fusion **BT 23FUP** | Aqua Marina Fusion | 0,635 |
| Aqua Marina Dhyana **BT 23DHP** | Aqua Marina Dhyana | 0,635 |
| Aqua Marina RAPID **BT 22RP , 130kg** | Aqua Marina Rapid | 0,520 |
| Aqua Marina **FLOW YOGA** | Aqua Marina Yoga Dock | 0,566 |

Az első három VALÓDI duplikátum — a cikkszám rontja le a névhasonlóságot a
0,8-as küszöb alá. A negyedik viszont KÉT KÜLÖNBÖZŐ deszka: jó, hogy a
rendszer nem fésülte össze magától. Pontosan ezért marad ez a kör emberi
döntés.

### F2.1-utó-35 — MÉRETENKÉNTI bontás és a Fanatic (2026-08-21)

**Felhasználói kérés:** „csináljuk meg a Fanatic méretenkénti bontását."

A Fanatic EGY oldalon sorolja fel a modellcsalád minden méretét, egyetlen
transzponált spec-táblában. A SUP-nál a MÉRET maga a termék (a Deszkaválasztó
hossz és szélesség alapján pontoz), ezért méretenként külön jelölt születik —
ugyanaz az elv, mint a Shopify-ág `expandShopifyProduct`-jánál. A jelölt
URL-je méretenként EGYEDI (`?size=…`): a jelölt-sorokat a figyelő URL szerint
azonosítja, közös URL-lel a méretek felülírnák egymást. A modellnév a tábla
SAJÁT cellájából jön (`FLY AIR S|L|T 9'8"`), nem a cím + méret ragasztásából.

**A bekötés NÉGY rejtett hibát hozott elő, mind a böngésző-fallback körül:**

1. **A fallback htmlOnly forrásnál HATÁSTALAN volt** — a renderelt szöveget
   csak a JSON-LD-ág értelmezte újra. Új `overrideText` opció: a cím és a képek
   a HTML-ből, a specifikáció a renderelt szövegből.
2. **A `htmlOnly` nem ütött a JSON-LD-n.** A Fanatic kitesz Product JSON-LD-t
   (név, ár), de egyetlen méretet sem — így a féladat nyert. A kapcsoló
   jelentése épp az, hogy ennél a forrásnál a spec a SZÖVEGBEN van.
3. **A fallback esélyt sem kapott**, ha a nyers HTML semmit nem adott: a crawl
   `continue`-val kilépett — épp azon az oldalon, ahol a spec-tábla kizárólag
   renderelés után létezik. A sorrend megfordult, és ez KÜLÖN kapcsolóra fut
   (`renderWhenEmpty`), mert drága: enélkül minden blog- és kategória-oldal is
   böngészőbe kerülne.
4. **Hamis adat maradt volna.** A nyers HTML a leírás prózájából
   `hossz 340,4 = vastagság 340,4`-et adott; mivel a hossz nem volt üres, a
   fallback el sem indult. Az ellentmondás-vizsgálat közös szabály lett
   (`dimensionsAreCoherent`): egy deszka SOSEM szélesebb és SOSEM vastagabb,
   mint amilyen hosszú. Ugyanez védi a `classifyProduct` rövidzárát is.

**A kategória a gyártó saját feliratából**, új `categoryClass` konfiggal
(`product-overview__line`). A felirat SORRENDJE dönt:

| felirat | helyes | amit a szabály-prioritás adott volna |
|---|---|---|
| `TOURING / FREERACING` | **túra** | race (a „FREERACING"-ből) |
| `ALL-AROUND / WINDSURF` | **allround** | allround |

A gyártó az ELSŐ helyre a fő felhasználást írja — ezért kapott saját olvasót
(`boardTypeFromCategoryLine`), nem a `guessBoardType` prioritásos logikáját.

**Mellékesen:** a szlogen levágása után (`ᐅ`) a Ripper gyerekdeszka (238 cm, a
méret-küszöb alatt) elesett a `classifyProduct`-on, mert a címben már nem volt
„SUP" szó. A deszka-azonosítás mostantól a termékspecifikus jelet (URL-útvonal)
is nézi: `fanatic-ISUP-ripper-air-slt`. A KIEGÉSZÍTŐ-felismerés szándékosan
marad a puszta címnél — az URL-ben álló „paddle" evezőnek minősítene egy
deszkát.

**Eredmény:** 11 Fanatic-URL → **16 méret-változat, MIND teljes adattal és
kategóriával**. A jóváhagyás után a katalógus **236 deszka**.

---

## F2.1-utó-36 — Gyártói receptek a repóban + regresszió-háló (2026-08-21)

**A felismerés a felhasználóé:** „gyártónként vannak egyedi megoldások… inkább
alkalmazkodjunk mi, mint egy általános (és soha jól nem működő) megoldást
gyártani." Ez a lépés arra ad választ, **mi legyen gyártónkénti és mi közös**.

### A szétválasztás

A megelőző napon 20 commit nyúlt a kinyerő szabályaihoz. Két csoportra estek:

* **„így ír a világ"** (cirill szorzójel, tipográfiai prime, font-only
  teherbírás, `&amp;` a kép-URL-ben, NFD-indexcsúszás, zárójeles
  címke-magyarázat) → **KÖZÖS marad** a `normalize.ts`-ben. Négy esetben az
  egyik gyártóért írt szabály oldott meg egy MÁSIKAT, mielőtt ránéztünk volna
  (pl. a Gladiatorért írt „mértékegység a címkében" a Fanatic `VOLUME (L)`-jét).
  Gyártónkénti másolatban mind a négyet újra fel kellett volna fedezni.
* **valóban a forrásé** (melyik sitemap, URL-minta, cím-vágás,
  kategória-osztály, rögzített besorolások, kell-e renderelés) → **RECEPT**.

### 1. A recept a repóban él

`tools/catalog-watch/sources/<gyarto>.ts` — a `crawl_config` értékei **és a
MIÉRT**: melyik élesben mért viselkedés indokolja. Eddig ez kizárólag az
adatbázisban élt: nem volt átnézhető, nem volt verziózva, és egy
adatbázis-újraépítésnél mind a 10 forrás beállítása elveszett volna.

`sync-sources [--apply]` írja az adatbázisba, dry-run alapértelmezéssel. **Soha
nem töröl**: a recept nélküli forrást csak jelenti — egy elfelejtett receptfájl
nem szedheti ki a talajt egy működő forrás alól. A mai 10 forrásra nulla
eltérést ad.

### 2. Gyártónkénti regresszió-háló

`tools/catalog-watch/fixtures/<gyarto>/` — mentett valós termékoldal + a VÁRT
kinyerés. **Ez váltja ki a legdrágább kézi műveletet**: az előző napon ~15-ször
kellett kézzel ellenőrizni, hogy egy általános javítás nem rontott-e el egy
másik gyártót.

*Eltérés a tervtől:* a fixtúra a TELJES oldalt tárolja (gzip-elve, 7 oldal =
424 kB), nem egy kivágott szeletet. A kézi vágás pont azt a zajt tüntetné el,
amit a kinyerőnek túl kell élnie — a „Related Products" elszívása (152 kg a
valós 170 helyett) épp ilyen zajban bújt meg.

Az oldal-szintű kinyerés `extractPageProducts` / `needsRenderedText` néven
kiemelve a crawl-ciklusból: a teszt **pontosan azt futtatja**, amit az éles
crawl, nem egy utánzatot.

**Ellenőrizve:** a cirill szorzójel kivétele buktatja a Gladiator fixtúráját,
miközben a többi zöld marad.

### 3. Amit a háló AZONNAL talált — négy hamis adat

| hol | mit adott | miért |
|---|---|---|
| sup-deszka.hu | **vadvízi** deszka egy kezdő allroundból | „ideális tengerre, tóra vagy **folyóra**" — prózában a kategória-szó ÚTI CÉL |
| sup-deszka.hu | **8,8 kg** teherbírás 150 helyett | „max. 150 kg **teherbírással** és mindössze 8,8 kg súllyal" — magyar ragozásnál az érték a címke ELŐTT áll |
| aquamarinahungary.com | **210 cm** hossz egy 366 cm-es deszkára | „hossza: 165-210cm" — az ÁLLÍTHATÓ EVEZŐ adata; tartomány nem méret |
| aquamarinahungary.com | üres súly a kiírt 11 kg helyett | „paddleboard **súlya:**" nem számított kettőspontos címkének, ezért a lap alján álló evező „Súly:" címkéje nyert |

Mind a négy javítva, mindegyikhez unit-teszt ÉS fixtúra. A közös szabályok
ennek megfelelően pontosultak:

* `boardTypeFromProse` — prózában FŐNÉV is kell a kategória-szó mellé, és a
  **kötőszó megállítja**: a sorolt kategóriák egyike sem A kategória. A
  címben/URL-slugban marad a laza `guessBoardType`, mert ott a szó maga a
  besorolás.
* a címke-keresés sorrendje: **közvetlenül a címke előtti szám+egység →
  azonos sor a címke után → következő sor**. Kettőspontnál („Capacity:") az
  „előtte" ág nem él, mert a kettőspont maga mondja ki, hogy az érték utána jön.
* `parseDimensionCm` elutasítja a tartományt.
* a kettőspontos menet elfogadja a magyar birtokos toldalékot (`súlya:`).

Az élő katalógus 7 speciális besorolása (2 river, 3 yoga, 2 fishing)
ellenőrizve — **mind helyes**; a hibás értékek a jóváhagyásra váró jelöltekben
ültek, oda nem jutottak be.

### Nyitva maradt

A Starboard **Shopify-ágához nincs fixtúra**: a `capture-fixture` a HTML-oldalas
utat járja, a Shopify-mód a `/products.json`-ból dolgozik. Külön rögzítő kell
hozzá.

---

## F2.1-utó-37 — „A gyártó nem közli" mint rögzített tény (2026-08-21)

**Felhasználói megállapítás:** a Bluefin oldalán ellenőrizve **egyetlen
modellnél sem szerepel űrtartalom**. Tehát a 15 hiányzó térfogat nem a mi
kinyerési hibánk — a forrás tulajdonsága.

Ez rávilágított egy megkülönböztetésre, ami eddig hiányzott: egy üres mezőnek
két, gyökeresen eltérő oka lehet.

| ok | mi a teendő | eddig |
|---|---|---|
| a kinyerés nem találta | javítani | megkülönböztethetetlen |
| a gyártó nem teszi közzé | rögzíteni | megkülönböztethetetlen |

### Amit a megkülönböztetés hiánya okozott

* A 15 Bluefin deszka **örökre „hiányos"** maradt volna a munkalistán.
* Az adatlapon az űrtartalom sora egyszerűen **eltűnt** — az olvasó nem tudta,
  hogy mi nem tudjuk-e, vagy nem létezik.
* A tervezett mezőlefedettségi jelentés minden futásnál anomáliát jelzett
  volna ott, ahol nincs.

### A megoldás három rétege

1. **A recept mondja ki** (`crawlConfig.unpublishedFields`), indoklással és
   dátummal — ott, ahol a forrás minden más tulajdonsága is él.
2. **A fixtúra ELLENŐRZI.** A deklaráció nem mentség: a teszt megköveteli,
   hogy a deklarált mező tényleg üres legyen a mentett oldalon. Ha a gyártó
   egyszer közölni kezdi, a teszt bukik, és szól, hogy vegyük le.
3. **A sor viseli** (`boards.unpublished_fields`, migráció 20260717092600),
   mert a megjelenítéskor nincs forrás-kapcsolat kéznél.
   `sync-unpublished [--apply]` vezeti át, idempotensen, csak hozzáadva.

Az adatlap ezentúl **„Térfogat: a gyártó nem közli"** feliratot mutat üres hely
helyett (élesben ellenőrizve a `bluefin-cruise-gecko` lapon).

### Deszkaválasztó: a hiányzó űrtartalom nem zár ki többé

**Felhasználói döntés (2026-08-21).** A kemény szűrés eddig kizárta a térfogat
nélküli deszkát (`select.ts:138`) — emiatt a Bluefin mind a 15 modellje
kiesett az ajánlásból, holott a gyártó saját terhelési korlátja ismert.

Az új szabály:

* a **teherbírás-vizsgálat KÖTELEZŐ marad** — űrtartalom nélkül ez az egyetlen
  gyártói korlát, amit a felhasználó súlyához mérhetünk;
* mindkét biztonsági mező hiánya továbbra is kizár;
* az ilyen deszka a **pontozásban nem nyerhet**: a `volumeFitScore` semleges
  0,5-öt ad, tehát azonos paraméterű, ismert űrtartalmú deszka mindig
  megelőzi (külön teszt őrzi);
* a hiány **látható** marad a felhasználónak.

Amit NEM teszünk: a geometriából számolt űrtartalom kitalált biztonsági adat
lenne. A 221 mérhető deszkán a térfogat/geometria arány 0,36–1,01 között szór —
ez becslésre nem elég szoros, ELLENŐRZÉSRE viszont igen (a hibás HYPER 11'6"
0,12-t ad).

**Kapuk:** typecheck + lint zöld, 1114 teszt (82 fájl).

---

## F2.1-utó-38 — Gyanú-jelek és mezőlefedettség (2026-08-21)

**Felhasználói követelmény:** „ezeket a fejlesztéseket azért csináljuk, hogy
eleve ne jusson el rossz adat a kapuig. Ugyanis ha rossz adat eljut, akkor
alapvetően megkérdőjeleződik a többi adat is egy adott márkánál."

Két külön eszköz, mert két külön kérdésre válaszolnak.

### 1. Gyanú-jelek — NEM elutasítás

A felhasználó pontosítása döntötte el a formát: a kemény elutasítás rossz
volna, mert *„egy gyerek SUP hossza biztosan kisebb a többinél… de a gyerek
méretre mindig utal a gyártó"*. Nem a szám önmagában gyanús, hanem a szám a
KATEGÓRIÁJÁHOZ képest — és a gyanús értéket **meg kell tudni nézni** (hátha
csak egyetlen modell HTML-oldala hibás).

Négy jel, mind emberi indoklással:

| jel | mit fog meg | küszöb |
|---|---|---|
| `volume_geometry` | HYPER 11'6": 350×79×15 cm mellett 48 L | arány < 0,25 vagy > 1,1 |
| `too_short` | 210 cm allroundként (az evező tartományából) | gyerek 180 cm, egyéb 240 cm |
| `implausible_load` | 8,8 kg „teherbírás" (a deszka súlya) | < 40 kg |
| `conflicts_with_board` | 210 cm egy 300 cm-esként ismert deszkáról | > 10% eltérés, csak ≥0,8 egyezésnél |

**A küszöbök MÉRTEK.** A 221 mérhető deszkán a térfogat/geometria arány
0,36–1,01 között szór, és mindkét szél értelmes: a hegyes orrú Sprint 14'0"
adja a 0,36-ot, a szinte téglatest Peace jógadeszka az 1,01-et. A felső határ
FIZIKAI: a térfogat nem lehet nagyobb a befoglaló doboznál. A hossz-küszöb
kategóriafüggő, mert a legrövidebb gyerekdeszkánk 244 cm, a legrövidebb
nem-gyerek 249 cm.

A `suspicion.test.ts` külön blokkja a katalógus VALÓS szélsőértékeit engedi át
(Sprint, Peace, Kids Navy, Mega, Cruise Gecko) — ha egy jövőbeli szigorítás
legitim deszkát kezdene gyanúsítani, ott bukik el.

**A fogaskerék, ami a jelzést védelemmé teszi:** a megjelölt sor kimarad a
TÖMEGES jóváhagyásból, névvel és indokkal kiírva. Enélkül igaza lenne a
felhasználónak: ami bekerül az adatbázisba, azt tömegesen jóvá is hagyják, és
onnantól ugyanolyan tényként viselkedik, mint a többi.

Az első futás **4 jelöltet tartott vissza**: a HYPER lehetetlen űrtartalmát és
három szörfdeszkát (172–223 cm), amik rövidebbek bármelyik valós SUP-nál.

### 2. Mezőlefedettség forrásonként — a GYŰJTÉSNÉL

A felhasználó másik pontja: „ha itt hibázik, akkor joggal merül fel a gyanú,
hogy mi van az adott gyártó többi modelljével?" Erre a soronkénti hiány nem
válasz — a forrás-szintű igen:

```
Bluefin: 6 URL · 6 termék · …
    mezők: hossz ✓ · szél ✓ · vast ✓ · térf n.a. · súly ✓ · teher 5/6
```

A `térf n.a.` VÁRT hiány (a recept `unpublishedFields`-je szerint a gyártó nem
közli), a `teher 5/6` viszont egyetlen terméké — azt kell megnézni. A „0/15"
alak pedig azt jelentené, hogy nem a termékkel van baj, hanem a kinyeréssel.
Eddig ez sehol nem látszott: a summary terméket számolt, mezőt nem.

### Mellékesen: a jóváhagyás űrtartalom-követelése pontosítva

A tömeges jóváhagyó eddig MINDIG megkövetelte az űrtartalmat. A -37-es döntés
után ez ellentmondás lett volna: a Bluefin új modelljei sosem mehettek volna
át, holott a Deszkaválasztó beengedi őket. Az űrtartalom mostantól ott nem
kötelező, ahol a recept szerint a gyártó nem közli — máshol változatlanul az.

**Kapuk:** typecheck + lint zöld, 1133 teszt (83 fájl).

## F2.4-utó — A CI helyreállítása: öt ok, köztük egy Postgres-szegfault (2026-08-24)

A CI **2026-07-31 óta piros** volt, és közben ~110 commit ment fel mellette —
holott a `CLAUDE.md` kimondja, hogy „piros CI-val nincs merge". Az öt piros láb
öt KÜLÖNBÖZŐ okból bukott; egyik sem policy-hiba volt.

### 1. `e2e` — a `db start` nem indít API-átjárót

A job `supabase db start`-tal indult, ami KIZÁRÓLAG a Postgrest hozza fel:
Kong, Auth és REST nélkül a `supabase status` „Stopped services"-t ír, az
`API_URL=` sor meg sem jelenik, tehát a `VITE_SUPABASE_URL` ÜRESEN maradt, és a
webszerver induláskor elszállt. Javítás: teljes `supabase start`, plusz egy
fail-fast env-lépés — az üres érték most MEGÁLLÍTJA a futást, korábban csendben
ment tovább, és a hiba csak három lépéssel később derült ki.

Az `rls-tests`-nek viszont TÉNYLEG elég a `db start`: a pgTAP közvetlenül a
Postgreshez csatlakozik.

### 2. `gates` — a biztonsági javítás fél lépése

Az F1.10-01 zárásakor a `react-router` 7.18.2-re ment, a `@react-router/*`
család nem. A `@react-router/serve` PONTOS verziót vár, így a lock
ellentmondásossá vált: az `npm install` még feloldotta, az `npm ci` nem.
Tanulság a findingban rögzítve.

### 3–4. Két teszt, ami ROSSZ KÉRDÉST tett fel

* `feedback: pontosan egy sor jött létre` — a `count(*)` `authenticated` szerep
  alatt futott, miközben a `feedback` SELECT-je szándékosan admin-only. A 0
  helyes válasz volt egy rosszul feltett kérdésre.
* `weather: duplicate key` — a PK `(spot_id, fetched_at)`, a `fetched_at`
  alapértelmezése `now()`, ami TRANZAKCIÓN BELÜL ÁLLANDÓ. Egy tranzakcióban
  futó teszt így ugyanarra a spotra mindig ütközött.

Ugyanitt kiderült egy csendesebb baj: a `feedback` oszlop-védő triggerét mérő
állítás **üresen futott** — `authenticated`-ként az RLS minden sort elrejt,
tehát a szűrt darabszám akkor is 0, ha a trigger nem működik. Rossz okból volt
zöld. Ez a fajta hiba veszélyesebb a pirosnál, mert nem tűnik fel.

### 5. A `push`-teszt: a Postgres ÖSSZEOMLOTT

A `42_push_webpush_test.sql` 94. soránál a szerver `signal 11: Segmentation
fault`-tal leállt, és a maradék nyolc tesztfájl már csak „recovery mode"-ot
látott. Ezt lokálisan nem lehetett reprodukálni: **ezen a gépen nincs Docker**,
a pgTAP-készlet csak CI-ben fut. Ezért előbb a CI-t kellett rábírni, hogy
bukáskor kiírja a Postgres naplóját — a `signal 11` sora kizárólag ott látszik,
a kliensoldali kimenetből nem következtethető ki.

Utána öt mérési kör, eldobható konténerben (a workflow a `ci/crash-probe` ágon
élt, és a mérés után törlődött — a `main`-re sosem került fel):

1. A crash a függvényhíváson van, `anon` szerep alatt.
2. A pgTAP ÁRTATLAN; a NULL `auth.uid()` ÁRTATLAN; ha az anonnak GRANT-tal
   megadjuk az EXECUTE-ot, a hívás TÚLÉLI.
3. Az ACL tényleg nem tartalmazza az anont — a crash tehát a
   JOGOSULTSÁG-MEGTAGADÁS útvonalán történik, hibaüzenet nélkül.
4. **A döntő bizonyíték:** egy triviális `create function probe() returns int
   as 'select 1'`, amiről az anon jogát elvettük, UGYANÍGY szegfaultol. Nem a
   mi függvényünk, nem a mi kódunk — és nem is a pgaudit (kikapcsolva is).
5. **A biztonsági kérdés:** kiváltható-e hitelesítés nélküli HTTP-kéréssel? Az
   éles projekt ugyanazon a 17.6-os motoron fut, tehát ezt nem lehetett
   feltételezéssel lezárni. Teljes stackkel (Kong + PostgREST), az éles
   kérésúton mérve: tiszta `42501` + HTTP 401, az adatbázis a hívás után is
   kiszolgált, a naplóban nincs crash-nyom. **Élesben szándékosan nem
   próbáltuk ki — ott a mérés maga lenne a támadás.**

Az összeomláshoz superuser-munkamenetből indított `SET ROLE` kell; azt a
pgTAP-futtató psql csinálja, a PostgREST nem. Rögzítve: `F2.4-03`.

A tesztet nem elnémítottuk: az anon elzárását mostantól
`has_function_privilege` méri, a viselkedési ágat pedig `authenticated`
szerepből, `sub` nélküli claimsszel — a megtagadási útvonal érintése nélkül,
ugyanazzal a lefedettséggel, sőt élesebben, mert külön látszik a jogosultsági
és a viselkedési garancia.

**Kapuk:** a CI mind a négy lábon ZÖLD (`gates` · `rls-tests` · `e2e` ·
`semgrep`) — 2026-07-31 óta először.

## F2.1-03 zárása — vite 7, és amit a build közben kihozott (2026-08-25)

A gép váratlanul újraindult; az állapotfelmérés szerint a repó ép volt (tiszta
munkafa, `origin/main`-nel szinkronban, `git fsck` csak a törölt `ci/crash-probe`
dangling objektumait mutatta), a négy CI-láb zöld. Egyetlen dolgot rontott el az
újraindítás, azt sem a projektben: a shell rossz `TMPDIR`-t örökölt
(`/var/folders/zz/…` = a root temp-je), amitől a vitest mind a 83 fájlon
`EACCES`-szel elhasalt. Nem kódhiba — TMPDIR-átirányítással azonnal zöld.

Maradt a nyitott F2.1-03: az `esbuild` kritikus a fejlesztői fában.

### A frissítés maga: unalmas volt, és ez a jó hír

`vite@^6.3.0` → `^7.3.6` (esbuild 0.28.2). A család peer-tartományai MÁR
tartalmazták a 7-est, tehát a `@react-router/*`-hoz nem kellett nyúlni — az
F1.10-01 csapdája (`npm install` feloldja, `npm ci` nem) nem ismétlődött,
`npm ci`-vel is ellenőrizve. A 8-as két okból nem jött szóba: `vitest@3.2.7`
peer-je `^7.0.0-0`-ig megy, a `@react-router/dev@8` pedig Node ≥22.22-t kér
(itt 22.20).

Utána a maradék tranzitív tételek relockolása (`brace-expansion`,
`browserslist`, `nanoid`, `postcss`, `undici`, `js-yaml`). A `js-yaml`-nál a
Snyk `eslint@10`-et javasolt — fölöslegesen: a követelő `@eslint/eslintrc`
`^4.3.0`-t kér, amibe a javított 4.3.1 belefér. **Snyk-remediationt érdemes a
tényleges peer-tartománnyal szemben ellenőrizni**, mert a legfelső szintű
útvonalat preferálja.

Végeredmény: `snyk_sca_scan --dev` **14 → 0**, `npm audit` teljes fán 0.

### A valódi hozadék: a vite 7 elkapott egy leaket

A build hibával állt meg: „Server-only module referenced by client" — a
`@core/feedback/feedback.server` a `admin.visszajelzesek.tsx` kliens-oldaláról.
Az ok: a `.server` fájl futásidejű konstansokat is exportált
(`FEEDBACK_STATUSES`, `FEEDBACK_KINDS`, `MESSAGE_MIN_LENGTH`), amiket a
komponensek használnak — és a React Router csak a `loader`/`action`/
`middleware`/`headers` exportokból vágja ki a szerverkódot, a default export
komponensből nem. A vite 6 ezt évekig átengedte volna.

Titok nem szivárgott (a `.server` egyetlen importja egy TÍPUS), de az admin
adatréteg alakja — táblanevek, oszlopok, a `feedback_rate_limit` jelzés —
kikerülhetett a kliens-csomagba. Javítás: a modul kettévált kliens-biztos
(`feedback.ts`) és szerver-only (`feedback.server.ts`) részre, a határ mindkét
fejlécben kimondva. A `.server` szándékosan NEM re-exportál — az csendben
visszahozná a hibát. Ellenőrizve: a `build/client`-ben a szerveroldali nevekre
nulla találat. Rögzítve `F2.1-05` néven.

Nyitva hagyva egy védőháló: ESLint-szabály, ami kliens-komponensből tiltja a
`.server` importot. Most a vite-build a kapu, az viszont csak a route-okat
fogja meg.

**Kapuk:** `npm ci` · `typecheck` · `lint` · `test` (83 fájl / 1170 teszt) ·
`build:web` — mind zöld.

## F2.1-05 védőhálója — ESLint-őr a `.server` importra (2026-08-26)

Az F2.1-05-öt a vite 7 buildje hozta ki: a `feedback.server` futásidejű
konstansokat is exportált, amiket kliens-komponensek használtak. A javítás után
maradt egy kérdés: **mi fogja meg legközelebb?** A build csak a route-okat
vizsgálja — egy sima `src/**` komponensben ugyanez a hiba csak a kész
csomagban derülne ki.

### Az őr

`@typescript-eslint/no-restricted-imports` a `src/**/*.{ts,tsx}` körre,
`**/*.server` mintára. Kivételek szándékosan: `*.server.ts` (maga a
szerver-réteg hívhat szerver-modult), `*.test.ts(x)` (a unit-tesztek
közvetlenül a szerver-modult mérik), és az `app/**` route-réteg, ahol a React
Router távolítja el a loader/action szerverkódját.

### A kerülőút, ami majdnem átcsúszott

A szabály `allowTypeImports`-szal engedi a típus-importot — logikusnak tűnik,
hiszen a fordító kidobja. Csakhogy a tsconfig `verbatimModuleSyntax: true`,
és ilyenkor az inline alak MÁSKÉNT viselkedik. Nem feltételeztem, lefordítottam:

```
import { type Foo } from "./mod.server";   →   import {} from "./mod.server";
import type { Foo } from "./mod.server";   →   (semmi)
```

Az első tehát futásidőben betölti a modult — pontosan az, amit tiltani
akarunk, csak más ruhában. Ezért az őr mellé
`@typescript-eslint/no-import-type-side-effects` került az egész repóra, ami a
csak-típus importokat a teljes `import type` alakra kényszeríti. A kettő
EGYÜTT zár; külön-külön egyik sem elég. A kódbázisban egyetlen valós
előfordulás volt (`sup-index/reading.ts`), automatikusan javítva.

### Mérés, nem szemrevételezés

Négy próbafájllal ellenőrizve, hogy a szabály tényleg fog: érték-import
aliasból → hiba · relatív érték-import → hiba · inline `{ type X }` → hiba ·
`import type { … }` → átmegy. A próbafájlok a mérés után törölve. A
`@core/auth` barrelje eleve helyes volt (egyetlen `.server`-hivatkozása
`export type`, ami nyomtalanul eltűnik) — ezt is ellenőriztem, mert egy
értéket re-exportáló barrel minden importálójába behúzta volna a szerverkódot.

**Kapuk:** typecheck · lint · test (83 fájl / 1170 teszt) · build:web — zöld.
