/**
 * Megjelenítési segédek a Deszkaválasztó eredményéhez.
 *
 * A SUP-deszkákat a piac LÁBBAN nevezi (11'0", 12'6"), a katalógusban viszont
 * cm-ben tároljuk. Az ideális hossz ajánlásánál mindkettőt kiírjuk, különben a
 * szám nem összevethető a boltok kínálatával.
 */

const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;

/**
 * cm → `láb'hüvelyk"` alak (a legközelebbi hüvelykre kerekítve). A 12 hüvelyk
 * túlcsordulást kezeli: 11'12" helyett 12'0".
 */
export function cmToFeetInches(cm: number): string {
  const totalInches = Math.round(cm / CM_PER_INCH);
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = totalInches % INCHES_PER_FOOT;
  return `${feet}'${inches}"`;
}
