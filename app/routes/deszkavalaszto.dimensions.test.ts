/**
 * Őrszem-teszt a modul-szerződés (1.3) egyik tudatos duplikációjához.
 *
 * Az advisor NEM importálhat a reviews-modulból, ezért a vélemény-dimenziók
 * listáját SAJÁT másolatban tartja (`ADVISOR_REVIEW_DIMENSIONS`). A másolat
 * csendben elavulhatna: ha a reviews új szempontot vezet be, a Deszkaválasztó
 * eredmény-kártyája némán lehagyná a Közös nevező bontásából.
 *
 * Ez a teszt a ROUTE-rétegben él, mert kizárólag itt szabad mindkét modulhoz
 * nyúlni — ugyanott, ahol az `agg.perDimension` → kártya-DTO leképezés történik.
 */
import { describe, expect, it } from "vitest";

import { ADVISOR_REVIEW_DIMENSIONS } from "@modules/advisor/select/types";
import { REVIEW_DIMENSIONS } from "@modules/reviews/types";

describe("advisor ↔ reviews dimenzió-lista", () => {
  it("az advisor másolata megegyezik a reviews igazság-forrásával", () => {
    expect([...ADVISOR_REVIEW_DIMENSIONS]).toEqual([...REVIEW_DIMENSIONS]);
  });
});
