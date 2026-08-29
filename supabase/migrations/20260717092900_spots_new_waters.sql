-- ============================================================================
-- MODUL: spots — hét új spot az F2.5-utó vízbővítéshez (2026-08-29).
-- Additív és IDEMPOTENS: fix UUID + `on conflict (id) do nothing`, meglévő
-- sort nem ír felül (kivéve az orfűi átnevezést, ld. lent, ami szándékos
-- javítás).
--
-- MIÉRT MIGRÁCIÓBAN ÉS NEM A SEEDBEN: a `seed.sql` az F1 demó-alapja, és csak
-- FRISS adatbázison fut le — az éles adatbázis már régen seedelve van. A
-- vízmérce-hozzárendelés (20260717091900) ugyanezt az utat járta: adat-
-- állítás migrációban, mert az élesre is el kell jutnia.
--
-- A vizek szabály-oldalai a `/alapinfo`-ban élnek; a spot→víz leképezést a
-- `src/modules/spots/waterinfo.ts` NÉV-alapú ága végzi, ezért a nevekben ott
-- van a víz neve zárójelben („Gyomaendrőd (Hármas-Körös)"). Források és
-- jogi háttér: `docs/VIZTESTEK_KUTATAS.md`.
--
-- KOORDINÁTÁK: mind ellenőrzött. A Gyomaendrőd, Ráckeve és Szentendre pont a
-- vizugy vízmérce hivatalos koordinátája (ugyanazon a vízfolyáson); a többi
-- OpenStreetMap-ből, a konkrét objektumra (strand, kemping, holtág, tó)
-- illesztve. Egyiket sem becsültük.
--
-- VÍZMÉRCE (`vizugy_tsz`) CSAK OTT, AHOL A SZABÁLY TELJESÜL: a mérce
-- ugyanazon a vízfolyáson van, ÉS vannak hivatalos árvízvédelmi készültségi
-- szintjei. Ez a 20260717091900 migráció szabálya, és itt is tartjuk:
--   * Gyomaendrőd → 2756 „Gyoma", Hármas-Körös, 79,2 fkm, KF 550/650/750 ✔
--   * Ráckeve     → NINCS. A 120004 „Ráckeve" mérce ugyan pont ott van és
--                   ugyanazon az ágon, DE nincsenek készültségi szintjei —
--                   ilyenkor a `pickRiverAlertLevel` konstans 0-t adna, ami
--                   „nincs készültség"-et ÁLLÍT ott, ahol valójában nem
--                   tudjuk. A zsilipekkel szabályozott ág vízállása amúgy is
--                   közel állandó.
--   * Szentendre  → NINCS, ugyanezért (az 1038 „Szentendre" mércének sincsenek
--                   szintjei, a Szentendrei-Duna viszont valódi Duna-ág, ahol
--                   az árvíz nem elméleti — konstans 0-t írni itt kimondottan
--                   félrevezető lenne).
--   * Szarvas, Körös-torok, Fadd-Dombori, Gyékényes → NINCS: vagy más
--                   vízfolyáson van a legközelebbi mérce (holtág, tó), vagy
--                   a legközelebbi azonos vízfolyású mérce 50 km-re esik.
-- ============================================================================

insert into public.spots
  (id, name, slug, region, country, water_type, difficulty, geom,
   shore_bearing_deg, storm_warning_region, vizugy_tsz,
   season_info, access_info, safety_notes)
values
  -- Ráckevei (Soroksári)-Duna-ág — a főváros környékének legcsendesebb
  -- Duna-vize (belső égésű motor korlátozva, 21:00–6:00 között tiltva).
  ('d0000016-0000-0000-0000-000000000000','Ráckeve (Ráckevei-Duna)',
   '{"hu":"rackeve-rackevei-duna","en":"rackeve-danube-arm"}','Pest','HU','folyo','konnyu',
   ST_SetSRID(ST_MakePoint(18.9453, 47.1722),4326), null, null, null,
   '{"hu":"Egész szezonban evezhető, a nyári hétvégék a legforgalmasabbak.","en":"Paddleable all season; summer weekends are the busiest."}',
   '{"hu":"Városi Duna-part, csónakházak és stégek mentén.","en":"Town waterfront, along the boathouses and jetties."}',
   '{"hu":"Állóvíz jellegű, minimális sodrással — de a hosszú, egyenes szakaszokon a szél ugyanúgy elviszi a deszkát, mint egy tavon. A Rózsa-szigetnél (Büdös-sarok) táblákkal és bójákkal kijelölt terület: oda vízi járművel tilos behajózni.","en":"Behaves like still water with minimal current — but on the long straight stretches the wind carries a board away just as on a lake. At Rózsa Island (Büdös-sarok) a zone marked with signs and buoys is closed to all watercraft."}'),

  -- Hármas-Körös, Gyomaendrőd — a Csicsegő Vízitúra Megállóhely környéke.
  ('d0000017-0000-0000-0000-000000000000','Gyomaendrőd (Hármas-Körös)',
   '{"hu":"gyomaendrod-harmas-koros","en":"gyomaendrod-harmas-koros"}','Békés','HU','folyo','kozepes',
   ST_SetSRID(ST_MakePoint(20.8443, 46.9449),4326), null, null, 2756,
   '{"hu":"Nyári kisvízen a legkiszámíthatóbb; tavasszal a hóolvadás után erős a sodrás.","en":"Most predictable at summer low water; the current is strong after the spring snowmelt."}',
   '{"hu":"Csicsegő Vízitúra Megállóhely a Dévaványa/Körösladány felé vezető közúti hídnál, a bal parton.","en":"Csicsegő water tour stop at the road bridge towards Dévaványa/Körösladány, on the left bank."}',
   '{"hu":"Lefelé evezve a Békésszentandrási duzzasztó zárja a folyót — átjutni CSAK a hajózsilipen lehet, előre egyeztetve. Duzzasztón vagy bukógáton átmenni életveszélyes.","en":"Downstream the Békésszentandrás weir closes the river — the ONLY way through is the navigation lock, arranged in advance. Passing over a weir or spillway can be fatal."}'),

  -- Szarvasi Holt-Körös — a Hármas-Körös leválasztott kanyarulata, csendes víz.
  ('d0000018-0000-0000-0000-000000000000','Szarvas (Holt-Körös)',
   '{"hu":"szarvas-holt-koros","en":"szarvas-holt-koros"}','Békés','HU','holtag','konnyu',
   ST_SetSRID(ST_MakePoint(20.5389, 46.8787),4326), null, null, null,
   '{"hu":"Holtág: nyugodtabb és kiszámíthatóbb, mint a Körös főmedre.","en":"A backwater: calmer and more predictable than the main Körös channel."}',
   '{"hu":"Városi holtág-part; a vízre szállási pontokat a helyi kölcsönzők és csónakházak jelölik.","en":"Town backwater bank; launch points are marked by local rental places and boathouses."}',
   '{"hu":"A hullámtéri partok nagy része védett természeti terület — kiszállni a kijelölt helyeken érdemes.","en":"Most of the floodplain banks are protected natural areas — land at the designated places."}'),

  -- Körös-torok, Csongrád — a Hármas-Körös torkolata a Tiszába, homokos strand.
  ('d0000019-0000-0000-0000-000000000000','Körös-torok (Csongrád)',
   '{"hu":"koros-torok-csongrad","en":"koros-torok-csongrad"}','Csongrád-Csanád','HU','folyo','kozepes',
   ST_SetSRID(ST_MakePoint(20.1863, 46.7159),4326), null, null, null,
   '{"hu":"Nyári strandszezonban a legnépszerűbb; ilyenkor a legnagyobb a fürdőző-forgalom is.","en":"Busiest during the summer beach season, which is also when swimmer traffic peaks."}',
   '{"hu":"Homokos szabadstrand a Hármas-Körös torkolatánál.","en":"Sandy free beach at the mouth of the Hármas-Körös."}',
   '{"hu":"Torkolat: két folyó sodra találkozik, a víz a part közelében is meglepően húz. Fürdőzők között evezni csak lassan és tőlük távol szabad.","en":"A confluence: two currents meet and the water pulls surprisingly even near the bank. Paddle only slowly and well clear of swimmers."}'),

  -- Fadd-Dombori Holt-Duna — leválasztott Duna-holtág, üdülőterülettel.
  ('d0000020-0000-0000-0000-000000000000','Fadd-Dombori (Holt-Duna)',
   '{"hu":"fadd-dombori-holt-duna","en":"fadd-dombori-holt-duna"}','Tolna','HU','holtag','konnyu',
   ST_SetSRID(ST_MakePoint(18.8754, 46.4347),4326), null, null, null,
   '{"hu":"Üdülőövezeti holtág, nyáron a legmelegebb és legforgalmasabb.","en":"A resort-area backwater; warmest and busiest in summer."}',
   '{"hu":"Kemping és strand a holtág partján.","en":"Campsite and beach on the backwater shore."}',
   '{"hu":"Zárt holtág, sodrás nélkül — a fő kockázat a motoros- és fürdőző-forgalom a strandszakaszon.","en":"A closed backwater with no current — the main risk is motorboat and swimmer traffic along the beach stretch."}'),

  -- Gyékényesi-tó („Kotró") — bányató, ami rekreációra NYITVA van.
  ('d0000021-0000-0000-0000-000000000000','Gyékényesi-tó',
   '{"hu":"gyekenyesi-to","en":"gyekenyes-lake"}','Somogy','HU','to','konnyu',
   ST_SetSRID(ST_MakePoint(16.9852, 46.2447),4326), null, null, null,
   '{"hu":"Kavicsbányató, nyáron gyorsan melegszik; a szezon rövidebb, mint a nagy tavaknál.","en":"A gravel-pit lake that warms fast in summer; the season is shorter than on the big lakes."}',
   '{"hu":"Strandról; a bányatavak többségével ellentétben ez a tó rekreációs használatra nyitva áll.","en":"From the beach; unlike most mining lakes, this one is open for recreational use."}',
   '{"hu":"Bányató: a part meredeken mélyülhet, és a víz a felszín alatt hidegebb. Csak a kijelölt, engedélyezett részen menj vízre.","en":"A mining lake: the bottom can drop away steeply and the water is colder below the surface. Launch only in the designated, permitted area."}'),

  -- Szentendrei-Duna — a Duna kijelölt mellékága, Szentendrénél.
  ('d0000022-0000-0000-0000-000000000000','Szentendre (Szentendrei-Duna)',
   '{"hu":"szentendre-szentendrei-duna","en":"szentendre-danube-arm"}','Pest','HU','folyo','kozepes',
   ST_SetSRID(ST_MakePoint(19.0839, 47.6760),4326), null, null, null,
   '{"hu":"Tavasszal és nyár elején magasabb vízállás, erősebb sodrás.","en":"Higher water and stronger current in spring and early summer."}',
   '{"hu":"Városi Duna-part és csónakházak; a Duna főágából a sziget kerülésével közelíthető.","en":"Town waterfront and boathouses; reachable from the Danube main channel around the island."}',
   '{"hu":"Valódi Duna-ág: a sodrás nyugodtnak tűnő szakaszon is jelentős, és a kereskedelmi hajóforgalom hullámkeltése ide is beér. A kijelölt hajóútban tartózkodni tilos.","en":"A genuine Danube arm: the current is significant even where it looks calm, and the wake of commercial traffic reaches in here too. Staying in the marked navigation channel is prohibited."}')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- JAVÍTÁS: az „Orfűi-tó" spot valójában a PÉCSI-TÓN van (18,152/46,150 — a
-- 69 hektáros völgyzárógátas tározó), és a SUP-os víz is az. Az ORFŰI-TÓN a
-- horgászrend kimondja, hogy a tavon mindennemű vízi jármű elhelyezése tilos
-- — a régi név tehát oda irányított volna, ahová nem szabad menni.
--
-- A slug is változik. Ez most még biztonságos: az oldal nem publikus (HTTP
-- Basic kapu mögött van), tehát nincs indexelt URL, amit eltörnénk.
-- ---------------------------------------------------------------------------
update public.spots
set name = 'Orfű (Pécsi-tó)',
    slug = '{"hu":"orfu-pecsi-to","en":"orfu-lake-pecs"}'::jsonb
where slug->>'hu' = 'orfui-to';

-- A demó-szolgáltató leírása ugyanezt a tavat nevezi meg — együtt javul.
update public.providers
set description = '{"hu":"Kölcsönzés és szállás a Pécsi-tó partján, Orfűn.","en":"Rental and accommodation by Lake Pécs at Orfű."}'::jsonb
where slug->>'hu' = 'orfu-sup-kemping';
