-- ============================================================================
-- MODUL: catalog — jelöltenkénti mezőzár + "adatgyűjtés kész" jelölés
-- (F2.1-utó-10). ÚJ migráció, ADDITÍV: a 20260717091600-as catalog_watch
-- migrációt NEM bolygatja.
--
-- MIÉRT (élesben mért probléma, 2026-08-13 – 08-15): a catalog-watch crawler
-- egy ismert `pending` URL-t újra-crawlolva MINDIG felülírja a teljes
-- `extracted` payloadot — ha egy admin/karmester kézzel javított egy mezőt
-- (mert a bolt oldalán a parser tévedett, vagy gyártói forrásból pótolta a
-- hiányzó adatot), az a javítás egy következő heti crawlnál elveszhet.
-- Ez ténylegesen megtörtént egy jelölttel (2026-08-15).
--
-- KÉT KÜLÖN mechanizmus, két oszlop — NE keverjük össze őket:
--   * `locked_fields`: MEZŐNKÉNTI védelem — melyik konkrét `extracted`-
--     mezőt (pl. "specs.lengthCm") ne írja felül többé a crawler. Egy
--     jelölten fokozatosan bővülhet, ahogy az adatgyűjtés halad.
--   * `data_verified_at`: JELÖLT-SZINTŰ "kész" jelölés — mikor
--     nyilvánította valaki lezártnak a jelölt adatgyűjtését. Akkor is
--     beállítható, ha objektíven nem tölthető ki minden mező (pl. egy bolt
--     nem publikálja a súlyt). Amíg NULL, a jelölt az admin "hiányos
--     jelöltek" listáján marad; ha kitöltött, onnan lekerül, függetlenül a
--     maradék null mezőktől.
--
-- RLS: VÁLTOZATLAN — mindkét oszlop a meglévő catalog_candidates sor-szintű
-- policyk alá esik, oszlop-hozzáadás nem igényel új policyt.
-- ============================================================================

alter table public.catalog_candidates
  add column if not exists locked_fields text[] not null default '{}',
  add column if not exists data_verified_at timestamptz;

comment on column public.catalog_candidates.locked_fields is
  'Melyik extracted-mezőt (pl. "specs.lengthCm", "brandName") ne írja felül többé a crawler — kézzel/gyártói forrásból ellenőrzött érték. A tools/catalog-watch/lock.ts alkalmazza saveCandidate-ben.';
comment on column public.catalog_candidates.data_verified_at is
  'Mikor lett a jelölt adatgyűjtése "kész"-nek nyilvánítva (akkor is, ha maradt null mező) — NULL amíg aktívan gyűjtés alatt van. A list-incomplete parancs a NULL sorokat listázza.';
