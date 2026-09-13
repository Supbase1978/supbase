-- ============================================================================
-- MODUL: catalog — EGY SOR, TÖBB MODELLÉV (2026-09-13).
--
-- MÉRÉS, ami ezt kikényszerítette. A Starboard 126 modellje szerepel több
-- modellévben. Mezőnként összevetve (a hüvelyk→cm átváltás kerekítési zaját
-- leválasztva: 20 ⇄ 20,1 cm, 14,2 ⇄ 14,22 kg nem termékváltozás):
--   * 65 pár MINDEN mérhető mezőben azonos — csak a termékoldal éve más;
--   * 15 párnál csak a HIÁNYZÓ adat tér el (a régebbi lapról nem jött ki);
--   * 46 pár ÉRDEMBEN különbözik — 32-nél a tömeg (10,1 → 9,3 kg),
--     15-nél a TEHERBÍRÁS (85 → 120, 155 → 115, 90 → 70 kg), 5-nél a
--     vastagság (15 → 12 cm, azaz 6" helyett 4,75" — áttervezés).
--
-- A teherbírás BIZTONSÁGI mező (a Deszkaválasztó ez alapján ajánl), ezért a
-- modellévek vak összevonása ugyanolyan hiba lett volna, mint a kivitelek
-- összevonása: egy 70 kg-os deszka 90-esként jelenne meg.
--
-- FELHASZNÁLÓI DÖNTÉS (2026-09-13): „mivel korábbi évjáratokat is nézhetnek a
-- használók", ahol SEMMI különbség nincs, ott EGY sor legyen, és a neve
-- tüntesse fel kötőjellel az összes évjáratot — így a vevő látja, hogy azok
-- között nincs eltérés. Ahol van eltérés, ott évjáratonként külön sor marad a
-- saját adatával.
--
-- MIÉRT KÉT OSZLOP. A `model_year` EGYETLEN szám marad, mert a Deszkaválasztó
-- frissesség-pontozása ezzel számol (`advisor/select/select.ts`) — az
-- összevont sornál ez a LEGFRISSEBB év. A `model_years` a megjelenítés
-- igazsága: mely évjáratokra érvényes ez a sor. Egyelemű listánál a felirat
-- változatlan, tehát a 20 gyártó többsége nem lát semmi különbséget.
-- ============================================================================

alter table public.boards
  add column if not exists model_years int[] not null default '{}';

comment on column public.boards.model_years is
  'Mely modellévekre érvényes ez a sor. Több elem = a gyártó több évben AZONOS adattal hozta. A `model_year` ezek közül a legfrissebb (a Deszkaválasztó azzal pontoz).';

-- VISSZATÖLTÉS: aminek van évjárata, az egyelemű listát kap. Idempotens.
update public.boards
   set model_years = array[model_year]
 where model_year is not null
   and model_years = '{}';
