/**
 * catalog-watch — GYÁRTÓI RECEPTEK (F2.1-utó-36, 2026-08-21).
 *
 * MIÉRT VAN EZ A KÖNYVTÁR: a forrás-beállítások (melyik sitemap, milyen
 * URL-minta, cím-vágás, kategória-osztály, rögzített besorolások) korábban
 * KIZÁRÓLAG az adatbázisban éltek. Nem voltak átnézhetők, nem voltak
 * verziózva, és egy adatbázis-újraépítésnél a 9 forrás beállítása elveszett
 * volna — pedig mindegyik mögött egy-egy MÉRÉS áll.
 *
 * Mostantól a repó az autoritás, és a `sync-sources` parancs írja az
 * adatbázisba. A fájlok fejlécében ott a MIÉRT is: melyik beállítás milyen
 * élesben mért viselkedés miatt kell.
 *
 * A SZABÁLYOK NEM ITT VANNAK. A kinyerés logikája (mértékegységek, címke-
 * felismerés, kép-horgony) KÖZÖS marad a `normalize.ts`-ben: az a réteg
 * bizonyítottan kamatozik — a Gladiatorért írt „mértékegység a címkében"
 * szabály oldotta meg a Fanatic `VOLUME (L)`-jét is, mielőtt ránéztünk volna.
 * Ide csak az kerül, ami TÉNYLEG a forrásé.
 */
import type { CrawlConfig, SourceKind } from "../types.ts";

export interface SourceRecipe {
  /** A `catalog_sources.name` — ez azonosítja a sort az adatbázisban. */
  name: string;
  baseUrl: string;
  kind: SourceKind;
  country: string;
  crawlConfig: CrawlConfig;
}

import { recipe as aquaMarina } from "./aqua-marina.ts";
import { recipe as aquaMarinaHungary } from "./aqua-marina-hungary.ts";
import { recipe as aqualing } from "./aqualing.ts";
import { recipe as aquatone } from "./aquatone.ts";
import { recipe as bestway } from "./bestway.ts";
import { recipe as bluefin } from "./bluefin.ts";
import { recipe as bote } from "./bote.ts";
import { recipe as decathlon } from "./decathlon.ts";
import { recipe as fanatic } from "./fanatic.ts";
import { recipe as funwater } from "./funwater.ts";
import { recipe as gladiator } from "./gladiator.ts";
import { recipe as indiana } from "./indiana.ts";
import { recipe as isle } from "./isle.ts";
import { recipe as jobe } from "./jobe.ts";
import { recipe as redPaddle } from "./red-paddle.ts";
import { recipe as rocOutdoors } from "./roc-outdoors.ts";
import { recipe as starboard } from "./starboard.ts";
import { recipe as supDeszka } from "./sup-deszka.ts";
import { recipe as uone } from "./uone.ts";
import { recipe as zray } from "./zray.ts";

/** Minden recept. Új forrás = új fájl + egy sor ide. */
export const SOURCE_RECIPES: readonly SourceRecipe[] = [
  aquaMarina,
  aquaMarinaHungary,
  aqualing,
  aquatone,
  bestway,
  bluefin,
  bote,
  decathlon,
  fanatic,
  funwater,
  gladiator,
  indiana,
  isle,
  jobe,
  redPaddle,
  rocOutdoors,
  starboard,
  supDeszka,
  uone,
  zray,
];
