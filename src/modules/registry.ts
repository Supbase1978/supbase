import type { ModuleManifest } from "@core/module-contract";

// Relatív import (nem @modules/*-alias): ezt a fájlt az app/routes.ts a RR7
// config-loader vite-node kontextusában is behúzza, ahol a tsconfig-aliasok nem
// élnek — a manifeszt ezért mellékhatás-mentes és relatívan importált.
import { weatherModule } from "./weather/module";
import { spotsModule } from "./spots/module";
import { catalogModule } from "./catalog/module";
import { reviewsModule } from "./reviews/module";

/**
 * Modul-regiszter — az EGYETLEN hely, ahol új modult regisztrálni kell.
 * A modulok az F1.1–F1.9 lépésekben kerülnek ide:
 * advisor · catalog · reviews · spots · weather · providers · profile · admin
 */
export const modules: readonly ModuleManifest[] = [
  weatherModule,
  spotsModule,
  catalogModule,
  reviewsModule,
];
