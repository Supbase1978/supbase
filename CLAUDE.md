# SUP Platform — CLAUDE.md

**Elsődleges specifikáció: [`SUP_PLATFORM_FEJLESZTESI_DOKUMENTACIO.md`](./SUP_PLATFORM_FEJLESZTESI_DOKUMENTACIO.md).**
Minden architekturális és designdöntés ott van rögzítve; eltérés csak indoklással, a dokumentum frissítésével együtt. Fejlesztési állapot: `docs/PROGRESS.md`.

## Modul-szerződés (sérthetetlen — 1.3 fejezet)

1. Egy modul csak a `src/core`-tól és a saját könyvtárától függhet. **Modul→modul import tilos** (ESLint `import/no-restricted-paths` kényszeríti ki); közös igény a core-ba kerül.
2. Minden modul `module.ts` manifesztet exportál (`@core/module-contract` típussal), és a `src/modules/registry.ts`-ben regisztrálódik. Új modul = új mappa + regisztráció, máshoz nyúlni nem kell.
3. Minden modul saját SQL-migrációs fájlokban hozza a tábláit; közös táblákhoz (profiles) csak core-migráció nyúlhat.

## Biztonsági tokenek érinthetetlenek (2. fejezet)

- A `src/core/ui/tokens.css` „biztonsági" blokkja (`--safe*`, `--caution*`, `--danger*`, `--stale`) **FIX, módosítani tilos** — importált design-kód sem írhatja felül.
- Státusz mindig **szín + ikon + szöveg** hármasban, soha nem csak színnel.
- `--danger` család interakciós elemen (gomb, link) tilos; amber CTA-n mindig sötét (`--text`) felirat.
- Adatkor-szabály: 30 percnél régebbi időjárás/vízadat = „Elavult adat" state; cache-elt viharjelzés SOHA nem jelenhet meg aktuálisként.

## Kapu-szabály

**Piros CI-val nincs merge — a subagentek sem kerülhetik meg.** Kapuk: `npm run typecheck` · `npm run lint` · `npm test` (később: RLS-tesztek, Playwright e2e, Semgrep/Snyk, axe).

**TypeScript-hibát hagyni tilos: minden feladat `tsc --noEmit` zölddel zárul** (a `npm run typecheck` előbb `react-router typegen`-t futtat).

## Subagent-kiosztás (11.2 fejezet)

| Agent | Modell | Feladat |
|---|---|---|
| `scaffolder` | sonnet | boilerplate, route-váz, komponens-váz, i18n-kulcsok |
| `ui-builder` | sonnet | komponensek a tokenekből, Tailwind, reszponzív |
| `db-engineer` | opus | SQL-migrációk, RLS-policyk, PostGIS + RLS-tesztek |
| `algo-engineer` | opus | SUP-index, Deszkaválasztó + unit-tesztek |
| `auth-security` | opus | auth-folyamatok, Turnstile, session/SSR, GDPR |
| `test-runner` | sonnet | Playwright e2e, axe-a11y |
| `security-auditor` | opus | Semgrep + Snyk, finding-triage |
| `reviewer` | opus | PR-review: modul-szerződés, típusok, RLS-lefedettség (csak olvas) |

## Praktikus

- Útvonal-aliasok: `~/*` → `app/*`, `@core/*` → `src/core/*`, `@modules/*` → `src/modules/*`.
- `_design-source/` = Claude Design export, **csak olvasható referencia** (gitignore-olt); komponens onnan nem másolható át, a `core/ui`-ban épül újra.
- Fordítható tartalmi mező mindig `jsonb` (`{"hu": ..., "en": ...}`); UI-szöveg i18next namespace-ből, hardcode tilos.
- **Supabase CLI: CSAK a wrapperrel** — `npm run sb -- <parancs>` (vagy `scripts/sb.sh`). Nyers `supabase` parancs TILOS: a gép shell-profilja (`~/.zshrc`) egy RÉGI fiók `SUPABASE_ACCESS_TOKEN`-jét exportálja globálisan, ezért wrapper nélkül a CLI a rossz fiókban (7 idegen projekt) landol. A wrapper a `.env`-beli tokent kényszeríti (projekt: „Supbase", ref `pycsqnthxaytwaptbiph`). Ha a CLI váratlanul más projekteket lát: először az env-árnyékolásra gyanakodj, ne a tokenre.
