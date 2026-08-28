/**
 * A MÓDSZER-KATALÓGUS: a mai lánc darabjai, névvel és bizonyítékkal.
 *
 * A logika NEM íródott újra — mindegyik módszer ugyanazt a függvényt hívja,
 * ami eddig is futott. Ami új: a NÉV, a BIZONYÍTÉK, és hogy a recept
 * választhat közülük.
 *
 * A SORREND itt a mai elsőbbségi sorrend (`resolveBoardType`), tehát lista
 * nélkül minden forrás viselkedése változatlan.
 */
import {
  boardTypeFromDescription,
  boardTypeFromUsage,
  boardTypesFromCategoryLine,
} from "../usage-rating.ts";
import type { BoardType } from "../types.ts";
import {
  NO_MATCH,
  type CategoryMethod,
  type MethodContext,
  type MethodResult,
} from "./index.ts";

/**
 * A modul-körkörösség elkerülésére a `normalize.ts` adja be azokat a
 * függvényeit, amiket ő maga is használ (az importálja EZT a modult).
 * Ugyanaz a minta, mint a `usage-rating.ts` helyi hajtásánál.
 */
export interface NormalizeHelpers {
  guessBoardType(text: string): BoardType | null;
  breadcrumbText(html: string): string;
  elementTextByClass(html: string, className?: string): string;
  urlCategoryHint(url: string): string;
  multiUseFromProse(text: string): BoardType[];
  matchPinnedType(url: string, pins: Readonly<Record<string, BoardType>>): BoardType | null;
  /** A gyártó SAJÁT használat-mezője a spec-táblából (`Versatility: …`). */
  labelledUseText(text: string): string;
}

/** Rövid, olvasható bizonyíték-részlet a moderátornak és a probe-nak. */
function snippet(text: string, max = 120): string | null {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean === "" ? null : clean.slice(0, max);
}

function one(type: BoardType | null, evidence: string | null): MethodResult {
  return type === null ? NO_MATCH : { types: [type], evidence };
}

export function buildCategoryMethods(helpers: NormalizeHelpers): CategoryMethod[] {
  return [
    {
      name: "pinnedUrl",
      describe: `MODERÁTORI RÖGZÍTÉS URL-részlet szerint — a gyártó saját
        taxonómia-oldaláról kiolvasva (Gladiator, Zray). A legerősebb jel:
        emberi döntés, nem következtetés.`,
      run: (ctx: MethodContext) => {
        const type = helpers.matchPinnedType(ctx.sourceUrl, ctx.boardTypeByUrl);
        return one(type, type === null ? null : ctx.sourceUrl);
      },
    },
    {
      name: "labeledUse",
      describe: `A gyártó SAJÁT HASZNÁLAT-MEZŐJE a spec-táblából (FunWater:
        „Versatility: All-around, ideal for cruising, exploring, and yoga").
        Címkézett mező, tehát ÁLLÍTÁS, nem következtetés — ezért áll a
        névből/URL-ből tippelő módszerek ELŐTT. Élesben ez javította az „Island
        Explorer" nevű ALL-ROUND deszkát, amit a név alapján túrásnak vettünk.`,
      run: (ctx) => {
        const line = helpers.labelledUseText(ctx.pageText);
        const types = boardTypesFromCategoryLine(line);
        return types.length === 0 ? NO_MATCH : { types, evidence: snippet(line) };
      },
    },
    {
      name: "nameAndUrl",
      describe: `A MODELLNÉV és az URL kategória-szegmense. Ott a kategória-szó
        maga a besorolás (/products/all-around/), ezért a laza kulcsszó-lista is elég.`,
      run: (ctx) => {
        const hint = helpers.urlCategoryHint(ctx.sourceUrl);
        const type = helpers.guessBoardType(`${ctx.rawTitle} ${hint}`);
        return one(type, type === null ? null : snippet(`${ctx.rawTitle} ${hint}`));
      },
    },
    {
      name: "categoryLine",
      describe: `A gyártó SAJÁT kategória-felirata a termékfejlécben (Fanatic:
        ALL-AROUND / WINDSURF). A felirat MINDEN tagja számít, a sorrendje a gyártóé.`,
      run: (ctx) => {
        const line = helpers.elementTextByClass(ctx.html, ctx.categoryClass);
        const types = boardTypesFromCategoryLine(line);
        return types.length === 0 ? NO_MATCH : { types, evidence: snippet(line) };
      },
    },
    {
      name: "breadcrumb",
      describe: `A MORZSAMENÜ (Zray: HOME › ALL AROUND › X-RIDER). Azért szabad,
        amiért a teljes oldalszöveg nem: a navigáció MINDEN kategóriát felsorol,
        a morzsamenü pontosan egyet — azt, ahová EZ a termék tartozik.`,
      run: (ctx) => {
        const crumb = helpers.breadcrumbText(ctx.html);
        const type = helpers.guessBoardType(crumb);
        return one(type, type === null ? null : snippet(crumb));
      },
    },
    {
      name: "usageBars",
      describe: `A gyártó pontozott HASZNÁLAT-SÁVJAI (Aqua Marina: ALL-AROUND 100%,
        GUIDE 60%, SURF 70%, RACE 30%). Nem szöveg, hanem a gyártó saját profilja.`,
      run: (ctx) => {
        const usage = boardTypeFromUsage(ctx.html);
        // A `surf` NEM a mi taxonómiánk (felhasználói döntés, 2026-08-19: „a
        // surf egy teljesen más dolog"). A hívó ág ilyenkor el is dobja a
        // terméket — ez a módszer csak annyit mond, hogy nincs találata.
        if (usage === null || usage === "surf") return NO_MATCH;
        return one(usage, "használat-sávok");
      },
    },
    {
      name: "prose",
      describe: `A gyártó LEÍRÁSA, FŐNEVET is megkövetelve (a versatile MODEL from
        the entry-level series). EGY kategóriát ad; ha a szöveg kettőt mond ki,
        a multiUseProse való rá.`,
      run: (ctx) => {
        const type = boardTypeFromDescription(ctx.pageText);
        return one(type, type === null ? null : snippet(ctx.description || ctx.pageText));
      },
    },
    {
      name: "multiUseProse",
      describe: `TÖBBES használat a prózából: két kategória-szó, KÖZÖTTÜK kötőszó,
        rövid mondaton belül (Jobe: Ideal for both all-around paddling and touring).
        CSAK oda való, ahol a gyártó tényleg így fogalmaz — a Fanaticnál tévedett
        (choppy waters or rivers → vadvízi deszka lett volna egy túradeszkából).`,
      run: (ctx) => {
        const types = helpers.multiUseFromProse(ctx.pageText);
        if (types.length === 0) return NO_MATCH;
        // A BIZONYÍTÉK a kiváltó mondat — enélkül a találat ellenőrizhetetlen.
        for (const sentence of ctx.pageText.split(/[.!?]+|\n/)) {
          const trimmed = sentence.trim();
          if (trimmed.length > 8 && helpers.multiUseFromProse(trimmed).length >= 2) {
            return { types, evidence: snippet(trimmed, 160) };
          }
        }
        return { types, evidence: null };
      },
    },
  ];
}
