-- ============================================================================
-- MODUL: catalog — MODERÁTORI JEGYZET a jelöltekre (2026-08-31).
--
-- MIÉRT: a validálás közben a moderátor olyan hibákba fut, amiket nem ő tud
-- javítani — a kinyerés hibája, nem a döntésé. Élesben: a
-- „Hydro-Force BREEZE PANORAMA ablakos túra 30" modellnév, ahol a bolti
-- cím-zaj („ablakos túra 30") a névbe került. Az ilyet eddig KÉZZEL kellett
-- visszajelezni, jelöltenként — ami több száz jelöltnél tarthatatlan.
--
-- Ez a mező a csatorna: a moderátor a kártyán odaírja, mi a gond, és a
-- fejlesztés a `list-notes` paranccsal egyben látja mindet.
--
-- MIÉRT A JELÖLT-SORON, és nem külön táblán: a jegyzet MINDIG egy konkrét
-- jelölthöz tartozik, egy darab belőle van, és a jelölt sorsával együtt kell
-- élnie (jóváhagyás után is olvasható marad — épp azokra a hibákra derül fény
-- utólag, amiket a moderátor jóváhagyáskor észlelt).
--
-- ÜRESEN HAGYVA `null`: a mező OPCIONÁLIS, csak akkor telik meg, ha tényleg
-- van gond. Így a `list-notes` kimenete = a valódi teendők listája.
-- ============================================================================

alter table public.catalog_candidates
  add column if not exists moderator_note text;

comment on column public.catalog_candidates.moderator_note is
  'A moderátor szabad szöveges észrevétele a jelöltről (kinyerési hiba, hibás név, rossz kép). A fejlesztésnek szól, nem a felhasználóknak; a `catalog-watch list-notes` gyűjti ki.';
