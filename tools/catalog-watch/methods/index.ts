/**
 * KATEGÓRIA-KINYERÉSI MÓDSZEREK, névvel (F2.1-utó-45, 2026-08-22).
 *
 * MIÉRT VAN EZ A POLC — a felhasználó megfogalmazásában:
 *
 *   „gyártónként külön kezeljük és építsük fel ezt a rendszert, mert
 *    univerzálisat nem lehet létrehozni… Minden gyártónak egyedi megoldásai
 *    vannak és azokhoz kell alkalmazkodni."
 *
 * A bizonyíték a saját adatunk: a kategóriát HÉT gyártónál HÉT különböző úton
 * mondja ki a forrás —
 *
 *   Gladiator  → külön JS-taxonómia, böngészővel kiolvasva  (`pinnedUrl`)
 *   Zray       → ugyanez, más alakban; az új modelleknél JS-morzsamenü
 *   Fanatic    → termékfejléc-felirat, `ALL-AROUND / WINDSURF` (`categoryLine`)
 *   Aqua Marina→ négy pontozott használat-sáv                (`usageBars`)
 *   Starboard  → Shopify-kollekció + marketing-próza
 *   Jobe       → KIZÁRÓLAG a prózában („for both … and …")   (`multiUseProse`)
 *   bolti forrás → sehol; a katalógusból öröklődik           (`familyInherit`)
 *
 * — és eddig mind a hét EGYETLEN, mindenkire lefutó láncban élt. Működött, de
 * a hamis pozitív MINDENKIT érintett: a `prose` a Jobe-nál kell, a Fanaticnál
 * viszont tévedett („choppy waters or rivers" → vadvízi deszka).
 *
 * MOSTANTÓL a recept választ (`crawl_config.categoryMethods`), és a
 * `probe-methods` parancs végigpróbálja mindet egy új gyártón.
 *
 * A LISTA HIÁNYA = MINDEN MÓDSZER, a mai sorrendben. Ez teszi a bevezetést
 * kockázatmentessé: amíg egy recept nem sorol fel semmit, a forrás viselkedése
 * változatlan — és ezt a fixtúra-háló bizonyítja.
 */
import type { BoardType } from "../types.ts";

/** Amit egy módszer a döntéshez megkaphat. Minden mező opcionális lehet. */
export interface MethodContext {
  /** A termékoldal nyers HTML-je (üres, ha a forrás Shopify-JSON-ból jön). */
  html: string;
  /** Az oldal látható szövege — renderelés után, ha volt. */
  pageText: string;
  /** A `<title>`-ből tisztított modellnév. */
  rawTitle: string;
  sourceUrl: string;
  /** A gyártó saját kategória-feliratát viselő elem osztályneve, ha van. */
  categoryClass?: string;
  /** Moderátori rögzítések: URL-részlet → típus. */
  boardTypeByUrl: Readonly<Record<string, BoardType>>;
  /** A JSON-LD `description` mezője, ha a forrás ad ilyet. */
  description: string;
}

export interface MethodResult {
  types: BoardType[];
  /**
   * A KIVÁLTÓ szövegrészlet — ezt látja a moderátor és a `probe-methods`.
   * Enélkül a találat ellenőrizhetetlen állítás lenne.
   */
  evidence: string | null;
}

export interface CategoryMethod {
  /** Stabil név: ez kerül a receptbe ÉS a jelölt `boardTypeSource` mezőjébe. */
  name: string;
  /** Egy mondat: MIT próbál, és miért szokott működni. */
  describe: string;
  run(ctx: MethodContext): MethodResult;
}

/** Üres eredmény — a „nem találtam" egyértelmű alakja. */
export const NO_MATCH: MethodResult = { types: [], evidence: null };
