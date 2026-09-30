/**
 * Kezdőlap csempe-adat — a `nav.tsx` `primaryNav`-mintáját követi (1.3
 * modul-szerződés): a csempék a registry-ből épülnek, új modul + `tile` =
 * új csempe, ehhez a fájlhoz és a `home.tsx`-hez nem kell nyúlni.
 *
 * Csak azok a `primary` nav-bejegyzések kerülnek be, amelyek `tile`-t is
 * adnak — az advisor (Deszkaválasztó) SZÁNDÉKOSAN nem ad, azt a hero
 * képviseli a kezdőlapon (lásd `module-contract.ts` kommentje).
 */
import type { ModuleManifest, ModuleNavEntry, TileIcon } from "@core/module-contract";

export interface HomeTileEntry {
  labelKey: string;
  path: string;
  namespace: string;
  descriptionKey: string;
  icon: TileIcon;
}

type NavEntryWithTile = ModuleNavEntry & { tile: NonNullable<ModuleNavEntry["tile"]> };

function hasTile(entry: ModuleNavEntry): entry is NavEntryWithTile {
  return entry.placement === "primary" && entry.tile !== undefined;
}

interface HomeTileEntryWithOrder extends HomeTileEntry {
  order: number;
}

/** A kezdőlap csemperácsának bejegyzései, `order` szerint rendezve. */
export function buildHomeTiles(modules: readonly ModuleManifest[]): HomeTileEntry[] {
  const withOrder: HomeTileEntryWithOrder[] = modules.flatMap((mod) =>
    mod.nav.filter(hasTile).map((entry) => ({
      order: entry.order,
      labelKey: entry.labelKey,
      path: entry.path,
      namespace: mod.i18nNamespace,
      descriptionKey: entry.tile.descriptionKey,
      icon: entry.tile.icon,
    })),
  );

  return withOrder
    .sort((a, b) => a.order - b.order)
    .map(({ labelKey, path, namespace, descriptionKey, icon }) => ({
      labelKey,
      path,
      namespace,
      descriptionKey,
      icon,
    }));
}
