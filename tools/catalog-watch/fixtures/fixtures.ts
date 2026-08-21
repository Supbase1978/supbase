/**
 * GYÁRTÓNKÉNTI REGRESSZIÓ-HÁLÓ — a fixtúrák betöltése (F2.1-utó-36).
 *
 * MIÉRT: a mai napon ~15-ször KÉZZEL ellenőriztem, hogy egy általános javítás
 * nem rontott-e el egy másik gyártót. Ez volt a legdrágább kézi művelet — és
 * pont ez automatizálható. Egy mentett valós oldal + a VÁRT kinyerés
 * másodpercek alatt, hálózat nélkül megmondja, hogy egy új szabály elrontott-e
 * bármelyik meglévő forrást.
 *
 * MIÉRT A TELJES OLDAL, ÉS NEM EGY SZELET: a tervben még oldal-SZELET
 * szerepelt (méret miatt), de a szeletet kézzel kellene kivágni — és a kézi
 * vágás pont azt a zajt tüntetné el, amit a kinyerőnek túl kell élnie. A
 * „Related Products" blokk elszívása (152 kg a valós 170 helyett) épp ilyen
 * zajban bújt meg; egy megtisztított fixtúra ezt SOHA nem fogta volna meg.
 * Ezért az oldal teljes egészében megmarad, GZIP-elve — a Fanatic 524 kB-os
 * oldala így ~40 kB.
 *
 * A fixtúra NEM pillanatkép a gyártóról: nem az a dolga, hogy kövesse az élő
 * oldalt, hanem hogy A MI KINYERŐNK viselkedését rögzítse egy ismert bemeneten.
 */
import { gunzipSync } from "node:zlib";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtractedProduct } from "../types.ts";

const FIXTURE_ROOT = dirname(fileURLToPath(import.meta.url));

/** Egy fixtúra leírója (a `<slug>.json` tartalma). */
export interface FixtureCase {
  /** A `catalog_sources.name` — ezzel talál rá a receptre. */
  source: string;
  /** A mentett termékoldal URL-je. */
  url: string;
  /** Mikor mentettük (dokumentáció; a teszt nem használja). */
  capturedAt: string;
  /**
   * Mit tanít ez a fixtúra — EMBERI mondat. Ha egy teszt elbukik, ez mondja
   * meg, mi veszett el; enélkül a hiba csak egy szám-eltérés lenne.
   */
  teaches: string;
  /** Kellett-e böngésző-renderelés (ilyenkor van `<slug>.txt.gz` is). */
  rendered: boolean;
  /** A VÁRT kinyerés — a `sources.test.ts` ehhez hasonlít. */
  expected: ExtractedProduct[];
}

export interface LoadedFixture extends FixtureCase {
  /** `<gyártó>/<slug>` — a teszt neve. */
  id: string;
  html: string;
  /** A renderelt oldalszöveg, ha a forrás rendereléses. */
  renderedText: string | null;
}

/** Minden fixtúra, gyártó-mappánként. */
export function loadFixtures(): LoadedFixture[] {
  const out: LoadedFixture[] = [];
  for (const brand of readdirSync(FIXTURE_ROOT, { withFileTypes: true })) {
    if (!brand.isDirectory()) continue;
    const dir = join(FIXTURE_ROOT, brand.name);
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const slug = file.slice(0, -".json".length);
      const kase = JSON.parse(readFileSync(join(dir, file), "utf8")) as FixtureCase;
      const textPath = join(dir, `${slug}.txt.gz`);
      out.push({
        ...kase,
        id: `${brand.name}/${slug}`,
        html: gunzipSync(readFileSync(join(dir, `${slug}.html.gz`))).toString("utf8"),
        renderedText: existsSync(textPath)
          ? gunzipSync(readFileSync(textPath)).toString("utf8")
          : null,
      });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
