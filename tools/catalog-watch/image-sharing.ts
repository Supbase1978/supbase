/**
 * catalog-watch — MEGOSZTOTT KÉPEK kigyomlálása a katalógusból (F2.1-utó-56).
 *
 * A PROBLÉMA, felhasználói észrevételre: „több deszkához ugyanaz a kép nagyon
 * félrevezető". Élesben mérve 273 deszkából 130 osztott legalább egy képet egy
 * másikkal.
 *
 * A MÉRÉS VISZONT KÉTFÉLE ESETET TALÁLT, és csak az egyik a mi hibánk:
 *
 *  * **157 megosztás a MODELLCSALÁDON BELÜL marad** — a Starboard Whopper
 *    11'0" és 9'0" ugyanazt a „Blue Carbon" stúdiófotót viseli. Ez nem a
 *    kinyerés hibája: a gyártó SAJÁT variáns-képe is ez, mert KIVITELENKÉNT
 *    fotóz, nem méretenként. Ilyen fotó egyszerűen nem létezik, és a kivágás
 *    csak kevesebb képet adna, nem pontosabbat.
 *  * **5 megosztás CSALÁDHATÁRT lép át** — és mind az öt valóban hibás: egy
 *    All Star fotója a Sprinten, egy közös marketing-GIF három BOTE-modellen,
 *    továbbá egy leash- és egy uszony-fotó két ISLE-deszkán.
 *
 * A szabály ezért: **a családhatáron átnyúló megosztás kiesik**, a családon
 * belüli marad. Ez pontosan azt vágja ki, ami félrevezet, és nem szegényíti a
 * katalógust ott, ahol a gyártó maga sem ad többet.
 *
 * A CSALÁD a márka + a modellnév ELSŐ SZAVA. Ez heurisztika, de a mérés
 * szerint jól vág: „LowRider Aero Tandem" és „LowRider Aero" egy család,
 * „EasyRider Aero" nem; a „Whopper 11'0" X 36" Blue Carbon" és a
 * „Whopper 9'0" X 33" Starlite" egy család, a „Sprint" és az „All Star" nem.
 *
 * KIVÉTEL: ha a FÁJLNÉV megmondja, kié a kép (pontosan EGY érintett család
 * neve szerepel benne), ott MARAD. Az `…-All-star-3.jpg` az All Staré, hiába
 * szerepel a Sprint galériájában is — kár lenne mindkettőről levenni.
 *
 * A BORÍTÓHOZ NEM NYÚLUNK. Élesben mérve: ha a megosztott borítókat is
 * kivágnánk, 73 deszka maradna kép NÉLKÜL — az rosszabb, mint egy
 * családon belül ismétlődő fotó. A borító a rácsban az egyetlen vizuális
 * fogódzó.
 *
 * TISZTA modul: se hálózat, se adatbázis. A hívó adja a sorokat, és a
 * változtatások tervét kapja vissza.
 */

import { imageIdentity } from "./images.ts";

/** Egy katalógus-sor, amennyit a döntéshez ismerni kell. */
export interface BoardImages {
  id: string;
  brandName: string | null;
  modelName: string;
  /** A borító — ehhez NEM nyúlunk, csak az azonosság megállapításához kell. */
  imageUrl: string | null;
  /** A galéria URL-jei, a sor sorrendjében. */
  gallery: readonly string[];
}

/** Egy sor terve: mely galéria-URL-ek maradnak, és mi esik ki, miért. */
export interface ImagePruneAction {
  boardId: string;
  modelName: string;
  keep: string[];
  removed: { url: string; sharedWith: string[] }[];
}

/**
 * A kép AZONOSSÁGA — UGYANAZ a függvény, amit a galéria-összeállítás használ
 * (`images.ts`). A két helyen ugyanazt kell jelentenie, különben a gyomlálás
 * mást látna, mint a gyűjtés; ezért van EGY definíció.
 */

export { imageIdentity as imagePathIdentity };

/** Ékezet- és írásjel-független alak az összevetéshez. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** A modellcsalád kulcsa: márka + a modellnév első szava. */
export function familyKey(brandName: string | null, modelName: string): string {
  const first = fold(modelName).split(" ")[0] ?? "";
  return `${fold(brandName ?? "")}|${first}`;
}

/**
 * Mit vágjunk ki. Csak azokat a sorokat adja vissza, ahol TÉNYLEGESEN változik
 * valami — így a hívó dry-runja pontosan azt mutatja, amit írna.
 */
export function planImagePruning(
  boards: readonly BoardImages[],
): ImagePruneAction[] {
  // kép → az őt viselő családok és a deszkanevek
  const families = new Map<string, Set<string>>();
  const names = new Map<string, Set<string>>();
  for (const board of boards) {
    const key = familyKey(board.brandName, board.modelName);
    const urls = new Set(
      [...(board.imageUrl === null ? [] : [board.imageUrl]), ...board.gallery].map(
        imageIdentity,
      ),
    );
    for (const url of urls) {
      const family = families.get(url) ?? new Set<string>();
      family.add(key);
      families.set(url, family);
      const name = names.get(url) ?? new Set<string>();
      name.add(board.modelName);
      names.set(url, name);
    }
  }

  // A FÁJLNÉV NÉHA MEGMONDJA, kié a kép. Az
  // `Starboard-SUP-Inflatable-All-star-3.jpg` az All Staré, hiába szerepel a
  // Sprint galériájában is — ilyenkor kár lenne mindkettőről levenni. Csak
  // akkor él, ha PONTOSAN EGY család neve szerepel a fájlnévben.
  const attributedTo = new Map<string, string>();
  for (const [url, owners] of families) {
    if (owners.size <= 1) continue;
    const file = fold(url.split("/").pop() ?? "");
    const named = [...owners].filter((owner) => {
      const word = owner.split("|")[1] ?? "";
      return word.length > 2 && file.includes(word);
    });
    if (named.length === 1 && named[0] !== undefined) attributedTo.set(url, named[0]);
  }

  const actions: ImagePruneAction[] = [];
  for (const board of boards) {
    const key = familyKey(board.brandName, board.modelName);
    const keep: string[] = [];
    const removed: { url: string; sharedWith: string[] }[] = [];
    for (const url of board.gallery) {
      const identity = imageIdentity(url);
      const owners = families.get(identity) ?? new Set([key]);
      if (owners.size <= 1 || attributedTo.get(identity) === key) {
        keep.push(url);
        continue;
      }
      removed.push({
        url,
        sharedWith: [...(names.get(identity) ?? [])].filter(
          (name) => name !== board.modelName,
        ),
      });
    }
    if (removed.length > 0) {
      actions.push({ boardId: board.id, modelName: board.modelName, keep, removed });
    }
  }
  return actions;
}
