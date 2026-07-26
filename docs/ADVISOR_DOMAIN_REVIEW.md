# Deszkaválasztó — szakmai összevetés a kezdő-útmutatóval (2026-07-25)

Források:
- `Kezdők_tanácsok/sup-kezdo.md` (felhasználói kutatás)
- [supzone.hu — Hogyan válasszunk SUP deszkát](https://www.supzone.hu/blogs/news/hogyan-valasszunk-sup-deszkat):
  allround 9–11' (274–335 cm), jellemzően 81 cm (32") széles; kezdőnek legalább
  10' hossz és 32" szélesség; közép/haladó 9–12', 71–81 cm.
- [supshop.hu — SUP vásárlási útmutató](https://supshop.hu/sup-vasarlasi-utmutato#meret):
  kezdőnek 10'6"–11'6" hossz, 32"–34" szélesség.

Mindhárom forrás egyezik a lényegben: **kezdőnek 32" (81 cm) a szélesség-optimum,
és 10'6–11'6 a hossz-sáv** — ez adta az új cél-értékek kalibrációját.

A megállapítások **méréssel** készültek: a referencia-eseteket végigfuttattuk az
éles `/deszkavalaszto` action-ön a jelenlegi katalógussal (20 deszka).

---

## 1. Ahol SZINKRONBAN vagyunk

| Útmutató | Nálunk |
|---|---|
| Kezdőnek allround a default | `USE_BOARD_TYPES.allround = ["allround", "touring"]` |
| Kezdőnek felfújható ajánlott | minden katalógus-deszka `inflatable`; a „csak felfújható" szűrő megvan |
| Kerek orrú (planing) vs. hegyes (displacement) | a `board_type` (allround ↔ touring) implicit módon lefedi |
| Ne közelítsd a max. terhelhetőséget | kemény szűrő: `max_load × 0,66 ≥ effektív súly` |
| Utas/csomag növeli az igényt | `passenger` → +15 kg (gyerek) / +25 kg (kutya) |
| Térfogat a súlyhoz méretezve | kemény szűrő: `térfogat ≥ súly × 2,5` (kezdő) |

**Mért egyezés a méret-ajánlásban:**

| Eset | Útmutató ajánlása | Amit a rendszerünk ad |
|---|---|---|
| 65 kg / 170 cm, kezdő | 10'6 (320 cm) × 32", 280–300 L | X100 11'0" (79 %), Fly Air 10'4", Nalu 10'6" — **egyezik** |
| 85 kg / 180 cm, kezdő | 10'6–11' (320–335) × 32–33", 300–330 L | X100 11'0" (75 %) — **pontosan a sávban** |
| 100 kg / 185 cm, kezdő | 11–12' (335–366) × 33–34", 340–380 L | **NINCS TALÁLAT** (lásd 2.1) |

---

## 2. Eltérések és hiányok

### 2.1 BLOKKOLÓ: 96 kg fölött a kezdő NULLA ajánlást kap

Mért határ (kezdő / allround / nagy tó / nincs budget- és tárolás-korlát):
95 kg → van ajánlás · **96 kg → nincs**.

**Ok (a kettő együtt):**
- a `max_load × 0,66` szűrő 96 kg-os evezőshöz ≥ 145,5 kg terhelhetőséget kér;
- a katalógusban egyetlen ilyen deszka van (Drift 10'10", 160 kg), az viszont
  `fishing` típusú, amit az `allround` cél-mapping kizár.

**Miért fontos:** a 100 kg körüli felnőtt teljesen hétköznapi eset — az
útmutató külön sorban kezeli. Ráadásul az üres állapot szövege **félrevezet**:
„lazíts az árkereten vagy a tároláson", holott a felhasználó egyiket sem
állította be.

**Az útmutatóhoz mérve a 0,66 SZIGORÚBB a szakmai ajánlásnál:** az útmutató azt
mondja, „a max. terhelhetőséget pár tíz kilóval ne érd el" — egy 140 kg-os
deszkánál ez ~110–120 kg evezőst enged, nálunk 92,4 kg a plafon.

**Lehetséges válaszok:**
1. a biztonsági faktor felülvizsgálata (0,66 → 0,75 körül) — **spec-eltérés**
   (5.2), külön indoklással és a doku frissítésével;
2. üres találatnál „legközelebbi, de figyelmeztetett" lista, a valódi ok
   megnevezésével (ne a budget/tárolás legyen a vak tipp);
3. a cél-mapping bővítése: az útmutató szerint a extra széles allround/fishing
   deszka a nagy stabilitást igénylő (nehezebb) evezős opciója.

### 2.2 Térfogat: nálunk „minél több, annál jobb" — az útmutatóban OPTIMUM van

`volumeHeadroom` = `clamp(térfogat / (súly × szorzó) − 1, 0, 1)`, és kezdőnél a
stabilitás-pont fele ebből jön → a **kétszeres ráhagyás kapja a maximumot**.
85 kg-nál ez 425 L-t jelentene, miközben az útmutató 300–330 L-t ajánl.
A túl nagy térfogat lassabb, szelesebb, nehezebben kezelhető deszka.

**Javaslat:** sáv-alapú pontozás (cél-térfogat ± tolerancia), a mostani
monoton „több a jobb" helyett — ugyanaz a minta, mint a most bevezetett
hossz-illesztésnél.

### 2.3 Szélesség: szintén monoton, pedig 32" a nyerő

`widthNorm` = `(szélesség − 60) / 30` → a 90 cm-es deszka kap maximumot.
Az útmutató: **32" (81–82 cm) a kezdő optimum**, 30" alatt bizonytalan,
**34"+ (86 cm+) stabilabb, de lassabb és nagyobb terpeszt kíván**.
A katalógusban 66–90 cm a tartomány, tehát a különbség valós.

### 2.4 A hossz nálunk CSAK a magasságból jön — az útmutató a SÚLYHOZ köti

A most bevezetett `lengthFit` a testmagasságból számol (175 cm → 320 cm).
Az útmutató méret-táblája viszont a **testsúly** szerint lépteti a hosszt is
(65 kg → 10'6; 85 kg → 10'6–11'; 100 kg → 11–12').

Következmény: egy **nehéz, alacsony** evezős nálunk túl rövid deszkát kap
ideálisként (100 kg / 170 cm → 314 cm, az útmutató szerint 335–366 cm).

**Javaslat:** az ideális hossz a súly-sávból induljon, és a magasság MÓDOSÍTSA
(a mostani képlet a magasság-korrekciónak jó, csak a bázis legyen súly-függő).

### 2.5 Ár: nálunk a legolcsóbb nyer — az útmutató szerint az olcsó veszélyes

`valueScore` budget mellett: `(1 − ár/budget) × értékelés` → **minél olcsóbb,
annál jobb pont**. Az útmutató viszont kimondja: a 200 EUR alatti szettek
jellemzően gyenge anyagminőségűek, „főtt spagetti" merevséggel, ami
**kezdőként is érezhetően rontja a stabilitást** — tehát nem csak élmény-,
hanem biztonsági kérdés.

**Javaslat:** minőségi alsó küszöb (ár-padló) a kategóriában, vagy a túl olcsó
sáv pontozásbeli büntetése — nem kizárás, hanem jelzés a kártyán.

### 2.6 Nem használt adat: vastagság (5–6")

A `boards.thickness_cm` KI VAN töltve (12 / 15 / 20 cm), de az algoritmus nem
nézi. Az útmutató szerint 5–6" (12–15 cm) a kezdő sáv, mert a túl vastag
deszkán magasabbra kerül a súlypont. A 20 cm-es deszkáink így büntetlenül
mennek kezdőknek.

### 2.7 Kezdő → felfújható: csak szűrő, nincs preferencia

Az útmutató szerint kezdőnek „szinte mindig" felfújható való. Nálunk ez csak
akkor számít, ha a felhasználó maga kéri a „csak felfújható" tárolást.
(Jelenleg a katalógus 20/20 felfújható, tehát a hatás most nulla — de a
katalógus bővülésével azonnal élessé válik.)

### 2.8 Biztonsági kiegészítők: teljesen hiányoznak

Az útmutató külön fejezetet szán rá: leash (víz-típushoz igazítva!),
mentőmellény, pumpa, szárazzsák — és kimondja, hogy ez **legalább annyira
fontos, mint a deszka mérete**. Néhány országban a mentőmellény kötelező.

Ez illeszkedik a platform biztonsági küldetéséhez (SUP-index, viharjelzés),
és a Deszkaválasztó eredmény-oldala természetes helye lenne egy
„ez is kell hozzá" blokknak. Termékdöntés — nincs benne az F1-scope-ban.

---

## 3. Összegzés

- A **méret-ajánlás magja jó**: a 65 és 85 kg-os referencia-esetben a
  rendszerünk pontosan azt adja, amit az útmutató.
- **Egy blokkoló hiba van** (2.1): 96 kg fölött nincs találat, félrevezető
  üres-üzenettel.
- A pontozás három helyen **monoton, ahol a szakma optimumot mond**
  (térfogat, szélesség, ár) — ez rendszerszintű minta, egységesen javítható.
- Két adatmező kihasználatlan (vastagság), egy szempont (súly-alapú hossz)
  pontosítható, egy termék-bővítés (biztonsági kiegészítők) merült fel.


---

## 4. Mit valósítottunk meg (2026-07-26)

A felhasználó a 2.1, 2.2, 2.3, 2.4, 2.6 pontokat kérte. Mind kész, a 2.5
(ár-padló) és a 2.8 (biztonsági kiegészítők) NYITOTT maradt.

### Sáv-alapú pontozás a monoton helyett

Új közös primitíva: `bandScore(value, target, tolerance)` — 1 a célon, 0 a
toleranciahatáron. Erre épül a térfogat-, szélesség-, vastagság- és
hossz-illeszkedés. A `stabilityScore` mostantól ezek súlyozott átlaga
(45 / 40 / 15), és a **tapasztalati szint nem a képletben, hanem a CÉLOKBAN**
jelenik meg — egyetlen átlátható szabály maradt a korábbi háromágú switch helyett.

**Kalibrált cél-értékek** (mind az `advisor_weights`-ből hangolható):

| Súly | Cél-térfogat | Cél-szélesség | Ideális hossz (175 cm-nél) |
|---|---|---|---|
| 65 kg | 290 L | 81,0 cm | 320 cm (10'6") |
| 85 kg | 330 L | 83,4 cm | 336 cm (11'0") |
| 100 kg | 360 L | 85,2 cm | 348 cm (11'5") |

Egybevág a források méret-tábláival (65 kg → 280–300 L / 32"; 85 kg →
300–330 L / 32–33"; 100 kg → 340–380 L / 33–34").

### A hossz bázisa a SÚLY lett

`ideal = clamp(320 + (súly − 65) × 0,8 + (magasság − 175) × 0,5, 290, 380)`.
A magasság-együttható 1,2-ről 0,5-re csökkent, mert a súly vette át a fő
szerepet (a két bemenet erősen korrelál, kétszer nem szabad beszámítani).
Teszt védi, hogy egy **nehéz, alacsony** evezős se kapjon túl rövid deszkát.

### A 96 kg-os holtpont feloldva

Két lépésben:
1. **Nehéz evezős → extra széles deszkák.** `heavyRiderKg` (default 90) fölött
   a `fishing` típus is engedélyezett allround/túra célra — a források ezeket
   „extra széles allround/fishing SUP, nagy stabilitás, sok liter"
   kategóriaként kezelik.
2. **Őszinte üres állapot.** Az `explainNoMatch()` a szűrőket a kizárás
   SÚLYOSSÁGA szerint nézi végig, és a DOMINÁNS okot adja vissza
   (`maxLoad` / `volume` / `budget` / `storage` / `availability` / `type` /
   `noBoards`). A terhelhetőségnél a szöveg kimondja, hogy ez **biztonsági
   korlát, nem érdemes lazítani rajta** — más deszka-kategóriát javasol.

**Mért eredmény (kezdő / allround / nagy tó):**

| Eset | Előtte | Utána |
|---|---|---|
| 65 kg / 170 cm | X100 11'0" (79 %) | X100 11'0" (78 %) — cél: 318 cm / 81 cm / 290 L |
| 85 kg / 180 cm | X100 11'0" (75 %) | X100 11'0" (76 %) — cél: 339 cm / 83,4 cm / 330 L |
| **100 kg / 185 cm** | **NINCS TALÁLAT** | **Drift 10'10" (52 %)** — cél: 353 cm / 85,2 cm / 360 L |
| 110 kg / 185 cm | „lazíts az árkereten" (vak tipp) | „a terhelhetőség kevés — BIZTONSÁGI korlát" |

### Vastagság bekötve

`thicknessFit` (cél 14 cm, tolerancia 3) — a 12–15 cm-es sáv a jó, a 20 cm-es
deszkák pontot veszítenek (magasabb súlypont).

### Eredmény-fejléc

A korábbi „ideális hossz" sáv helyett **mind a három cél-méret** látszik
(hossz cm + láb, szélesség, térfogat), hogy a felhasználó lássa, mire
méreteztünk.

### Mellékesen javítva

Az üres állapotnak nem volt `h1`-e — a lapnak így nem volt címsora (a11y).

## 5. Nyitva maradt

- **2.5 ár-padló — a megközelítés PONTOSÍTVA (felhasználói visszajelzés,
  2026-07-26):** a nagyon olcsó deszka nem egyszerűen „rossz", hanem
  **más felhasználásra jó**. Sokan strandolásra, alkalmi játékra veszik, és
  arra meg is felel. Tehát NEM ár-büntetés kell (az félrevezetően minősítene),
  hanem **rendeltetés-jelzés**: az olcsó sávba eső deszkánál a kártyán
  őszinte megjegyzés („alkalmi, strandolós használatra jó; rendszeres
  evezéshez merevebb konstrukció ajánlott"), a pontszám érintése nélkül.

  **Küszöb konkrét HUF-érték NÉLKÜL:** a felhasználónak nincs kézzelfogható
  száma, és egy kitalált érték hamis pontosságot sugallna. Adatvezérelt
  alternatíva: a küszöb a katalógus saját ár-eloszlásából jöjjön (pl. az adott
  `board_type` alsó ötöde), így magától követi a piacot, és nem avul el.
  Megvalósítás előtt érdemes megvárni, hogy a katalógus a mostani 20 deszkánál
  bővebb legyen — ekkora mintán az eloszlás-alapú küszöb még zajos.
- **2.7 kezdő → felfújható preferencia:** most nulla hatású (a katalógus 20/20
  felfújható), de a kínálat bővülésével élessé válik.
- **2.8 biztonsági kiegészítők** (leash víz-típushoz, mentőmellény, pumpa,
  szárazzsák): termék-bővítés, F1-scope-on kívül.
- **Kalibrációs finomhangolás:** 85 kg-nál az ideális hossz (339 cm) épp a
  források sávja (320–335) fölé lóg 4 cm-rel. A 40 cm-es tolerancia miatt a
  rangsorra nincs érdemi hatása; ha zavaró, az `advisor.length_fit.cm_per_weight_kg`
  0,8 → 0,7 csökkentése SQL-ből, deploy nélkül elvégezhető.
