/**
 * catalog-watch — DUPLIKÁTUM-ŐR a katalógusra (F2.1-utó-57, 2026-08-31).
 *
 * MI TÖRTÉNT: a moderáció során 20 fölösleges katalógus-sor keletkezett —
 * ugyanaz a deszka kétszer, `-2` végű sluggal (Starboard Whopper, GO, iGO,
 * Generation, Touring; Uone SPRINT; Aqua Marina BLADE). Egy párnál a két sor
 * ugyanazt a slugot is viselte.
 *
 * MIÉRT KELETKEZETT — és miért nem a jóváhagyó hibája: a jelölt
 * `matched_board_id`-ja a CRAWL pillanatában fagy meg. Ha a párja csak KÉSŐBB
 * kerül a katalógusba (mert egy másik jelöltből épp akkor hagytuk jóvá), a
 * régi jelölt továbbra is „új típusként" áll a moderátor előtt — és egy
 * kattintás új sort csinál belőle. Az admin-felület ezen a ponton nem véd: a
 * `matchedBoardLabel` a TÁROLT párt mutatja, a `findDuplicateHints` pedig
 * jelölt↔jelölt átfedést néz, nem jelölt↔élő deszkát.
 *
 * KÉT ELLENŐRZÉS, KÉT KÜLÖN CÉLLAL:
 *  1. `findDuplicateBoards` — ami MÁR bent van kétszer (takarítás);
 *  2. `findUnpairedCandidates` — ami MOST hozna létre duplikátumot (megelőzés).
 *
 * A NÉV-EGYEZÉS SZIGORÚ: írásjel- és kisbetű-független, de BETŰRE azonos.
 * A trigram-hasonlóság ehhez kevés: élesben az `iCON 12'0" X 33" Deluxe`
 * 82%-kal az `iGO 12'0" X 33" Deluxe`-ra illeszkedett (MÁS modell), az
 * `iGO … 11'2"` pedig a `10'8"`-ra. Egy téves pár-javaslat rosszabb, mint a
 * hiánya: a moderátor arra kattint rá.
 *
 * TISZTA modul: se hálózat, se adatbázis.
 */

/** Egy katalógus-sor, amennyit az összevetéshez ismerni kell. */
export interface CatalogBoard {
  id: string;
  brandName: string | null;
  modelName: string;
  slug: string | null;
  /** Kitöltött mezők száma — a „gazdagabb sor marad" döntéshez. */
  filledFields: number;
  /** Képek száma (borító + galéria). */
  imageCount: number;
}

/** Egy még el nem bírált jelölt, a megelőző ellenőrzéshez. */
export interface PendingCandidate {
  id: string;
  brandName: string | null;
  modelName: string;
  /** A jelölt-sorban TÁROLT pár (a crawl idejéből). */
  matchedBoardId: string | null;
}

/** Írásjel- és kisbetű-független alak; ez alapján „azonos" két név. */
export function nameKey(brandName: string | null, modelName: string): string {
  const fold = (text: string) =>
    text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  return `${fold(brandName ?? "")}|${fold(modelName)}`;
}

/** Egy duplikátum-csoport: melyik sor maradjon, melyek fölöslegesek. */
export interface DuplicateGroup {
  keep: CatalogBoard;
  drop: CatalogBoard[];
}

/**
 * Ugyanaz a deszka többször a katalógusban.
 *
 * A MEGTARTOTT a GAZDAGABB sor: több kitöltött mező, majd több kép, majd a
 * `-2` nélküli slug; végül a stabil azonosító, hogy a kimenet determinisztikus
 * legyen. A hívó feladata, hogy a törlendő sorok hiányzó adatát és képeit
 * ÁTVEGYE a megtartottba — a takarítás nem veszíthet adatot.
 */
export function findDuplicateBoards(
  boards: readonly CatalogBoard[],
): DuplicateGroup[] {
  const groups = new Map<string, CatalogBoard[]>();
  for (const board of boards) {
    const key = nameKey(board.brandName, board.modelName);
    groups.set(key, [...(groups.get(key) ?? []), board]);
  }

  const numbered = (slug: string | null) => (/-\d+$/.test(slug ?? "") ? 0 : 1);
  const out: DuplicateGroup[] = [];
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    const sorted = [...rows].sort(
      (a, b) =>
        b.filledFields - a.filledFields ||
        b.imageCount - a.imageCount ||
        numbered(b.slug) - numbered(a.slug) ||
        a.id.localeCompare(b.id),
    );
    const [keep, ...drop] = sorted;
    if (keep !== undefined) out.push({ keep, drop });
  }
  return out;
}

/** Egy jelölt, ami MOST duplikátumot hozna létre, és a hozzá tartozó deszka. */
export interface UnpairedCandidate {
  candidateId: string;
  label: string;
  boardId: string;
}

/**
 * Függő jelöltek, amiknek a neve BETŰRE egyezik egy MÁR ÉLŐ deszkával, de
 * nincs (vagy elavult) a tárolt párjuk — ezekre a „Jóváhagyás — új deszka"
 * gomb duplikátumot csinálna.
 *
 * A javítás nem a jóváhagyás megkerülése: csak beírja a párt, hogy a moderátor
 * ELŐTT ott legyen az „Összefésülés" lehetőség. A döntés az övé marad.
 */
export function findUnpairedCandidates(
  candidates: readonly PendingCandidate[],
  boards: readonly CatalogBoard[],
): UnpairedCandidate[] {
  const byName = new Map<string, CatalogBoard>();
  for (const board of boards) byName.set(nameKey(board.brandName, board.modelName), board);

  const out: UnpairedCandidate[] = [];
  for (const candidate of candidates) {
    const board = byName.get(nameKey(candidate.brandName, candidate.modelName));
    if (board === undefined || board.id === candidate.matchedBoardId) continue;
    out.push({
      candidateId: candidate.id,
      label: `${candidate.brandName ?? ""} ${candidate.modelName}`.trim(),
      boardId: board.id,
    });
  }
  return out;
}
