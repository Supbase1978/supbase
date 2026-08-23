---
name: biztonsagi-ellenorzes
description: Biztonsági ellenőrzés a SUP Platformon — Semgrep (SAST), Snyk (függőség + SAST) és TypeScript egy menetben. Akkor használd, ha a felhasználó "security checket" kér, fázist zársz, vagy piros CI-t vizsgálsz. Tartalmazza a findingok nyilvántartásba vételének módját és az élesben mért csapdákat.
---

# Biztonsági ellenőrzés

## A három láb

Ez a három eszköz együtt adja az ellenőrzést — egyik sem helyettesíti a másikat.

```bash
# 1. SEMGREP (SAST) — pontosan a CI konfigjával, hogy az eredmény összevethető legyen
semgrep scan --error --metrics=off \
  --config=p/typescript --config=p/react \
  --config=p/secrets --config=p/owasp-top-ten \
  --config=p/sql-injection \
  --exclude=node_modules --exclude=build --exclude=.react-router

# 3. TYPESCRIPT
npm run typecheck
```

**2. SNYK** — MCP-eszközökkel, nem CLI-vel:

| Lépés | Eszköz |
|---|---|
| hitelesítés (böngészőt nyit) | `mcp__Snyk__snyk_auth` |
| TERMELÉSI függőségek | `snyk_sca_scan` — `severity_threshold: "high"` |
| FEJLESZTŐI fa is | `snyk_sca_scan` — `dev: true` |
| SAST | `snyk_code_scan` |

A `path` mindig **abszolút**.

## A findingok NYILVÁNTARTÁSBA kerülnek

`docs/SECURITY_FINDINGS.md` — minden tétel egy szakasz, a címben a **státusz**:
`JAVÍTVA` · `ELFOGADOTT KOCKÁZAT` · `FALSE POSITIVE` · `NYITOTT` · `LEZÁRVA`.

Az elfogadott kockázat CSAK indoklással érvényes, és a szakasznak tartalmaznia
kell azt is, **mi váltja ki az újraértékelést**. Élesben mért példa: az
`F1.10-01` azért volt elfogadott, mert „nincs javítás a 7.x ágon" — közben
megjelent a 7.18.2, és az indoklás elavult. **Az elfogadás nem örök állapot.**

## Csapdák, mind élesben mérve

**A `--dev` és a nélküle futtatott vizsgálat MÁS képet ad.** A termelési fán 0
HIGH/CRITICAL, a fejlesztőin 1 kritikus + 5 magas. Mindkettőt futtasd, és a
jelentésben KÜLÖN mondd meg, melyik melyik — különben a „14 sebezhetőség"
riasztóbban hangzik, mint amennyire indokolt.

**A Snyk és az `npm audit` MÁS súlyosságot adhat ugyanarra.** A react-router
CSRF az `npm audit` szerint high, a Snyk szerint medium. Ha csak az egyikre
támaszkodsz, vagy pánikolsz, vagy elnézed.

**RLS-próbánál NEM LÉTEZŐ sorra írni értelmetlen.** Egy `update ... eq("id",
"0000…")` 0 sorra fut, és SIKERREL tér vissza akkor is, ha az RLS egyébként
tiltana — ebből lett egy hamis „anonim írás sikerült" riasztás. Valós soron
mérj, a mostani értékére visszaírva (így semmi nem változik), és a
`.select()` visszaadott sorait nézd.

**A lokális eszközök találatai nem automatikusan valódiak.** A
`scripts/serve-build.mjs` három medium találata (HTTP, format string, ráta-
korlát) azért elfogadható, mert a szkript CSAK a Playwright perf-mérését
szolgálja ki a localhoston. Mielőtt „javítanál", nézd meg, HOL fut a kód.

## Amit a Semgrep élesben megfogott

A `${{ inputs.* }}` interpoláció egy workflow `run:` blokkjában. A `run:` a
runner shelljében fut, a workflow-bemenet pedig szabad szöveg lehet — így a
`SUPABASE_SERVICE_ROLE_KEY` kiszivárogtatható lett volna. A javítás: köztes
`env:` változó, idézőjelezett használat, és a számot váró bemenet
**szám-ellenőrzése**.

Ha új workflow-t írsz, ez az első, amit a Semgrep meg fog találni.
