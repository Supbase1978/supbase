/**
 * KIEGÉSZÍTŐ-SPECIFIKÁCIÓ: a deszka-mezők leszedése.
 *
 * KÜLÖN FÁJL, mert KÉT oldalról kell (F2.1-utó-61): a jóváhagyás
 * (`data/candidates.server.ts`) ezzel tisztítja az insert-payloadot, a
 * MODERÁCIÓS KÁRTYA (`admin.katalogus.tsx`) pedig ezzel jeleníti meg a
 * kiegészítő-jelöltet. A kártya a `.server.ts`-t nem importálhatja — az
 * szerver-kód —, ezért a tiszta függvény ide került.
 *
 * MIÉRT KELL A KÁRTYÁN IS. A jelölt `extracted` mezője a CRAWL IDEJÉN fagy be,
 * a jóváhagyás viszont már szűr — így a moderátor olyan adatot LÁTOTT, ami
 * sosem került volna be. Élesben ez félrevezetett: három moderátori jegyzet
 * született arról, hogy „a hossz nem lehet 396 cm" és „max terhelés 150 kg egy
 * pumpánál?", holott az élő sorokra ekkor már `null` ment. A felület a
 * valóságot mutassa: azt, ami tényleg be fog kerülni.
 */
import type { ExtractedBoardSpecs } from "./types";

/**
 * Egy KÖVETETT kiegészítő (evező, mentőmellény, pumpa) sosem 2,4 m-es — ez a
 * figyelő deszka-alsóhatára is (`BOARD_LENGTH_MIN_CM`). A konstans itt
 * SZÁNDÉKOSAN duplán szerepel: a modul csak a `@core`-tól és önmagától
 * függhet, a figyelő pedig `tools/` alatt él (modul-szerződés 1.).
 */
const ACCESSORY_LENGTH_CEILING_CM = 240;

/**
 * A DESZKA-MEZŐK LESZEDÉSE a kiegészítő-jelöltről — a figyelő
 * `stripBoardOnlySpecs`-ének párja a jóváhagyási ágon.
 *
 * ÉLESBEN MÉRT HIBA (zraysports.com, 2026-09-06): a pumpa-oldalakon nincs
 * saját spec-blokk, a „Related Products" viszont deszkákat sorol fel, és a
 * szöveg-parse onnan szedte a méretet — 13' = 396,2 cm. A besorolás helyesen
 * mondta kiegészítőnek, a hamis méret mégis bekerült a `boards.length_cm`-be:
 * a moderátor egy 396 cm „hosszú" pumpa-adaptert hagyott jóvá.
 *
 * A jelölt `extracted` mezője a CRAWL IDEJÉN fagy be, ezért a figyelő-oldali
 * javítás a MÁR SORBAN ÁLLÓ jelölteken nem segít — ez itt az utolsó kapu.
 *
 * A vágás kétszintű, mert a kiegészítőnek IS van valódi mérete (Jobe
 * `SUP Pump 12V`: 29,5 × 13,5 × 16 cm — jó adat): a térfogat és a teherbírás
 * deszka-fogalom, ezért mindig kiesik; a méret-hármas csak akkor, ha bármelyik
 * tagja eléri a deszka-alsóhatárt — ekkora érték csak deszkából szivároghatott
 * át, és mindhárom tag ugyanabból a félreolvasott hármasból jön.
 */
export function stripBoardOnlySpecs(specs: ExtractedBoardSpecs): ExtractedBoardSpecs {
  const leaked = [specs.lengthCm, specs.widthCm, specs.thicknessCm].some(
    (value) => value !== null && value >= ACCESSORY_LENGTH_CEILING_CM,
  );
  return {
    ...specs,
    volumeL: null,
    maxLoadKg: null,
    lengthCm: leaked ? null : specs.lengthCm,
    widthCm: leaked ? null : specs.widthCm,
    thicknessCm: leaked ? null : specs.thicknessCm,
  };
}
