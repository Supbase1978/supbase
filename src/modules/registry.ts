import type { ModuleManifest } from "@core/module-contract";

/**
 * Modul-regiszter — az EGYETLEN hely, ahol új modult regisztrálni kell.
 * A modulok az F1.1–F1.9 lépésekben kerülnek ide:
 * advisor · catalog · reviews · spots · weather · providers · profile · admin
 */
export const modules: readonly ModuleManifest[] = [];
