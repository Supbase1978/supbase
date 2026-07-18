-- ============================================================================
-- CORE — Kiterjesztések (F1.2)
-- Modul: core. Idempotens, additív. A modul-szerződés (1.3) szerint a közös
-- infrastruktúrát (kiterjesztések) a core hozza; modulok nem telepítenek ext-et.
-- ============================================================================

-- PostGIS a spots geo-rétegéhez (geometry(Point,4326) + GiST index).
create extension if not exists postgis;

-- gen_random_uuid() PG13+ core-ban elérhető; pgcrypto biztonsági tartaléknak.
create extension if not exists pgcrypto;
