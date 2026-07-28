-- ============================================================================
-- MODUL: reviews — explicit „ajánlom / nem ajánlom" + jövőbeli kategória-
-- szempontok varrata (F2.3 2. szakasz). ÚJ migráció, ADDITÍV: a
-- 20260717091100-as reviews-migrációt NEM bolygatja.
--
-- RLS: VÁLTOZATLAN. Mindkét új oszlop a SAJÁT vélemény szabadon írható mezője
-- (mint a rating_overall vagy a text_pros) — a `protect_review_columns` trigger
-- CSAK a `verified_owner` és a `status` oszlopot pinneli vissza user-oldali
-- update-nél, és ez így is marad: a jelvényt és a moderációs állapotot a user
-- nem állíthatja, a saját véleményének tartalmát viszont igen.
-- ============================================================================

-- --- would_recommend ---------------------------------------------------------
-- NULLABLE, szándékosan: a MEGLÉVŐ vélemények null-lal maradnak, és az
-- aggregátor rájuk a régi szabályt alkalmazza (rating_overall >= 4 → ajánlja),
-- így egyetlen korábbi százalék sem torzul visszamenőleg. Az új véleményeknél
-- az EXPLICIT érték győz a származtatás felett.
alter table public.board_reviews
  add column if not exists would_recommend boolean;

-- --- ratings (EGYELŐRE NEM HASZNÁLT) -----------------------------------------
-- FIGYELEM: ezt az oszlopot MOST NEM ÍRJA ÉS NEM OLVASSA SEMMI. Tudatos
-- előkészítés a későbbi kategória-specifikus szempontokhoz (pl. „evező: súly,
-- merevség"), hogy az ne igényeljen újabb migrációt.
--
-- A SZABÁLY, ami emiatt érvényes (kettős tárolás elleni védelem):
--   * a NÉGY meglévő deszka-oszlop (rating_stability, rating_glide,
--     rating_build, rating_value) marad a DESZKA KANONIKUS tárolója —
--     ezeket a `ratings` NEM duplikálja és NEM váltja ki;
--   * MINDEN ÚJ szempont (kategória-specifikus dimenzió) ide, a `ratings`
--     jsonb-be kerül: {"suly": 4, "merevseg": 5}, 1–5 skálán.
-- Az aggregáció amúgy is JS-ben történik (src/modules/reviews/aggregate.ts),
-- ezért a jsonb nem drágít semmit.
alter table public.board_reviews
  add column if not exists ratings jsonb
    check (ratings is null or jsonb_typeof(ratings) = 'object');

comment on column public.board_reviews.would_recommend is
  'Explicit „ajánlom / nem ajánlom". NULL = a vélemény még a bevezetés előttről való: az aggregátor ilyenkor a rating_overall >= 4 származtatást használja.';
comment on column public.board_reviews.ratings is
  'EGYELŐRE NEM HASZNÁLT (F2.3 előkészítés). Jövőbeli KATEGÓRIA-SPECIFIKUS szempontok tárolója, 1–5 skálán. A négy rating_* oszlop marad a deszka kanonikus tárolója; minden ÚJ szempont ide kerül, nem új oszlopba.';
