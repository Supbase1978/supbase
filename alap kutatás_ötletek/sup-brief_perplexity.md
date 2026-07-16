# SUP Directory & Népítélet – Projekt brief

## 1. Projektcél

Egy webes (PWA‑képes) SUP információs portál és directory építése, amely:
- Katalógust ad a különböző SUP‑deszkákról (adatok, képek, manuálok, ajánlott felhasználás).
- Adatbázis‑szerűen listázza a SUP‑ozható vizeket (spotok, túraútvonalak, szolgáltatók).
- Lehetővé teszi, hogy a felhasználók népítélet‑szerűen **pontozzák és véleményezzék** az egyes SUP‑okat.
- Később alkalmas legyen közösségi funkciókra (reviewk, túranapló, kedvencek).

Elsődleges célpiac: Magyarország (Balaton, Velencei‑tó, Tisza‑tó, Duna, kisebb tavak), később CEE/Európa.


## 2. Fő funkciók

### 2.1 SUP‑deszka katalógus

- Gyártó és modell szerinti adatbázis.
- Adatmezők (példa, bővíthető):
  - Márka, modellnév
  - Típus: all‑round, touring, race, yoga, gyerek stb.
  - Hossz, szélesség, vastagság
  - Térfogat (liter)
  - Súly
  - Ajánlott rider súly tartomány
  - Max terhelhetőség
  - Ajánlott felhasználás (tó, folyó, túra, játék)
  - Manuál / setup link (PDF vagy web)
  - Kiegészítők: pumpa, leash, táska, fin rendszere
  - Affiliate / webshop linkek (pl. hazai shopok, nagyobb EU‑s webshopok)

### 2.2 SUP‑spot és túra directory

- Magyarországi és később európai SUP‑helyek listázása.
- Spot mezők (példa):
  - Ország, régió
  - Víz típusa: tó, folyó, holtág, csatorna, tenger
  - Nehézség: könnyű / közepes / haladó
  - Áramlás / vízjárás jelleg (nyugodt, lassú, gyors, duzzasztott)
  - Szezon: ajánlott hónapok, vízhőmérséklet tartomány
  - Access info: parkolás, vízre szállási pont, engedélyek
  - Biztonság: mentőmellény, forgalom, akadályok, tiltások
  - Kapcsolt szolgáltatók (kölcsönzők, túraszervezők)

### 2.3 Szolgáltatók és túrák

- Szolgáltatók (kölcsönzők, túraszervezők, oktatók) directory:
  - Név, elérhetőség (telefon, email, web, social link)
  - Típus: kölcsönzés, vezetett túra, oktatás, csapatépítő
  - Kapcsolt spotok (hol működik)
- Túra események/adatbázis:
  - Túra neve
  - Szolgáltató
  - Spot
  - Dátum / időtartam
  - Táv (km)
  - Nehézség
  - Ár
  - Felszerelés (hozni kell vs. biztosított)

### 2.4 Népítélet‑szerű review rendszer

- Minden SUP‑modellhez:
  - Csillagos pontozás (1–5) több dimenzióban:
    - Stabilitás
    - Sebesség / haladás
    - Építési minőség
    - Ár/érték arány
  - Összesített „átlagpontszám” (egy fő szám).
- Szöveges vélemény:
  - Mi tetszett?
  - Mi nem tetszett?
  - Milyen vízen használta (tó, folyó, tenger)?
  - Milyen testsúllyal / tapasztalattal?
- Népítélet‑szerű struktúra, de **nem chat / levelező felület**, hanem jól strukturált, termékközpontú vélemény.

### 2.5 Moderáció és minőség

- Reviewk jelenthetők („Jelentem” gomb).
- Admin felület flagged reviewk kezelésére (jóváhagyás, elrejtés, visszajelzés a szerzőnek).
- Alap community guideline:
  - Nincs személyeskedés, politika, gyűlöletbeszéd.
  - Csak SUP‑deszkák és használati tapasztalatok.
  - Nincs reklám‑spam (külön jelölni a szponzorált tartalmat, ha lesz).


## 3. Adatmodell (első verzió Supabase‑re tervezve)

### 3.1 Táblák

**users**  
- id (UUID, Supabase auth user id)  
- display_name  
- email (read‑only a profilban, valójában Supabase auth kezeli)  
- rider_weight (opcionális)  
- experience_level (kezdő / haladó / versenyző)  
- preferred_water_type (tó/folyó/tenger stb.)

**boards**  
- id (UUID)  
- brand  
- model_name  
- board_type (allround/touring/race/yoga/gyerek)  
- length_cm  
- width_cm  
- thickness_cm  
- volume_l  
- weight_kg  
- rider_weight_min_kg  
- rider_weight_max_kg  
- max_load_kg  
- recommended_use (tó/folyó/túra stb. – enum/string)  
- description_short  
- manual_url  
- image_url  
- affiliate_url

**spots**  
- id (UUID)  
- country  
- region  
- name  
- water_type (tó/folyó/stb.)  
- difficulty  
- flow_characteristics  
- season_info  
- access_info  
- safety_notes  
- gps_lat  
- gps_lng

**providers**  
- id (UUID)  
- name  
- contact_email  
- contact_phone  
- website_url  
- type (rental/tour/lesson/mixed)  
- description

**provider_spots** (kapcsolótábla)  
- provider_id  
- spot_id

**tours**  
- id (UUID)  
- provider_id  
- spot_id  
- title  
- description  
- date_start  
- date_end (opcionális, vagy csak duration_hours)  
- distance_km  
- difficulty  
- price_huf  
- includes_equipment (bool)

**board_reviews**  
- id (UUID)  
- board_id (FK boards.id)  
- user_id (FK users.id)  
- rating_overall (1–5)  
- rating_stability (1–5)  
- rating_speed (1–5)  
- rating_quality (1–5)  
- rating_value (1–5)  
- text_pros  
- text_cons  
- used_water_type (tó/folyó/tenger)  
- used_rider_weight_kg (opcionális)  
- used_experience_level  
- created_at  
- updated_at

**review_flags**  
- id (UUID)  
- review_id  
- flagged_by_user_id  
- reason (spam/offensive/other)  
- created_at  
- resolved (bool)  
- resolved_by_admin_id (opcionális)

### 3.2 RLS és jogosultság alapelvek (Supabase)

- Minden táblán RLS bekapcsolva.
- `board_reviews`:
  - insert: csak bejelentkezett user (`auth.uid() IS NOT NULL`).
  - update/delete: csak, ha `user_id = auth.uid()`.
  - select: public (mindenki olvashat), vagy később részben korlátozható.
- `users`:
  - select: user csak a saját profilját látja (vagy egy anon PublicView, ha kell).
  - update: csak saját record.
- Admin szerepkör (később):
  - külön `role` mező a users táblában, RLS policy, ami adminnak engedélyezi flagged reviewk moderálását.


## 4. Architektúra és technológiai stack

### 4.1 Frontend

- Modern JS framework (React vagy Svelte) + Vite.
- PWA támogatás:
  - Service worker, manifest.
  - Offline cache legalább a fontos listanézetekre (deszkák listája, spotok listája).
- Fő oldalak:
  - Home (featured deszkák, featured spotok, cikkek/guide‑ok).
  - Boards list + filter (típus, márka, hossz, ár/érték stb.).
  - Board detail + népítélet reviewk.
  - Spots list + map view.
  - Spot detail + kapcsolt szolgáltatók, túrák.
  - Providers list/detail.
  - Tours list/detail.
  - Saját profil (user adatainak és saját reviewk listája).
  - Admin oldal (flagged reviewk kezelése).

### 4.2 Backend / adat

**V1 – statikus adat + Netlify**
- Kezdetben a board/spot/provider/tour adatok lehetnek statikus JSON fájlok a repo‑ban (`/data/*.json`).
- Build során a frontend beolvassa ezeket (import vagy fetch).
- Előny: nincs azonnal szükség Supabase‑re, gyors MVP.

**V2 – Supabase backend**
- Supabase Postgres + Auth + Storage:
  - Postgres: táblák a fenti séma szerint.
  - Auth: email+jelszó, magic link, esetleg social login.
  - Storage: képek, manuálok (PDF), spot fotók.
- Supabase JS SDK a frontendben, public read + autholt write, RLS‑szabályokkal.
- Reviewk, felhasználói profilok, későbbi közösségi funkciók már Supabase‑en.

### 4.3 Hosting és deployment

- Frontend: Netlify (ingyenes tier)
  - Build command: pl. `npm run build`.
  - Deploy: Netlify CLI vagy GitHub connect.
- Supabase: külön projekt az appnak.


## 5. Népítélet UX és flow

### 5.1 Review írás flow

1. User bejelentkezik (Supabase Auth).
2. Board detail oldalon „Vélemény írása” gomb.
3. Form mezők:
   - Csillagok (overall + részletes ratingek).
   - Szöveges mezők: pros/cons.
   - Használati paraméterek: víz típusa, testsúly, tapasztalati szint.
4. Mentéskor hívás Supabase felé (`insert into board_reviews`).
5. Siker esetén visszairányítás a board detailre, review megjelenik.

### 5.2 Review listázás

- Board detail oldalon:
  - Összesített átlagpontszám.
  - Rating eloszlás (pl. mini grafikon).
  - Lista véleményekről:
    - Kivonat: név, dátum, összpontszám, víztípus.
    - Teljes nézet: pros/cons, részletes ratingek.
- Szűrők:
  - víz típusa (tó/folyó/tenger).
  - tapasztalati szint.
  - időszak (pl. csak az utolsó 2 év).

### 5.3 Moderáció UX

- Minden review mellett „Jelentem” gomb.
- Jelentés lépései:
  1. User kiválasztja okot (spam/offensive/other).
  2. Insert `review_flags` record.
- Admin dashboard:
  - Flagged reviewk listája.
  - Akciók: elrejtés, ok megjelölése, vagy jelölés törlése.


## 6. Későbbi bővítési irányok

- Közösségi funkciók:
  - „Hasznos” szavazás a reviewkra.
  - Kommentelés (szigorúan moderált, vagy csak Q&A jelleg).
- Gamifikáció:
  - Review‑írásért badge‑ek.
  - „Top reviewer” jelvények.
- Ajánlórendszer:
  - Deszkák ajánlása felhasználó paraméterek és reviewk alapján.
- Időjárás / vízállás integráció (idővel):
  - Spot oldalon aktuális időjárás, szél, vízhőmérséklet.


## 7. Claude Code‑nak szóló konkrét feladatlista

A Claude Code‑nak adandó első promptoknál ezt a briefet használd kontextusként.

### 7.1 Projekt inicializálás

- Feladat: 
  - Hozz létre egy új projektet (pl. Vite + React) PWA‑supporttal.
  - Állítsd be az alap file‑struktúrát:
    - `/src/components` (BoardCard, SpotCard, ReviewForm stb.)
    - `/src/pages` (Home, BoardsList, BoardDetail, SpotsList, SpotDetail, Providers, Tours, Profile, Admin)
    - `/src/data` (ha V1‑ben statikus JSON‑nal indulunk)
    - `/src/services/supabase.ts` (Supabase kliens)

- Kérd meg Claude Code‑ot, hogy generáljon:
  - Alap routingot (React Router vagy SvelteKit routes).
  - Dummy adatokat a listanézetekhez (board/spot/provider/tour JSON).

### 7.2 Supabase integráció (V2)

- Feladat:
  - Generálja le a Supabase SQL sémát a fenti táblák alapján.
  - Írjon RLS policy példákat az `board_reviews` és `users` táblára.
  - Készítsen egy egyszerű `supabaseClient` modult JS/TS‑ben.

- Kérd meg, hogy készítsen:
  - Review író komponenseket (React/Svelte formok).
  - Review listázó komponenseket (átlag, eloszlás, lista, szűrők).

### 7.3 UI/UX finomhangolás

- Feladat Claude Code‑nak:
  - Javasoljon UI layoutot board/spot detail oldalakra.
  - Készítsen reszponzív CSS‑t / Tailwindet.
  - Tegyen hangsúlyt az olvashatóságra (mobile‑first).


## 8. Összefoglalás

Ez a brief írja le a tervezett SUP‑directory és népítélet‑modul fő céljait, adatmodelljét, architektúráját és fejlesztői feladatlistáját.  
Cél: könnyen odaadható legyen Claude Code‑nak, hogy a projektet modulárisan, PWA‑képes, Supabase‑integrált webalkalmazásként építse fel.
