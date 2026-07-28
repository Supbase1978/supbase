# SUP Platform — PROGRESS

> Session-átvihetőség: keret-elfogyás vagy compact után a karmester (Fable 5,
> hiányában Opus 4.8) INNEN veszi fel a fonalat. Minden fázis végén frissítendő.

## Állapot-összkép

| Lépés | Állapot | Megjegyzés |
|---|---|---|
| F1.0 Projekt-setup | ✅ kész (2026-07-17) | részletek lent |
| F1.1 Core (auth, i18n, ui-primitívek…) | ✅ kész (2026-07-17) | reviewer-jóváhagyással; részletek lent |
| F1.2 DB (séma + RLS + seed) | ✅ kész (2026-07-18) | reviewer-jóváhagyással; futási verifikáció a CI rls-tests jobban |
| F1.3 Weather + SUP-index | ✅ kész (2026-07-19) | reviewer-jóváhagyva; Edge Functionök deployolva, cron aktív, élesben end-to-end verifikálva |
| F1.4 Spots + térkép | ✅ kész (2026-07-19) | scaffolder+ui-builder+karmester; MapLibre-térkép, adatlap, spot_reports; élesben verifikálva (m5 „Tilos" éles II. fokon) |
| F1.5 Catalog + Reviews | ✅ kész (2026-07-21) | catalog+reviews modulok, deszka-lista/adatlap, „Közös nevező"-blokk RatingBar-okkal (átnevezve: Népítélet→Közös nevező, színkiemelt evező-szójáték), e-mail-gate-elt vélemény+flag flow, admin-moderáció, catalog-watch séma-előkészítés. Vélemény-flow bejelentkezett teszt-fiókkal ÉLESBEN verifikálva (Közös nevező adattal renderel) |
| F1.6 Advisor | ✅ kész (2026-07-21) | algo-engineer (kétrétegű algoritmus) + ui-builder/karmester (wizard + eredmény + route + session-log); wizard end-to-end élesben verifikálva. Admin-moderáció böngészőben VERIFIKÁLVA (2026-07-24, lásd F1.6-szakasz) — az admin-ág teljesen zöld |
| F1.7 Providers | ✅ kész (2026-07-24) | directory-lista + profil + lead-form + saját-listing (claim/regisztráció) + admin-hitelesítő panel; mind az 5 flow böngészőben élesben verifikálva. Részletek lent |
| F1.8 SEO-réteg | ✅ mag kész (2026-07-24) | loader-alapú meta+hreflang, JSON-LD, sitemap+robots, consent (user_consents migráció + regisztrációs checkbox + re-consent), ÁSZF+adatvédelmi. HÁTRA: OG-kép-generálás + persona-landingek (F1.8b) + a consent-migráció éles push. Részletek lent |
| F1.9 Push + viharjelzés | ✅ kész (2026-07-25) | teljes web push-pipeline (VAPID + RFC 8291 natív Web Cryptóval, npm nélkül), storm-alert push-ág, feliratkozó-UI, m4 `observed_at`. Élesítve (5 migráció + secretek + deploy) és **böngészőben végponttól végpontig verifikálva: a viharjelzés-push megérkezett**. Részletek lent |
| F1.11 Folyó-vízállás (5.1/6) | ✅ kész + élesítve (2026-07-27) | vizugy.hu (OVF) REST API, HIVATALOS árvízvédelmi készültségi küszöbökkel; a fix −1 folyó-büntetés helyett fokozat-alapú index-plafon. Élesben verifikálva, cron írja. + F1.11b: póráz-figyelmeztetés folyóvízre |
| F1.12 Analitika (süti-mentes) | ✅ kész + élesítve (2026-07-28) | `analytics_events` + definer-RPC + `/admin/analitika`. Nincs süti/IP/azonosító → nincs egyéni tölcsér, csak darabszám. Robot/DNT/dev nem számol |
| F2.2 Visszajelzés-csatorna | ✅ kód kész (2026-07-28) | `/visszajelzes` (hiba · hiányzó bolt · hiányzó modell) + `/admin/visszajelzesek`. HÁTRA: migráció éles push + böngésző-verifikáció |
| F2.1 catalog-watch piacfigyelő | ✅ kód kész (2026-07-28) | crawler + CLI + `/admin/katalogus` moderáció + heti GH Actions cron. HÁTRA: valós HU források bekötése és az első éles crawl (felhasználói döntés) |
| F2.3 Felszerelés (kiegészítők), 1–2. szakasz | ✅ kész (2026-07-28) | 1.: `/felszereles` útmutató-oldalak, séma nélkül. 2.: `kind`/`accessory_type`/`would_recommend`/`ratings` migráció (NEM éles) + `kind='board'` szűrő minden deszka-lekérdezésen, őrszem-teszttel. HÁTRA: migráció éles push, route/UI a termékszintű kiegészítőkhöz, 3. szakasz (catalog-watch besorolás) |
| F1.10 Záró audit + élesítés | ✅ audit **26/26** (2026-07-27) | **`docs/AUDIT_F1.md`**: az audit két mérés-jellegű hiánya pótolva (vizuális regresszió 07-26, teljesítmény-budget 07-27). HÁTRA az F1 lezárásához a publikussá tétel — a lépések a `RUNBOOK.md` **élesítési checklistjében** (domain → Resend-SMTP → Turnstile → cégadatok → `SITE_PUBLIC=true`), mind felhasználói döntés/adat |

## ITINER a következő sessionnek (2026-07-28-i állapot)

**HOL TARTUNK:** az F1 funkcionálisan LEZÁRVA (fázis-záró audit 26/26,
`docs/AUDIT_F1.md`). Az oldal a `supperz.netlify.app`-on él, HTTP Basic
jelszó-kapu mögött. Azóta három továbbfejlesztés ment ki élesbe: folyó-vízállás
(F1.11), póráz-figyelmeztetés (F1.11b) és süti-mentes analitika (F1.12).
2026-07-28: elkészült az **F2.1 catalog-watch piacfigyelő** (kód kész, éles
futás még nem volt — a nyitott lépések az F2.1-szakasz végén), az **F2.2
visszajelzés-csatorna** (kód kész, migráció még nincs élesítve), és az **F2.3
Felszerelés-útmutató 1. szakasza** (séma-módosítás nélkül, lásd F2.3-szakasz —
a 2–3. szakasz DB-migrációt igényel, HÁTRA).

**A PUBLIKUSSÁ TÉTEL a felhasználón múlik** — a lépések sorrendben a
`docs/RUNBOOK.md` „Élesítési checklist" szakaszában:
domain → Resend-SMTP → Turnstile-kulcs → cégadatok (`@core/legal/entity.ts`) →
`SITE_PUBLIC=true` → éles LCP-mérés. Egyik sem fejlesztői feladat.
Felhasználói döntések (2026-07-27): a domain regisztrációja folyamatban
(a név **Suptime**); a Turnstile-fiók a publikussá tételkor jön létre; a
cégadatok addig várnak, amíg eldől a vállalkozási forma.

**Fejlesztési irányok, amelyekből választani lehet** (a legutóbbi körben a
felhasználó a HydroInfo-t választotta, majd az analitikát):

1. **Biztonsági kiegészítők teljes blokkja** — a domain-review 2.8 pontja.
   A biztonságkritikus mag (póráz + mentőmellény-mondat, F1.11b) ÉS a
   „Felszerelés" tartalmi útmutató (8 kategória, Deszkaválasztó-integráció)
   MÁR MEGVAN (F2.3, 1. szakasz). Ami hátra van: a terv 2. szakasza
   (termékszintű katalógus — `kind` diszkriminátor, konkrét ajánlások,
   `would_recommend`) és 3. szakasza (catalog-watch besorolás) — ld.
   `~/.claude/plans/rendben-kezdj-nk-a-2-vel-nested-wand.md`, mindkettő
   DB-migrációt igényel.
2. ~~**catalog-watch piacfigyelő pipeline** (F2)~~ — **KÓD KÉSZ (F2.1,
   2026-07-28)**. Ami hátra van, az nem fejlesztés: valós HU források
   bekötése (`add-source`), első `crawl --dry-run`, majd moderáció a
   `/admin/katalogus`-on. Ez tölti fel a katalógust (most 20 deszka), ami
   EGYBEN előfeltétele az advisor ár-padló tételének (20 elemen az
   eloszlás-alapú küszöb zajos).
3. **Capacitor natív build** (F2 nyitása) — a `build:native` SPA-mód megvan,
   a wrapper nincs.
4. **react-router 8 frissítés** — `SECURITY_FINDINGS.md` F1.10-01 (RSC-módú
   CSRF; minket NEM érint, de a 7.x ágon nincs patch). Kiváltó ok: ha RSC-t
   vezetnénk be.
5. **Fertő-viharjelzés forrása** — nincs HungaroMet-forrása, ma fail-safe
   „unknown". Nyitott kérdés F1.3 óta.

**Nyitott kis tételek (nem blokkolók):**
- **Advisor ár-padló** (domain-review 2.5): NEM ár-büntetés kell, hanem
  rendeltetés-jelzés („alkalmi, strandolós használatra jó"), a küszöb pedig a
  katalógus saját ár-eloszlásából — ezért vár a katalógus bővülésére.
- **Kezdő → felfújható preferencia** (2.7): ma nulla hatású (20/20 felfújható).
- **MapLibre null-warning**: külső stílus-kifejezésből jön, nem a mi kódunkból.
- **Snyk nincs bekötve** (F1.10-04): fiók-hitelesítés kell, felhasználói döntés.
- **Persona-landingek** (F1.8b): terméki definíció kell hozzá.
- A vízhozam/vízhő adat hézagos a mércéinken — ha sűrűbb lesz, bekötendő
  (F1.11).

**Teszt-fiókok:** admin = `endre.sztellik@gmail.com` (profiles.role='admin');
teszt-user = `teszt@sup-platform.test` / `Teszt_1234`.

**MUNKAMÓD (fontos):** lokál-first. Minden lépés zárása: `npm run typecheck` ·
`npm run lint` · `npm test` zölden, PROGRESS frissítve, commit. Netlify-build
CSAK `[deploy]` jelölős commit-üzenetre indul. Éles műveletet (migráció-push,
függvény-deploy, adat-módosítás) KIZÁRÓLAG felhasználói jóváhagyással.
A verifikáció MÉRÉSSEL zárul (parancs-kimenet), nem szemrevételezéssel — a
legutóbbi három körben ez fogott meg egy blokkolót és két valódi hibát.

**Környezet-emlékeztetők:** Supabase CLI CSAK `npm run sb --` wrapperrel
(CLAUDE.md, zshrc-csapda; a `db push`-hoz `--include-all` kell a 099000-es
migráció magasabb időbélyege miatt) · a gépen nincs Docker/helyi Postgres —
pgTAP-verifikáció a CI `rls-tests` jobban · a szolgáltatói kulcs a Management
API-ból kérhető le (`/v1/projects/<ref>/api-keys?reveal=true`), titkot ne írj
a terminálra és ne `npm run`-on át adj át.

## F2.1 — catalog-watch piacfigyelő pipeline (2026-07-28)

Kiosztás: karmester. Terv: `docs/CATALOG_WATCH_TERV.md` (a séma F1.5 óta kész,
migráció élesben). Kapuk zöldek: typecheck · lint · **693 vitest** (+150 új).

**Elkészült — a figyelő (`tools/catalog-watch/`, a `src/modules`-on KÍVÜL):**
- Minden döntés TISZTA függvény, az I/O injektált (az Edge Functionök `_shared`
  mintája) → a teljes futás hálózat és adatbázis nélkül tesztelhető.
- `robots.ts` (leghosszabb-minta illesztés, `*`/`$`, Crawl-delay) · `sitemap.ts`
  (sitemapindex is) · `jsonld.ts` + `html.ts` (schema.org `Product`) ·
  `normalize.ts` (márka-alias, modellnév-tisztítás, spec/ár/elérhetőség) ·
  `match.ts` (pg_trgm-kompatibilis trigram) · `crawl.ts` (hibatűrő orchestrátor) ·
  `store.ts` (az EGYETLEN író fájl, service-role) · `cli.ts`.
- CLI: `list-sources` · `add-source` · `crawl [--dry-run] [--source] [--max]` ·
  `lifecycle`. Node 22 natívan futtatja a TS-t, build nincs.
- Heti cron: `.github/workflows/catalog-watch.yml` (hétfő hajnal UTC +
  `workflow_dispatch` dry-run kapcsolóval, `concurrency` védelem, SHA-pinnelt
  action-ök).

**Elkészült — a kapu (`/admin/katalogus`, catalog adminPanel):**
- `catalog/data/candidates.server.ts`: jelölt-lista (forrás + javasolt pár),
  **jóváhagyás** (márka-feloldás vagy -létrehozás, ütközésmentes slug, ársor),
  **összefésülés** meglévő deszkába, **elutasítás**, **kifutás** megerősítése.
- A route `requireRole('moderator')` a loaderben ÉS az actionben; a jelölt-
  kártyán a kinyert adatok, a típus-választó (a figyelő tippje csak elő-
  választás) és a merge-legördülő.

**Két sérthetetlen szabály a kódban:**
1. **A figyelő SOHA nem publikál magától** — `boards` sort nem hoz létre, minden
   új típus a moderációs sorba kerül (ez a dupla-név elleni védelem).
2. **Státuszt sem állít**: a kifutás-jelölt csak jelentés, a `discontinued`-ot
   ember erősíti meg. Amit a figyelő SOHA nem látott (`last_seen_at IS NULL`,
   pl. a seed-sorok), ahhoz hozzá sem nyúl.

**Modul-szerződés (1.3) — duplikáció helyett core/domén (3 helyen):**
- `slugify` a providersből → `@core/text/slug` (két modulnak kell; a RatingBar
  mintája, F1.6-utó).
- A kifutás-felismerés a **catalog modul** `lifecycle.ts`-ébe került; a figyelő
  onnan importálja — egy implementáció szolgálja a CLI-t és az admin felületet.
- A `catalog_candidates.extracted` jsonb szerződése EGYETLEN típus
  (`ExtractedBoardData` a catalogban), amit a figyelő is onnan vesz.

**VALÓS HIBÁT FOGOTT A MUNKA KÖZBEN (env-árnyékolás, `tools/catalog-watch/env.ts`):**
a gép shell-profilja globálisan exportál egy **IDEGEN projekt**
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` párosát — ugyanaz a zshrc-csapda,
amit a CLAUDE.md a Supabase CLI-nél ír le, csak más változókkal. A CLI első
futása emiatt az idegen projektre csatlakozott (olvasás volt, nem írt semmit —
a hiba „nincs ilyen tábla" volt). Javítva: a repo `.env`-je az AUTORITÁS, a
szolgáltatói kulcs `ref` claimjét összevetjük a cél-projekttel, eltérésnél a
futás **leáll**, és minden futás kiírja, melyik projekttel dolgozik.
**Tanulság a jövőre:** ha egy új eszköz `SUPABASE_*` env-változót olvas,
először az árnyékolásra gyanakodj — a gépen több változó is idegen fiókra mutat.

**Verifikáció (mérés, nem szemrevételezés):**
- 150 új Vitest a tiszta logikára (robots-illesztés, sitemap, JSON-LD-hibatűrés,
  spec-parse, trigram-egyezés, teljes crawl-menet hamis hálózattal).
- `tools/catalog-watch/cli.ts` natívan fut Node 22-n (súgó + hibaágak).
- Az env-őr élesben kipróbálva: a foreign-kulcsos futás LEÁLL.
- `catalog_candidates` és `catalog_sources` tábla ÉL az éles projekten
  (anon REST → `[]`, tehát létezik és az RLS zár).
- `/admin/katalogus` kijelentkezve → **302** a belépőre (guard áll).

**HÁTRA (felhasználói döntés):**
- **Valós HU források bekötése** (`add-source`) és az első `crawl --dry-run` —
  ez már élő oldalak lekérése, ezért jóváhagyással.
- **Az admin felület böngésző-verifikációja** moderátor-sessionnel (jelölt-
  kártya renderelése, jóváhagyás→új deszka). Ehhez admin-belépés kell.
- **GitHub-secretek** a cronhoz: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## F2.2 — Visszajelzés-csatorna a fejlesztőnek (2026-07-28)

Felhasználói kérés a katalógus-források felderítése közben: kelljen egy felület,
ahol a felhasználó **hibát jelenthet**, illetve **hiányzó boltot vagy
deszka-modellt javasolhat** — a tartalom NEM a nagyközönségnek, hanem a
fejlesztőnek szól. Minta: a PecApp `send-feedback` megoldása. Kapuk zöldek:
typecheck · lint · **728 vitest**.

**Elkészült:**
- ÚJ core-migráció `20260717092100_core_feedback.sql`: `feedback` tábla
  (kind: bug/shop/board/idea/other, message, page_path, status, admin_note).
  RLS: **írni** csak bejelentkezett, megerősített e-mailű user a SAJÁT nevében;
  **olvasni CSAK admin** (a beküldő a saját sorát sem látja vissza — ez nem
  közösségi felület); **állapotot** csak admin ír. Oszlop-védő trigger
  (a beküldő nem állíthatja magát „kész"-re) + **gyakoriság-korlát
  definer-triggerben** (óránként 5/user).
- pgTAP `07_feedback_test.sql`: saját néven írás, idegen név tiltva,
  e-mail-gate, anonim tiltás, admin-olvasás/állapotkezelés, rate limit,
  hossz- és kind-kényszerek.
- `@core/feedback`: adatréteg + tiszta validálás (13 teszt) és **best-effort
  Resend-értesítés** (13+4 teszt; kulcs nélkül csendben kimarad, a levél HTML-
  escape-eli a beküldött szabad szöveget).
- `/visszajelzes` űrlap (requireUser + e-mail-gate, `?tema=`/`?ut=`
  előválasztással) és `/admin/visszajelzesek` (szűrés állapotra, jegyzet).
  Mindkettő CORE-route, mint az F1.12 analitika — a csatorna keresztmetszeti.
- Belépési pontok: lábléc-link mindenhol, plusz kontextusos hívás a
  `/deszkak` és `/szolgaltatok` lista alján (`FeedbackPrompt`).

**Miért kötelező a bejelentkezés:** a hitelesítés nélküli visszajelzés-végpont
levélbombázható és szemét-özönnel eltömíthető — ez a hiba a testvér-projektben
élesben elő is fordult. A projekt vélemény- és jelentés-folyamatai ugyanígy
e-mail-gate-eltek.

**A gyakoriság-korlát az ADATBÁZISBAN van**, nem az alkalmazásban: a beküldő a
saját sorait sem olvashatja vissza (admin-only select), tehát az app nem tudná
megszámolni őket; és így a korlát a REST-en át is él, nem csak a mi űrlapunkon.

**Verifikáció:** `/visszajelzes` kijelentkezve → 302 a belépőre;
`/admin/visszajelzesek` → 302; a lábléc-link és a `/deszkak` kontextusos hívás
renderel; robots.txt tiltja a `/visszajelzes`-t. A lap-szélesség invariáns
teszt **elkapott két eltérést** (max-w-2xl/4xl a kötelező max-w-5xl helyett) —
javítva.

**HÁTRA:** a migráció éles push-a (jóváhagyással) · a beküldés böngésző-
verifikációja bejelentkezett fiókkal · `RESEND_API_KEY` + `FEEDBACK_TO_EMAIL`
beállítása, ha kell e-mail-értesítés (addig a DB + admin felület a csatorna).

## F2.3 — Felszerelés (kiegészítők) — 1. szakasz: útmutató (2026-07-28)

Terv: `~/.claude/plans/rendben-kezdj-nk-a-2-vel-nested-wand.md` (a munkamenet
egy külső-SSD-megszakadás után folytatódott, a terv a lemezen maradt kész
állapotban). A domain-review 2.8 nyitott tétele (leash/mentőmellény/pumpa/
szárazzsák „legalább annyira fontos, mint a deszka mérete") + vásárlói igény
(„melyik evezőt vegyem?") adja az indokot. Kiosztás: scaffolder. Kapuk zöldek:
typecheck · lint · **737 vitest** (+9 új).

**Elkészült — csak tartalom, séma-módosítás NÉLKÜL:**
- `src/modules/catalog/gear.ts`: zárt 8-elemű `GEAR_CATEGORIES` lista (evező ·
  póráz · mentőmellény · pumpa · szárazzsák · ülés · uszony · táska) +
  `CORE_SAFETY_SOURCE`/`OWN_SAFETY_CATEGORIES` — melyik kategória-oldal
  hasznosítja újra a meglévő core `safety.riverLeash.*` szöveget (póráz,
  mentőmellény), melyiknek van saját catalog-szövege (pumpa, szárazzsák), és
  melyiknek nincs biztonsági tartalma (evező/ülés/uszony/táska — nincs
  `SafetyNote` ezeken, tudatosan nem kitalált tartalom).
- `app/routes/felszereles.tsx` (kategória-áttekintő) +
  `app/routes/felszereles.$kategoria.tsx` (útmutató: mire való · mire figyelj
  vásárláskor · opcionális `SafetyNote` · kapcsolódó linkek; ismeretlen
  kategória-slug → 404 az `isGearCategory` őrrel).
- `src/modules/catalog/module.ts`: `nav.gear` bejegyzés `order: 15` (Deszkák=10
  és Spotok/Szolgáltatók=20 közé — az érték a tényleges module.ts-ekből
  ellenőrizve), a két új route regisztrálva.
- i18n: `catalog` namespace `gear.*` fája hu+en, kulcs-paritás ellenőrizve
  (ad hoc szkripttel — nincs a repóban erre kész teszt, follow-up alább).
- `src/core/seo/sitemap.ts`: a `/felszereles` + 8 kategória-út felvéve a
  `STATIC_SITEMAP_PATHS`-hoz (core fájl, de a minta megegyezik a
  deszkak/spotok/szolgaltatok korábbi bővítésével).

**Integráció a meglévő felületekbe (ez zárja le a domain-review 2.8-at):**
- `app/routes/deszkavalaszto.gear.ts`: TISZTA `recommendGearFor({water, use,
  storage})` — ROUTE-rétegben él (nem catalogban, nem advisorban), mert a
  `GearCategory` (catalog) és a `WaterChoice`/`AdvisorUse`/`StorageChoice`
  (advisor) típusokat köti össze — a modul-szerződés csak itt engedi (F1.5/F1.6
  mintája). Mindig póráz (víztípus szerinti szöveggel) + mentőmellény;
  felfújható-tárolás-preferenciánál pumpa-említés; túra célnál szárazzsák. 7
  unit-teszt. Az „Ez is kell hozzá" `Card`-blokk a Deszkaválasztó eredménye
  alatt, a meglévő folyó-`SafetyNote` alatt jelenik meg.
- `app/routes/spotok.$slug.tsx`: a meglévő folyó-póráz `SafetyNote` linket
  kapott a `/felszereles/poraz`-ra (a szöveg változatlan).

**Tudatos döntés (a terv nem rögzítette egyértelműen):** a `tapasztalat`
(experience) bemenet NEM számít a `recommendGearFor`-ban — a terv 84–87. sora
csak víztípus/tárolás/cél szerint variál, ezt követtük a task-összefoglaló
helyett (a terv az irányadó dokumentum).

**Follow-up (nem blokkoló):** nincs repo-szintű i18n kulcs-paritás teszt (csak
ad hoc szkripttel verifikálva) — érdemes lehet állandó tesztet írni rá, ha ez
elvárás a jövőben. Az `e2e/a11y.spec.ts` és `e2e/public-paths.spec.ts` bővítve
lett az új oldalakkal, de **nem futott** (nincs helyi Playwright-böngésző +
az e2e-suite élő távoli Supabase-seedet igényel) — a CI-ban fut le előbb.

## F2.3 — Felszerelés — 2. szakasz: `kind`-diszkriminátor + adatréteg-szűrés (2026-07-28)

Kiosztás: db-engineer. A terv 97–194. sora. **Csak a migráció + adatréteg-szűrés
készült el ebben a körben, route/UI szándékosan NEM** — a séma-változtatás a
legkritikusabb rész (a Deszkaválasztó SOHA nem ajánlhat kiegészítőt deszkaként),
ezt kellett először stabilan, tesztelve látni. Kapuk zöldek: typecheck · lint ·
**746 vitest** (+8 új). **A migráció NEM lett élesre tolva** (`db push` nem
történt) — az külön, felhasználói jóváhagyással induló lépés.

**Két ÚJ additív migráció** (modul-szerződés: catalog és reviews séma-tulajdona
külön fájlban):
- `20260717092200_catalog_board_kind.sql`: `boards.kind` (`board`/`accessory`,
  default `board` — a meglévő 20 seed-sor érintetlen) + `accessory_type` (zárt
  8-elemű lista, a `src/modules/catalog/gear.ts` `GEAR_CATEGORIES`-ével azonos)
  + `board_type` NOT NULL feloldva + feltételes `boards_kind_shape` CHECK
  (idempotens `do $$` blokk) + `boards_kind_idx`. RLS változatlan (a meglévő
  policyk kind-agnosztikusak).
- `20260717092300_reviews_recommend.sql`: `board_reviews.would_recommend`
  (nullable — régi sorok `null`-lal maradnak, az aggregátor ezekből továbbra is
  a `rating_overall >= 4` szabállyal származtat) + `ratings jsonb` (**egyelőre
  NEM HASZNÁLT**, a jövőbeli kategória-szempontokhoz — a szabály a kódban
  kimondva: a 4 deszka-oszlop marad a kanonikus tároló, minden ÚJ szempont ide
  megy; `jsonb_typeof = 'object'` CHECK az alak védelmére).

**pgTAP bővítés** (`10_catalog_test.sql`, `20_reviews_test.sql`): seed-assert
(0 nem-`board` sor élesben), `boards_kind_shape` pozitív + 4 negatív eset
(23514), RLS kiegészítő-sorra; `would_recommend`/`ratings` saját véleményben
írható, miközben a `verified_owner`/`status` védve marad. **A CI `rls-tests`
jobban fut le** (helyben nincs Docker/Postgres).

**Adatréteg-szűrés — korrektségi invariáns, `kind='board'` mindenhol ahol
deszka-listát ad vissza:**
`catalog/data/boards.server.ts` (`listBoards`, `getBoardBySlug` — kiegészítő
slugjára 404), `catalog/data/candidates.server.ts` (`listBoardChoices`,
`listBoardsForLifecycle`), `tools/catalog-watch/store.ts`
(`listBoardsForLifecycle`, `listBoardsForMatch`). Kivétel, dokumentálva:
`resolveUniqueSlug` szándékosan kind-agnosztikus (a slug az egész táblán belül
egyedi kell legyen).

**Őrszem-teszt** (`app/routes/deszkavalaszto.kind.test.ts`, 8 teszt): ál-Supabase-
kliens vegyes (deszka+kiegészítő) adaton igazolja, hogy a szűrt függvények csak
deszkát adnak vissza; plusz forrás-szintű lefedettség-ellenőrzés, ami minden
`boards`-olvasásra megköveteli a `.eq("kind", "board")`-ot. Mutációs próbával
igazolva: a szűrő kivételekor a teszt elhasal.

**Follow-up / HÁTRA:**
- A migráció éles push-a (felhasználói jóváhagyással) — a CI rls-tests előbb
  fusson le rajta.
- Route + UI a termékszintű kiegészítő-adatlaphoz
  (`/felszereles/:kategoria/:slug`), `BoardCard`/`BoardHero` kiegészítő-változat.
- Az `would_recommend` bekötése az űrlapba és az aggregátor `percentRecommend`
  szabályába (explicit érték elsőbbsége — MOST még nem történt meg, a terv
  156. sora szerinti szabály még csak a típusban és a DB-ben létezik).
- 3. szakasz: catalog-watch `classifyProduct` (szűrés helyett besorolás).

## F1.0 — Projekt-setup (2026-07-17)

**Elkészült:**
- Claude Design import: `SUP Explorations.dc.html` → `_design-source/` (gitignore-olt, csak olvasható referencia).
- Token-egyeztetés: a design 2c token-blokkja tételesen egyezik a doku 2. fejezetével; **`--caution-bg: #F7ECD8`** a designból pótolva (Óvatosan-badge háttér) → doku + `src/core/ui/tokens.css`. A doku 12/2 nyitott kérdés lezárva.
- RR7 framework-mód + Vite + TS strict (`noUncheckedIndexedAccess`), `BUILD_TARGET=native` → SPA-mód (react-router.config.ts).
- Tailwind 4 + `tokens.css` + `@theme inline` híd (utility-nevek: `bg-petrol`, `bg-caution-bg`…).
- Könyvtárszerkezet az 1.3 szerint; `@core/module-contract` (ModuleManifest), üres `src/modules/registry.ts`, `src/core/platform.ts`.
- ESLint flat config `import/no-restricted-paths` zónákkal (modul→modul tilos, core nem függ modultól/app-tól) — a 8 tervezett modulra előre felvéve.
- CI-váz: `.github/workflows/ci.yml` (typecheck/lint/vitest; RLS- és e2e-jobok kommentben előkészítve F1.2/F1.10-re). `netlify.toml` váz (SSR-adapter bekötése F1.10).
- `CLAUDE.md` (modul-szerződés, biztonsági tokenek, kapu-szabály, agent-tábla).
- 8 subagent-definíció: `.claude/agents/` (scaffolder, ui-builder, db-engineer, algo-engineer, auth-security, test-runner, security-auditor, reviewer).
- PostToolUse hook: `.claude/hooks/post-edit-check.sh` (tsc + eslint minden ts/tsx-edit után).

**Megjegyzések a következő lépéshez (F1.1):**
- Az új subagent-definíciókat a Claude Code session-újraindítás után látja.
- Netlify SSR-adapter (`@netlify/vite-plugin-react-router`) szándékosan nincs még bekötve — F1.10 (élesítés) része.
- A design-fájl komponens-referenciái: gombok · státusz-jelvények · vízfelszín-vonal (4 állapot) · vízmérce (10 szegmens) · II. fokú riasztás-képernyő · kontraszt-tábla — az F1.1 ui-primitívekhez a `_design-source/SUP Explorations.dc.html`-ből olvasandók.

## F1.1 — Core: auth, i18n, ui-primitívek (2026-07-17)

Kiosztás a 11.4 szerint: ui-builder + scaffolder párhuzamosan, majd auth-security,
karmester-integráció, reviewer-jóváhagyás. Kapuk záráskor: typecheck · lint ·
104 vitest zöld + buildelt SSR-füstteszt (/, /belepes, /regisztracio,
/kijelentkezes GET→302, 404 fordított szöveggel).

**Elkészült:**
- `src/core/ui/`: Button (primary/secondary/ghost — danger-variáns típus-szinten
  nem létezik), Card, StatusBadge (kötelező label + beépített ikon = szín+ikon+
  szöveg), Waterline (4 állapot, állapotonként ELTÉRŐ SVG-geometria, stale =
  szaggatott), Gauge (10 szegmens, `role="meter"`, küszöbök propból — végleges
  sávok az F1.3 SUP-indexből; stale = csíkozott), DataAge + `isStale`/
  `minutesSince` (`STALE_THRESHOLD_MINUTES = 30`).
- `src/core/i18n/`: `createI18n(locale)` kérésenkénti példány (SSR-biztos),
  namespace-regiszter (`registerNamespace` — modulok innen csatlakoznak),
  url-helperek (hu prefix nélkül, en `/en/...`), `pickTranslated` jsonb-fallback,
  `locales/{hu,en}/core.json` (hu forrás, en tükör).
- `src/core/seo/`: `buildMeta`, `buildHreflangLinks` (x-default = hu), JSON-LD
  builderek (Product/Place/LocalBusiness/FAQPage) + XSS-biztos `jsonLdScript`,
  `ogImageUrl` stub (F1.8).
- `src/core/notifications/`: `NotificationProvider` interfész + `WebPushProvider`
  váz (isSupported valós, többi F1.9), platform-alapú kiválasztás.
- `src/core/payments/`: `PaymentProvider` interfész (createCheckout/handleWebhook/
  getEntitlements + invoice-hook) + `NoopPaymentProvider`.
- `src/core/auth/` (4. fejezet): @supabase/ssr szerver/browser kliens, cookie-s
  SSR-session, `getUser`-alapú guardok (`requireUser`, `requireRole`), szerep-
  hierarchia (user/moderator/admin, app_metadata védett `user` defaulttal),
  `isEmailConfirmed` UX-gate, Turnstile-komponens (npm-függőség nélkül,
  `isTurnstileEnabled` egyetlen kapcsoló, captchaToken a Supabase-hívásban),
  `safeRedirect` nyílt-redirect-védelem (`//host` ÉS `/\host` tiltva), GDPR
  `deleteAccount` váz. Auth-route-ok: /belepes (jelszó + magic link),
  /regisztracio, /auth/callback (PKCE code-exchange), /kijelentkezes (POST-only,
  redirectTo a safeRedirect-en át). `.env.example` a gyökérben.
- Karmester-integráció: `app/routes.ts` a registry-manifesztekből komponál (új
  modulhoz e fájlhoz nem kell nyúlni; relatív import, mert a RR7 config-loader
  vite-node kontextusában a tsconfig-alias nem él); `app/root.tsx` Layout-szintű
  I18nextProvider (ErrorBoundary is fordít) + `<html lang>` az URL-ből.

**Tudatos döntések / eltérések:**
- `isStale`: a pontosan 30 perces adat MÁR elavult (`>=`), és az értelmezhetetlen
  dátum is stale — fail-safe eltérés a spec „30 percnél régebbi" szövegétől;
  reviewer által elfogadva.
- Nincs `--stale-bg` token (a biztonsági blokk fix): a stale-badge `mist` háttér +
  `stale` szöveg/ikon kombinációt használ, új szín bevezetése nélkül.
- Supabase-env hiányában fail-closed: `getSession`/`getUser` → null (egyszeri
  szerver-warn), guardok a belépőre irányítanak, a kliens-factory híváskor dob —
  a publikus oldalak env nélkül is renderelnek (F1.2-ig nincs Supabase-projekt).
- Reviewer-kör: 1 MAJOR (safeRedirect backslash open-redirect) + 3 minor →
  javítva, regressziós teszttel; végső verdikt: JÓVÁHAGYVA.

**Megjegyzések a következő lépéshez (F1.2):**
- Supabase-projekt provisioning + `.env` kitöltése (minta: `.env.example`);
  Turnstile secret a Supabase Dashboardban, rate limitek szigorítása.
- RLS-adósságok (a kódban feljegyezve): e-mail-megerősítés gate security definer
  függvénnyel (`email-confirmed.ts`), a `role` forrása a `profiles` táblára
  kötve (`roles.ts` — API változatlan marad), GDPR vélemény-anonimizáló SQL
  (`gdpr.ts`), `push_subscriptions` (`web-push.ts`).
- A Gauge küszöb-defaultjai (caution 4, safe 6.5) F1.3-ban a `supindex.*`
  konfigból jönnek majd.
- Vitest `environmentMatchGlobs` deprecation-warningot ír (működik) — később
  projects-alapú konfigra váltható.

## F1.2 — DB: teljes séma + RLS + tesztek + seed (2026-07-18)

Kiosztás: db-engineer (2 kör) + reviewer (2 kör). Helyi kapuk záráskor zöldek
(typecheck · lint · 104 vitest); a futási verifikáció a CI `rls-tests` jobja
(helyben nincs Docker/Postgres — a pgTAP-tesztek először a CI-ban futnak élesben).

**Elkészült:**
- 12 migráció (`supabase/migrations/`): core (extensions, helpers, profiles,
  orders, push_subscriptions, gdpr_anonymize) + modulonként saját fájl
  (catalog, reviews, spots, weather, advisor, providers) — modul-szerződés
  szerint. Minden táblán RLS + minden policyhoz pozitív ÉS negatív pgTAP-teszt.
- 7 pgTAP tesztfájl (`supabase/tests/00,10,20,30,40,45,50`), tranzakció+rollback
  mintával; szerepek: anon / user (confirmed/unconfirmed) / moderator / admin /
  tulajdonos vs. idegen / service_role.
- `seed.sql`: 9 márka, 20 deszka (+20 ár), 15 spot, 5 provider, 32
  advisor_weights kulcs (`supindex.*` defaultokkal, `storm.level1_cap=3.9`,
  `storm.level2_cap=0`).
- CI `rls-tests` job élesítve: setup-cli 2.100.1 (pinnelt) → `supabase db start`
  → `supabase test db --local`.
- Security definer helperek `set search_path=''`-vel; column-védő triggerek:
  `profiles.role`, `board_reviews.verified_owner/status`, `providers.verified/
  tier`, `orders.status/provider_ref/amount_huf/currency/kind/user_id`.
- GDPR `anonymize_user`: csak service_role hívhatja (REST-ről admin sem);
  sentinel-profil, review-duplikátum-kezelés, leads/sessions null-ozás,
  push-törlés.

**Audit/review során javított hibák (tanulság):**
- BLOKKOLÓ: 8 hexjegyű „UUID"-literálok a seedben+tesztekben (Postgres 32
  hexjegyet vár) → kanonikus pad-elés. A seed emiatt az első `db start`-on
  elhasalt volna.
- BLOKKOLÓ: hiányzó `pgtap` extension → minden tesztben `create extension if
  not exists pgtap` (rollback-kel efemer).
- Logikai: RLS USING-gal szűrt UPDATE 0 sort érint és NEM dob kivételt →
  `throws_ok` helyett 0-soros minta + érték-változatlanság assert.
- MAJOR (reviewer): orders pénzügyi mezők user-írhatósága; providers.tier
  önemelés → trigger-védelem + negatív tesztek.

**Follow-up (nem blokkoló):** `amount_huf` update-revert külön assert;
`anonymize_user` runbook-jegyzet (service_role-claimmel hívandó — az Edge
Function így teszi); CI első futásán ellenőrizni, hogy a `db start` seedel.

**Környezet:** Supabase-projekt linkelve („Supbase", ref `pycsqnthxaytwaptbiph`)
— CLI CSAK a `npm run sb --` wrapperrel (lásd CLAUDE.md: zshrc-token-csapda).
A 12 migráció + seed a távoli projektre kitolva (2026-07-18, `db push
--include-seed`); élesben ellenőrizve: 20 boards / 15 spots / 5 providers /
32 advisor_weights, anon írás 401.

**Megjegyzések a következő lépéshez (F1.3):**
- `supindex.*` kulcsok a seedben — az algo-engineer validálja a sávokat,
  különösen `storm.level2_cap=0` (II. fok → index 0, spec 9. fejezet).
- A Gauge küszöb-defaultjai (F1.1-jegyzet) innen kötendők be.
- Weather-írás kizárólag service_role (nincs write-policy) — az Edge Function
  ehhez igazodjon.

## F1.3 — Weather + SUP-index (folyamatban)

**1. kör kész (2026-07-18, algo-engineer + karmester-integráció):**
- `src/modules/weather/`: route-mentes manifeszt + registry-regisztráció.
- SUP-index (`sup-index/`): tiszta `computeSupIndex` az 5.1 mind a 6 lépésével
  (storm-override a végén alkalmazva; offshore-szektor `angularDelta`-val;
  minden küszöb/súly konfigból). Kimenet: index (1 tizedes) + státusz-enum
  (safe/caution/danger) + flagek (besodró, neoprén, viharfok) + indoklás
  i18n-kulcsként (nem kész mondat). Táblázatos határeset-tesztek (sávhatárok,
  pont 3,9 plafon, pont 15 lökés/offshore-szélminimum, pont 14 °C, 4,0/7,0).
- Konfig: `config.ts` (típus + defaultok, seed-kulcsokkal egyező) +
  `config.server.ts` (advisor_weights `supindex.*` olvasó, fallback defaultokra).
- Open-Meteo adapter: forecast + marine (tengeri vízhő; belvíznél null — F1),
  injektálható fetch, parse fixture-tesztekkel; null-biztos parse (karmester-fix).
- i18n: `weather` namespace (hu forrás + en tükör), bekötés az ÚJ
  `src/modules/registry-i18n.ts`-en át (app/root.tsx importálja; új modul
  fordítása ide kötendő — a registry.ts-be azért nem, mert azt a RR7
  config-loader is behúzza, és a manifesztnek mellékhatás-mentesnek kell lennie).

**2. kör kész (2026-07-18, algo-engineer): Edge Functionök + cron-előkészítés.**
- `supabase/functions/_shared/` — Deno- ÉS Node-semleges tiszta logika (nincs
  Deno API / `jsr:` import / I/O), Vitesttel tesztelve: `types.ts`, `sup-index.ts`
  (a webes `computeSupIndex` bit-azonos portja + `parseSupIndexConfig`),
  `open-meteo.ts` (parse + injektálható fetch), `storm-scrape.ts` (BM OKF
  tag-toleráns parse + `detectStormLevelChanges`), `weather-sync.ts` és
  `storm-alert.ts` (tiszta batch-orchestrátorok injektált I/O-val, hibatűrők).
- `weather-sync/index.ts` + `storm-alert/index.ts` — vékony Deno-héjak (service-
  role kliens, valós fetch); a repo `tsconfig`-jából kizárva (`*/index.ts`),
  a `_shared` viszont typecheckelt + tesztelt.
- Konfig-bővítés: `tsconfig` (`allowImportingTsExtensions`, index.ts-kizárás),
  `vitest` include (`supabase/functions/**/*.test.ts`), eslint Deno-globális.
- 44 új Vitest-teszt (OKF-fixture 3 állapot, szintváltás 0→1/1→2/2→0/nincs,
  batch spot-hibatűrés, storm-override újraszámítás) — hálózat nélkül. Kapuk
  zöldek: typecheck · lint · 212 vitest.
- `supabase/functions/README.md`: deploy (`npm run sb -- functions deploy …`) +
  cron (Dashboard scheduled VAGY pg_cron+pg_net SQL; óránként / 5 perc ápr–okt).
- **Forrás-választás:** OMSZ viharjelzés (`STORM_SOURCE_URL`, default met.hu
  balatoni oldal) — a hivatalos kiadó, és a négy körzet pontosan a
  `storm_warning_region` seed-értékekkel egyezik; a parser szöveg-alapú, forrás-
  váltásra csak env + needle-lista kell.

**Reviewer-kör (2026-07-18): JÓVÁHAGYVA.** A két SUP-index implementáció
bit-azonossága, az adatkor-szabály, a modul-szerződés és a fail-safe viselkedés
tételesen ellenőrizve. Findingok: M1 (storm-scrape tagadás-vakság — a
storm-alert élesítése előtt KÖTELEZŐ; azonnal javítva negáció-kezeléssel +
UNKNOWN állapottal) · m2 (README: a default forrás csak Balaton-körzetet fed —
javítva) · m6 (explicit verify_jwt=true a config.toml-ben — javítva).

**Follow-upok (nem blokkolók, célfázissal):**
- m3 → F1.3-utó: `supindex.stale_minutes` seed-kulcs holt (a stale-küszöb a
  core `STALE_THRESHOLD_MINUTES` konstansa) — bekötni vagy seedből kivenni.
- m4 → F1.9: Open-Meteo `observed_at` (current.time) tárolása/használata a
  `fetched_at` mellett.
- m5 → F1.4 ÁTADÁSI FELTÉTEL: II. foknál (`flags.stormLevel===2`) a UI-nak
  „Tilos" státuszt kell rendernie (i18n `status.forbidden`), NEM a
  danger-„Veszélyes"-t — a status-enum önmagában nem elég.

**Élesítés (2026-07-18/19, felhasználói jóváhagyással) — KÉSZ:**
- Mindkét Edge Function deployolva a „Supbase" projektre (`npm run sb --
  functions deploy weather-sync|storm-alert`).
- Cron aktív (pg_cron + pg_net): `weather-sync-hourly` (`0 * * * *`) és
  `storm-alert-5min-season` (`*/5 * * 4-10 *`). A service-kulcs a Supabase
  **Vaultban** (`edge_invoke_key`) — a cron-parancsok a
  `vault.decrypted_secrets`-ből olvassák, literálként sehol nincs.
- Éles verifikáció: weather-sync → 200, 15/15 spot snapshot + SUP-index
  (3–10 közti értékek); storm-alert → 200, 3 körzet scrape, pozitívan
  megerősített 0-s fokozat, `verify_jwt` 401 auth nélkül.
- **Éles teszt fogta + javítva:** az eredeti forrás-URL 404 volt → valódi
  forrás felderítve: met.hu TAVANKÉNTI `main.php` (Balaton medencénként; 0-s
  állapot szövege: „a viharjelző rendszer ALAPON VAN" — felvéve a pozitív
  minták közé). Körzet→URL forráslista (`DEFAULT_STORM_SOURCES`,
  `STORM_SOURCES` env-felülírás), fokozat-ikon (`viharjelzesN.png`) másodlagos
  jelként, szöveg–kép eltérésnél a magasabb győz. Valódi letöltött fixture-ök.
  **Fertő-korlát:** nincs HungaroMet-forrása → unknown/fail-safe (README).

**Megjegyzés:** az 1. kört az algo-engineer session-limit szakította meg (a
hiányzó adapter-tesztet és az i18n-bekötést a karmester pótolta); a forrás-
átállítást session-limit + classifier-kiesés miatt szintén a karmester írta.

## F1.4 — Spots + térkép (2026-07-19)

Kiosztás: scaffolder (modul-váz) → ui-builder (UI) → karmester-integráció +
verifikáció. A ui-buildert session-limit szakította meg; a route-integrációt
(SpotMap/SpotCard/StormAlert bekötése a loaderekbe), az éles verifikációt és a
javításokat a karmester végezte. Kapuk záráskor zöldek: typecheck · lint ·
265 vitest (18 új F1.4-teszt).

**Elkészült:**
- `src/modules/spots/`: route-os manifeszt (`spotok`, `spotok/:slug`) +
  registry- és registry-i18n-regisztráció; `spots` i18n-namespace (hu forrás,
  en tükör; kulcs-paritás ellenőrizve).
- **Modul-szerződés betartva:** a spots-modul NEM importál a weather-modulból —
  a SUP-index kiértékelés (`evaluateSnapshot`) kizárólag a route-rétegben
  (`app/routes/spotok*.tsx`) történik, a spots saját `SpotStatus` típusára
  képezve. Az m5 „forbidden" leképezés (`storm_level===2 → "forbidden"`) is itt.
- `data/wkb.ts`: `parseEwkbPoint` (EWKB hex) + `pointFromGeom` (GeoJSON-objektum
  VAGY hex — az éles PostgREST-forma GeoJSON, lásd follow-up); `data/spots.server.ts`
  injektált klienssel (listSpots, getSpotBySlug slug-alak-guarddal, latest-
  snapshot reduce, reports CRUD).
- `ui/SpotMap.tsx`: MapLibre GL, kizárólag kliens-oldali init (dinamikus import,
  SSR-placeholder), OpenFreeMap kulcs nélküli stílus, OSM-attribúció; token-
  színes + színtévesztő-biztos (eltérő ikon-geometria) markerek, popup
  „Adatlap"-linkkel, réteg-kapcsolók (Spotok/Védett területek).
- `ui/SpotCard.tsx`: Waterline (kártyán VONAL), StatusBadge, DataAge, flag-
  jelvények. `ui/StormAlertScreen.tsx`: teljes képernyős, nem eldugható
  `role="alertdialog"`, 3 MIT TEGYÉL-lépés, amber vízimentő-CTA sötét felirattal
  (`tel:+36303838383`), forrás+időbélyeg.
- Lista-route: térkép + waterType-szűrőchipek (a térkép a szűrt listát kapja) +
  SpotCard-rács. Adatlap-route: fejléc-StatusBadge, Gauge (küszöbök a
  `supindex.*` konfigból), indoklás (weather reason-kulcs a route-rétegben
  fordítva), stale-blokk, besodró/neoprén figyelmeztetések, természetvédelmi
  sáv, mini-térkép, jelentés-lista + űrlap (requireUser + e-mail-gate).
- Fejléc-navigáció: `app/nav.tsx` a modul-manifesztek `primary` nav-
  bejegyzéseiből (registry-vezérelt — új modul automatikusan megjelenik).

**Éles verifikáció (Playwright, dev-szerver a távoli „Supbase" projekttel):**
- Lista: 15 marker renderel a térképen, kártyák helyes SUP-index/státusz/
  adatkor-jelzéssel; a waterType-szűrő a kártyákat ÉS a markereket is szűri.
- **m5 ÁTADÁSI FELTÉTEL ÉLESBEN IGAZOLVA:** a verifikáció közben a storm-alert
  cron valós II. fokot állított a Balatonra → a Balaton-spotok „Tilos · 0,0"-t
  mutatnak (nem „Veszélyes"), az adatlapon a teljes képernyős StormAlertScreen
  renderel (alertdialog, MIT TEGYÉL, vízimentő-CTA, forrás „bm-okf").
- Adatlap: Gauge kitöltött+csíkozott (stale) állapotban, indoklás, adatmezők,
  404 ismeretlen slugra.

**Verifikáció fogta + javítva (a karmester javításai):**
- **BLOKKOLÓ volt:** a térképen 0 marker jelent meg — a PostgREST a `geom`-ot
  GeoJSON-objektumként adja, nem EWKB hexként, amire a `parseEwkbPoint` épült.
  → `pointFromGeom` mindkét formára (GeoJSON + hex), a route-ok erre váltva,
  `SpotRow.geom: unknown`, 4 új teszt. (15/15 marker renderel.)
- **Layout-hiba:** az adatlap mini-térképe 0 magas volt (`h-full` a SpotMap
  bázisán tartalom-magasságú `<section>`-ben 0-ra oldódott) → `h-full` kivéve a
  bázisból, a magasságot a hívó explicit `className`-je adja (a `min-h` alsó
  korlát marad). (240px, a marker a Tiszán renderel.)
- **Biztonsági keményítés:** `getSpotBySlug` a slug-ot nyersen fűzte a PostgREST
  `.or()` szűrő-stringbe → slug-alak-guard (`^[a-z0-9-]+$`) a szűrő-injektálás
  ellen, 4 negatív teszt.

**Follow-upok (nem blokkolók) — az ITINER „Nyitott kis tételek" közé felvéve:**
geom-forma dokumentálva, `listLatestSnapshots` distinct-on-nézetre cserélhető,
MapLibre null-warning az F1.10 auditra.

## F1.5 — Catalog + Reviews (2026-07-19, funkcionális mag)

A scaffolder session-limitbe futott (a subagent-kvóta ezen a napon szűk volt),
így a teljes vázat a karmester írta, az F1.4-mintát követve. A DB-séma és RLS
már F1.2-ben kész (catalog + reviews migrációk), ezért F1.5 UI + route +
adatréteg + i18n, ÚJ core-migráció nélkül. Kapuk zöldek: typecheck · lint ·
276 vitest (11 új). Éles Playwright-verifikáció (dev + távoli „Supbase").

**Elkészült:**
- **Két külön modul** a modul-szerződés szerint: `catalog` (brands/boards/
  board_prices adat + deszka-lista/adatlap) és `reviews` (board_reviews/
  review_flags adat + Közös nevező-aggregátor + admin-moderáció). A catalog NEM
  importál reviews-t és fordítva — a deszka-adatlap a KETTŐT a ROUTE-rétegben
  (`app/routes/deszkak.$slug.tsx`) komponálja (mint a spots↔weather).
- `catalog/data/boards.server.ts`: listBoards (brand-join), getBoardBySlug
  (slug-alak-guard `^[a-z0-9-]+$` a `.or()` szűrő-injektálás ellen, negatív
  teszt), listBoardPrices (legolcsóbb elöl).
- `reviews/aggregate.ts`: tiszta `computeReviewAggregate` (csak publikált sorok;
  count, avgOverall 1–5, dimenzió-átlagok, %ajánlaná, verifiedCount) + `toTen`
  (1–5 → 10-es mérce); táblázatos határeset-tesztek (üres, hidden-szűrés,
  kerekítés 4,55→4,6, null-dimenzió, %recommend, verified).
- `reviews/data/reviews.server.ts`: listReviews (publishedOnly), getUserReview
  (1/deszka), insertReview (rating 1–5 validálás + `23505` unique→„már írtál"),
  insertFlag, és ADMIN: listPendingReviews, listFlaggedReviews (feloldatlan
  jelzés → két lépéses JS-párosítás), setReviewStatus, setVerifiedOwner,
  resolveFlag (moderátori jog, RLS + requireRole a védőháló).
- Route-ok: `/deszkak` (lista), `/deszkak/:slug` (adatlap: hero + spec + Közös nevező
  + vélemény-lista + e-mail-gate-elt vélemény-űrlap + flag + árak; action
  `intent`-tel review/flag), `/admin/velemenyek` (reviews adminPanel,
  requireRole('moderator') loaderben ÉS actionben, moderációs gombok).
- i18n: `catalog` + `reviews` namespace (hu forrás, en tükör, kulcs-paritás
  ellenőrizve); a nav automatikusan hozza a „Deszkák"-at.

**Verifikáció (Playwright + curl):** lista 20 deszkával renderel (típus-badge,
méret + stabilitási index); adatlap: Ride 10'6" fejléc + ár „429 000 Ft-tól",
Paraméterek, Közös nevező ÜRES-állapot, vélemény-űrlap login-gate, árak; admin
route 302 (requireRole átirányít kijelentkezve); 404 ismeretlen slugra; nincs
konzol-hiba.

**Token-megkötés a ui-builder-polishoz (route-kommentben is):** a Közös nevező
mércék NEM a biztonsági Gauge-ot használják (veszély-szemantika), és a `--danger`
(piros) értékelés-sávon TILOS — külön RatingBar kell (petrol/semleges v.
safe/caution), a szám mindig a sáv mellett. A loader már átadja a 10-es
`dimensionsTen`/`overallTen` értékeket.

**UI-polish (2026-07-21):** átnevezés „Népítélet" → „Közös nevező" (színkiemelt
evező-szójáték a blokk-címben, `--caution-text`); új komponensek
`reviews/ui/{RatingBar,ReviewSummary,ReviewCard,FlagButton}` +
`catalog/ui/{BoardCard,BoardHero}`, a route-ok ezekből komponálnak. A RatingBar
NEM a biztonsági Gauge (küszöb-szín ≥7 safe / <7 caution, SOHA danger; a szám
mindig a sáv mellett). 8 új komponens-teszt.

**catalog-watch séma-előkészítés (2026-07-21, `docs/CATALOG_WATCH_TERV.md`):**
ÚJ migráció `20260717091600_catalog_watch.sql` (additív, az F1.2-catalogot nem
bolygatja): boards életciklus-mezők (`status` active|discontinued|unverified +
first/last_seen_at + discontinued_at), `catalog_sources`, `catalog_candidates`
(mindkettő RLS: select ÉS write CSAK moderator/admin — kurált/belső tartalom),
`pg_trgm` + trigram GIN index a modell-névre (fuzzy dedup). pgTAP:
`12_catalog_watch_test.sql` (mod ír/olvas; user/anon se olvas, se ír; boards
default-ok). A `BoardRow` típus bővítve. Migráció NINCS kitolva — CI `rls-tests`
futtatja, éles `db push` a felhasználó jóváhagyásával (lokál-first munkamenet).

**HÁTRA (nem blokkoló):** auth-flow verifikáció teszt-fiókkal (lásd ITINER).

## F1.6 — Advisor / Deszkaválasztó (2026-07-21)

Kiosztás: algo-engineer (tiszta algoritmus-mag) → ui-builder (wizard + eredmény +
route) → karmester-integráció + verifikáció. A ui-buildert a végén kapcsolat-
megszakadás érte (a route-fájl + UI-komponensek a karmester írta). Kapuk zöldek:
typecheck · lint · 335 vitest (~38 új advisor-teszt).

**Elkészült:**
- `src/modules/advisor/select/`: tiszta kétrétegű ajánló (5.2). 1. réteg kemény
  szűrés (térfogat=súly×szint-szorzó, terhelhetőség×0,66≥effektív súly, HU-
  elérhetőség, tárolás, budget, cél→board_type mapping); 2. réteg 0–100
  pontozás (stabilitás-illeszkedés tapasztalat-függő, Közös nevező-átlag ≥5
  vélemény/semleges, ár-érték, cél-fit, elérhetőség/frissesség) — súlyok az
  `advisor_weights`-ből (config.ts/config.server.ts, fail-safe DEFAULT). Az
  algoritmus STRUKTURÁLIS bemeneten dolgozik (`BoardForAdvisor[]`), NEM importál
  catalog/reviews-t; az indoklás determinisztikus {key, params} (level/use
  nested i18n-kulcs). Táblázatos határeset-tesztek.
- `src/modules/advisor/ui/AdvisorWizard.tsx` (5 lépéses kliens-wizard: testsúly+
  utas, tapasztalat, víz, cél, budget+tárolás; progress-bar, opció-kártyák,
  amber CTA sötét felirattal) + `AdvisorResult.tsx` (1 nagy + 2 kompakt ajánlás,
  „X% neked" amber-badge, feloldott indoklások, adatlap-linkek; megosztás
  OG-képe F1.8).
- `app/routes/deszkavalaszto.tsx`: a catalog+reviews+advisor összekötése a
  route-rétegben — boards+legolcsóbb ár+publikált-vélemény-aggregátum →
  `BoardForAdvisor[]` → `recommendBoards` → advisor_sessions insert (anonim is,
  best-effort) → display-DTO. Adat-helperek: catalog `listCheapestPriceByBoard`
  (+pickCheapestPerBoard teszt), reviews `listAllPublishedReviews`.
- advisor i18n (hu forrás + en tükör): nav + wizard.* + result.* + reason/level/use.
- `nav`: „Deszkaválasztó" (order 5) a fejlécben (registry-vezérelt).

**Éles verifikáció (Playwright + dev + távoli „Supbase"):**
- Wizard end-to-end: 85 kg / kezdő / allround / nagy tó lefutás → top ajánlás
  X100 11'0" (65% neked, 189 000 Ft) + 2 kompakt, a feloldott indoklásokkal
  (térfogat/kezdő szint, allround cél, terhelhetőség), adatlap-linkekkel.
- **F1.5 vélemény-flow ÉLESBEN lezárva** a `teszt@sup-platform.test` userrel:
  vélemény beküldve → a Közös nevező „van-adat" nézete renderel (5,0 átlag,
  100% ajánlaná, dimenzió-mércék 10-es skálán), a form „már írtál" + „Köszönjük"
  állapotra váltott.
- **Admin-moderáció verifikáció KÉSZ (2026-07-24, böngésző + éles „Supbase"):**
  a szerep-forrás javítás után `/admin/velemenyek` adminként **200** (korábban
  403). Végigkattintva: jelentés az adatlapról → megjelenik a panel „Jelentett
  vélemények" listájában → **elrejtés** (státusz `hidden`, a vélemény kiesik a
  publikus `published`-only Közös nevezőből) → **újra közzététel** (`published`)
  → **jelzés lezárása** (`resolved`, panel tiszta). Végállapot helyreállítva
  (Közös nevező 5,0 / 1 értékelés). A `verified_owner` kapcsoló csak a
  „Jóváhagyásra vár" (pending) szekcióban látszik — F1.5-ben nincs pending-queue,
  ezért a mostani flow-ban nem elérhető (nem blokkoló, azonos mechanizmus).

## F1.7 — Providers / szolgáltatói directory (2026-07-24)

Kiosztás: karmester (az F1.4/F1.5/F1.6 modul-mintát követve). A DB-séma és RLS
már F1.2-ben kész (providers + provider_spots + provider_leads migráció), ezért
F1.7 = modul + route + adatréteg + UI + i18n, ÚJ migráció nélkül. Kapuk zöldek:
typecheck · lint · 341 vitest (6 új providers-teszt). Éles Playwright-verifikáció
(dev + távoli „Supbase", admin-session).

**Elkészült (`src/modules/providers/`):**
- `types.ts` (ProviderRow/Service-type/Tier/Lead + linked-spot), `module.ts`
  (routes: `szolgaltatok`, `szolgaltatok/uj` [requiresAuth], `szolgaltatok/:slug`;
  adminPanel: `szolgaltatok`; nav order 20), `i18n.ts` + `locales/{hu,en}`
  (kulcs-paritás), registry + registry-i18n regisztráció.
- `data/providers.server.ts`: `listProviders` (+ tiszta `sortProvidersForList` —
  premium elöl, azon belül név), `getProviderBySlug` (slug-alak-guard `^[a-z0-9-]+$`
  a `.or()` szűrő-injektálás ellen), `listLinkedSpots` (provider_spots→spots join),
  `insertLead` (insert-gate: e-mail-forma + RLS `provider_leads_insert_any`),
  `insertProvider` (owner=self; tiszta `slugify` ékezet-hajtással + `resolveUniqueSlug`
  ütközés-feloldás; verified/tier a triggerrel biztonságos defaultra), admin
  `listProvidersByVerified` + `setProviderVerified`. 6 unit-teszt (slugify, sort).
- `ui/ProviderCard.tsx`: név + típus-chipek + „Kiemelt" (semleges chip, NEM
  StatusBadge) + „Hitelesített" (biztonsági StatusBadge safe) / „Hitelesítés
  folyamatban" jelvény + leírás-kivonat.
- Route-ok: `/szolgaltatok` (lista + típus-szűrőchipek + „regisztráld" CTA),
  `/szolgaltatok/:slug` (profil: fejléc + jelvények + elérhetőség + kapcsolódó
  spotok [route-rétegben kötve, a providers NEM importál spots-t] + lead-form),
  `/szolgaltatok/uj` (requireUser; saját listing felvétele → redirect az új
  profilra), `/admin/szolgaltatok` (requireRole('**admin**') — a `verified`
  jelvényt a `protect_provider_columns` trigger CSAK adminnak engedi, a
  moderátor verify-ja némán no-op lenne; verify/unverify).

**Éles verifikáció (Playwright, mind az 5 flow):**
- Directory: 5 seed-szolgáltató, típus-szűrő, kártyák; nav-ban „Szolgáltatók".
- Profil (SUP Balaton): elérhetőség (mailto), kapcsolódó spotok (Balatonföldvár +
  Siófok, /spotok-linkkel), lead-form e-mail-előtöltéssel a session-ből.
- Lead beküldve → „Köszönjük!" (insert-gate zöld).
- Admin-panel: Tisza-tavi hitelesítve → átkerült a „Hitelesített" szekcióba, a
  publikus listán „Hitelesített" StatusBadge jelenik meg (trigger adminnak engedi).
- Új listing: „Balázs SUP TúraBázis" beküldve → slug `balazs-sup-turabazis`
  (ékezet-hajtás), redirect a profilra, „Hitelesítés folyamatban" (a trigger
  user-insertnél verified=false-ra kényszerít ✓). Nincs valós konzol-hiba.

**Follow-upok / nyitott kis tételek (nem blokkolók):**
- **Seed↔trigger interakció:** a `providers` seed közvetlen SQL-inserttel fut
  (nincs `auth.uid()` → `is_admin()`=false), így a `protect_provider_columns`
  trigger a seed `tier='premium'`/`verified` szándékát felülírja `free`/`false`-ra.
  Ezért élesben EGYETLEN provider sem premium/verified alapból. Ha demo-jelleggel
  kell hitelesített/kiemelt példa: seed UTÁNI admin-update, vagy a seed-context
  triggerkerülése (db-engineer, F1.10 seed-revízió). A `sortProvidersForList`
  premium-elöl logikája helyes, csak nincs premium sor az adatban.
- **Meglévő seed-listing „átvétele" (owner=null → user):** a jelenlegi claim =
  önkiszolgáló ÚJ listing (owner=self). A már seedelt, gazdátlan sorok user általi
  átvétele owner-hozzárendelést igényelne, amit az RLS csak adminnak enged — ehhez
  külön `provider_claims` request/approve tábla (ÚJ migráció, db-engineer) kellene.
  Elhalasztva; nem blokkoló.
- **Éles teszt-artefaktumok (a verifikáció hagyta a távoli DB-ben):** „Balázs SUP
  TúraBázis" provider (owner=admin), egy lead a SUP Balatonon, és a Tisza-tavi
  `verified=true`. Ártalmatlan dev-adat; az F1.10 tiszta `db push --include-seed`
  reset-eli. Nincs törlő-UI (admin-panel csak verifikál); DB-törlés a rossz-projekt
  token-csapda miatt szándékosan elmaradt.

## F1.8 — SEO-réteg + consent + jogi oldalak (2026-07-24)

Kiosztás: karmester (scaffolder+auth-security-minta). Kapuk zöldek: typecheck ·
lint · 359 vitest (+15 új: page-seo, sitemap, consent). SSR/curl-verifikáció a
dev-szerveren. A `user_consents` migráció + pgTAP a CI `rls-tests` jobban fut
(lokálisan nincs Docker/Postgres); éles push jóváhagyással.

**Mag KÉSZ (5 al-lépés):**
1. **Loader-alapú meta + hreflang** (`@core/seo/page-seo` `buildPageSeo` +
   `serverT` szerver-oldali fordító + `siteOrigin`/`absoluteUrl`; `VITE_PUBLIC_SITE_URL`
   env vagy kérés-origin fallback). Minden fő route-on (home, deszkak[/:slug],
   spotok[/:slug], deszkavalaszto, szolgaltatok[/:slug]) locale-helyes title/
   description/OG + canonical + hreflang. SEO-kulcsok a namespace-ekben (hu+en).
2. **JSON-LD** az adatlapokon (`@core/seo/json-ld` `<JsonLd>` + a meglévő builderek):
   Product+AggregateRating+Offer (deszka), Place+geo (spot), LocalBusiness (provider).
3. **sitemap.xml + robots.txt** resource route-ok (`@core/seo/sitemap`
   `buildSitemapXml`; dinamikus slugok a 3 modulból; 96 URL). robots tiltja az
   /admin, /auth, /szolgaltatok/uj, /kijelentkezes utakat + sitemapre mutat.
4. **Consent** (verziózott, jövőálló): ÚJ core-migráció `20260717090500_core_user_consents.sql`
   — `user_consents (user_id, kind, version, granted_at)` append-only napló, RLS
   (own select/insert, admin delete), `record_signup_consents` trigger (a
   signup-metaadatból írja, mert az e-mail-megerősítés miatt regkor nincs session).
   `@core/consent` (CONSENT_VERSION="2026-07", REQUIRED=[terms,privacy] + marketing
   jövőre; `getMissingRequiredConsents`/`recordConsents`). Regisztrációs
   **checkbox** (kötelező, ÁSZF+adatvédelmi linkkel, `consent_version` metaadat).
   **Retroaktív re-consent:** `/beleegyezes` route + root-loader banner (bejelentkezett
   usernél a hiányzó consent-et jelzi; fail-safe, ha a tábla még nincs kitolva).
5. **Jogi oldalak** (`@core/legal`): `/aszf` + `/adatvedelem` kétnyelvű, strukturált
   tartalommal (a Hullám-projekt `ÁSZF_SEO/aszf-maradjaktivpecs.md` struktúrája
   alapján, SUP-platformra adaptálva: időjárás/SUP-index-disclaimer, szolgáltatói-
   directory-disclaimer, felhasználói tartalom). Cégadatok `[KITÖLTENDŐ: …]`
   placeholderek (`entity.ts`, verzióhoz kötve). Lábléc a site-wide eléréshez.
   **A közösségi belépésre (Google/Apple) már utal az ÁSZF 7. és az adatvédelmi
   2./4. szakasza** (a most kért reg-bővítéshez).

**Fontos SEO-döntés (javítás):** a `/en/...` route-ok NINCSENEK bekötve (en csak
CEE-terjeszkedésnél élesedik), ezért bevezetve az `activeLocales=["hu"]` — a
hreflang/sitemap CSAK élő locale-t hirdet (nincs 404-es /en URL a crawlernek).
Amikor az en-routing élesedik: `activeLocales`-hez add az `en`-t.

**Jogi tartalom forrás (referencia):** a felhasználó saját, más projektben
használt ÁSZF-anyagai: `/Volumes/Endre_Samsung1T/Hullám/weblap/ÁSZF_SEO/`
(`aszf-maradjaktivpecs.md` kész minta, `aszf-kitoltendo.md` a kitöltendő cégadat-
mezők, `cookie-tajekoztato-maradjaktivpecs.md`). A codesummon.org/terms
GDPR-struktúrája is irányadó volt az adatvédelmihez.

**HÁTRA (F1.8b / F1.10):**
- **OG-kép dinamikus generálás** (advisor megosztás-kártya + deszka-adatlap) —
  technikai döntéssel (satori/resvg vagy edge function). Elhalasztva.
- **Persona-landingek** — terméki definíció kell.
- **`user_consents` migráció éles push** (jóváhagyással) — addig a re-consent
  banner fail-safe kikapcsolt (a tábla hiánya nem crashel).
- **Cégadatok kitöltése** a jogi oldalakon (`entity.ts` `[KITÖLTENDŐ: …]`).

## F1.8b — Regisztráció-bővítés: jelszó-visszaállítás + Google/Apple belépés (2026-07-24)

Kód KÉSZ (a felhasználó kérésére, „mindhárom mód most", együtt az F1.8-cal).
Supabase Auth natív — nem építettünk sajátot. Kapuk zöldek: typecheck · lint · 359 vitest.

**Elkészült:**
- `/auth/oauth` action-route: `signInWithOAuth({provider})` (allowlist: google|apple)
  → provider-redirect; a visszatérést a MEGLÉVŐ `/auth/callback` kezeli
  (exchangeCodeForSession). `safeRedirect` a redirectTo-n (nincs open-redirect).
- `app/auth/OAuthButtons.tsx`: „Folytatás Google/Apple-fiókkal" (POST `/auth/oauth`,
  progressive enhancement) — bekötve a `/belepes` és `/regisztracio` oldalra.
- `/elfelejtett-jelszo`: `resetPasswordForEmail` (Turnstile, user-enumeráció ellen
  mindig „elküldve"; redirectTo = `/auth/callback?redirectTo=/uj-jelszo`).
- `/uj-jelszo`: requireUser (recovery-session a callback után) → `updateUser({password})`,
  min. 8 karakter. „Elfelejtetted a jelszavad?" link a belépőn.
- i18n: auth.oauth / forgotPassword / newPassword kulcsok (hu+en) + error-kulcsok.
- Verifikáció (curl, anon): a gombok + linkek renderelnek, a guardok (302) állnak.

**OAuth↔consent (megoldva):** az OAuth-signup KIHAGYJA a reg-consent-checkboxot,
de az F1.8 retroaktív re-consent bannere elkapja: első belépéskor a `/beleegyezes`
oldalra irányítja. Így a közösségi belépő userek is elfogadják a feltételeket.

**FELHASZNÁLÓI TEENDŐ (Dashboard, kód nélkül nem él élesben):**
- **Google:** Google Cloud OAuth 2.0 kliens (client ID + secret) → Supabase
  Dashboard → Authentication → Providers → Google. Redirect URL: a Supabase
  callback (`https://<project>.supabase.co/auth/v1/callback`). Ingyenes.
- **Apple:** Apple Developer-fiók (~99 USD/év), Services ID + kulcs → Providers → Apple.
- Bekapcsolásig a gombok redirectelnek, de a Supabase provider-hibára fut (a kód kész).

## F1.6-utó/2 — Deszkaválasztó: szakmai kalibráció három forrásból (2026-07-26)

A felhasználó saját kutatása (`Kezdők_tanácsok/sup-kezdo.md`) + két magyar
piaci útmutató (supzone.hu, supshop.hu) alapján összevetettük az algoritmust a
szakirodalommal. Teljes elemzés: **`docs/ADVISOR_DOMAIN_REVIEW.md`**.
Kapuk zöldek: typecheck · lint · 444 vitest · 60 Playwright.

**A vizsgálat MÉRÉSSEL készült** (referencia-esetek végigfuttatva az éles
action-ön), nem szemrevételezéssel — ez fogta meg az alábbi blokkolót.

**BLOKKOLÓ VOLT: 96 kg fölött a kezdő NULLA ajánlást kapott.** Ok: a
`max_load × 0,66` szűrő 96 kg-hoz ≥145 kg terhelhetőséget kér, és az egyetlen
ilyen deszka `fishing` típusú, amit az allround cél-mapping kizárt. Az üres
állapot ráadásul félrevezetett („lazíts az árkereten", holott a felhasználó
nem is állított be árkeretet). **Javítva:**
- `heavyRiderKg` (90) fölött a `fishing` típus is engedélyezett allround/túra
  célra — a források „extra széles allround/fishing, nagy stabilitás, sok
  liter" kategóriaként kezelik;
- `explainNoMatch()` a DOMINÁNS kizárási okot adja vissza, és a terhelhetőségnél
  kimondja, hogy ez **biztonsági korlát, nem érdemes lazítani** rajta.
- Mérve: 100 kg → most Drift 10'10" (52 %); 110 kg → nincs találat, de a
  VALÓDI okkal.

**RENDSZERSZINTŰ JAVÍTÁS: sáv-alapú pontozás a monoton helyett.** A régi logika
szerint „minél nagyobb térfogat és minél szélesebb deszka, annál jobb" — a
szakirodalom viszont OPTIMUMOT ad meg (a túl nagy térfogat lassabb és
szelesebb, a túl széles deszka nagyobb terpeszt kíván). Új `bandScore`
primitíva, erre épül a térfogat-, szélesség-, vastagság- és hossz-illeszkedés.
A `stabilityScore` ezek súlyozott átlaga (45/40/15), és a **tapasztalati szint
nem a képletben, hanem a CÉLOKBAN** jelenik meg (a háromágú switch megszűnt).

**Kalibráció** (mind `advisor_weights`-ből hangolható): 65 kg → 290 L / 81 cm /
320 cm · 85 kg → 330 L / 83,4 cm / 336 cm · 100 kg → 360 L / 85,2 cm / 348 cm.
Egybevág mindhárom forrás méret-tábláival.

**A hossz bázisa a SÚLY lett** (a magasság csak korrigál, 1,2 → 0,5
együtthatóval): a két bemenet erősen korrelál, kétszer nem szabad beszámítani.
Korábban egy nehéz, alacsony evezős túl rövid deszkát kapott (100 kg/170 cm →
314 cm); most 346 cm. Teszt védi.

**Vastagság bekötve** (cél 14 cm ±3): a 12–15 cm-es sáv a jó, a 20 cm-esek
pontot veszítenek (magasabb súlypont). Az adat eddig kihasználatlan volt.

**Eredmény-fejléc:** mind a három cél-méret látszik (hossz cm + láb, szélesség,
térfogat) — a felhasználó lássa, mire méreteztünk.

**Mellékesen javítva:** az üres állapotnak nem volt `h1`-e (a lapnak nem volt
címsora — a11y).

**NYITVA maradt (felhasználói döntésre vár):** ár-padló (a `valueScore` még
mindig a legolcsóbbat jutalmazza, pedig a források szerint a nagyon olcsó szett
gyenge merevsége a STABILITÁST rontja) · kezdő→felfújható preferencia (most
nulla hatású, 20/20 felfújható) · biztonsági kiegészítők blokk (leash,
mentőmellény — termék-bővítés).

## F1.12 — Süti-mentes használati statisztika (2026-07-28)

A 12/6 pont („cookie-mentes analitika preferált, saját eseménynaplózás
Supabase-be") megvalósítva. Eddig SEMMI nem mért: élesedés után visszamenőleg
nem pótolható adatról van szó. Kapuk zöldek: typecheck · lint · **547 vitest**
(+19 új). **Élesítve és verifikálva.**

**A HATÁR, amit tudatosan vállalunk:** nincs süti, nincs eszköz-azonosító,
nincs IP, nincs user_id — még napi rotációjú látogató-hash sem (amit a
privacy-barát eszközök használnak). Következmény: **egyéni tölcsér nem
mérhető**, csak esemény-darabszám. Cserébe az adat nem alkalmas személy
azonosítására, és az adatvédelmi tájékoztatónk ígéretét (analitikai süti csak
külön hozzájárulással) betű szerint tartjuk. A fő kérdésünk így is
megválaszolható: hány kérdőív-megnyitásra hány ajánlás-megjelenítés jut.

**Írás CSAK definer-függvényen át.** A táblára NINCS insert-policy, tehát
közvetlenül senki nem írhat; az egyetlen út a `record_analytics_event()`, ami
zárt eseménynév-listát, útvonal-alakot és props-méretet ellenőriz. Olvasás:
admin-only. Élesben mind a négy viselkedés ellenőrizve (anon insert → 42501,
anon olvasás → üres, ismeretlen név → nem keletkezik sor, query-s útvonal →
levágva).

**A megosztott advisor-link TESTSÚLYT tartalmaz** (`?suly=85&magassag=180`) —
ezért az útvonalról a query-t KÉT helyen is levágjuk: a szerver-oldali
helperben és magában az SQL-függvényben. Élesben ellenőrizve: a tárolt érték
`/deszkavalaszto`, paraméterek nélkül.

**A mérés nem törhet el és nem lassíthat oldalt:** minden hiba elnyelve
(nincs `throw` egyetlen ágon sem), és 1,5 s-os időkorlát — ha a DB lassú, az
esemény elveszik. Ez elfogadható ár egy statisztikáért.

**Nem mérünk:** robotot (`isbot`), `DNT: 1` vagy `Sec-GPC: 1` jelzést küldő
böngészőt, és **dev-módot**. Az utolsót élő próba kényszerítette ki: a lokális
dev-szerver a TÁVOLI adatbázisba ír, tehát a saját kattintgatásom azonnal
bekerült az éles statisztikába (6 sor). Kizárás után három oldalbetöltés
nulla új eseményt adott; a dev-eredetű sorokat töröltem, a tábla üresen várja
az első valódi forgalmat.

**Admin-felület:** `/admin/analitika` (requireRole admin) — tölcsér-arány,
eseményenkénti összeg, napi bontás. Szándékosan grafikon nélkül: a kérdés
egyetlen aránnyal megválaszolható, egy diagram itt díszítés lenne. A
tölcsér-arány 100% fölé is mehet — a megosztott linket megnyitók egyből az
eredményt látják; ez információ, nem hiba (a súgó-szöveg is kimondja).

**Jogi szöveg frissítve** (`@core/legal`, hu+en): az adatvédelmi tájékoztató
5. szakasza most tételesen leírja a süti- és azonosító-mentes mérést, a
DNT/GPC-tiszteletet, és hogy egyéni út nem rekonstruálható.

**Fájlok:** migráció `20260717092000` (tábla + kényszerek + definer-RPC +
admin-only RLS + `analytics_daily` nézet) · `@core/analytics` (events,
analytics.server, analytics-query.server) · `/admin/analitika` route + i18n ·
pgTAP `06_analytics_test.sql` · `SECURITY_FINDINGS.md` F1.12-01 (a végpont
kívülről is hívható — elfogadott kockázat, indoklással).

## F1.11b — Póráz-figyelmeztetés folyóvízre (2026-07-27)

Az F1.11 folytatása: ha már tudjuk, hogy a spot folyó, a legfontosabb
folyó-specifikus SUP-szabályt is ki kell mondani. Kapuk zöldek: typecheck ·
lint · **527 vitest** · **66 e2e**.

**A szabály:** álló vízen a bokapóráz a helyes választás (a deszka a
mentőeszköz), sodró vízen viszont beakadhat víz alatti akadályba, és a sodrás
a víz alá szoríthat — folyón gyorskioldós DERÉKpóráz kell. A felhasználó saját
forrása (`Kezdők_tanácsok/sup-kezdo.md`) ezt óvatosan fogalmazza meg („folyóra
gyakran más megoldás biztonságosabb"); a szövegünk kimondja a konkrét okot is,
mert a „miért" nélkül a tanács nem meggyőző.

**Hol jelenik meg:** a folyó-spotok adatlapján ÉS a Deszkaválasztó eredményén,
ha a felhasználó folyót választott. Tavon egyik helyen SEM — ez nem részletkérdés:
a tavi evezősnek pont hogy RAJTA kell hagynia a bokapórázt, egy oda nem illő
figyelmeztetés tehát rossz irányba terelne. E2E-teszt mindkét irányt őrzi.

**Modul-szerződés:** két modulnak (spots + advisor) kellett ugyanaz a tartalom,
ezért a szöveg a CORE i18n-namespace-ben él, a megjelenítés pedig az új
`@core/ui/SafetyNote` komponensben — ugyanaz a minta, mint a `RatingBar`-nál.

**Token-döntés:** a SafetyNote SZÁNDÉKOSAN nem használ biztonsági színt. A
`--safe/--caution/--danger` család a MÉRT, éppen fennálló állapoté (2. fejezet
3.); egy mindig érvényes szabály ezekben a színekben felhígítaná a
státusz-szemantikát — a felhasználó megszokná a riasztás-színt ott, ahol nincs
friss veszély. Ezért a természetvédelmi blokk semleges `sand` mintáját követi.
Teszt őrzi, hogy ne szivárogjon be `bg-safe/caution/danger`.

**Nyitva marad (termékdöntés):** a teljes kiegészítő-blokk (mentőmellény, pumpa,
szárazzsák, konkrét termékajánlással) — a domain-review 2.8. Most a
biztonságkritikus magot (póráz + mentőmellény-mondat) építettük meg, terméklista
nélkül.

## F1.11 — Folyó-spotok vízállása: a SUP-index utolsó adóssága (2026-07-27)

Az 5.1/6 pont eddig FIX −1 büntetést adott minden folyó-spotra, függetlenül
attól, hogy a folyó nyugodt nyári vízálláson van-e vagy árad. Kapuk zöldek:
typecheck · lint · **524 vitest** (+9 komponens, +16 adapter, +9 index/batch,
+4 árvíz-riasztás) · 64 e2e. **ÉLESÍTVE ÉS BÖNGÉSZŐBEN VERIFIKÁLVA** (lent).

**A FORRÁS-DÖNTÉS a lényeg.** A spec HydroInfo-scrapinget írt elő (a felhasználó
DunApp-projektjéből portolva). A DunApp kódját megnézve kiderült, hogy ott a
JELENLEGI adat már nem scrape-ből jön, hanem a **vizugy.hu (OVF) REST API-ból**
— és ez az API mércénként megadja a **HIVATALOS árvízvédelmi készültségi
küszöböket** (KF1/KF2/KF3 = I./II./III. fok). Ez döntötte el az egész
tervezést: nem kellett cm-sávokat kitalálnunk, a küszöb hatósági érték.
(Ugyanez a „ne gyárts hamis pontosságot" elv, ami az advisor ár-padlóját is
nyitva tartja.)

**Az algoritmus a MEGLÉVŐ vihar-override mintájára épül** (nem új mechanizmus):
I. fok → index-plafon 3,9 · II. fok → 2,0 · III. fok → 0 („Tilos"). Vihar ÉS
árvíz együtt: a SZIGORÚBB plafon marad (`Math.min`). A plafonok
`advisor_weights`-ből hangolhatók, deploy nélkül. A III. fok ugyanúgy „Tilos"
státuszt kap a UI-ban, mint a II. fokú viharjelzés — az m5-minta kiterjesztve.

**FAIL-SAFE minden ponton:** ha a vizugy elérhetetlen, a batch fut tovább (a
vízállás hiánya nem buktathatja az EGÉSZ időjárás-szinkront) · ha a mércének
nincs hivatalos küszöbe, nem találunk ki fokozatot (`null` ≠ 0. fok) · ha nincs
vízállás-adat, marad a régi alap-büntetés, változatlan viselkedéssel.

**A mérce-párosítás nem távolság-kérdés — ezt mérés fogta meg.** Győrnél a
LEGKÖZELEBBI mérce (0,3 km) a **Rábán** van, nem a Mosoni-Dunán: a folyónak is
egyeznie kell. A Római-partnál pedig a közelebbi Óbuda-mércének **nincsenek
készültségi szintjei**, ezért a 8,7 km-re lévő budapesti mérce a helyes forrás.
Végleges hozzárendelés: Szeged/Tisza → 2275 · Győr/Mosoni-Duna → 18 (Bácsa) ·
Római-part/Duna → 1026 (Budapest).

**Élő verifikáció (2026-07-27, valódi API):** auth → 1193 állomás → idősor →
minta+tendencia → fokozat. Mindhárom mércénk 0. fokon (Szeged 61 cm, Bácsa
207 cm, Budapest 36 cm), a küszöbök 650/750/850, 450/550/600, 620/700/800.
A fixture-ök ebből a válaszból készültek — kézzel gyártott mintán a magyar
mezőnevek (`Tsz`, `MdrNev`, `KF1`) eltérése észrevétlen maradt volna.

**Adatkor — külön küszöb, indoklással:** a mércék ÓRÁNKÉNT jelentenek, ezért a
30 perces általános stale-szabály itt minden adatot elavultnak jelölne, és
kiüresítené a jelzést. A vízállás a saját, 150 perces küszöbét kapta (két
kimaradt jelentést tűr), és a MÉRÉS saját időbélyegét mutatjuk, nem a
lekérésünkét. A 30 perces szabály a szél/viharjelzés adatokon ÉRINTETLEN.

**Amit szándékosan NEM használunk:** a vízhozam (m³/s) és a vízhő (°C) hézagos
— az általunk használt mércék közül a hozam csak kettőn, a vízhő egyetlenen
jön óránként. Egy csak néhány spoton működő jelzés rosszabb a semminél, mert
a hiányát a felhasználó nyugalomnak olvasná. Ha később sűrűbb lesz, bekötjük.

**Fájlok:** `_shared/vizugy.ts` (+teszt, valódi fixture-ökkel) · SUP-index
mindkét másolatában az árvízi ág (bit-azonos, külön tesztekkel) ·
`weather-sync` batch + Deno-héj · migráció `20260717091900` (spots.vizugy_tsz,
4 snapshot-oszlop értékkészlet-kényszerrel, nézet-bővítés, seed) · pgTAP-
kiegészítés · `spots/ui/WaterLevel.tsx` + i18n (hu/en).

**ÉLESÍTVE ÉS VERIFIKÁLVA (2026-07-27, felhasználói jóváhagyással):**
1. Migráció kitolva (`db push --include-all` — a 099000-es GDPR-migráció
   magasabb időbélyege miatt kellett a flag, ahogy F1.9-ben is).
2. `weather-sync` újradeployolva; kézi hívás → **15/15 spot OK, `riverGauges: 3`**.
3. Éles adat a snapshotokban: Szeged 62 cm · Bácsa 207 cm · Budapest 34 cm,
   mind 0. fokon, a mérés saját időbélyegével. Az óránkénti cron azóta magától
   írja (a verifikáció közben le is futott, valódi adattal).

**A KIKÉNYSZERÍTETT TESZT AZONNAL FOGOTT EGY VALÓDI HIBÁT.** Mivel élesben
mindhárom mérce 0. fokon áll, a fokozat-ág csak szimulációval ellenőrizhető:
egy ideiglenes sorral (`source='teszt-vizallas'`, 900 cm, III. fok)
kikényszerítettük az állapotot. Ekkor derült ki, hogy a teljes képernyős
riasztás a VIHARJELZÉS szövegét mutatta árvízre: „másodfokú viharjelzés van
érvényben" és „Várható széllökés: 10 km/h" — **szélcsend mellett** —, a
menekülési tanács pedig szél-specifikus volt („csökkentsd a szélfelületet"),
ami áradó folyón félrevezető, sőt veszélyes.
**Javítva:** a `StormAlertScreen` `variant` propot kapott (`storm` | `flood`),
saját i18n-blokkal (hu+en). Az árvíz-változat a sodrásról, az uszadékról és a
vízbe lógó fákról szól, és a vízállást írja ki a széllökés helyett. A keret
(ikon, vízimentő-CTA, forrás-sor) közös. Ha mindkét ok fennáll, a viharjelzés
győz (a szél az azonnal ható tényező). 4 új teszt védi, köztük egy, ami
kimondottan azt őrzi, hogy árvíznél NE szerepeljen a „viharjelzés" és a
„széllökés" szó.

A teszt-sorok törölve (ellenőrizve: 0 maradék), a spotok az éles adatot mutatják.

## F1.10/10 — A termék neve: „Suptime" (2026-07-27)

A felhasználó eldöntötte a nevet (a domaint másnap regisztrálja), így az F1 óta
nyitva álló **`[APPNÉV]` placeholder feloldva** — 28 helyen. Kapuk zöldek:
typecheck · lint · 482 vitest · 64 e2e · 7 vizuális.

**Ez nem kozmetika volt:** a placeholder RÁ VOLT ÍRVA a megosztás-kártyára is,
tehát minden megosztott link „[APPNÉV]"-vel jelent volna meg a Facebookon.

**Hol él a név, és miért pont ott** (`src/core/brand.ts` fejléce is felsorolja):
- **`APP_NAME`** (`@core/brand`) — a TypeScript-kód EGYETLEN forrása; a 10
  route-`meta` innen kapja a címet (eddig mindegyikben be volt égetve).
- **i18n-fájlok** — ott a név lefordított MONDATOK része („… | Suptime"), a
  fordítás pedig nem hivatkozhat kódra. hu + en, 5 namespace.
- **`public/og/default.png`** — a kártyára RAJZOLVA.
- **`public/sw.js`** (a service worker nem éri el a bundle-t) és a
  **`basic-auth.ts` realm-je** (Deno-runtime, külön fordítási egység).
Névváltáskor ez az öt hely a teljes lista: `grep -ri suptime`.

**A megosztás-kártya mostantól ÚJRAGENERÁLHATÓ.** Az F1.10/8-as változatot csak
PNG-ként commitoltuk, a generáló HTML eldobódott — a névváltás ezt azonnal
számon kérte. Most a forrás is bent van (`scripts/og-card.html` +
`node scripts/generate-og.mjs`, a meglévő Playwright-chromiummal).

**A repó és a dokumentáció munkaneve marad „SUP Platform"** — az belső
megnevezés, a felületen nem jelenik meg. A fejlesztési dokumentáció fejléce
rögzíti a döntést.

**Mellékesen javítva (valós, éles adat fogta):** a spot-adatlap e2e-tesztje a
szigorú `h1`-keresővel elhasalt, amikor a mérés közben ÉLESBE váltott egy
II. fokú viharjelzés — a teljes képernyős riasztásnak saját `h1`-e van. Ez
véletlenszerű piros lett volna (a lokális futás a távoli DB-t nézi); a teszt
mostantól az első címsorra vár, kommentben az okkal.

## F1.10/9 — Teljesítmény-kapu: LCP-mérés (2026-07-27)

Az audit UTOLSÓ nyitott hiánya (`AUDIT_F1.md` 6.1) lezárva. Kapuk zöldek:
typecheck · lint · 482 vitest · 64 e2e · 5 perf.

**A mérés a PRODUKCIÓS build ellen megy, nem a dev-szerver ellen.** A dev nem
bundle-öl, nem minifikál és HMR-kódot is szállít — abból mért LCP semmit nem
mondana. Az F1.10/3 óta viszont nincs `npm run start`, ezért új futtató:
`scripts/serve-build.mjs` (statikus fájl a `build/client`-ből + a generált
SSR-handler, ugyanabban a sorrendben, ahogy a Netlify csinálja).

**Fojtás Lighthouse-mobil profillal** (150 ms RTT / 1,6 Mbps / 4× CPU, CDP-n).
Fojtás nélkül minden localhost-mérés pár száz ms lenne, és a kapu semmit nem
fogna meg.

**A módszertan MAGA fogott egy hibát:** az első futásnál a `/spotok` **2764 ms**
LCP-t adott — a 2500-as budget FÖLÖTT. Az ok nem az oldal volt, hanem a mérés:
a lokális szerver tömörítés nélkül szállított, a Netlify viszont br/gzip-pel.
Fojtott hálózaton ez a legnagyobb egyetlen tényező. Tömörítés bekapcsolása után
UGYANAZ a build **944 ms**. Tanulság: egy hűtlen mérőeszköz nem konzervatív,
hanem hamis riasztást ad — és a hamis riasztás pont annyira rombolja a kapu
hitelét, mint az elnézett hiba.

**Alapérték (macOS, 2026-07-27):** `/` 584 ms · `/deszkak` 528 ms ·
`/deszkavalaszto` 588 ms · `/spotok` 944 ms. Kliens-JS (brotli, átvitt):
130 / 132 / 135 / 395 kB.

**Két kapu, két jellegű küszöbbel:** az LCP-budget a SPEC célján marad
(2500 ms) — szorosabb küszöb a gépek közti szórásra bukna, nem regresszióra.
A JS-budget viszont mért értékhez igazított (~35 % fejtér), mert
determinisztikus: ugyanaz a build ugyanannyi bájt. Külön teszt mondja ki, hogy
a **MapLibre csak a térképes útvonalon** töltődik — ha kikerülne a dinamikus
importból, minden oldal megfizetné, és a puszta budget-bukás nem nevezné meg az
okot.

**CI-ban SZÁNDÉKOSAN nem fut** (a vizuális kapuval azonos indok: osztott futók
ingadozó CPU-ja → hamis piros). Release előtti kapu, a runbookban leírva.
Az ÉLES oldal mérése a publikussá tétel után: `PERF_BASE_URL=https://… npm run e2e:perf`.

**Mellékesen javítva:** a `SpotMap.test.tsx` maplibre-mockjából hiányzott az
`once` — a betöltés-jelző (F1.10-es animált hullám) óta minden futás 3 kezeletlen
elutasítást írt. A tesztek zöldek voltak, de a kezeletlen hiba elfedhet valódi
regressziót.

**Élesítési döntések (felhasználóval egyeztetve, 2026-07-27):**
- **Captcha:** a Turnstile-kód kész, de éles kulcs NINCS és egyelőre nem is lesz
  — a jelszó-kapu mögött nincs mit védeni. A felhasználó a publikussá tételkor
  regisztrál a (ingyenes) Cloudflare-fiókra. Tisztázva: a Turnstile **nem
  hosting** — a domain nem költözik sehova; és a Supabase-nek nincs saját
  captchája, csak hCaptcha/Turnstile közül lehet választani. Elfogadott
  kockázatként rögzítve: `SECURITY_FINDINGS.md` **F1.10-05**.
- **E-mail-küldés:** a beépített Supabase-küldő próbára való (néhány levél/óra,
  best-effort). Éles SMTP a **Resend**-en át lesz — előfeltétele a saját domain
  (a `*.netlify.app` aldomain nem hitelesíthető feladóként). `SECURITY_FINDINGS.md`
  **F1.10-06**.
- Mindkettő + a cégadatok + a mérés bekerült a `RUNBOOK.md` **élesítési
  checklistjébe**, sorrendben (a domain a többi előfeltétele).

## F1.10/8 — OG megosztás-kártya (2026-07-27)

**A hiány:** a megosztott linkeknek EGYÁLTALÁN nem volt képük — `og:image` sehol
nem szerepelt. Az F1.1-es `og-image.ts` STUB nem létező útvonalakat adott vissza
(`/og/board/<slug>.png`), és sehol nem volt bekötve.

**Elkészült:**
- Márkázott, 1200×630-as alapértelmezett kártya (`public/og/default.png`), a
  design tokenjeiből (petrol gradiens, hullám-motívum, amber jelvény).
  **Generálás:** a meglévő Playwright-tel, HTML→PNG — így NEM kellett új
  futásidejű függőség.
- `resolveOgImage()`: relatív útvonalat abszolúttá tesz (a crawlerek a
  relatívat nem oldják fel), a már abszolút külső képet érintetlenül hagyja,
  hiányzó képnél az alapértelmezettre esik.
- `buildMeta` kiegészítve: `og:image` + `width`/`height`/`alt` +
  `twitter:card=summary_large_image` (kép nélkül a Twitter/X kis kártyát rajzol).
- A deszka-adatlapok a SAJÁT termékképüket használják. **Jelenleg mind az
  alapértelmezettre esik vissza — helyesen: a katalógusban egyetlen deszkának
  sincs `image_url`-je.** Ez adathiány, nem kódhiba.

**SZÁNDÉKOSAN NEM készült futásidejű, dinamikus kártya** (pl. „X100 11'0" —
76% neked"). Az F1.8-terv ezt említette, de a satori + resvg-wasm páros ~8 MB
függőséget tenne a serverless csomagba, és MINDEN crawler-kérésnél lefuttatná
az ajánló-algoritmust. Ez az arány most nem indokolt; a döntés újranyitható, ha
a megosztás valós forgalmat hoz. (A `og-image.ts` fejléce is rögzíti az okot.)

## F1.10/7 — Megosztható eredmény + működő Megosztás gomb (2026-07-26)

Két, egymással összefüggő hiba a Deszkaválasztó eredményén. Kapuk zöldek:
typecheck · lint · 479 vitest · 64 e2e · 7 vizuális.

**1. Az eredménynek nem volt saját címe.** Az ajánlás KIZÁRÓLAG a POST-válasz
törzsében élt, aminek három látható következménye volt:
- újratöltésnél a böngésző űrlap-újraküldést kért,
- a vissza-gomb után az eredmény elveszett,
- nem lehetett könyvjelzőzni és megosztani.

**Javítás: POST→redirect→GET.** Az `action` mostantól VALIDÁL és átirányít
(`/deszkavalaszto?suly=85&magassag=180&…`), a számítás a `loader`-ben történik
a query-paraméterekből. Új tiszta modul: `select/url.ts` (kódolás oda-vissza,
10 unit-teszttel).

**Ahol a hibás bemenet számít:** az URL nem megbízható. A testsúly az egyetlen
kötelező adat — hiánya/érvénytelensége esetén a WIZARD jelenik meg, nem üres
eredmény vagy hibaoldal. A felsorolás-mezők (szint, cél, víz, utas) ismeretlen
értéknél a józan alapértékre esnek, mert egy megosztott linkből könnyen
kimaradhat vagy elromolhat egy paraméter.

**A session-log az ACTION-ben maradt, nem került a loaderbe** — szándékosan:
egy megosztott linket sokan megnyithatnak, és minden megnyitás új sort írna,
ami torzítaná az elemzést.

**2. A „Megosztás" gomb NEM CSINÁLT SEMMIT** (nem volt `onClick`) — és nem is
lett volna mit megosztania. Az 1. pont után van mit: új `ShareButton` a natív
`navigator.share`-rel, vágólap-tartalékkal és visszajelzéssel. Ha egyik sem
elérhető (régi böngésző), a gomb EL SEM JELENIK — jobb, mint egy gomb, ami
kattintásra nem tesz semmit (pontosan ez volt a hiba).

**Verifikálva:** POST → 302 a paraméteres URL-re; a kapott URL friss
munkamenetben, közvetlenül megnyitva is renderel eredményt; paraméter nélkül a
wizard jön; hibás paraméterek nem törik el az oldalt. Két új e2e-teszt fedi.

## F1.10/6 — FÁZIS-ZÁRÓ AUDIT (2026-07-26)

Teljes riport: **`docs/AUDIT_F1.md`**. Minden pont MÉRÉSSEL zárult
(parancs-kimenettel), nem szemrevételezéssel. **24/26 tétel zöld.**

**Zöld szakaszok:** modul-szerződés (4/4) · RLS-lefedettség (4/4) · biztonság
(3/3) · design+a11y (5/5) · dokumentáció (2/2).

**Kiemelt bizonyítékok:**
- **19 tábla, 19-en RLS** — 0 fedetlen. 10 pgTAP-fájl, 189 assert.
- **Az e-mail-gate KÉT rétegű:** 2 app-route + 7 DB-policy az
  `is_email_confirmed()` helperre — az app-réteg megkerülése sem nyit utat.
- **A biztonsági tokenek bizonyíthatóan érintetlenek:** a `tokens.css`-nek a
  projekt kezdete óta 2 commitja van, MINDKETTŐ 0 TÖRLÉSSEL — egyetlen sor sem
  módosult benne.
- **Semgrep tiszta, Snyk 0 produkciós finding**, nyitott HIGH/CRITICAL nincs.
- **468 unit + 60 e2e (benne axe WCAG 2.1 AA)** — mind zöld.

**KÉT HIÁNY (egyik sem blokkoló, mindkettő mérés-jellegű kapu):**
1. **Vizuális regresszió (screenshot-egyezés) NINCS.** A token-kritikus
   komponensek viselkedését unit- és a11y-teszt fedi, de a vizuális elcsúszást
   nem. **Ez a session két ilyet is felszínre hozott** (mobil nav-túlcsordulás,
   fejléc↔tartalom eltérés) — mindkettőt FELHASZNÁLÓI észrevétel, nem teszt.
   Azóta mindkettőre van regressziós teszt, de a hibaosztály nyitva marad.
   Kockázat: közepes.
2. **LCP-mérés (Lighthouse-budget) NINCS.** Az oldal jelszó-kapu mögött van,
   valós forgalom nélkül — a mérés a publikussá tétel előtt értelmes. Ismert
   terhelő tétel a MapLibre + a külső csempe-CDN. Kockázat: alacsony-közepes.

**Audit közbeni önkorrekció:** a hreflang-ellenőrzésem először 0-t mutatott, és
majdnem hibaként jelentettem — a saját `grep`-em volt kis-nagybetű-érzékeny.
A linkek ott vannak (`hrefLang` alakban), és a HTML attribútumnevek
kis-nagybetű-érzéketlenek, tehát a crawlerek helyesen olvassák.

## F1.10/5 — ELSŐ ÉLES DEPLOY (2026-07-26)

A `supperz.netlify.app` él, **jelszó-kapu mögött**. 11 commit + a `[deploy]`
jelölős commit kitolva; a build lefutott.

**Az első deploy ELHASALT — tanulságos módon.** Minden kérés `500`-at adott
(`uncaught exception during edge function invocation`). Ok: a
`WWW-Authenticate` fejléc realm-jébe **ékezetes karakter és gondolatjel**
került (`"SUP Platform — elő-éles"`), a HTTP-fejléc értéke viszont csak ASCII
lehet — a Deno `Headers` kivételt dob rá MINDEN kérésnél, még mielőtt a 401
elkészülne.

**Amit ez egyben bizonyított:** a kapu tényleg MINDENT lefed (a `/robots.txt`
is 500-at adott, nem tartalmat), és a biztonsági posztúra végig tartott — az
500 sem engedett be senkit. Kellemetlen hiba, de nem nyitotta ki az oldalt.

**Javítás (2. deploy):** ASCII-only realm + védőháló `try/catch`, ami
BÁRMILYEN váratlan kivételnél is ZÁRVA marad (401), nem 500-zal. Így ha később
elszáll valami az edge functionben, az oldal továbbra is védett, és a
böngésző jelszó-ablaka is előjön.

**Verifikálva (jelszó nélkül):** `/`, `/spotok`, `/deszkak`, `/robots.txt`,
`/sitemap.xml`, `/admin/velemenyek` → **mind 401**, helyes
`www-authenticate` fejléccel és `x-robots-tag: noindex, nofollow`-val.

**Tanulság a jövőre:** ez a hibaosztály lokálisan NEM fogható — a kód csak a
Netlify Deno-futtatókörnyezetében fut, ahol a `Headers` szigorúbb, mint
Node-ban. Ezért marad kötelező az első deploy utáni kézi ellenőrzés
(`docs/RUNBOOK.md`).

**HÁTRA (felhasználói lépés):** a HITELESÍTETT út ellenőrzése — helyes
jelszóval betöltenek-e az SSR-oldalak, és él-e a Supabase-kapcsolat
(a `VITE_` értékek build-időben épültek be).

## F1.10/4 — Nyitott kis tételek + Netlify jelszó-kapu (2026-07-26)

Kapuk zöldek: typecheck · lint · 444 vitest. Új dokumentum: **`docs/RUNBOOK.md`**
(éles műveletek lépésről lépésre).

**Netlify-helyzet TISZTÁZVA (felhasználói aggály).** A `supperz.netlify.app`
oldalon **semmi nem szivárgott ki**: minden útvonal (`/`, `/spotok`, `/deszkak`,
`/admin/velemenyek`, `/assets/`, `/robots.txt`, `/sw.js`, `/index.html`) **404**.
Az utolsó publikált verzió (júl. 19.) az SSR-adapter ELŐTTI, és SSR-módban a
React Router nem generál `index.html`-t → a `build/client` csak assetet
tartalmazott, kiszolgálható oldalt nem.
A **`[deploy]`-kapu is működik:** a júl. 19. utáni deployok mind `Canceled`
státuszúak, **build-idő nélkül** (a publikáltaknál látszik a „Deployed in Xs",
a canceledeknél nem) — tehát build-percet nem fogyasztanak.
**Döntés: a repót NEM kötöttük le** — a kapu megoldja a költséget, a lekötés
viszont elvenné a deploy previewt és a `[deploy]`-os élesítést. Ha kell még egy
réteg, a Deploy Previews kikapcsolása olcsóbb.

**ÚJ: elő-éles jelszó-kapu** (`netlify/edge-functions/basic-auth.ts`) — HTTP
Basic auth az EGÉSZ oldalra, mert a Netlify beépített jelszó-védelme fizetős.
**FAIL-CLOSED:** `SITE_PASSWORD` nélkül 503, nem publikus oldal — az elfelejtett
beállítás feltűnő hiba, nem csendes szivárgás. Élesítéskor NEM a jelszót
töröljük (az 503-at adna), hanem `SITE_PUBLIC=true`-t állítunk, hogy a
nyilvánossá tétel tudatos lépés legyen. Deno-runtime → tsc/ESLint kizárás a
Supabase-functionök mintájára. **Automata teszt nem fedi** (csak a Netlify
edge-én fut) — az első deploy után kézi ellenőrzés a runbook szerint.

**Nyitott kis tételek lezárva:**
- **m3 (`supindex.stale_minutes`) — KIVÉVE, nem bekötve.** Az adatkor-küszöb
  (30 perc) **biztonsági invariáns** (2. fejezet 5.), nem hangolható paraméter:
  ha DB-ből állítható lenne, egy elgépelt érték csendben kikapcsolhatná az
  „Elavult adat" jelzést. Kód-konstans marad, a holt seed-kulcs törölve (a
  jelenléte azt a téves benyomást keltette, hogy SQL-ből állítható).
- **`listLatestSnapshots` — NÉZETRE cserélve** (migráció `20260717091800`,
  élesben kitolva és verifikálva: 15 spot → 15 sor, spotonként pontosan egy).
  A régi „utolsó 200 sor + JS-reduce" a spot-szám növekedésével CSENDBEN romlott
  volna el (egyes spotok „nincs adat"-ként jelentek volna meg). A nézet
  `security_invoker = on` → a hívó jogaival olvas, az alaptábla RLS-e érvényes.
- **providers seed↔trigger — JAVÍTVA.** A seed a `protect_provider_columns`
  triggert a beszúrás idejére kikapcsolja, majd VISSZAKAPCSOLJA (a pgTAP-minta
  szerint), és két szolgáltatót `verified=true`-ra állít. Így a „premium elöl"
  rendezés és a „Hitelesített" jelvény éles adaton is látszik.
- **F1.2-reviewer follow-upok:** `amount_huf` update-revert külön assert a
  pgTAP-ban (eddig csak a `status`-t néztük — egy pénzügyi mező szivárgása
  észrevétlen maradt volna); `anonymize_user` runbook-jegyzet a
  `docs/RUNBOOK.md`-ben (service_role-only, mit csinál, mit NEM szabad).

**MEGMARADT nyitott tétel:** cégadatok a jogi oldalakon (`@core/legal/entity.ts`
`[KITÖLTENDŐ: …]`) — a felhasználó adja meg. MapLibre null-warning: külső
stílus-kifejezésből jön, nem a mi kódunkból; nem blokkoló, F2-re hagyva.

## F1.10/3 — Netlify SSR-adapter bekötése (2026-07-26)

Az F1.0 óta halasztott adapter (`@netlify/vite-plugin-react-router` 4.0.0)
bekötve a `vite.config.ts`-be. Kapuk zöldek: typecheck · lint · 444 vitest ·
60 Playwright · Semgrep tiszta.

**Build-kimenet:** `build/client/` (statikus assetek, ez a `publish`) +
`.netlify/v1/functions/react-router-server.mjs` (az SSR-t kiszolgáló Netlify
Function). A függvényt a Netlify automatikusan felismeri.

**Node-runtime, nem Edge — tudatosan:** az Edge (Deno) változat külön
verifikációt igényelne, mert az SSR-loaderek a Supabase Node-kliensét használják.

**A natív (Capacitor) build érintetlen:** az adapter csak akkor aktív, ha
`BUILD_TARGET !== "native"` — SPA-módban nincs SSR, tehát adapter sem kell.

**Füstteszt (nem csak „lefordult"):** a generált függvényt Node-ból meghívtuk
egy valódi `Request`-tel → **200, `text/html`, `<html lang="hu">`, renderelt
navigáció**. Az SSR tehát ténylegesen kiszolgál, nem csak legenerálódik.

**BREAKING a fejlesztői flow-ban: a `npm run start` MEGSZŰNT.** Az adapterrel a
szerver-build serverless handler, nem önálló Node-szerver — a `react-router-serve`
nem tudja futtatni (ezt a build utáni próba mutatta ki). A `@react-router/serve`
függőség is kikerült (így nem marad használatlan produkciós csomag).
Fejlesztés: `npm run dev`; a produkciós futtató a Netlify Function.

**`[deploy]`-kapu megmarad:** a `netlify.toml` `ignore` parancsa minden push
buildjét kihagyja, kivéve ha a legutolsó commit üzenete tartalmazza a
`[deploy]` jelölőt. Új: `NODE_VERSION = "22"` (a `engines` >=22-t ír elő).

**E2E-stabilizálás (valós hibából):** a Vite az ELSŐ oldalbetöltéskor
optimalizálja a függőségeket és újratölti a lapot — a `webServer` health-check
ezt nem várja meg, így a párhuzamos tesztek egy épp újrainduló szerverbe
futottak (lokálisan 9 db `page.goto` timeout, hibátlan kód mellett). Megoldás:
`e2e/global-setup.ts` sorosan bemelegíti a nehéz route-okat, és CI-ban a
teszt-timeout 60 s. Enélkül ez véletlenszerű piros CI lett volna.

**HÁTRA az első éles deployhoz (felhasználói lépések):**
1. Netlify site létrehozása / repo bekötése.
2. Környezeti változók a Netlify UI-ban — a `netlify.toml` alján tételesen
   felsorolva (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `VITE_PUBLIC_SITE_URL`, `VITE_VAPID_PUBLIC_KEY`, `VITE_TURNSTILE_SITE_KEY`).
   **A `VITE_` értékek BUILD-IDŐBEN épülnek be** → utólagos beállítás után
   újra kell buildelni.
3. Egy commit `[deploy]` jelölővel (vagy „Trigger deploy" a UI-ból).

## F1.10/2 — Biztonsági audit: Semgrep-kapu + finding-triage (2026-07-25)

Új dokumentum: **`docs/SECURITY_FINDINGS.md`** — a findingok élő nyilvántartása
(javítva / elfogadott kockázat / nyitott, mindegyik INDOKLÁSSAL). Az
`AUDIT_CHECKLIST.md` 3. pontja innentől ide mutat.

**Semgrep SAST-kapu élesítve** (`p/typescript`, `p/react`, `p/secrets`,
`p/owasp-top-ten`, `p/sql-injection`) — CI-ban minden PR-en, `--error`-ral
(találat = piros CI). A scan a teljes kódbázison (app + core + modulok +
Edge Functionök + SQL) **jelenleg TISZTA**.

**Findingok (részletek a SECURITY_FINDINGS.md-ben):**
- **F1.10-01 — react-router CSRF (high, GHSA-qwww-vcr4-c8h2): ELFOGADOTT
  KOCKÁZAT.** A sérülékenység KIZÁRÓLAG RSC-módban él; a projekt framework-módú
  SSR-t használ, RSC nincs bekötve (grep-pel ellenőrizve). Javítás csak a 8.3.0
  FŐVERZIÓBAN van (a 7.x ágon nincs patch), ezért F2-re ütemezve. **Kiváltó ok az
  azonnali frissítésre:** ha RSC-módot vezetünk be, még a bevezetés ELŐTT.
- **F1.10-02 — `dangerouslySetInnerHTML` a JSON-LD-ben: FALSE POSITIVE.** A
  `<script>`-ből csak `<`-gal lehet kilépni, amit a `jsonLdScript` mind
  escape-el; regressziós teszt védi. `nosemgrep` + indoklás a kódban. Ez a
  projekt EGYETLEN innerHTML-pontja.
- **F1.10-03 — mozgó GitHub Actions tagek: JAVÍTVA.** Minden `uses:` teljes
  commit-SHA-ra pinnelve (a `trivy-action`/`kics-github-action` kompromittálása
  pont mozgó tagen keresztül történt). Frissítéskor a SHA-t is cserélni kell —
  F2-ben Dependabotra bízandó.
- **F1.10-04 — Snyk NINCS bekötve: NYITOTT.** A CLI/MCP fiók-hitelesítést kér,
  ami felhasználói döntés; addig az `npm audit --omit=dev` a helyettesítő (ez
  fedte fel az F1.10-01-et is). Teendő: Snyk-fiók + `SNYK_TOKEN` secret + heti
  ütemezett workflow.

## F1.10/1 — Playwright e2e + axe a11y kapu (2026-07-25)

A 10. fejezet két hiányzó kapuja élesítve. Kapuk zöldek: typecheck · lint ·
433 vitest · **54 Playwright-teszt** (chromium + Pixel 7 mobil).

**Felállás:**
- `playwright.config.ts`: két projekt (desktop chromium + **mobil**, mert a
  projekt mobil-first és a layout-regressziók csak ott jönnek elő).
  `E2E_BASE_URL`-lel külső szerverre irányítható; enélkül maga indít
  `npm run dev`-et.
- **CI-ban LOKÁLIS Supabase-stack ellen fut** (`supabase db start`, ugyanaz,
  amit az `rls-tests` használ): a seed determinisztikus, és a tesztek NEM írnak
  az éles projektbe. A kulcsokat a `supabase status` adja — repository secret
  nem kell. Bukásnál a Playwright-riport artifactként feltöltődik.
- Az assertek VISELKEDÉST rögzítenek, nem darabszámokat: a lokális (távoli DB,
  dev-artefaktumokkal) és a CI-beli (friss seed) adat eltér, de mindkettőben
  igaznak kell lennie.

**Lefedve:** `e2e/public-paths.spec.ts` (nav a modulokból, deszka/spot/szolgáltató
lista→adatlap, 404 ismeretlen slugra, jogi oldalak, robots+sitemap [nincs `/en/`],
jogosultsági kapuk kijelentkezve, `/api/push` → 401 JSON) · `e2e/advisor.spec.ts`
(wizard→eredmény→adatlap, a testsúly+magasság kötelezősége, **a magasság hatása
az ajánlásra**, Közös nevező a kártyán) · `e2e/a11y.spec.ts` (axe WCAG 2.1 AA a
10 kulcsképernyőn).

**Az új kapu AZONNAL fogott 3 valódi hibát (mind javítva):**
1. **`/belepes` és `/regisztracio` cím (`<title>`) NÉLKÜL renderelt** — axe
   „document-title", serious. Képernyőolvasóval megnevezhetetlen lap, és a
   böngésző-előzményben is névtelen. Az F1.8 loader-alapú meta a fő route-okra
   került be, az auth-oldalak kimaradtak → `meta` export (noindexszel, mert
   SEO-értékük nincs).
2. **A Deszkaválasztó wizardnak nem volt `h1`-e** — a címsor-hierarchia h2-vel
   indult (axe „page-has-heading-one"). Kapott látható h1-et.
3. **Két `<nav>` landmark megkülönböztető név nélkül** (fejléc + lábléc) —
   `aria-label` mindkettőre (`nav.primaryLabel` / `nav.footerLabel`, hu+en).

**Regressziós védelem a korábbi hibákra:** külön teszt őrzi, hogy az oldal
SEHOL nem csúszik el vízszintesen (ez volt a mobil nav-hiba), és hogy a
sitemap nem hirdet `/en/` URL-t (F1.8-döntés).

**Tanulság a teszt-írásból:** a `runWizard` helper eleinte „bármilyen h1"-re
várt; amint a wizard maga is kapott h1-et (3. javítás), a helper azonnal
késznek hitte a lapot, és a teszt még a wizardon vizsgálódott. Azóta az
EREDMÉNY-lap konkrét címére vár — általános várakozás helyett mindig a
célállapotra jellemző horgonyt kell figyelni.

**Ami SZÁNDÉKOSAN nincs az automata csomagban:** az auth-os ÍRÁSI folyamatok
(vélemény, flag, moderáció, provider-claim, push-feliratkozás) — éles adatot
írnának, és böngésző-engedélyt/teszt-fiókot igényelnek. Ezeket a PROGRESS
kézi runbookjai fedik (F1.5/F1.6/F1.7/F1.9 szakaszok).

## F1.6-utó — Deszkaválasztó: testmagasság + Közös nevező az eredményen (2026-07-25)

Felhasználói visszajelzésből (kattintgatós körből) jött két hiányosság; mindkettő
javítva. Kapuk zöldek: typecheck · lint · 432 vitest (+15).

**1. Testmagasság mint bemenet (hiányzott).** A SÚLY a térfogatot adja
(felhajtóerő), a MAGASSÁG a deszka HOSSZÁT — magasabb evezősnek hosszabb deszka
fekszik jobban. Bevezetve:
- `AdvisorInputs.heightCm` + `BoardForAdvisor.lengthCm` (a `boards.length_cm`
  már megvolt, séma-módosítás NEM kellett).
- ÚJ, HATODIK rész-pont: `lengthFitScore` — `ideal = clamp(base_length +
  (magasság − base_height) × cm_per_height, min, max)`, a pont pedig
  `1 − |hossz − ideal| / tolerancia`. Defaultok: 175 cm → 320 cm, 1,2 cm/cm,
  290–380 cm korlát, 45 cm tolerancia — **mind az `advisor_weights`-ből
  hangolható** (6 új `advisor.length_fit.*` kulcs + `advisor.weight.length`=10
  a seedben).
- **PUHA szempont, tudatosan:** a hossz SOHA nem zár ki (külön teszt védi) — a
  kemény szűrés kizárólag biztonsági marad (térfogat, terhelhetőség). Hiányzó
  magasság vagy deszkahossz → semleges 0,5, nem büntetjük az adathiányt.
- A súlyok mostantól RELATÍV értékek: a pontszám a tényleges súlyösszeggel
  normálva megy 0–100-ra, ezért az öt eredeti súlyt nem kellett átskálázni.
- Wizard: kötelező magasság-mező (120–220 cm) a testsúly mellett, magyarázó
  súgóval. Az eredmény tetején kiírjuk az ideális hosszt cm-ben ÉS lábban
  (`cmToFeetInches`, mert a piac lábban nevezi a deszkákat) — enélkül a
  felhasználó nem látná, hogy a válasza számított (a rész-pont súlya csak 10 %,
  ezért ritkán kerül a top-2 indoklás közé).
- Élesben ellenőrizve: 85 kg / kezdő / allround inputtal 165 cm → „kb. 308 cm
  (10'1")", a top score 72 %; 192 cm → „kb. 340 cm (11'2")", 76 %, és a további
  ajánlások sorrendje is átrendeződik a hosszabb deszkák felé.

**2. Közös nevező az ajánlás-kártyán (nem jelent meg).** Az algoritmus HASZNÁLTA
a vélemény-átlagot, de az eredmény-képernyő nem mutatta.
- A `RatingBar` **átkerült a `@core/ui`-ba**: két modulnak (reviews + advisor)
  kellett, a modul-szerződés (1.3) szerint a közös igény a core-ba megy —
  modul→modul import tilos lenne.
- Az ajánlás-kártyákon (nagy + kompakt) most 10-es mérce + számérték +
  értékelés-szám látszik, LINKKÉNT a deszka-adatlap Közös nevező blokkjára
  (`/deszkak/<slug>#kozos-nevezo`; a horgony + `scroll-mt` felvéve az adatlapra).
  Értékelés hiányában őszinte üres-állapot („még nincs értékelés"), nem üres sáv.
- Token-szabály betartva: a `RatingBar` NEM a biztonsági Gauge, a `--danger`
  értékelés-sávon tilos, és a szám MINDIG a sáv mellett (szín + szöveg).
- **Bővítés (ugyanaznap, felhasználói kérésre): TELJES bontás a kártyán.** Nem
  csak az összesített szám, hanem a négy rész-szempont (stabilitás, siklás,
  minőség, ár-érték) mércéi + a „hányan ajánlanák" arány is ott van az
  ajánlásoknál — a választáshoz össze kell tudni hasonlítani a jelölteket
  anélkül, hogy mindegyikre át kellene kattintani. A `#kozos-nevezo` link
  megmaradt („Vélemények"), de már nem az EGÉSZ blokk link (a hosszú
  link-tartalom rossz a11y), és az aria-felirat sem ígér kattintást.
- A dimenzió-listát az advisor SAJÁT másolatban tartja
  (`ADVISOR_REVIEW_DIMENSIONS`), mert a reviews-ból importálni tilos —
  a másolat elcsúszását **őrszem-teszt** védi a route-rétegben
  (`app/routes/deszkavalaszto.dimensions.test.ts`), ahol mindkét modulhoz
  szabad nyúlni. Ha a reviews új szempontot vezet be, a teszt elhasal.

**Mellékesen javítva (a mobil-verifikáció fogta):** a fejléc-navigáció 375 px-en
kilógott, és az EGÉSZ OLDAL vízszintesen görgethető lett (minden route-on).
Mostantól maga a nav-sáv görgethető (`overflow-x-auto`, elrejtett scrollbar,
`shrink-0` + `whitespace-nowrap` az elemeken) — a dokumentum nem csúszik el
(ellenőrizve: scrollWidth == clientWidth 375 px-en).

## F1.9 — Web push + viharjelzés-pipeline (2026-07-25)

Kiosztás: karmester (a `web-push` skill Deno-mintája alapján, az F1.3 `_shared`
tiszta-logika + vékony-héj mintát követve). Kapuk zöldek: typecheck · lint ·
417 vitest (+58 új: web-push crypto, push-notify célzás, storm-alert push-ág,
push.server, m4). SSR/curl-verifikáció a dev-szerveren.

**Elkészült — küldő oldal (Edge Function):**
- `_shared/web-push.ts`: VAPID JWT (ES256) + RFC 8291 payload-titkosítás
  (aes128gcm) **natív `crypto.subtle`-lel, npm-függőség NÉLKÜL** (az
  `npm:web-push` Deno edge alatt megbízhatatlan). Node/Vitest-semleges, a
  hálózat injektált `fetch`-en jön. A 404/410 nem hiba, hanem `stale: true`.
- `_shared/push-notify.ts`: TISZTA célzás + üzenet-építés. Feliratkozásonként
  EGY üzenet, a saját spotjaira szabva; **explicit opt-in** (spot nélküli
  feliratkozás nem kap semmit). Üzenetek a 9./3. szerint: II. fok = „Tilos a
  vízen tartózkodni — azonnali partraszállás!" (critical), I. fok = fokozott
  óvatosság, visszaállás = „Újra evezhető"; MINDEGYIKBEN forrás + időbélyeg
  (9./4.). Azonos `tag` → az új riasztás felülírja a régit (nem torlódnak
  elavult üzenetek).
- `_shared/storm-alert.ts`: `notifyStormChange()` + `push` opcionális dep.
  **Fail-safe:** VAPID nélkül a push-ág kimarad; a snapshot-írás hibája NEM
  némítja el a push-t (és fordítva sem); egy feliratkozó hibája nem viszi a
  többit; a 410/404-es feliratkozásokat kitakarítja. Summary: `pushSent`,
  `pushStale`.
- `storm-alert/index.ts`: a push-deps bekötése (`overlaps("alert_spot_ids")`
  célzó lekérdezés, `sendWebPush`, törlés), spot `name`+`slug` a select-be.

**Elkészült — feliratkozó oldal (web):**
- ÚJ migráció `20260717090600_core_push_webpush.sql` (additív, az F1.2-táblát és
  RLS-t nem bolygatja): `endpoint` GENERÁLT oszlop a jsonb tokenből + UNIQUE
  index (egy böngésző-endpoint = egy sor, nincs duplikált riasztás), GIN index
  az `alert_spot_ids`-re, `updated_at`, és `upsert_push_subscription()`
  **SECURITY DEFINER** RPC. A definer-jogkör oka: **eszköz-átvétel** — ha ugyanaz
  az endpoint másik fiókkal jelentkezik be, a régi sort törölni kell, amit RLS
  alatt a hívó nem tehetne meg. A `user_id` MINDIG `auth.uid()`, sosem paraméter.
  pgTAP: `42_push_webpush_test.sql` (9 eset: generált oszlop, nincs duplikálás,
  hibás token, eszköz-átvétel, anon tiltás, idegen sor nem törölhető).
- `public/sw.js`: service worker — CSAK push + notificationclick.
  **Szándékosan nincs fetch-handler/offline cache:** cache-elt viharjelzés soha
  nem jelenhet meg aktuálisként (2. fejezet 5.). `requireInteraction` a kritikus
  riasztásokra. `public/icons/` értesítés-ikon + badge (petrol, hullám-motívum).
- `@core/notifications/web-push.ts`: valódi `WebPushProvider` (engedélykérés,
  igény szerinti SW-regisztráció, PushManager). **DB-t SOHA nem ír közvetlenül** —
  a `/api/push` resource route ír, a kérés cookie-s SSR-sessionjével, RLS alatt.
- `@core/notifications/push.server.ts`: topic-validálás (`storm:<uuid>`, a
  kliens-bemenet nem megbízható), spot-lista összefésülés (feliratkozás nem
  veszít el korábbi spotot), leiratkozásnál az utolsó spotnál a SOR IS törlődik
  (adatminimum).
- `app/routes/api.push.ts`: GET (eszköz feliratkozásai) + POST
  (subscribe/unsubscribe). Bejelentkezés nélkül **401 JSON, nem redirect**.
  A robots.txt tiltja a `/api/`-t.
- `@core/notifications/PushToggle.tsx` + `core` i18n `push.*` (hu+en), bekötve a
  spot-adatlapra — **csak ott, ahol van `storm_warning_region`** (a Fertőnek
  nincs HungaroMet-forrása, F1-korlát: nincs mit riasztani).
- `scripts/generate-vapid.mjs`: npm-mentes VAPID-generátor (Node Web Crypto); a
  privát kulcsot a gitignore-olt `.vapid.json`-ba írja, NEM a terminálra.

**Verifikáció (curl + SSR, dev-szerver):** `/sw.js` 200, ikon 200, `/api/push`
GET anonim → `{subscriptions:[]}`, POST anonim → 401 `push.loginRequired`,
robots.txt tiltja az `/api/`-t, a spot-adatlapon renderel a „Viharjelzés-
értesítés" szekció. Az RFC 8291 helyessége roundtrip-teszttel igazolt (a teszt a
FOGADÓ oldalról fejti vissza a titkosított üzenetet) — ez a kritikus rész, mert
hibás levezetésnél a böngésző némán eldobná az üzenetet.

**ÉLESÍTÉS KÉSZ (2026-07-25, felhasználói jóváhagyással):**
1. VAPID-kulcspár generálva (`.vapid.json`, gitignore-olt); a publikus kulcs a
   `.env`-ben (`VITE_VAPID_PUBLIC_KEY`), a **privát kizárólag** Supabase
   secretben. A kulcspárt egyszer ROTÁLTUK, mert az első `npm run sb --`
   hívásnál az npm kiírta a parancssort a privát kulccsal — azóta a wrapper
   közvetlen (`bash scripts/sb.sh`) hívása megy, exportált env-változóval.
   **Tanulság:** titkot tartalmazó CLI-parancsot ne `npm run`-on át.
2. Secretek beállítva (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`);
   a digestek a lokális kulcspárral egyeznek (ellenőrizve).
3. **5 migráció kitolva** (`db push --include-all` — a régebbi időbélyegek miatt
   kellett a flag): `090500` consent · `090600` push webpush · `090700` RPC-grant
   szigorítás · `091600` catalog-watch · `091700` observed_at.
4. `storm-alert` újra deployolva a push-ággal.

**Éles verifikáció (REST + függvényhívás):**
- `weather_snapshots.observed_at` oszlop létezik (régi sorokon null) ✓
- `user_consents`, `catalog_candidates` táblák elérhetők (F1.8 + catalog-watch
  migráció is kiment) ✓
- `push_subscriptions` anonim olvasás → `[]` (RLS) ✓
- storm-alert hívás → 200, 3 körzet scrape (mind 0 fok), `pushSent: 0`,
  `pushStale: 0` — az ÚJ kód fut élesben ✓
- **Éles teszt fogott egy hiányosságot (javítva, `090700`):** a
  `revoke all … from public` + `grant … to authenticated` NEM zárja ki az anont
  — a Supabase `alter default privileges` beállítása létrehozáskor explicit
  EXECUTE-ot ad anon/authenticated/service_role szerepnek, amit a PUBLIC-revoke
  nem érint. Anonim hívásnál eddig a függvényen BELÜLI `auth.uid()` guard fogott
  (helyes, de csak egy réteg); az explicit `revoke … from anon` után már a
  jogosultsági réteg utasítja el („permission denied for function") ✓
  **Általános tanulság minden jövőbeli RPC-re:** a public sémában létrehozott
  függvény alapból anon-hívható — explicit revoke kell.

**BÖNGÉSZŐ-VERIFIKÁCIÓ KÉSZ (2026-07-25) — a push ÉLESBEN MEGÉRKEZETT.**
Chrome + lokális dev-szerver (a `localhost` biztonságos kontextus, nem kellett
hozzá deploy). Menet:
1. Belépés → `/spotok/balatonfoldvar` → „Értesíts viharjelzésről" → engedély.
   `push_subscriptions` sor létrejött (10:12:39 UTC, FCM-endpoint,
   `alert_spot_ids` = Balatonföldvár).
2. Kikényszerített szintváltás: a spot legutóbbi mérésének másolata
   `storm_level=1`, `source='teszt-viharfok'` sorként (nem hamis szél-adat).
3. A **cron** (5 perc, ápr–okt) 10:15:03-kor észlelte az 1→0 váltást: 6 Balaton-
   spotra bm-okf snapshot (szint 0) + push kiküldve → **az értesítés megérkezett**.
4. Teszt-sor törölve (`source='teszt-viharfok'` — ellenőrizve, 0 maradék).

Ezzel a 9. fejezet push-pipeline-ja végponttól végpontig igazolt: feliratkozás →
RLS-es tárolás → cron-detektálás → célzás → VAPID+RFC 8291 titkosítás → FCM →
service worker → rendszer-értesítés.

**Nem automatizálható (tudatos korlát):** Playwrighttal nem tesztelhető — headless
Chromiumnak nincs push-szolgáltatása. Regresszióhoz a fenti 4 lépéses kézi menet
a runbook (a `docs/PROGRESS.md` ezen szakasza).

**Megjegyzés a nyelvhez:** a push-szöveg magyarul, a `_shared/push-notify.ts`-ben
épül (az Edge Function nem éri el az i18next namespace-eket, és F1-ben csak a
`hu` locale él). Több nyelvnél a feliratkozás locale-ját is tárolni kell (F2).
