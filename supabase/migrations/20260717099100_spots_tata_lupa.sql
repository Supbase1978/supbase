-- ============================================================================
-- MODUL: spots — Tatai Öreg-tó és Lupa-tó (2026-08-31, felhasználói lelet).
-- Additív és IDEMPOTENS: fix UUID + `on conflict (id) do nothing`.
--
-- MIÉRT MOST: mindkét vízre a felhasználó talált rá. A Tata sehol nem
-- szerepelt nálunk; a LUPA viszont IGEN, méghozzá a `docs/VIZTESTEK_KUTATAS.md`
-- „Ahol NEM szabad" szakaszában, tiltott vízként — az az állítás HIBÁS volt, és
-- ugyanabban a menetben helyesbítettük (ld. a doksi „HELYESBÍTÉS" bekezdését).
--
-- KOORDINÁTÁK: mindkettő OpenStreetMapből, a KONKRÉT objektumra illesztve,
-- nem becsülve — ugyanaz a szabály, mint a 20260717092900 migrációban:
--   * Tata   → 47.642573, 18.338585 = Tópart sétány 13, az Old Lake SUP
--              bázisának címe a tóparti sétányon (a tó maga 47.6401, 18.3301);
--   * Lupa   → 47.624949, 19.070282 = a „Lupa Beach" strand OSM-objektuma.
--
-- VIHARJELZŐ (`storm_warning_region`) EGYIKNÉL SINCS: az országos viharjelző
-- rendszer a Balatonra, a Velencei-tóra, a Tisza-tóra és a Fertőre terjed ki.
-- Ezekre a tavakra nem — konstans értéket írni ide azt ÁLLÍTANÁ, hogy van
-- jelzés, holott nincs. (Ugyanez a döntés, mint a Gyékényesi-tónál.)
--
-- `shore_bearing_deg` szintén NULL: a parti kitettséget nem mértük, becsülni
-- pedig nem szabad — a szélirány-értékelés inkább maradjon üres, mint hamis.
--
-- FORRÁSOK (mind elsődleges, üzemeltetői vagy hatósági):
--   * Tata, szabályzat: oregtotata.hu „Szabályok a vízen" — a SUP NEVESÍTVE
--     szerepel az engedélyezett sporteszközök között; belső égésű motor tilos,
--     elektromos engedélyezett; éjszaka és 1000 m alatti látótávolságnál tilos.
--   * Tata, védettség: HUDI10006 Tatai Öreg-tó különleges madárvédelmi terület
--     (Natura 2000) + Ramsari terület + nemzeti védettség 1977 óta.
--   * Lupa: lupabeach.com — saját eszközzel is használható, surf/SUP-jegy,
--     kötelező mentőmellény és felelősségi nyilatkozat, a bójázott fürdő-
--     területen kívül, ködben/szürkületben/sötétben tilos.
--
-- AMIT SZÁNDÉKOSAN NEM ÁLLÍTUNK: a tatai őszi-téli VADLÚD-VONULÁS idejére
-- vonatkozó evezési korlátozást. A terület fenntartási terve a madárzavarást
-- veszélyeztető tényezőként nevezi meg, de konkrét, evezésre vonatkozó
-- időszakos tiltást egyetlen hivatalos forrásban sem találtunk. A
-- `safety_notes` ezért ELLENŐRZÉSRE hív fel, nem tiltást mond ki.
-- ============================================================================

insert into public.spots
  (id, name, slug, region, country, water_type, difficulty, geom,
   shore_bearing_deg, storm_warning_region, vizugy_tsz,
   protected_area, season_info, access_info, safety_notes)
values
  -- Tatai Öreg-tó — a vár tövében fekvő, középkori eredetű mesterséges tó.
  -- A hivatalos szabályzat a SUP-ot néven nevezi, ezért ez a ritka eset,
  -- amikor nem következtetni kell: a gyártó… azaz az üzemeltető kimondja.
  ('d0000023-0000-0000-0000-000000000000','Tatai Öreg-tó',
   '{"hu":"tatai-oreg-to","en":"tata-old-lake"}','Komárom-Esztergom','HU','to','konnyu',
   ST_SetSRID(ST_MakePoint(18.338585, 47.642573),4326), null, null, null,
   '{"name":{"hu":"Tatai Öreg-tó — Ramsari terület és Natura 2000 madárvédelmi terület (HUDI10006)","en":"Tata Old Lake — Ramsar site and Natura 2000 bird protection area (HUDI10006)"},
     "rules":{"hu":"1977 óta védett terület, nemzetközi jelentőségű vadlúd-vonuló hely. Az evezés nem tiltott, de a madárzavarás a terület fenntartási terve szerint veszélyeztető tényező — vonulási időszakban (ősz–tél) tartsd a távolságot a pihenő csapatoktól, és a helyszínen ellenőrizd, van-e aktuális korlátozás.","en":"Protected since 1977; an internationally important wild goose migration site. Paddling is not banned, but bird disturbance is listed as a threat in the site management plan — during the autumn-winter migration keep your distance from resting flocks and check locally for current restrictions."}}',
   '{"hu":"Egész évben evezhető; a tavat időszakosan lehalászás miatt leeresztik, indulás előtt nézd meg a vízállást. Télen a jégen tartózkodás MÁS szabályok alá esik, mint a vízre szállás.","en":"Paddleable year-round; the lake is periodically drained for the fish harvest, so check the water level before setting out. In winter, being on the ice falls under different rules than launching on water."}',
   '{"hu":"Tópart sétány, a vár és a tóparti sétány mentén; a helyi SUP-szolgáltató (Old Lake SUP) bázisa a Tópart sétány 13. alatt van. A tó Tata belvárosából gyalog elérhető.","en":"Tópart promenade, along the castle and the lakeside walk; the local SUP operator (Old Lake SUP) is based at Tópart sétány 13. The lake is walkable from Tata town centre."}',
   '{"hu":"A tó hivatalos szabályzata a SUP-ot nevesítve engedélyezi. Belső égésű motor használata a tavon TILOS (kivéve vitorlás segédmotorja, engedélyes és hatósági hajók), elektromos hajtás engedélyezett. Vízi sporteszközzel éjszaka és korlátozott látási viszonyok között (1000 m alatti látótávolság) TILOS közlekedni. Elsőbbségi sorrend: nagyhajó → vitorlás kishajó → vitorlás csónak → evezős csónak → sporteszköz (SUP) → motoros csónak; ha nem vagy biztos az elsőbbségedben, adj utat. Segélykérő: +36 20 540 0574.","en":"The lake''s official rules name SUP explicitly as permitted. Internal combustion engines are BANNED on the lake (except sailboat auxiliaries, licensed and official vessels); electric propulsion is allowed. Watercraft sports equipment may NOT be used at night or in visibility below 1000 m. Right of way: large vessel → small sailboat → sailing dinghy → rowing boat → sports equipment (SUP) → motorboat; when in doubt, give way. Emergency: +36 20 540 0574."}'),

  -- Lupa-tó (Lupa Beach) — bányatóból lett strand, 2016 óta üzemel; itt
  -- rendezték a 2022-es ISA SUP-világbajnokságot. A SAJÁT ESZKÖZ külön
  -- jeggyel és felelősségi nyilatkozattal vihető vízre.
  ('d0000024-0000-0000-0000-000000000000','Lupa-tó (Lupa Beach)',
   '{"hu":"lupa-to","en":"lupa-lake"}','Pest','HU','to','konnyu',
   ST_SetSRID(ST_MakePoint(19.070282, 47.624949),4326), null, null, null,
   null,
   '{"hu":"Strandszezonban (nyár) üzemel a teljes kiszolgálás; a szezon jellemzően augusztus végén zárul. Zárás után a tó egész területe használható, de a jegy- és nyilatkozat-kötelezettséget a helyszínen ellenőrizd.","en":"Full services run in the summer beach season, which typically closes at the end of August. Outside opening hours the whole lake may be used, but check the ticket and waiver requirements on site."}',
   '{"hu":"Budakalász, Dunapart — bármelyik bejáraton be lehet menni saját SUP-pal. A deszka és a szállító utánfutó a főpénztárnál parkoltatható. Bérlés és oktatás a strand SUP-bázisán.","en":"Budakalász, Dunapart — you may enter with your own SUP through any gate. Boards and trailers can be parked at the main ticket office. Rental and instruction at the beach SUP base."}',
   '{"hu":"Saját eszközzel is szabad vízre szállni, de az üzemeltető szabályai kötelezőek: surf/SUP-jegy váltása, FELELŐSSÉGI NYILATKOZAT aláírása a pénztárnál, és MENTŐMELLÉNY viselése. Nyitvatartás alatt kizárólag a bójázott fürdőterületen KÍVÜL evezhetsz; zárás után a tó egész területén. Ködben, szürkületben és sötétben TILOS vízre szállni. Figyelem: a Lupa-tavak többi, bányató-medencéje üzemi terület — az ottani tiltás továbbra is él, ez a spot kizárólag a strand területére vonatkozik.","en":"You may launch your own gear, but the operator''s rules are binding: buy a surf/SUP ticket, sign a LIABILITY WAIVER at the ticket office, and wear a LIFE JACKET. While the beach is open you may only paddle OUTSIDE the buoyed swimming area; after closing, anywhere on the lake. Launching in fog, at dusk or in the dark is FORBIDDEN. Note: the other Lupa mining-lake basins remain an industrial area where the ban still applies — this spot covers the beach only."}')
on conflict (id) do nothing;
