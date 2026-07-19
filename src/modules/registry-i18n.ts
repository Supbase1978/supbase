/**
 * Modul-i18n regiszter — az EGYETLEN hely, ahol új modul fordítás-namespace-ét
 * be kell kötni (a registry.ts párja). Azért külön fájl, mert a registry.ts-t
 * a RR7 config-loader (vite-node) is behúzza, ahol a manifeszteknek
 * mellékhatás-mentesnek kell maradniuk — a namespace-regisztráció viszont
 * import-mellékhatás (JSON-betöltés), ezért itt él, és az app/root.tsx
 * importálja (bundle-kontextus, tsconfig-alias él).
 */
import "./weather/i18n";
import "./spots/i18n";
