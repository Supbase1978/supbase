-- ============================================================================
-- MODUL: spots — Deseda, Szelidi-tó, Tőserdő, Bánki-tó (2026-09-26).
-- Additív és IDEMPOTENS: fix UUID + `on conflict (id) do nothing`.
--
-- MIÉRT MOST: a felhasználó országos víz-összesítője (`Kezdők_tanácsok/
-- magyar-sup-vizteruletek.html`, nincs a repóban) kb. húsz új vizet vetett fel.
-- Ebből EZ A NÉGY az, ahol elsődleges (önkormányzati / üzemeltetői) forrás
-- igazolja, hogy a vízen evezős eszközzel — és konkrétan SUP-pal — lehet
-- közlekedni. A többi jelölt és a kizárás oka: `docs/VIZTESTEK_KUTATAS.md`,
-- „Országos bővítés (2026-09-26)".
--
-- KOORDINÁTÁK: mind OpenStreetMapből, a KONKRÉT vízre szállási objektumra
-- illesztve, fordított geokódolással visszaellenőrizve — nem becsülve:
--   * Deseda   → 46.408267, 17.818558 = „Csónakház" (amenity=boat_rental),
--                Vízisporttelep, a Kaposvári Vízügyi SC csónakháza;
--   * Szelid   → 46.625222, 19.043574 = „Nagy strand" (natural=beach);
--   * Tőserdő  → 46.857239, 19.989648 = „Csónakkölcsönző" (amenity=
--                boat_rental), a Lakitelki Holt-Tisza partján. A „Tőserdői
--                strand" OSM-objektum a TERMÁLFÜRDŐ, nem a holtági strand —
--                azt szándékosan nem használjuk;
--   * Bánk     → 47.923129, 19.177405 = „Bánki-tó strand" (leisure=
--                beach_resort).
--
-- VIHARJELZŐ (`storm_warning_region`) EGYIKNÉL SINCS: a `46/2001. BM r.
-- 4. § (1)` szerint a szolgálat csak a Balatonon, a Velencei-tavon, a
-- Tisza-tavon és a Fertőn működik. VÍZMÉRCE (`vizugy_tsz`) SINCS: egyik sem
-- folyóvíz, a holtágnak pedig nincs saját készültségi szintű mércéje.
-- `shore_bearing_deg` NULL: nem mértük, becsülni nem szabad.
--
-- VÍZIÚT-E: egyik sem szerepel a `17/2002. KöViM r.` 3. mellékletében, tehát
-- NEM a Hajózási Szabályzat a kiindulópont, hanem a helyi réteg. Ezért a
-- szövegek SEHOL nem állítanak jogszabályi mellény-/leash-kötelezettséget;
-- a Bánki-tónál a mentőmellény az ÜZEMELTETŐ szabálya, és így is írjuk.
--
-- FORRÁSOK (elsődleges):
--   * Deseda: egeszseges.kaposvar.hu/cikk/deseda (Kaposvár MJV Önkormányzata)
--     — „a Kaposvári Vízügyi SC-nél … SUP-ot" is bérelhetünk; deseda.hu (a tó
--     bemutatása: 8 km hosszú, 245 ha, önkormányzati tulajdon, halászati
--     kezelő a Kaposvári Sporthorgász Egyesület, csónakos horgászat);
--     evezzitthon.hu megállóhely-adatlap (KVSC Deseda Csónakház, 0425/1 hrsz.).
--   * Szelid: szelidi-to.hu/programok — „kajak, kenu, csónak, ladik, surf,
--     vízibicikli bérlésére nyílik lehetőség" a szabad strandnál és a
--     fizetőstrandon; knp.hu/hu/szelidi-to — természetvédelmi terület, 360 ha,
--     2/1976. OTvH; dunapatajishe.hu általános szabályok — „Robbanómotoros
--     vízi jármű csak szolgálati célból használható, elektromos csónakmotor
--     használata engedélyezett", „A nádfalba bemenni … tilos".
--   * Tőserdő: toserdo.hu (Lakitelek turisztikai oldala) — SUP-túrák és
--     csónakkölcsönző a Holt-Tisza partján, vezetett vízitúra előzetes
--     bejelentkezéssel; knp.hu Lakitelek-Tőserdő — Szikrai és Alpári Holt-Tisza,
--     szabad strand, csónakázási lehetőség.
--   * Bánk: bank-falu.hu/bank/strand (Bánk Község Önkormányzata) — SUP-
--     kölcsönzés a strandon; „Állószörf (SUP) és tartozékainak bérlése és
--     használatának szabályai" (bank-falu.hu/bank/docs/sup_hasznalat_szabalyai
--     .pdf): csak a bójákkal határolt fürdőterületen KÍVÜL, mentőmellény
--     KÖTELEZŐ, max. 1 fő, bérlés 18 év felett, felelősségvállalási nyilatkozat.
--
-- AMIT SZÁNDÉKOSAN NEM ÁLLÍTUNK:
--   * Bánk: hogy SAJÁT SUP-pal is szabad vízre szállni. Az önkormányzati oldal
--     csak a KÖLCSÖNZÖTT SUP-ról rendelkezik. (Egy WebFetch-összefoglaló „saját
--     SUP tárolási díjat" állított — a nyers oldalszövegben ilyen NINCS.)
--   * Szelid: SUP-specifikus szabályt. A források evezős eszközökről (kajak,
--     kenu, csónak, „surf") szólnak; a motor- és nádas-szabály a horgászrendből
--     való, ezért a szöveg ezt a forrást nevezi meg.
--   * Deseda: konkrét fürdőzóna-, tiltott zóna- vagy nyitvatartási adatot. A
--     tó használatát önkormányzati rendelet szabályozza, amit elsődleges
--     forrásból nem tudtunk megnyitni.
-- ============================================================================

insert into public.spots
  (id, name, slug, region, country, water_type, difficulty, geom,
   shore_bearing_deg, storm_warning_region, vizugy_tsz,
   protected_area, season_info, access_info, safety_notes)
values
  -- Deseda-tó, Kaposvár — az ország egyik leghosszabb mesterséges tava.
  ('d0000025-0000-0000-0000-000000000000','Deseda-tó (Kaposvár)',
   '{"hu":"deseda-to-kaposvar","en":"lake-deseda-kaposvar"}','Somogy','HU','to','konnyu',
   ST_SetSRID(ST_MakePoint(17.818558, 46.408267),4326), null, null, null,
   null,
   '{"hu":"Nyáron strand és vízisport-élet; a csónakház a szezonon kívül is üzemelhet, de a nyitvatartását indulás előtt ellenőrizd.","en":"Beach and water-sports life in summer; the boathouse may also open outside the season, but check its opening hours before you go."}',
   '{"hu":"A Kaposvári Vízügyi Sport Club csónakháza a Deseda Vízisporttelepen (Toponár); SUP, kajak, kenu és sárkányhajó bérelhető. A tó a városból kerékpárúton is megközelíthető.","en":"The Kaposvár Water Sports Club boathouse at the Deseda water-sports ground (Toponár); SUP, kayak, canoe and dragon boat rental. The lake can also be reached from town by cycle path."}',
   '{"hu":"Hosszú (kb. 8 km-es), keskeny tó: a visszautat a széliránnyal együtt tervezd, hogy ne szembeszélben kelljen hazaevezni. A tavon csónakos horgászat is folyik — a horgászhelyeket és a zsinórokat nagy ívben kerüld. A tó használatáról önkormányzati rendelet rendelkezik; a helyszíni táblákat tartsd be.","en":"A long (about 8 km), narrow lake: plan your way back with the wind in mind so you do not have to paddle home into a headwind. Anglers fish from boats here too — give fishing spots and lines a wide berth. Use of the lake is governed by a municipal decree; follow the signs on site."}'),

  -- Szelidi-tó, Dunapataj — természetvédelmi terület, két strandsávval.
  ('d0000026-0000-0000-0000-000000000000','Szelidi-tó',
   '{"hu":"szelidi-to","en":"lake-szelid"}','Bács-Kiskun','HU','to','konnyu',
   ST_SetSRID(ST_MakePoint(19.043574, 46.625222),4326), null, null, null,
   '{"name":{"hu":"Szelidi-tó — országos jelentőségű természetvédelmi terület (Kiskunsági Nemzeti Park, 1976, 360 ha)","en":"Lake Szelid — nature conservation area of national importance (Kiskunság National Park, 1976, 360 ha)"},
     "rules":{"hu":"A tó a Kiskunsági Nemzeti Park kezelésében álló védett terület. A nádast és a vízi növényzetet ne bolygasd, a parton tüzet rakni és sátrazni tilos.","en":"The lake is a protected area managed by Kiskunság National Park. Do not disturb the reeds or aquatic vegetation; lighting fires and camping on the shore are prohibited."}}',
   '{"hu":"Nyáron a vízminőség miatt időszakos fürdési tilalom előfordulhat (2026 júliusában is volt) — indulás előtt nézd meg, van-e érvényes tilalom.","en":"Temporary bathing bans due to water quality can occur in summer (there was one in July 2026) — check for any ban in force before you go."}',
   '{"hu":"A szabad strandokról és a fizetőstrandról. Kajak, kenu, csónak, ladik, „surf” és vízibicikli a szabad strandnál és a fizetőstrand csúszdájánál lévő kölcsönzőben bérelhető.","en":"From the free beaches and the paid beach. Kayak, canoe, rowing boat, punt, “surf” and pedalo rental at the free beach and at the rental point by the paid-beach slide."}',
   '{"hu":"A helyi horgászrend szerint a tavon robbanómotoros vízi jármű csak szolgálati célból közlekedhet (elektromos motor engedélyezett), és a nádfalba bemenni tilos — evezősként is maradj a nyílt vízen. Nyáron a strandok előtt sok a fürdőző: tőlük távol evezz.","en":"Under the local angling rules, combustion-engine craft may only be used for official purposes on the lake (electric motors are allowed), and entering the reed wall is prohibited — as a paddler, stay on open water too. In summer the beaches are busy with swimmers: keep well clear of them."}'),

  -- Lakitelki Holt-Tisza, Tőserdő — kb. 7 km-es holtág a KNP szomszédságában.
  ('d0000027-0000-0000-0000-000000000000','Tőserdő (Lakitelki Holt-Tisza)',
   '{"hu":"toserdo-lakitelki-holt-tisza","en":"toserdo-lakitelek-oxbow"}','Bács-Kiskun','HU','holtag','konnyu',
   ST_SetSRID(ST_MakePoint(19.989648, 46.857239),4326), null, null, null,
   null,
   '{"hu":"Holtág, sodrás nélküli víz. A holtági szabad strand a Holt-Tisza hídjánál van, nyáron itt a legnagyobb a forgalom.","en":"An oxbow with still water and no current. The free beach is by the Holt-Tisza bridge, which is where it gets busiest in summer."}',
   '{"hu":"A tőserdei csónakkölcsönzőnél, a Holt-Tisza partján; vezetett vízitúra előzetes bejelentkezéssel (turisztika@lakitelek.hu). Egyes partszakaszok szárazföldön nem közelíthetők meg — vízről viszont igen.","en":"At the Tőserdő boat rental on the Holt-Tisza bank; guided water tours on prior booking (turisztika@lakitelek.hu). Some stretches of shore cannot be reached by land — but they can from the water."}',
   '{"hu":"Zárt holtág, sodrás nélkül — a fő kockázat a fürdőzők a strandszakaszon és a horgászok. A holtág a Kiskunsági Nemzeti Park szomszédságában, érzékeny ártéri környezetben fekszik: a nádast és a madarakat ne zavard.","en":"A closed oxbow with no current — the main risks are swimmers along the beach stretch and anglers. The oxbow lies next to Kiskunság National Park in a sensitive floodplain environment: do not disturb the reeds or the birds."}'),

  -- Bánki-tó, Bánk — Nógrád kis strandtava, önkormányzati SUP-szabályzattal.
  ('d0000028-0000-0000-0000-000000000000','Bánki-tó',
   '{"hu":"banki-to","en":"lake-bank"}','Nógrád','HU','to','konnyu',
   ST_SetSRID(ST_MakePoint(19.177405, 47.923129),4326), null, null, null,
   null,
   '{"hu":"Nyári strandszezonban üzemel a strand és a SUP-kölcsönző; a nyitvatartást és a hatályos árakat a község oldalán nézd meg.","en":"The beach and the SUP rental operate in the summer beach season; check opening hours and current prices on the village website."}',
   '{"hu":"Bánki Tó-Strand, Petőfi út 61. — a bejárat a Lomen János sétány (tópart) felől van. SUP-kölcsönzés a strandon.","en":"Bánk Lake Beach, Petőfi út 61 — the entrance is from Lomen János promenade (lakeside). SUP rental at the beach."}',
   '{"hu":"A strand SUP-szabályzata szerint: SUP-pal kizárólag a bójákkal határolt fürdőterületen KÍVÜL szabad evezni; a MENTŐMELLÉNY viselése KÖTELEZŐ; egy deszkán legfeljebb 1 fő; bérelni 18 év felett, felelősségvállalási nyilatkozattal lehet, kiskorú csak felnőtt felügyeletével használhatja. A fürdőzőket és a horgászokat zavarni tilos. Saját SUP behozataláról a szabályzat nem rendelkezik — erről a strandon érdeklődj.","en":"Under the beach''s SUP rules: paddle only OUTSIDE the buoyed swimming area; wearing a LIFE JACKET is MANDATORY; at most 1 person per board; renters must be 18+ and sign a liability waiver, and minors may only use a board under adult supervision. Disturbing swimmers and anglers is prohibited. The rules say nothing about bringing your own SUP — ask at the beach."}')
on conflict (id) do nothing;
