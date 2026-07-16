# SUP PLATFORM — FEJLESZTÉSI DOKUMENTÁCIÓ

> **Ez a dokumentum a Claude Code elsődleges kontextusa.** A projekt gyökerében lévő `CLAUDE.md` erre hivatkozik. Minden architekturális és designdöntés itt van rögzítve; eltérés csak indoklással, a dokumentum frissítésével együtt megengedett.
>
> Verzió: 1.0 · 2026-07-16 · Munkanév: SUP Platform ([APPNÉV] placeholder a UI-ban)

---

## 0. Vezetői összefoglaló

Magyar (később közép-európai) SUP-platform, amely négy, ma sehol együtt nem létező modult egyesít:

1. **Deszkaválasztó** — kétrétegű ajánlómotor (kemény szűrés + súlyozott pontozás), a platform fő belépési pontja és növekedési motorja.
2. **Katalógus + Népítélet** — strukturált deszka-adatbázis közösségi, többdimenziós értékelésekkel.
3. **Spot-térkép + SUP-index** — SUP-ozható vizek valós idejű, SUP-specifikus időjárással, viharjelzéssel, természetvédelmi rétegekkel.
4. **Szolgáltatói directory (B2B)** — kölcsönzők, túravezetők, oktatók; MVP-ben lead-gen, később foglalás + jutalék.

**Nem funkcionális sarokkövek:** erős autentikáció · moduláris, utólag bővíthető felépítés · erős SEO (SSR + schema.org) · fizetés-készenlét (absztrakció, MVP-ben implementáció nélkül) · push értesítések (viharjelzés-riasztás) · i18n (hu elsődleges, en előkészítve) · offline-olvasás a biztonságkritikus adatokra · biztonsági szín- és adatkor-szemantika sérthetetlen.

**Fázisok:**
- **F1 (MVP, web-PWA):** Deszkaválasztó + Katalógus/Népítélet + Spot-térkép/SUP-index + szolgáltatói directory (lead-gen) + auth + SEO + web push.
- **F2 (natív):** Capacitor iOS/Android buildek, natív push viharriasztással, offline térképcsomagok, túranapló + GPX.
- **F3 (üzlet):** foglalási motor + Stripe Connect jutalék, használtdeszka-piactér, gamifikáció, advisor-adatriportok (B2B piackutatási termék).

---

## 1. Architektúra

### 1.1 Fő döntések és indoklásuk

| Döntés | Választás | Indok |
|---|---|---|
| Framework | **React Router v7 (framework mód) + Vite + TypeScript (strict)** | Egy kódbázisból két build: **SSR** a webre (SEO!) és **SPA mód** a Capacitor natív buildekhez. Illeszkedik a meglévő React+Vite rutinhoz. |
| Hosting | **Netlify** (SSR adapterrel) | Meglévő workflow, deploy preview-k, Edge support. |
| Backend | **Supabase** (Postgres + PostGIS + Auth + Storage + Edge Functions + cron) | Nincs külön Node-backend. A geo-lekérdezések (offshore-szél, geofence) PostGIS-ben. |
| Natív | **Capacitor** (F2) | A webes build wrappelése; push, geofencing, offline pluginekkel. |
| Térkép | **MapLibre GL JS + OSM/Protomaps (PMTiles)** | Ingyenes, offline-képes (F2: letölthető csempecsomagok). |
| Stílus | **Tailwind CSS 4** + CSS design tokenek (`:root` változók) | A tokenek a designból (2. kör) egy az egyben átemelve; web és natív ugyanabból. |
| State/adat | **TanStack Query** (+ persist offline-hoz), Zustand csak lokális UI-state-re | Cache, offline queue, stale-jelzés natívan kezelhető. |
| i18n | **i18next** (UI) + jsonb fordításmezők (tartalom) | Lásd 8. fejezet. |

### 1.2 Build-célok

```
npm run dev            # RR7 dev szerver (SSR)
npm run build:web      # SSR build → Netlify (SEO-s publikus oldalak + app)
npm run build:native   # SPA-mód build → Capacitor copy (F2)
```

A kód **nem tudhatja build-időben**, melyik célra megy: platform-különbségeket a `src/core/platform.ts` absztrakció kezeli (pl. push-regisztráció webpush vs. FCM/APNs).

### 1.3 Könyvtárszerkezet (modul-szerződéssel)

```
/app
  /routes                 # RR7 route-ok — VÉKONY réteg, csak modulokat komponál
/src
  /core                   # keresztmetszeti réteg — modul EZEN kívül mástól nem függhet
    /auth                 # Supabase auth wrapper, useSession, guardok
    /i18n                 # i18next setup, locale-routing helper
    /ui                   # design system: tokenek, primitívek (Button, Card, Badge…)
    /ui/waterline         # vízfelszín-vonal komponens (signature)
    /ui/gauge             # vízmérce komponens (részletező skála)
    /map                  # MapLibre wrapper, marker- és réteg-API
    /notifications        # push absztrakció (web / capacitor implementációk)
    /payments             # fizetési absztrakció — F1-ben csak interfész + no-op
    /offline              # TanStack persist, stale-kezelés, írási queue
    /seo                  # meta/hreflang/JSON-LD helperek
    /analytics            # eseménynaplózás (advisor-tölcsér méréshez)
  /modules
    /advisor              # Deszkaválasztó
    /catalog              # deszka-adatbázis + adatlapok
    /reviews              # Népítélet (katalógustól KÜLÖN modul!)
    /spots                # spotok, spot-adatlap, spot-jelentések
    /weather              # SUP-index, időjárás-adapterek, viharjelzés
    /providers            # B2B directory
    /profile              # felhasználói profil, saját tartalmak
    /admin                # moderáció, tartalomkezelés
/supabase
  /migrations             # SQL migrációk (sorszámozott, idempotens)
  /functions              # Edge Functions (weather-sync, storm-alert, advisor-log…)
/e2e                      # Playwright tesztek
/.claude
  /agents                 # subagent-definíciók (13. fejezet)
  CLAUDE.md → gyökérben
```

**Modul-szerződés (a bővíthetőség garanciája):**
1. Egy modul csak a `core`-tól és a saját könyvtárától függhet. Modul→modul import tilos; ha két modulnak közös igénye van, az a `core`-ba kerül (ESLint `import/no-restricted-paths` szabállyal kikényszerítve).
2. Minden modul exportál egy `module.ts` manifesztet: route-definíciók, navigációs bejegyzések, i18n namespace, (opcionális) admin-panelek. Új modul = új mappa + manifest regisztrálása a `src/modules/registry.ts`-ben — máshoz nem kell nyúlni.
3. Minden modul saját SQL-migrációs fájlokban hozza a tábláit; közös táblákhoz (users) csak a core-migrációk nyúlnak.

---

## 2. Design rendszer — VÉGLEGES tokenek (Hajnali tótükör, 2. kör)

A Claude Design 2. körének kimenete. **Ezek az értékek véglegesek**, a `src/core/ui/tokens.css` egy az egyben ezt tartalmazza.

```css
:root {
  /* brand */
  --ink-deep: #0E3B43;
  --petrol: #14606B;
  --petrol-text: #0E4B54;   /* AA kisszövegre */
  --mist: #EEF3F4;          /* app háttér */
  --surface: #FFFFFF;
  --sand: #E9E2D4;
  --amber: #E8A33C;         /* elsődleges CTA — mindig sötét szöveggel */
  --text: #14282C;
  --text-2: #3D5257;
  --text-3: #5A6B6E;        /* min 12px, AA fehéren */
  --line: #C4CDCE;

  /* biztonsági — brandfüggetlen, FIX, tilos módosítani */
  --safe: #1B8A4B;    --safe-text: #166B3D;    --safe-bg: #E3F2E8;
  --caution: #B87500; --caution-text: #8F5C00; --caution-bg: #F7ECD8;   /* designból pótolva (Óvatosan-badge háttér) */
  --danger: #C6392E;  --danger-text: #A32B22;  --danger-bg: #FBE4E1;
  --stale: #4A5B5E;   /* elavult adat */

  /* tipó + forma */
  --font-display: 'Bricolage Grotesque';
  --font-body: 'Instrument Sans';
  --radius-card: 16px; --radius-cta: 14px;
  --tap-min: 44px; --cta-height: 52px;
}
```

**Kőbe vésett komponens-szabályok:**
1. **Vízfelszín-vonal** (signature): kártyákon és kompakt nézetekben ez jelzi a SUP-indexet. Négy állapot: nyugodt (sima, `--safe`), fodrozódó (`--caution`), töredezett (`--danger`), elavult (szaggatott, `--stale`). A forma önmagában is megkülönböztet (színtévesztő-biztos).
2. **Vízmérce** (10 szegmens): kizárólag részletező nézetekben (spot-adatlap SUP-index bontás, Népítélet-eloszlás). Kártya = vonal, adatlap = mérce; a kettő ugyanazt az indexet mutatja.
3. **Státusz mindig szín + ikon + szöveg** hármasban jelenik meg, soha nem csak színnel.
4. **II. fokú viharjelzés** = teljes képernyős, nem eldugható riasztás, "MIT TEGYÉL" lépésekkel és vízimentő-hívás gombbal (+36 30 383 8383), forrás- és időbélyeg-felirattal.
5. **Adatkor**: minden időjárás/vízadat mellett `frissítve X perce`; 30 percnél régebbi adat automatikusan "Elavult adat" state-be vált (vonal szaggatottra, mérce csíkozottra). Cache-elt viharjelzés SOHA nem jelenhet meg aktuálisként.
6. **Kontraszt-kapuk** (a designban validálva): text 12,9:1 · text-2 7,0:1 · text-3 4,9:1 · CTA 7,6:1 · danger-text 6,3:1 · safe-text 6,2:1. Új szín-párosítás csak AA fölött.
7. Amber CTA-n mindig sötét (`--text`) felirat; a `--danger` család kizárólag veszélyt jelölhet, interakciós elemen (gomb, link) tilos.

---

## 3. Adatmodell (Supabase / Postgres + PostGIS)

Elvek: minden azonosító UUID · minden fordítható tartalmi mező `jsonb` (`{"hu": "...", "en": "..."}`) · minden táblán RLS bekapcsolva · minden migráció sorszámozott fájl a `/supabase/migrations`-ben.

### 3.1 Séma (kivonatos SQL — a migrációk ebből készülnek)

```sql
-- CORE
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  role text not null default 'user' check (role in ('user','moderator','admin')),
  rider_weight_kg int, experience text check (experience in ('kezdo','halado','versenyzo')),
  locale text not null default 'hu',
  created_at timestamptz default now()
);

-- CATALOG
create table brands ( id uuid primary key default gen_random_uuid(),
  name text not null unique, website_url text );

create table boards (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands not null,
  model_name text not null,
  model_year int,                         -- Totalcar-analógia: évjárat/verzió!
  slug jsonb not null,                    -- {"hu":"vandor-11-4-tura","en":"..."} — SEO
  board_type text not null check (board_type in
    ('allround','touring','race','yoga','kids','fishing','river')),
  length_cm int, width_cm int, thickness_cm int, volume_l int, weight_kg numeric,
  rider_weight_min_kg int, rider_weight_max_kg int, max_load_kg int,
  inflatable boolean not null default true,
  description jsonb,                      -- fordítható
  manual_url text, image_url text,
  availability_hu boolean not null default false,
  stability_index numeric generated always as
    (round((width_cm * 0.5 + thickness_cm * 2 + volume_l * 0.05)::numeric, 1)) stored,
  created_at timestamptz default now()
);

create table board_prices (               -- ártörténet → árfigyelő (F3 prémium)
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards not null,
  shop_name text not null, url text, price_huf int not null,
  recorded_at timestamptz default now()
);

-- REVIEWS (Népítélet)
create table board_reviews (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards not null,
  user_id uuid references profiles not null,
  rating_overall int not null check (rating_overall between 1 and 5),
  rating_stability int check (rating_stability between 1 and 5),
  rating_glide int check (rating_glide between 1 and 5),
  rating_build int check (rating_build between 1 and 5),
  rating_value int check (rating_value between 1 and 5),
  text_pros text, text_cons text,
  used_water_type text check (used_water_type in ('to','folyo','tenger')),
  used_rider_weight_kg int, used_experience text,
  verified_owner boolean not null default false,   -- csak admin/folyamat állíthatja
  status text not null default 'published'
    check (status in ('published','hidden','pending')),
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (board_id, user_id)              -- 1 user = 1 vélemény / deszka
);

create table review_flags (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references board_reviews not null,
  flagged_by uuid references profiles not null,
  reason text not null check (reason in ('spam','offensive','fake','other')),
  note text, resolved boolean default false, resolved_by uuid references profiles,
  created_at timestamptz default now()
);

-- SPOTS (PostGIS)
create extension if not exists postgis;
create table spots (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug jsonb not null,
  region text, country text not null default 'HU',
  water_type text not null check (water_type in ('to','folyo','holtag','csatorna')),
  difficulty text check (difficulty in ('konnyu','kozepes','halado')),
  geom geometry(Point, 4326) not null,
  shore_bearing_deg int,        -- a part tájolása → offshore-szél számításhoz!
  storm_warning_region text,    -- viharjelzési körzet (Balaton/Velencei/Tisza-tó/Fertő)
  protected_area jsonb,         -- {"name":..., "rules": {...}} — természetvédelmi réteg
  season_info jsonb, access_info jsonb, safety_notes jsonb,   -- fordítható
  created_at timestamptz default now()
);
create index spots_geom_idx on spots using gist (geom);

create table spot_reports (     -- "most itt voltam" — alacsony küszöbű engagement
  id uuid primary key default gen_random_uuid(),
  spot_id uuid references spots not null,
  user_id uuid references profiles not null,
  conditions text not null check (conditions in ('nyugodt','fodrozodo','hullamzo','veszelyes')),
  note text, photo_url text,
  created_at timestamptz default now()
);

-- WEATHER (Edge Function tölti, kliens csak olvassa)
create table weather_snapshots (
  spot_id uuid references spots not null,
  fetched_at timestamptz not null default now(),
  wind_kmh numeric, gust_kmh numeric, wind_dir_deg int,
  water_temp_c numeric, air_temp_c numeric, wave_cm int,
  storm_level int not null default 0 check (storm_level in (0,1,2)),
  sup_index numeric,            -- számított, 0–10
  source text not null,
  primary key (spot_id, fetched_at)
);

-- ADVISOR (Deszkaválasztó)
create table advisor_weights (  -- súlyok deploy nélkül hangolhatók (PecAI-minta)
  key text primary key, value numeric not null, updated_at timestamptz default now()
);
create table advisor_sessions ( -- piackutatási arany — anonim is menthető
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles,               -- nullable: anonim kitöltés
  inputs jsonb not null,        -- {weight, passenger, experience, use, water, budget, storage}
  results jsonb not null,       -- [{board_id, score, reasons[]}]
  clicked_board_id uuid, outcome text,            -- 'bought'|'not_yet'|null (follow-up)
  created_at timestamptz default now()
);

-- PROVIDERS (B2B)
create table providers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references profiles,         -- "claim your listing"
  name text not null, slug jsonb not null,
  type text[] not null,         -- {'rental','tour','lesson','accommodation'}
  description jsonb, contact_email text, contact_phone text, website_url text,
  tier text not null default 'free' check (tier in ('free','premium')),
  verified boolean default false,
  created_at timestamptz default now()
);
create table provider_spots ( provider_id uuid references providers,
  spot_id uuid references spots, primary key (provider_id, spot_id) );
create table provider_leads (   -- MVP: érdeklődés-továbbítás, foglalás F3-ban
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers not null,
  user_id uuid references profiles, name text, email text not null, message text,
  status text default 'new', created_at timestamptz default now()
);

-- PAYMENTS-READY (F1: üres, de a séma-hely lefoglalva — 7. fejezet)
create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  kind text not null check (kind in ('booking','subscription','listing_upgrade')),
  status text not null default 'draft',
  amount_huf int, currency text default 'HUF',
  provider_ref text,            -- Stripe payment intent / subscription id (F3)
  payload jsonb, created_at timestamptz default now()
);

-- PUSH
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  platform text not null check (platform in ('webpush','fcm','apns')),
  token jsonb not null,
  alert_spot_ids uuid[],        -- mely spotokra kér viharriasztást
  created_at timestamptz default now()
);
```

### 3.2 RLS-elvek (minden migráció része)

- **Publikus olvasás:** boards, brands, spots, weather_snapshots, providers, publikált board_reviews, spot_reports.
- **Írás csak bejelentkezve + tulajdon-ellenőrzéssel:** `board_reviews`/`spot_reports` insert: `auth.uid() is not null` ÉS a profil e-mailje megerősített; update/delete: `user_id = auth.uid()`.
- **advisor_sessions:** insert bárkinek (anonim méréshez), select csak saját + admin.
- **orders, push_subscriptions, provider_leads:** csak saját sor (+ provider-owner a saját leadjeit).
- **Moderáció:** `role in ('moderator','admin')` külön policy-kkal; a `verified_owner` és `status` mezőt user-oldali update nem érintheti (column-level trigger-védelem).
- **RLS-tesztek kötelezőek:** minden policy-hoz pgTAP vagy SQL-alapú teszt a CI-ban (13.4).

---

## 4. Autentikáció (kiemelt követelmény)

**Supabase Auth**, a következő folyamattal:

1. **Regisztráció:** e-mail + jelszó VAGY magic link. **E-mail-megerősítés kötelező** — megerősítetlen fiók böngészhet, de nem írhat véleményt/jelentést (RLS-ben kikényszerítve: `auth.jwt()->>'email_confirmed_at' is not null` ellenőrzés security definer függvényen keresztül).
2. **Bot-védelem:** Supabase Auth **Cloudflare Turnstile** captcha-integráció a signup/login végpontokon + Supabase beépített rate limitek szigorítva.
3. **Social login (F2):** Google + Apple (az App Store az Apple-belépést kötelezővé teszi, ha van social login — ezt az F2 Capacitor-fázisban együtt vezetjük be).
4. **Session-kezelés:** SSR-kompatibilis cookie-alapú session (`@supabase/ssr` csomag), a RR7 loaderekben szerver-oldali session-olvasással — SEO-s oldalak és védett oldalak ugyanabból.
5. **Jogosultsági szintek:** `user` → tartalom írása; `moderator` → flag-ek kezelése, review elrejtése; `admin` → minden + advisor_weights hangolás. Provider-oldal: `providers.owner_user_id` alapú "claim" folyamat, admin-jóváhagyással (`verified`).
6. **Hitelesített tulajdonos jelvény:** vásárlást igazoló fotó/számla feltöltése (Storage, privát bucket) → moderátori jóváhagyás → `verified_owner = true`. User maga soha nem állíthatja.
7. **Fiók-törlés (GDPR):** self-service törlés Edge Functionnel — a vélemények anonimizálódnak ("törölt felhasználó"), nem vesznek el.

---

## 5. Algoritmusok

### 5.1 SUP-index (0–10) — spotonként, óránként számítva

```
bemenet: wind_kmh, gust_kmh, wind_dir_deg, water_temp_c, storm_level,
         spot.shore_bearing_deg, spot.water_type
1) OVERRIDE: storm_level = 2 → index = 0 ("Tilos"), riasztás-pipeline indul
             storm_level = 1 → index max. 3,9 (plafon)
2) szél-alap:   0–12 km/h → 10 · 12–20 → 8 · 20–28 → 5 · 28–38 → 2 · 38+ → 0
3) lökés-büntetés: (gust - wind) > 15 km/h → −2
4) OFFSHORE-szorzó: ha a szélirány a parttól a nyílt víz felé mutat
   (|wind_dir − shore_bearing| ∈ besodró szektor) ÉS wind > 15 → index ×0,5
   és kötelező "Besodró szél" felirat — ez a Balaton-déli-part-i mentőhelyzet-minta
5) hidegvíz-büntetés: water_temp < 14 °C → −1,5 (és neoprén-figyelmeztetés)
6) folyó: vízállás-/áramlás-korrekció (HydroInfo adat, F1-ben egyszerű sávok)
kimenet: index + állapot (Kiváló ≥7 · Óvatosan 4–6,9 · Veszélyes <4 · Elavult ha
         fetched_at > 30 perc) + egy mondatos indoklás-template
```

A súlyok/sávok az `advisor_weights` mintájára konfig-táblából jönnek (kulcs-prefix: `supindex.*`) — hangolás deploy nélkül.

**Adatforrások:** Open-Meteo API (szél, hő, előrejelzés — ingyenes) · BM OKF viharjelzés (Edge Function scraper, 5 perces cron a szezonban) · HydroInfo vízállás (meglévő Python-scraper logika portolása Edge Functionbe vagy ütemezett GitHub Actionbe). Minden snapshot forrás-megjelöléssel tárolódik.

### 5.2 Deszkaválasztó — kétrétegű

```
1. réteg — KEMÉNY SZŰRÉS (kizárás):
   volume_l ∈ [súly × szorzó_min, ∞), ahol szorzó kezdő=2,5 · haladó=2,2 · versenyző=2,0
   + utas (gyerek/kutya): effektív súly = súly + 15/25 kg
   max_load_kg × 0,66 ≥ effektív súly
   ársáv-egyezés (board_prices legfrissebb ára) · board_type ∈ cél-mapping
   tárolás="csak felfújható" → inflatable = true · availability_hu = true (alapból)

2. réteg — PONTOZÁS (0–100, advisor_weights táblából):
   stabilitás-illeszkedés (kezdőnek szélesség+térfogat-ráhagyás)   súly: 30
   Népítélet-átlag (ha ≥5 értékelés; különben semleges 50%)        súly: 25
   ár/érték (ársávon belüli pozíció × rating_value)                súly: 20
   cél-specifikus fit (túra→hossz+kiel, folyó→orr/szkeg, stb.)     súly: 15
   elérhetőség/frissesség (model_year, bolti készlet)              súly: 10

kimenet: top 3–5, mindenhez indoklás-template magyar mondattal
         ("A te súlyodnál a {volume} l térfogat kényelmes ráhagyást ad {szint}ként…")
minden futás → advisor_sessions insert (anonim is)
```

**F2 AI-réteg:** Edge Function → Claude API (Sonnet): kizárólag az 1–2. réteg által kiválasztott jelöltekhez fogalmaz személyre szabott magyarázatot / kérdez vissza. A rangsorhoz az AI nem nyúl (hallucináció- és bizalomvédelem). A rangsor szponzorálhatatlan; fizetett megjelenés csak a "Hol kapható" blokkban, jelölten.

---

## 6. SEO-stratégia (erős követelmény)

1. **SSR minden publikus oldalra** (RR7 loaderek): deszka-adatlapok, Népítélet-oldalak, spot-oldalak, szolgáltatói profilok, Deszkaválasztó landing. Az app-jellegű, bejelentkezett nézetek lehetnek kliens-oldaliak.
2. **Locale-slugok + hreflang:** URL-séma `/{locale}/deszkak/{slug}` (hu alapértelmezett, prefix nélkül: `/deszkak/...`; en: `/en/boards/...`). A `slug` jsonb mezőből; `hreflang` + `x-default` minden oldalon.
3. **Strukturált adat (JSON-LD) — ez hozza a SERP-csillagokat:**
   - deszka-adatlap: `Product` + `AggregateRating` + `Review` (a Népítéletből) + `Offer` (board_prices) → csillagos találat a "XY SUP vélemény" keresésekre;
   - spot: `Place` + geo; szolgáltató: `LocalBusiness`; GYIK-blokkok: `FAQPage`.
4. **Programmatic SEO oldalak** a Deszkaválasztóból: persona-landingek statikusan generálva ("SUP kezdőknek 100 kg felett", "családi SUP tanácsadó", "folyami SUP választó") — mindegyik előre kitöltött wizard-linkkel.
5. **Technikai kapuk:** sitemap.xml (locale-onként, generált), canonical, OG-képek (deszkánként generált megosztás-kártya — a Facebook-csoportos terjedés miatt kiemelt!), Core Web Vitals budget (LCP < 2,5 s a mist-háttér + font preload mellett), `robots.txt`.
6. **Mérés:** Search Console + a `core/analytics` advisor-tölcsér eseményei (wizard start → eredmény → adatlap → Hol kapható klikk).

## 7. Fizetés-készenlét (F1-ben opció, nem implementáció)

- `src/core/payments/PaymentProvider.ts` **interfész**: `createCheckout(order)`, `handleWebhook(event)`, `getEntitlements(userId)`. F1-ben egyetlen implementáció: `NoopPaymentProvider` (mindent elutasít, logol).
- A séma-hely lefoglalva (`orders` tábla, `providers.tier`), így az F3-as Stripe-bevezetés (Checkout + Connect a jutalékos foglaláshoz, SCA-kompatibilis) migráció-minimális.
- Webhook-végpont váza már F1-ben áll (Edge Function, aláírás-ellenőrzés placeholderrel) — a route létezik, 501-et ad.
- Számlázás (szamlazz.hu / Billingo API) F3-ban, az interfész `invoice` hook-jával előkészítve.

## 8. i18n és offline

**i18n:** i18next, modulonkénti namespace (`advisor.json`, `spots.json`…). `hu` a forrás; `en` kulcsok F1-ben generálva, élesítés a CEE-terjeszkedésnél. Tartalmi fordítás a jsonb mezőkből, fallback-lánc: kért locale → hu. Új nyelv felvétele = új kulcs a jsonb-ben + i18next locale-fájl, sémamódosítás nélkül.

**Offline (F1-ben webes szinten):**
- TanStack Query persist (IndexedDB): spotok, biztonsági infók, utolsó weather-snapshot **explicit stale-jelzéssel** (2. fejezet 5. szabály).
- Írási queue: vélemény/spot-jelentés offline megírható, szinkron visszatéréskor.
- F2: PMTiles térképcsomag-letöltés régiónként + GPX-tár.

## 9. Push értesítések

- **Absztrakció:** `core/notifications` — `subscribe(topic)`, `unsubscribe`, platform-implementációk: Web Push (VAPID, service worker) F1 · Capacitor FCM/APNs F2.
- **Viharjelzés-pipeline (a killer feature):**
  1. Edge Function cron (szezonban 5 perc): BM OKF viharjelzés-scrape → `weather_snapshots.storm_level`;
  2. szintváltásnál (0→1, 1→2, 2→le): érintett `storm_warning_region` spotjai → `push_subscriptions` join → küldés;
  3. II. fok: "Tilos a vízen tartózkodni — azonnali partraszállás" + spot-név; visszaálláskor: "Újra evezhető";
  4. minden üzenetben forrás + időbélyeg.
- **Egyéb push (F2+):** "Értesíts, ha újra evezhető" (a designban már szerepel), árfigyelő, válasz a véleményemre.

---

## 10. Tesztelés és minőségkapuk

| Kapu | Eszköz | Mikor |
|---|---|---|
| Típus | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) | minden commit + CI |
| Lint | ESLint (+ import-határ szabályok a modul-szerződéshez) | minden commit + CI |
| Unit | Vitest — SUP-index és Deszkaválasztó algoritmus **táblázatos tesztesetekkel** (határértékek: offshore-szektor, II. fok override, térfogat-szorzók) | CI |
| RLS | SQL-alapú policy-tesztek (anon/user/moderator/admin szerepben) | CI |
| E2E | **Playwright** (playwright skill): kritikus utak — regisztráció+e-mail-megerősítés-gate, wizard→eredmény→adatlap, vélemény írás/flag/moderálás, viharjelzés-riasztás render, offline stale-state | CI + release előtt |
| Biztonság | **Semgrep** (SAST, minden PR) + **Snyk** (függőség-audit, heti + release) — semgrep/snyk skillek | CI |
| A11y | Playwright + axe-core a kulcsképernyőkön (AA) | CI |
| Vizuális | Playwright screenshot-összevetés a token-kritikus komponensekre (waterline, mérce, riasztás) | release előtt |

CI: GitHub Actions (a fenti kapuk) + Netlify deploy preview minden PR-hez. **Kapu-szabály: piros CI-val nincs merge — a subagentek sem kerülhetik meg.**

---

## 11. Claude Code — orchestráció és munkarend

### 11.1 Modell-hierarchia

- **Karmester (fő szál): Claude Fable 5.** Ha a Fable 5-keret elfogy: **Opus 4.8 veszi át** — a dokumentum és a feladatbontás úgy készült, hogy a levezénylés vele is teljes értékű. Váltás: `/model claude-opus-4-8` a fő szálban; a subagent-kiosztás változatlan.
- A karmester **nem ír tömegkódot**: tervez, bont, delegál, integrál, review-t hív. Kódot csak architektúra-kritikus pontokon ír (modul-szerződés, payments-interfész, RLS-minták).
- **Subagentek** (`.claude/agents/*.md`, YAML frontmatterben `model` mezővel): rutinfeladat → Sonnet; komplex/kritikus → Opus; végső audit → a karmester modellje.

### 11.2 Subagent-definíciók (a projekt-setup első lépésében létrehozandók)

| Agent | Modell | Feladat | Megkötések |
|---|---|---|---|
| `scaffolder` | sonnet | boilerplate, route-váz, komponens-váz, i18n-kulcsok, story-jellegű példák | csak a kijelölt modul-mappában dolgozhat |
| `ui-builder` | sonnet | komponensek a tokenekből, Tailwind, reszponzív | a 2. fejezet token- és komponens-szabályai kötelezőek; biztonsági színszabály-sértés = azonnali stop |
| `db-engineer` | opus | SQL-migrációk, RLS-policyk, PostGIS-lekérdezések, RLS-tesztek | minden policy-hoz teszt; destruktív migráció tilos jóváhagyás nélkül |
| `algo-engineer` | opus | SUP-index, Deszkaválasztó, konfig-tábla-olvasók + unit-tesztek | tesztek a kóddal együtt, határeset-táblázattal |
| `auth-security` | opus | auth-folyamatok, Turnstile, session/SSR, GDPR-törlés | 4. fejezet a specifikáció; eltérés csak karmesteri jóváhagyással |
| `test-runner` | sonnet | Playwright e2e írás/futtatás/riport, axe-a11y | playwright skill használata kötelező |
| `security-auditor` | opus | semgrep + snyk futtatás, findingok triage-a és javítási PR-javaslat | semgrep/snyk skillek; high/critical = blocker |
| `reviewer` | opus | PR-szintű kódreview: modul-szerződés, típusok, RLS-lefedettség | csak olvas + kommentel, nem ír kódot |

Frontmatter-minta:

```markdown
---
name: db-engineer
description: Supabase migrációk, RLS policy-k és PostGIS lekérdezések írása és tesztelése. Proaktívan használd minden adatbázis-érintő feladatnál.
tools: Read, Write, Bash, Grep
model: opus
---
A SUP Platform adatbázis-mérnöke vagy. A FEJLESZTESI_DOKUMENTACIO 3. fejezete
a séma-specifikáció... (részletes rendszerprompt)
```

### 11.3 Munkarend és skillek

1. **Superpower skill** a fő szálban: strukturált tervezés → feladatbontás → delegálás → integráció ciklus; minden fázis végén írásos összefoglaló a `docs/PROGRESS.md`-be (session-átvihetőség: keret-elfogyás vagy compact után az Opus 4.8 innen veszi fel a fonalat).
2. **CLAUDE.md** (gyökér) tartalma: hivatkozás erre a dokumentumra · modul-szerződés 3 szabálya · "biztonsági tokenek érinthetetlenek" · kapu-szabály (piros CI = nincs merge) · subagent-kiosztási táblázat · "TypeScript-hibát hagyni tilos: minden feladat `tsc --noEmit` zölddel zárul".
3. **Hookok:** `PostToolUse` hook Edit/Write után → `tsc --noEmit` + eslint az érintett fájlokra (a típushibák azonnal, nem a végén derülnek ki).
4. **Fázis-zárás:** minden fázis végén a karmester (Fable 5, hiányában Opus 4.8) teljes audit: modul-szerződés-ellenőrzés, RLS-lefedettségi mátrix, security-auditor riport, Playwright zöld, kontraszt/a11y, teljesítmény-budget. Az audit-checklista a `docs/AUDIT_CHECKLIST.md`-ben verziózva.

### 11.4 F1 feladatbontás (a karmester ebből delegál)

```
F1.0  Projekt-setup: RR7+Vite+TS strict, Tailwind+tokens.css, ESLint modul-
      határokkal, CI-váz, CLAUDE.md, .claude/agents/* + Claude Design import
      (11.5) és token-egyeztetés   [karmester + scaffolder]
F1.1  Core: auth (4. fej.), i18n, ui-primitívek + waterline + gauge,
      seo-helperek, platform.ts, notifications-váz, NoopPaymentProvider
      [auth-security, ui-builder, scaffolder]
F1.2  DB: teljes séma + RLS + tesztek + seed (20 deszka, 15 spot, 5 provider,
      advisor_weights + supindex.* defaultok)   [db-engineer]
F1.3  Weather-modul: Open-Meteo adapter, BM OKF scraper Edge Function + cron,
      SUP-index számítás + unit-tesztek, stale-logika   [algo-engineer]
F1.4  Spots-modul: térkép (MapLibre), spot-lista/adatlap, rétegek,
      spot_reports   [ui-builder + scaffolder]
F1.5  Catalog + Reviews: adatlap, Népítélet-blokk (mérce-eloszlással),
      vélemény-flow (e-mail-gate!), flag + admin-moderáció   [ui-builder,
      auth-security, scaffolder]
F1.6  Advisor: wizard, algoritmus, eredmény-képernyő (1 nagy + 2 kompakt,
      megosztás-kártya OG-képpel), advisor_sessions logolás   [algo-engineer,
      ui-builder]
F1.7  Providers: directory, profil, lead-form, claim-folyamat   [scaffolder]
F1.8  SEO-réteg: JSON-LD, hreflang, sitemap, persona-landingek, OG-generálás
      [scaffolder + reviewer ellenőrzéssel]
F1.9  Web push + viharjelzés-pipeline end-to-end   [algo-engineer,
      auth-security]
F1.10 Záró audit + e2e-csomag + security-átvilágítás + Netlify élesítés
      [karmester + test-runner + security-auditor + reviewer]
```

Minden lépés Definition of Done-ja: típus-zöld · lint-zöld · érintett tesztek zöldek · PROGRESS.md frissítve · reviewer-jóváhagyás a kritikus lépéseknél (F1.1, F1.2, F1.3, F1.9).

### 11.5 Claude Design handoff

- **MCP-setup (egyszeri):** `claude mcp add --scope user --transport http claude-design https://api.anthropic.com/v1/design/mcp`, majd `/design-login` (OAuth), ellenőrzés `/mcp`-vel.
- **Design-projekt:** https://claude.ai/design/p/166274ca-4862-42e7-97b2-575ae71ddc57?file=SUP+Explorations.dc.html — implementálandó fájl: `SUP Explorations.dc.html`.
- **Szabályok:**
  1. Az import **referencia, nem kész kód**: az exportált HTML a `_design-source/` mappába kerül (gitignore-olt vagy read-only referencia), a subagentek csak olvashatják. A komponensek a modul-szerződés szerint, a `core/ui`-ban épülnek újra.
  2. **Token-ütközésnél a jelen dokumentum 2. fejezete a mérvadó** — egyetlen kivétel: a hiányzó `--caution-bg` értéke a designból pótlandó (ide és a tokens.css-be is).
  3. A biztonsági szemantika (fix színek, szín+ikon+szöveg hármas, adatkor-szabály) importált kódból sem írható felül.
  4. Ha a design a Claude Designban később módosul: `/design-sync` a Claude Code-ból, majd a token-diff karmesteri review-val kerülhet csak be.


---

## 12. Nyitott kérdések / élesítés előtti teendők

1. **Névválasztás + domain** — a slug- és OG-generálás előtt kell (F1.8-ig ráér).
2. ~~**`--caution-bg` token** pótlása a Claude Design canvasról.~~ ✅ Pótolva (2026-07-17): `#F7ECD8` a design Óvatosan-badge hátteréből — 2. fejezet + tokens.css frissítve.
3. **Jogi tartalom ellenőrzése elsődleges forrásból** (Hajózási Szabályzat, viharjelzési rendelet) + disclaimer-szöveg jogásszal — az app "tájékoztat, nem jogforrás".
4. BM OKF scrape jogi/technikai stabilitása — ha van hivatalos API/feed, arra váltani.
5. Seed-tartalom: az első 20 deszka spec-adatai és az első 15 spot (Balatonföldvár, Tihany, Agárd, Poroszló, Orfű, Mosoni-Duna, Gemenc…) — a te szakmai inputod kell hozzá.
6. GDPR: adatkezelési tájékoztató, cookie-mentes analitika preferált (saját eseménynaplózás Supabase-be).
