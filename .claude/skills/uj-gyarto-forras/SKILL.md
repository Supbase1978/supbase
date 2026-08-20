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

## 2. lépés — mérj egy VALÓDI TERMÉKOLDALON

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

## 3. lépés — a csapda-lista

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

**Teherbírás**
- `Recommended rider weight: Up to 160kg` — sok gyártó CSAK ezt közli
  (Jobe). Felhasználói döntés (2026-08-20): ezt vesszük teherbírásnak, mert
  konzervatív (alacsonyabb a teljes terhelhetőségnél).
- `330LBS` — font-only. Átváltjuk, DE csak ha kilogramm sehol nincs.

**Csak görgetés után megjelenő spec**
- A Fanatic termékoldalán a `SIZES AND SPECS` tábla LUSTA betöltésű: sem a nyers
  HTML-ben, sem az azonnali render-szövegben nincs ott, csak görgetés után.
  Ilyenkor a `render.ts` böngésző-fallback kell — és annak GÖRGETNIE is kell.

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

## 4. lépés — felvétel és ellenőrzés

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
```

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
