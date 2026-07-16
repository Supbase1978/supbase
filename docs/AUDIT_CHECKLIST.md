# SUP Platform — Fázis-záró audit-checklista (v1, 2026-07-17)

> A karmester (Fable 5, hiányában Opus 4.8) minden fázis végén ezt futtatja
> végig (FEJLESZTESI_DOKUMENTACIO 11.3/4). Az eredmény a PROGRESS.md-be kerül.

## 1. Modul-szerződés
- [ ] Nincs modul→modul import (ESLint `import/no-restricted-paths` zöld, kézi szúrópróba)
- [ ] Core nem függ modultól / app-rétegtől
- [ ] Minden új modul: `module.ts` manifest + registry-regisztráció
- [ ] `app/routes` vékony maradt (csak komponál)

## 2. RLS-lefedettségi mátrix
- [ ] Minden tábla RLS-sel; tábla × szerep (anon/user/moderator/admin) mátrix kitöltve
- [ ] Minden policy-hoz futó teszt a CI-ban
- [ ] Write-path: e-mail-megerősítés-gate érvényes
- [ ] `verified_owner` / `status` user-oldali írás ellen védett

## 3. Biztonság
- [ ] security-auditor riport: nincs nyitott HIGH/CRITICAL (Semgrep + Snyk)
- [ ] Nincs kliensre szivárgó secret / service key
- [ ] Edge Functionök auth-védettek (verify_jwt vagy explicit indoklás)

## 4. Tesztkapuk
- [ ] `npm run typecheck` zöld (strict + noUncheckedIndexedAccess)
- [ ] `npm run lint` zöld
- [ ] `npm test` zöld (algoritmus-határesetek táblázatosan lefedve)
- [ ] Playwright e2e zöld a kritikus utakon
- [ ] Vizuális regresszió: waterline / vízmérce / riasztás screenshot-egyezés

## 5. Design- és a11y-kapuk
- [ ] Biztonsági tokenek érintetlenek (tokens.css diff-ellenőrzés)
- [ ] Státusz mindenhol szín + ikon + szöveg
- [ ] `--danger` interakciós elemen nem fordul elő
- [ ] axe-core AA zöld a kulcsképernyőkön; új szín-párosítás csak AA fölött
- [ ] Adatkor-szabály: >30 perc → stale-state; cache-elt viharjelzés nem aktuális

## 6. Teljesítmény + SEO
- [ ] LCP < 2,5 s a kulcsoldalakon (Lighthouse/CI budget)
- [ ] SSR-oldalak: meta + hreflang + JSON-LD validál
- [ ] sitemap/canonical/OG generálás fut (F1.8-tól)

## 7. Dokumentáció
- [ ] PROGRESS.md frissítve (fázis-összefoglaló + következő lépés jegyzetei)
- [ ] Eltérés a FEJLESZTESI_DOKUMENTACIO-tól? → doku frissítve indoklással
