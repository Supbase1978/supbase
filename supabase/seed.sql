-- ============================================================================
-- SUP Platform — SEED (11.4). Idempotens (on conflict do nothing).
-- Tartalom: 9 gyártó, 20 deszka (+ár), 15 magyar spot, 5 szolgáltató,
--           advisor_weights + supindex.* konfig-defaultok (5. fejezet).
-- Fordítható mezők jsonb {"hu":...,"en":...}; azonosítók fix UUID (idempotencia).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- GYÁRTÓK
-- ---------------------------------------------------------------------------
insert into public.brands (name, website_url) values
  ('Red Paddle Co', 'https://redpaddleco.com'),
  ('Fanatic',       'https://fanatic.com'),
  ('Starboard',     'https://star-board-sup.com'),
  ('JP Australia',  'https://jp-australia.com'),
  ('Naish',         'https://naish.com'),
  ('Aztron',        'https://aztronsports.com'),
  ('Gladiator',     'https://gladiatorsup.com'),
  ('Decathlon Itiwit', 'https://decathlon.hu'),
  ('Aqua Marina',   'https://aquamarina.com')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- DESZKÁK (20) — vegyes kategóriák; a board_type a séma check-listájából
-- (allround/touring/race/yoga/kids/fishing/river). availability_hu = true.
-- ---------------------------------------------------------------------------
insert into public.boards
  (id, brand_id, model_name, model_year, slug, board_type,
   length_cm, width_cm, thickness_cm, volume_l, weight_kg,
   rider_weight_min_kg, rider_weight_max_kg, max_load_kg, inflatable, description, availability_hu)
values
  ('b0000001-0000-0000-0000-000000000000', (select id from public.brands where name='Red Paddle Co'), 'Ride 10''6"', 2024,
   '{"hu":"red-paddle-ride-10-6","en":"red-paddle-ride-10-6"}', 'allround',
   320, 81, 12, 252, 9.4, 40, 100, 120, true,
   '{"hu":"Sokoldalú allround tábla kezdőknek és haladóknak.","en":"Versatile allround board for beginners and intermediates."}', true),

  ('b0000002-0000-0000-0000-000000000000', (select id from public.brands where name='Red Paddle Co'), 'Voyager 12''0"', 2024,
   '{"hu":"red-paddle-voyager-12-0","en":"red-paddle-voyager-12-0"}', 'touring',
   366, 76, 15, 305, 11.2, 55, 110, 140, true,
   '{"hu":"Túraorientált gyors sikló, hosszabb kirándulásokra.","en":"Touring-oriented glider for longer trips."}', true),

  ('b0000003-0000-0000-0000-000000000000', (select id from public.brands where name='Red Paddle Co'), 'Elite 12''6"', 2024,
   '{"hu":"red-paddle-elite-12-6","en":"red-paddle-elite-12-6"}', 'race',
   381, 66, 15, 300, 11.8, 60, 105, 120, true,
   '{"hu":"Versenydeszka keskeny orral, maximális sebességre.","en":"Race board with narrow nose for top speed."}', true),

  ('b0000004-0000-0000-0000-000000000000', (select id from public.brands where name='Fanatic'), 'Fly Air 10''4"', 2024,
   '{"hu":"fanatic-fly-air-10-4","en":"fanatic-fly-air-10-4"}', 'allround',
   315, 84, 15, 275, 8.9, 40, 95, 115, true,
   '{"hu":"Stabil, könnyű allround a mindennapi pancsoláshoz.","en":"Stable, light allround for everyday paddling."}', true),

  ('b0000005-0000-0000-0000-000000000000', (select id from public.brands where name='Fanatic'), 'Ray Air 12''6"', 2024,
   '{"hu":"fanatic-ray-air-12-6","en":"fanatic-ray-air-12-6"}', 'touring',
   381, 79, 15, 330, 11.5, 55, 115, 145, true,
   '{"hu":"Klasszikus túratábla jó nyomtartással.","en":"Classic touring board with good tracking."}', true),

  ('b0000006-0000-0000-0000-000000000000', (select id from public.brands where name='Starboard'), 'iGO 11''2"', 2024,
   '{"hu":"starboard-igo-11-2","en":"starboard-igo-11-2"}', 'allround',
   340, 79, 15, 288, 9.8, 45, 100, 125, true,
   '{"hu":"Ikonikus allround, kényelmes ráhagyással.","en":"Iconic allround with comfortable volume."}', true),

  ('b0000007-0000-0000-0000-000000000000', (select id from public.brands where name='Starboard'), 'Touring 12''6"', 2024,
   '{"hu":"starboard-touring-12-6","en":"starboard-touring-12-6"}', 'touring',
   381, 76, 15, 320, 11.0, 55, 110, 140, true,
   '{"hu":"Hegyes orrú túratábla hatékony haladáshoz.","en":"Pointed-nose touring board for efficient cruising."}', true),

  ('b0000008-0000-0000-0000-000000000000', (select id from public.brands where name='Starboard'), 'Sprint 14''0"', 2024,
   '{"hu":"starboard-sprint-14-0","en":"starboard-sprint-14-0"}', 'race',
   427, 66, 20, 350, 12.9, 65, 115, 130, true,
   '{"hu":"Hosszútávú versenydeszka tapasztalt versenyzőknek.","en":"Long-distance race board for experienced racers."}', true),

  ('b0000009-0000-0000-0000-000000000000', (select id from public.brands where name='JP Australia'), 'AllroundAir 10''6"', 2023,
   '{"hu":"jp-allroundair-10-6","en":"jp-allroundair-10-6"}', 'allround',
   320, 81, 15, 265, 9.5, 40, 100, 120, true,
   '{"hu":"Megbízható családi allround.","en":"Reliable family allround."}', true),

  ('b0000010-0000-0000-0000-000000000000', (select id from public.brands where name='JP Australia'), 'CruisAir 12''6"', 2023,
   '{"hu":"jp-cruisair-12-6","en":"jp-cruisair-12-6"}', 'touring',
   381, 78, 15, 315, 11.3, 55, 110, 140, true,
   '{"hu":"Kényelmes túratábla, jó iránytartással.","en":"Comfortable touring board with solid tracking."}', true),

  ('b0000011-0000-0000-0000-000000000000', (select id from public.brands where name='Naish'), 'Nalu 10''6"', 2024,
   '{"hu":"naish-nalu-10-6","en":"naish-nalu-10-6"}', 'allround',
   320, 82, 15, 270, 9.6, 45, 100, 120, true,
   '{"hu":"Sokoldalú allround minden vízre.","en":"Versatile allround for any water."}', true),

  ('b0000012-0000-0000-0000-000000000000', (select id from public.brands where name='Naish'), 'Glide 12''0"', 2024,
   '{"hu":"naish-glide-12-0","en":"naish-glide-12-0"}', 'touring',
   366, 79, 15, 310, 11.1, 55, 110, 140, true,
   '{"hu":"Gyors túratábla nagyobb rakománnyal is.","en":"Fast touring board, handles bigger loads."}', true),

  ('b0000013-0000-0000-0000-000000000000', (select id from public.brands where name='Aztron'), 'Nebula 11''0"', 2024,
   '{"hu":"aztron-nebula-11-0","en":"aztron-nebula-11-0"}', 'allround',
   335, 81, 15, 285, 9.7, 45, 100, 125, true,
   '{"hu":"Ár-érték bajnok allround kezdőknek.","en":"Value-champion allround for beginners."}', true),

  ('b0000014-0000-0000-0000-000000000000', (select id from public.brands where name='Fanatic'), 'Rapid Air 9''6"', 2023,
   '{"hu":"fanatic-rapid-air-9-6","en":"fanatic-rapid-air-9-6"}', 'river',
   290, 86, 15, 250, 8.5, 40, 95, 110, true,
   '{"hu":"Folyóvízi/whitewater tábla, rövid és fordulékony.","en":"River/whitewater board, short and maneuverable."}', true),

  ('b0000015-0000-0000-0000-000000000000', (select id from public.brands where name='Red Paddle Co'), 'Snapper 9''4"', 2024,
   '{"hu":"red-paddle-snapper-9-4","en":"red-paddle-snapper-9-4"}', 'kids',
   284, 76, 12, 150, 6.8, 20, 60, 70, true,
   '{"hu":"Gyerekdeszka könnyű, biztonságos kialakítással.","en":"Kids board with a light, safe design."}', true),

  ('b0000016-0000-0000-0000-000000000000', (select id from public.brands where name='Gladiator'), 'Elite 12''6"', 2024,
   '{"hu":"gladiator-elite-12-6","en":"gladiator-elite-12-6"}', 'touring',
   381, 76, 15, 315, 11.0, 55, 110, 140, true,
   '{"hu":"Kedvező árú túratábla merev kivitelben.","en":"Affordable touring board, stiff construction."}', true),

  ('b0000017-0000-0000-0000-000000000000', (select id from public.brands where name='Decathlon Itiwit'), 'X100 11''0"', 2024,
   '{"hu":"itiwit-x100-11-0","en":"itiwit-x100-11-0"}', 'allround',
   335, 84, 15, 290, 9.9, 45, 100, 130, true,
   '{"hu":"Belépő allround kiváló ár-érték aránnyal.","en":"Entry allround with excellent value."}', true),

  ('b0000018-0000-0000-0000-000000000000', (select id from public.brands where name='Decathlon Itiwit'), 'Race 14''0"', 2024,
   '{"hu":"itiwit-race-14-0","en":"itiwit-race-14-0"}', 'race',
   427, 68, 15, 330, 12.5, 60, 110, 125, true,
   '{"hu":"Belépő versenydeszka hosszútávra.","en":"Entry race board for long distances."}', true),

  ('b0000019-0000-0000-0000-000000000000', (select id from public.brands where name='Aqua Marina'), 'Dhyana 11''0"', 2023,
   '{"hu":"aqua-marina-dhyana-11-0","en":"aqua-marina-dhyana-11-0"}', 'yoga',
   335, 86, 15, 300, 10.2, 45, 100, 120, true,
   '{"hu":"Széles jógadeszka extra stabilitással.","en":"Wide yoga board with extra stability."}', true),

  ('b0000020-0000-0000-0000-000000000000', (select id from public.brands where name='Aqua Marina'), 'Drift 10''10"', 2023,
   '{"hu":"aqua-marina-drift-10-10","en":"aqua-marina-drift-10-10"}', 'fishing',
   330, 90, 15, 350, 11.8, 50, 120, 160, true,
   '{"hu":"Horgászdeszka nagy teherbírással és tárolóval.","en":"Fishing board with high load capacity and storage."}', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- ÁRAK (board_prices) — legfrissebb bolti ár HUF-ban (ársávos illesztéshez).
-- ---------------------------------------------------------------------------
insert into public.board_prices (id, board_id, shop_name, url, price_huf) values
  ('c0000001-0000-0000-0000-000000000000','b0000001-0000-0000-0000-000000000000','SUP Shop Budapest', null, 429000),
  ('c0000002-0000-0000-0000-000000000000','b0000002-0000-0000-0000-000000000000','SUP Shop Budapest', null, 489000),
  ('c0000003-0000-0000-0000-000000000000','b0000003-0000-0000-0000-000000000000','SUP Shop Budapest', null, 529000),
  ('c0000004-0000-0000-0000-000000000000','b0000004-0000-0000-0000-000000000000','Vízisport Webshop', null, 349000),
  ('c0000005-0000-0000-0000-000000000000','b0000005-0000-0000-0000-000000000000','Vízisport Webshop', null, 419000),
  ('c0000006-0000-0000-0000-000000000000','b0000006-0000-0000-0000-000000000000','Starboard Hungary',  null, 399000),
  ('c0000007-0000-0000-0000-000000000000','b0000007-0000-0000-0000-000000000000','Starboard Hungary',  null, 449000),
  ('c0000008-0000-0000-0000-000000000000','b0000008-0000-0000-0000-000000000000','Starboard Hungary',  null, 559000),
  ('c0000009-0000-0000-0000-000000000000','b0000009-0000-0000-0000-000000000000','SUP Center Balaton',  null, 329000),
  ('c0000010-0000-0000-0000-000000000000','b0000010-0000-0000-0000-000000000000','SUP Center Balaton',  null, 399000),
  ('c0000011-0000-0000-0000-000000000000','b0000011-0000-0000-0000-000000000000','Naish Store',         null, 359000),
  ('c0000012-0000-0000-0000-000000000000','b0000012-0000-0000-0000-000000000000','Naish Store',         null, 409000),
  ('c0000013-0000-0000-0000-000000000000','b0000013-0000-0000-0000-000000000000','Olcsó SUP',           null, 219000),
  ('c0000014-0000-0000-0000-000000000000','b0000014-0000-0000-0000-000000000000','Vízisport Webshop',   null, 299000),
  ('c0000015-0000-0000-0000-000000000000','b0000015-0000-0000-0000-000000000000','SUP Shop Budapest',   null, 259000),
  ('c0000016-0000-0000-0000-000000000000','b0000016-0000-0000-0000-000000000000','Olcsó SUP',           null, 249000),
  ('c0000017-0000-0000-0000-000000000000','b0000017-0000-0000-0000-000000000000','Decathlon',           null, 189000),
  ('c0000018-0000-0000-0000-000000000000','b0000018-0000-0000-0000-000000000000','Decathlon',           null, 259000),
  ('c0000019-0000-0000-0000-000000000000','b0000019-0000-0000-0000-000000000000','Jóga & Víz',          null, 199000),
  ('c0000020-0000-0000-0000-000000000000','b0000020-0000-0000-0000-000000000000','Horgász Webshop',     null, 289000)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- SPOTOK (15) — valós koordináták; PostGIS Point(4326).
-- storm_warning_region: Balaton / Velencei-tó / Tisza-tó / Fertő (folyók: null).
-- shore_bearing_deg: a partról a nyílt víz felé mutató irány (offshore-szélhez).
-- ---------------------------------------------------------------------------
insert into public.spots
  (id, name, slug, region, country, water_type, difficulty, geom,
   shore_bearing_deg, storm_warning_region, season_info, access_info, safety_notes)
values
  ('d0000001-0000-0000-0000-000000000000','Balatonföldvár',
   '{"hu":"balatonfoldvar","en":"balatonfoldvar"}','Somogy','HU','to','konnyu',
   ST_SetSRID(ST_MakePoint(17.8650, 46.8450),4326), 0, 'Balaton',
   '{"hu":"Május–szeptember a fő szezon.","en":"May–September is the main season."}',
   '{"hu":"Strandról vízre szállás, parkolás a móló mellett.","en":"Launch from the beach, parking near the pier."}',
   '{"hu":"Déli parton figyelj az északi besodró szélre.","en":"On the south shore watch for offshore north wind."}'),

  ('d0000002-0000-0000-0000-000000000000','Tihany',
   '{"hu":"tihany","en":"tihany"}','Veszprém','HU','to','kozepes',
   ST_SetSRID(ST_MakePoint(17.8880, 46.9140),4326), 200, 'Balaton',
   null,'{"hu":"Rév melletti vízre szállás.","en":"Launch near the ferry."}',
   '{"hu":"Erős áramlás a tihanyi szorosban.","en":"Strong current in the Tihany strait."}'),

  ('d0000003-0000-0000-0000-000000000000','Siófok',
   '{"hu":"siofok","en":"siofok"}','Somogy','HU','to','konnyu',
   ST_SetSRID(ST_MakePoint(18.0580, 46.9040),4326), 0, 'Balaton',
   null,'{"hu":"Nagyparti strandok.","en":"Big-beach launch points."}',
   '{"hu":"Nyáron erős hajóforgalom.","en":"Heavy boat traffic in summer."}'),

  ('d0000004-0000-0000-0000-000000000000','Balatonfüred',
   '{"hu":"balatonfured","en":"balatonfured"}','Veszprém','HU','to','konnyu',
   ST_SetSRID(ST_MakePoint(17.8880, 46.9580),4326), 180, 'Balaton',
   null,'{"hu":"Kikötő melletti bejáró.","en":"Launch near the marina."}', null),

  ('d0000005-0000-0000-0000-000000000000','Fonyód',
   '{"hu":"fonyod","en":"fonyod"}','Somogy','HU','to','konnyu',
   ST_SetSRID(ST_MakePoint(17.5560, 46.7570),4326), 0, 'Balaton',
   null,null,
   '{"hu":"Déli part — besodró északi szél veszélye.","en":"South shore — beware offshore north wind."}'),

  ('d0000006-0000-0000-0000-000000000000','Keszthely',
   '{"hu":"keszthely","en":"keszthely"}','Zala','HU','to','konnyu',
   ST_SetSRID(ST_MakePoint(17.2440, 46.7670),4326), 90, 'Balaton',
   null,'{"hu":"Városi strand és kikötő.","en":"City beach and marina."}', null),

  ('d0000007-0000-0000-0000-000000000000','Agárd',
   '{"hu":"agard","en":"agard"}','Fejér','HU','to','konnyu',
   ST_SetSRID(ST_MakePoint(18.6010, 47.1920),4326), 315, 'Velencei-tó',
   '{"hu":"Sekély, gyorsan melegedő tó.","en":"Shallow, quickly warming lake."}',
   '{"hu":"Agárdi strandról.","en":"From Agárd beach."}', null),

  ('d0000008-0000-0000-0000-000000000000','Velence',
   '{"hu":"velence","en":"velence"}','Fejér','HU','to','konnyu',
   ST_SetSRID(ST_MakePoint(18.6570, 47.2340),4326), 225, 'Velencei-tó',
   null,null,
   '{"hu":"Nádasok között könnyű eltévedni.","en":"Easy to lose your way among reeds."}'),

  ('d0000009-0000-0000-0000-000000000000','Poroszló',
   '{"hu":"poroszlo","en":"poroszlo"}','Heves','HU','to','konnyu',
   ST_SetSRID(ST_MakePoint(20.6660, 47.6490),4326), 90, 'Tisza-tó',
   '{"hu":"Természetvédelmi övezetek — csónakázási rend.","en":"Protected zones — boating rules apply."}',
   '{"hu":"Ökocentrum melletti bejáró.","en":"Launch near the Ecocentre."}',
   '{"hu":"Tartsd be a védett zónák határait.","en":"Respect protected-zone boundaries."}'),

  ('d0000010-0000-0000-0000-000000000000','Tiszafüred',
   '{"hu":"tiszafured","en":"tiszafured"}','Jász-Nagykun-Szolnok','HU','to','kozepes',
   ST_SetSRID(ST_MakePoint(20.7640, 47.6150),4326), 270, 'Tisza-tó',
   null,'{"hu":"Tiszafüredi holtág-bejárók.","en":"Tiszafüred backwater launches."}', null),

  ('d0000011-0000-0000-0000-000000000000','Orfűi-tó',
   '{"hu":"orfui-to","en":"orfu-lake"}','Baranya','HU','to','konnyu',
   ST_SetSRID(ST_MakePoint(18.1520, 46.1500),4326), null, null,
   '{"hu":"Mecseki kirándulótó, szélvédett.","en":"Sheltered lake in the Mecsek hills."}',
   '{"hu":"Kemping melletti strand.","en":"Beach next to the campsite."}', null),

  ('d0000012-0000-0000-0000-000000000000','Szeged (Tisza)',
   '{"hu":"szeged-tisza","en":"szeged-tisza"}','Csongrád-Csanád','HU','folyo','kozepes',
   ST_SetSRID(ST_MakePoint(20.1480, 46.2530),4326), null, null,
   null,'{"hu":"Belvárosi rakpart-bejárók.","en":"Downtown quay launches."}',
   '{"hu":"Folyó — vízállás és áramlás figyelése kötelező.","en":"River — always check water level and current."}'),

  ('d0000013-0000-0000-0000-000000000000','Győr (Mosoni-Duna)',
   '{"hu":"gyor-mosoni-duna","en":"gyor-mosoni-duna"}','Győr-Moson-Sopron','HU','folyo','kozepes',
   ST_SetSRID(ST_MakePoint(17.6350, 47.6870),4326), null, null,
   null,'{"hu":"Városligeti bejárók.","en":"City-park launches."}',
   '{"hu":"Enyhe áramlás, hajóforgalom.","en":"Mild current, boat traffic."}'),

  ('d0000014-0000-0000-0000-000000000000','Római-part (Duna)',
   '{"hu":"romai-part","en":"romai-part"}','Budapest','HU','folyo','halado',
   ST_SetSRID(ST_MakePoint(19.0550, 47.5730),4326), null, null,
   null,'{"hu":"Római-parti csónakházak.","en":"Boathouses at Római-part."}',
   '{"hu":"Erős hajóforgalom és áramlás — tapasztalat ajánlott.","en":"Heavy traffic and current — experience recommended."}'),

  ('d0000015-0000-0000-0000-000000000000','Fertőrákos (Fertő)',
   '{"hu":"fertorakos","en":"fertorakos"}','Győr-Moson-Sopron','HU','to','kozepes',
   ST_SetSRID(ST_MakePoint(16.6490, 47.7170),4326), 90, 'Fertő',
   '{"hu":"Nemzeti park — belépési és mozgási szabályok.","en":"National park — access and movement rules."}',
   '{"hu":"Fertőrákosi kikötő.","en":"Fertőrákos harbour."}',
   '{"hu":"Hirtelen erősödő szél a nyílt vízen.","en":"Wind can pick up suddenly on open water."}')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- SZOLGÁLTATÓK (5) — B2B directory. owner_user_id null (nem claim-elt), a
-- `verified` a column-védelmi trigger miatt insertkor false (csak admin állítja).
-- ---------------------------------------------------------------------------
insert into public.providers (id, name, slug, type, description, contact_email, tier) values
  ('e0000001-0000-0000-0000-000000000000','SUP Balaton Kölcsönző',
   '{"hu":"sup-balaton-kolcsonzo","en":"sup-balaton-rental"}',
   '{rental,lesson}',
   '{"hu":"Deszkakölcsönzés és kezdő oktatás Balatonföldváron.","en":"Board rental and beginner lessons in Balatonföldvár."}',
   'info@supbalaton.hu','free'),

  ('e0000002-0000-0000-0000-000000000000','Tisza-tavi SUP Túrák',
   '{"hu":"tisza-tavi-sup-turak","en":"tisza-lake-sup-tours"}',
   '{tour,lesson}',
   '{"hu":"Vezetett túrák a Tisza-tó vadregényes holtágain.","en":"Guided tours on the wild backwaters of Lake Tisza."}',
   'tura@tiszasup.hu','premium'),

  ('e0000003-0000-0000-0000-000000000000','Velence SUP Center',
   '{"hu":"velence-sup-center","en":"velence-sup-center"}',
   '{rental,tour,lesson}',
   '{"hu":"Teljes körű SUP-szolgáltatás a Velencei-tavon.","en":"Full-service SUP on Lake Velence."}',
   'hello@velencesup.hu','free'),

  ('e0000004-0000-0000-0000-000000000000','Orfű SUP & Kemping',
   '{"hu":"orfu-sup-kemping","en":"orfu-sup-camping"}',
   '{rental,accommodation}',
   '{"hu":"Kölcsönzés és szállás az Orfűi-tó partján.","en":"Rental and accommodation by Lake Orfű."}',
   'kemping@orfusup.hu','free'),

  ('e0000005-0000-0000-0000-000000000000','Duna SUP Iskola',
   '{"hu":"duna-sup-iskola","en":"danube-sup-school"}',
   '{lesson,tour}',
   '{"hu":"Folyóvízi technika és túrák a Dunán, haladóknak.","en":"River technique and tours on the Danube, for advanced paddlers."}',
   'iskola@dunasup.hu','premium')
on conflict (id) do nothing;

insert into public.provider_spots (provider_id, spot_id) values
  ('e0000001-0000-0000-0000-000000000000','d0000001-0000-0000-0000-000000000000'),
  ('e0000001-0000-0000-0000-000000000000','d0000003-0000-0000-0000-000000000000'),
  ('e0000002-0000-0000-0000-000000000000','d0000009-0000-0000-0000-000000000000'),
  ('e0000002-0000-0000-0000-000000000000','d0000010-0000-0000-0000-000000000000'),
  ('e0000003-0000-0000-0000-000000000000','d0000007-0000-0000-0000-000000000000'),
  ('e0000003-0000-0000-0000-000000000000','d0000008-0000-0000-0000-000000000000'),
  ('e0000004-0000-0000-0000-000000000000','d0000011-0000-0000-0000-000000000000'),
  ('e0000005-0000-0000-0000-000000000000','d0000014-0000-0000-0000-000000000000')
on conflict (provider_id, spot_id) do nothing;

-- ---------------------------------------------------------------------------
-- ADVISOR_WEIGHTS — Deszkaválasztó súlyok + szűrési konstansok (5.2) ÉS a
-- SUP-index (supindex.*) sávjai/szorzói (5.1). Deploy nélkül hangolható.
-- ---------------------------------------------------------------------------
insert into public.advisor_weights (key, value) values
  -- Deszkaválasztó 2. réteg — pontozási súlyok (összeg = 100)
  ('advisor.weight.stability',            30),
  ('advisor.weight.reviews',              25),
  ('advisor.weight.value',                20),
  ('advisor.weight.purpose_fit',          15),
  ('advisor.weight.availability',         10),
  -- Deszkaválasztó 1. réteg — kemény szűrés konstansai
  ('advisor.volume_multiplier.kezdo',     2.5),
  ('advisor.volume_multiplier.halado',    2.2),
  ('advisor.volume_multiplier.versenyzo', 2.0),
  ('advisor.passenger.child_kg',          15),
  ('advisor.passenger.dog_kg',            25),
  ('advisor.max_load.safety_factor',      0.66),
  ('advisor.reviews.min_count',           5),
  -- SUP-index (5.1) — szél-alap sávok (felső határ km/h → pontszám)
  ('supindex.wind.band1_max',             12),
  ('supindex.wind.band2_max',             20),
  ('supindex.wind.band3_max',             28),
  ('supindex.wind.band4_max',             38),
  ('supindex.wind.score.band1',           10),
  ('supindex.wind.score.band2',           8),
  ('supindex.wind.score.band3',           5),
  ('supindex.wind.score.band4',           2),
  ('supindex.wind.score.band5',           0),
  -- lökés-büntetés
  ('supindex.gust.delta_threshold',       15),
  ('supindex.gust.penalty',               2),
  -- offshore (besodró) szorzó
  ('supindex.offshore.multiplier',        0.5),
  ('supindex.offshore.wind_min',          15),
  -- hidegvíz-büntetés
  ('supindex.coldwater.temp_c',           14),
  ('supindex.coldwater.penalty',          1.5),
  -- viharfok-override: I. fok → max 3.9 pont; II. fok → 0 pont ("tilos a vízen
  -- tartózkodni", 9. fej.). Az F1.3 algo-engineer validálja a SUP-index számításban.
  ('supindex.storm.level1_cap',           3.9),
  ('supindex.storm.level2_cap',           0),
  -- kimeneti állapot-küszöbök + adatkor
  ('supindex.threshold.excellent',        7),
  ('supindex.threshold.caution',          4),
  ('supindex.stale_minutes',              30)
on conflict (key) do nothing;
