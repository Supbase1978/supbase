/**
 * /admin/katalogus — catalog-watch moderáció (catalog adminPanel, F2).
 *
 * Guard: `requireRole('moderator')` a loaderben ÉS az actionben (a jog-ellenőrzés
 * szerver-oldali, az RLS a védőháló — a `catalog_candidates` táblát csak
 * moderator/admin olvashatja/írhatja).
 *
 * EZ A KAPU. A piacfigyelő (`tools/catalog-watch`) soha nem hoz létre `boards`
 * sort: minden új típus ide, a jelölt-sorba érkezik, és emberi döntésből lesz
 * belőle katalógus-elem. Ugyanez igaz a kifutásra: a figyelő csak JELÖL, a
 * `discontinued` státuszt a moderátor erősíti meg.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { data, Form } from "react-router";

import { requireRole } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { APP_NAME } from "@core/brand";
import { Button, Card, StatusBadge } from "@core/ui";
import {
  approveCandidate,
  listAccessoryChoicesByCategory,
  listBoardChoices,
  listBoardsForLifecycle,
  listBoardsWithGallery,
  listPendingCandidates,
  loadFamilyTypeMap,
  mergeCandidate,
  rejectCandidate,
  setBoardDiscontinued,
  setBoardGallery,
} from "@modules/catalog/data/candidates.server";
import { findDuplicateHints } from "@modules/catalog/data/duplicate-hints";
import { inferBoardType } from "@modules/catalog/family-type";
import { GEAR_CATEGORIES, isGearCategory, type GearCategory } from "@modules/catalog/gear";
import { DEFAULT_UNSEEN_DAYS, findDiscontinuedCandidates } from "@modules/catalog/lifecycle";
import { BOARD_TYPES, type BoardType } from "@modules/catalog/types";

import type { Route } from "./+types/admin.katalogus";

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "moderator");
  const { supabase } = createSupabaseServerClient(request);

  const [candidates, boardChoices, accessoryChoicesByCategory, boards, galleries, familyTypes] =
    await Promise.all([
      listPendingCandidates(supabase),
      listBoardChoices(supabase),
      listAccessoryChoicesByCategory(supabase),
      listBoardsForLifecycle(supabase),
      listBoardsWithGallery(supabase),
      // CSALÁD → KATEGÓRIA a már jóváhagyott deszkákból (F2.1-utó-40): a
      // gyártói kollekciók csak az aktuális évjáratot sorolják be, a régebbi
      // példányok kategória nélkül érkeznek — pedig ugyanaz a deszka.
      loadFamilyTypeMap(supabase),
    ]);

  // Jelölt↔jelölt duplikátum-gyanú (F2.1-utó-8): a `matchedBoardLabel` csak
  // ÉLŐ deszkával veti össze a jelöltet — ez itt a MÁSIK, még el nem bírált
  // pending jelöltek közti átfedést jelzi (pl. ugyanaz a termék két forrásból).
  const hintInputs = candidates
    .filter(({ candidate }) => candidate.extracted !== null)
    .map(({ candidate }) => ({
      id: candidate.id,
      sourceId: candidate.source_id,
      brandName: candidate.extracted!.brandName,
      modelName: candidate.extracted!.modelName,
      modelYear: candidate.extracted!.modelYear,
      accessoryType: candidate.extracted!.accessoryType,
    }));
  const duplicateHints = findDuplicateHints(hintInputs);
  const titleById = new Map(
    candidates.map(({ candidate }) => [
      candidate.id,
      [candidate.extracted?.brandName, candidate.extracted?.modelName]
        .filter(Boolean)
        .join(" ") || (candidate.extracted?.rawTitle ?? ""),
    ]),
  );
  const sourceNameById = new Map(candidates.map(({ candidate, sourceName }) => [candidate.id, sourceName]));

  return {
    candidates: candidates.map(({ candidate, sourceName, matchedBoardLabel }) => {
      const hint = duplicateHints.get(candidate.id);
      const extracted = candidate.extracted;
      return {
        id: candidate.id,
        url: candidate.url,
        sourceName,
        matchedBoardId: candidate.matched_board_id,
        matchedBoardLabel,
        confidence: candidate.match_confidence,
        // A MODELLCSALÁDBÓL örökölhető kategória, ha a kinyerés nem talált.
        // A felület előre bejelöli, de MEGMONDJA, hogy örökölt — nem mérés.
        inheritedType:
          extracted !== null && extracted.boardType === null
            ? inferBoardType(familyTypes, extracted.brandName, extracted.modelName)
            : null,
        extracted: candidate.extracted,
        duplicateHint: hint
          ? {
              title: titleById.get(hint.candidateId) ?? "",
              sourceName: sourceNameById.get(hint.candidateId) ?? null,
              score: hint.score,
            }
          : null,
      };
    }),
    boardChoices,
    accessoryChoicesByCategory,
    unseen: findDiscontinuedCandidates(boards),
    unseenDays: DEFAULT_UNSEEN_DAYS,
    galleries,
  };
}

type ActionResult = { ok: boolean; errorKey?: string };

function isBoardType(value: string): value is BoardType {
  return (BOARD_TYPES as readonly string[]).includes(value);
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireRole(request, "moderator");
  const { supabase, headers } = createSupabaseServerClient(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  const boardId = String(formData.get("boardId") ?? "");

  let result: ActionResult = { ok: false, errorKey: "admin.error.updateFailed" };
  switch (intent) {
    case "approve": {
      const kind = String(formData.get("kind") ?? "board");
      if (kind === "accessory") {
        const rawCategory = String(formData.get("accessoryType") ?? "");
        if (!isGearCategory(rawCategory)) {
          result = { ok: false, errorKey: "admin.error.updateFailed" };
          break;
        }
        result = await approveCandidate(supabase, {
          candidateId,
          kind: "accessory",
          accessoryType: rawCategory,
          reviewerId: user.id,
        });
        break;
      }
      // TÖBB KATEGÓRIA (F2.1-utó-41). A sorrend a jelölőnégyzetek sorrendje;
      // az ELSŐ elem megy a `board_type` oszlopba is, amíg az átmenet tart.
      // Üres választás nem mehet át: kategória nélkül a deszka se a
      // Deszkaválasztóban, se a szűrőkben nem jelenne meg — csendben eltűnne.
      const rawTypes = formData.getAll("boardTypes").map(String).filter(isBoardType);
      if (rawTypes.length === 0) {
        result = { ok: false, errorKey: "admin.error.noBoardType" };
        break;
      }
      result = await approveCandidate(supabase, {
        candidateId,
        kind: "board",
        boardType: rawTypes[0]!,
        boardTypes: rawTypes,
        reviewerId: user.id,
      });
      break;
    }
    case "merge":
      result = boardId
        ? await mergeCandidate(supabase, { candidateId, boardId, reviewerId: user.id })
        : { ok: false, errorKey: "admin.error.noBoard" };
      break;
    case "reject":
      result = await rejectCandidate(supabase, { candidateId, reviewerId: user.id });
      break;
    case "discontinue":
      result = await setBoardDiscontinued(supabase, boardId, true);
      break;
    case "reactivate":
      result = await setBoardDiscontinued(supabase, boardId, false);
      break;
    case "gallery": {
      // A checkbox-ok CSAK a megtartott képeket küldik el; a borító külön
      // rádiógomb. Kép nélküli mentés nem lehetséges (a rács üresen maradna).
      const keepUrls = formData.getAll("keep").map(String);
      const coverUrl = String(formData.get("cover") ?? "");
      result =
        boardId && coverUrl !== "" && keepUrls.includes(coverUrl)
          ? await setBoardGallery(supabase, { boardId, coverUrl, keepUrls })
          : { ok: false, errorKey: "admin.error.updateFailed" };
      break;
    }
  }

  return data<ActionResult>(result, { headers });
}

export const meta: Route.MetaFunction = () => {
  // Admin-felület: nincs SEO-értéke, és a robots.txt is tiltja az /admin utat.
  return [{ title: `${APP_NAME} — Katalógus-moderáció` }, { name: "robots", content: "noindex" }];
};

export default function AdminCatalogRoute({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useTranslation("catalog");
  const { candidates, boardChoices, accessoryChoicesByCategory, unseen, unseenDays, galleries } =
    loaderData;

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1
          className="text-3xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("admin.title")}
        </h1>
        <p className="text-sm text-text-2">{t("admin.lead")}</p>
      </header>

      {actionData ? (
        <p className={actionData.ok ? "text-sm text-text-2" : "text-sm text-caution-text"}>
          {actionData.ok ? t("admin.done") : t(actionData.errorKey ?? "admin.error.updateFailed")}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink-deep">{t("admin.pending")}</h2>
        {candidates.length === 0 ? (
          <p className="text-sm text-text-2">{t("admin.pendingEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {candidates.map((candidate) => (
              <li key={candidate.id}>
                <CandidateCard
                  candidate={candidate}
                  boardChoices={boardChoices}
                  accessoryChoicesByCategory={accessoryChoicesByCategory}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink-deep">{t("admin.lifecycle")}</h2>
        <p className="text-sm text-text-2">{t("admin.lifecycleLead", { days: unseenDays })}</p>
        {unseen.length === 0 ? (
          <p className="text-sm text-text-2">{t("admin.lifecycleEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {unseen.map((board) => (
              <li key={board.boardId}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-text">{board.modelName}</span>
                    <StatusBadge
                      status="caution"
                      label={t("admin.daysUnseen", { days: board.daysUnseen })}
                    />
                  </div>
                  <div className="mt-2">
                    <IntentForm intent="discontinue" boardId={board.boardId}>
                      {t("admin.markDiscontinued")}
                    </IntentForm>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*
        GALÉRIA-VÁLOGATÁS (F2.1-utó-30). A gyűjtés a gyártó SAJÁT kép-sorrendjét
        hozza — többnyire jó, de a végén szín-változat és életkép is lehet. Itt
        dobható ki a fölösleges, és itt jelölhető ki a BORÍTÓ: a lista-rácsban az
        összehasonlítás azon áll, hogy minden kártya ugyanolyan nézetet mutat.
        `<details>`-be zárva, hogy a 100+ sor ne tegye átláthatatlanná az oldalt,
        és a bélyegképek csak kinyitáskor töltsenek.
      */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-ink-deep">{t("admin.gallery.title")}</h2>
        <p className="text-sm text-text-2">{t("admin.gallery.lead")}</p>
        {galleries.length === 0 ? (
          <p className="text-sm text-text-2">{t("admin.gallery.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {galleries.map((board) => (
              <li key={board.id}>
                <GalleryCard board={board} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

type LoaderGallery = Awaited<ReturnType<typeof loader>>["galleries"][number];

/**
 * Egy sor galéria-válogatása. A képek KÖZÖS listában vannak (borító + többi),
 * a moderátor pipával tartja meg és rádiógombbal jelöli a borítót — a mentés
 * a kettőt szétválasztja (`setBoardGallery`).
 */
function GalleryCard({ board }: { board: LoaderGallery }) {
  const { t } = useTranslation("catalog");
  return (
    <Card>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-text">
          {[board.brandName, board.modelName].filter(Boolean).join(" ")}{" "}
          <span className="font-normal text-text-3">
            ({t("admin.gallery.count", { count: board.imageUrls.length })})
          </span>
        </summary>
        <Form method="post" className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="intent" value="gallery" />
          <input type="hidden" name="boardId" value={board.id} />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {board.imageUrls.map((url) => (
              <li key={url} className="flex flex-col gap-1.5">
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full rounded-[var(--radius-card)] bg-mist object-contain"
                />
                <label className="flex items-center gap-1.5 text-xs text-text-2">
                  <input type="checkbox" name="keep" value={url} defaultChecked />
                  {t("admin.gallery.keep")}
                </label>
                <label className="flex items-center gap-1.5 text-xs text-text-2">
                  <input
                    type="radio"
                    name="cover"
                    value={url}
                    defaultChecked={url === board.coverUrl}
                  />
                  {t("admin.gallery.cover")}
                </label>
              </li>
            ))}
          </ul>
          <Button type="submit" variant="secondary">
            {t("admin.gallery.save")}
          </Button>
        </Form>
      </details>
    </Card>
  );
}

type LoaderCandidate = Awaited<ReturnType<typeof loader>>["candidates"][number];
type BoardChoice = { id: string; label: string };
type AccessoryChoicesByCategory = Record<GearCategory, BoardChoice[]>;

/**
 * Ennél biztosabb egyezésnél KÍNÁLJUK FEL készen az összefésülési célpontot.
 *
 * Ugyanaz a küszöb, ami a figyelőben az „ismert" sávot jelöli
 * (`match.ts` — `KNOWN_THRESHOLD`). Itt SZÁNDÉKOSAN másolat: a `tools/` a
 * bundleren kívül él, az app nem importálhat belőle. A két szám jelentése
 * viszont ugyanaz, és ha az egyik változik, a másikat is át kell nézni.
 */
const CERTAIN_MATCH = 0.8;

function CandidateCard({
  candidate,
  boardChoices,
  accessoryChoicesByCategory,
}: {
  candidate: LoaderCandidate;
  boardChoices: BoardChoice[];
  accessoryChoicesByCategory: AccessoryChoicesByCategory;
}) {
  const { t } = useTranslation("catalog");
  const extracted = candidate.extracted;

  // A figyelő tippje csak ELŐVÁLASZTÁS (F2.3 3. szakasz): ha a `classifyProduct`
  // kiegészítőnek látta, a kapcsoló ott indul, de a moderátor bármikor átváltja.
  const [kind, setKind] = useState<"board" | "accessory">(
    extracted?.accessoryType ? "accessory" : "board",
  );
  const [category, setCategory] = useState<GearCategory>(
    extracted?.accessoryType ?? GEAR_CATEGORIES[0],
  );

  // A KEZDŐ VÁLASZTÁS: amit a kinyerés talált, vagy amit a modellcsaládból
  // örököltünk. Ha egyik sincs, ÜRESEN indul — a felület nem talál ki
  // kategóriát (2026-08-21). Több is bejelölhető: a gyártók sem jelölnek ki
  // fő kategóriát, és a deszka így több helyen is előjön a Deszkaválasztóban.
  const [chosenTypes, setChosenTypes] = useState<BoardType[]>(() => {
    const fromExtraction = (extracted?.boardTypes ?? [])
      .map((item) => item.type)
      .filter((type): type is BoardType => (BOARD_TYPES as readonly string[]).includes(type));
    if (fromExtraction.length > 0) return fromExtraction;
    if (extracted?.boardType) return [extracted.boardType];
    return candidate.inheritedType ? [candidate.inheritedType] : [];
  });
  // A jóváhagyás KÉTLÉPCSŐS: a második lépés felsorolja, hol fog megjelenni a
  // deszka. A besorolás vezérli a Deszkaválasztó cél-illesztését, ezért nem
  // maradhat egy legördülő véletlen maradéka.
  const [confirming, setConfirming] = useState(false);

  if (!extracted) {
    return null;
  }

  const title = [extracted.brandName, extracted.modelName].filter(Boolean).join(" ");
  const confidence =
    candidate.confidence === null ? null : `${Math.round(candidate.confidence * 100)}%`;
  const mergeChoices = kind === "board" ? boardChoices : accessoryChoicesByCategory[category];

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-ink-deep">{title || extracted.rawTitle}</h3>
        <span className="text-sm text-text-2">
          {extracted.priceHuf === null
            ? t("admin.noPrice")
            : `${extracted.priceHuf.toLocaleString("hu-HU")} Ft`}
        </span>
      </div>

      <p className="mt-1 text-xs text-text-3">{extracted.rawTitle}</p>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <SpecItem label={t("spec.length")} value={formatCm(extracted.specs.lengthCm)} />
        <SpecItem label={t("spec.width")} value={formatCm(extracted.specs.widthCm)} />
        <SpecItem label={t("spec.thickness")} value={formatCm(extracted.specs.thicknessCm)} />
        <SpecItem
          label={t("spec.volume")}
          value={extracted.specs.volumeL === null ? null : `${extracted.specs.volumeL} l`}
        />
        <SpecItem
          label={t("spec.maxLoad")}
          value={extracted.specs.maxLoadKg === null ? null : `${extracted.specs.maxLoadKg} kg`}
        />
        <SpecItem label={t("spec.year")} value={extracted.modelYear?.toString() ?? null} />
      </dl>

      <p className="mt-2 text-xs text-text-2">
        {t("admin.source")}: {candidate.sourceName ?? "—"}
        {confidence ? ` · ${t("admin.confidence")}: ${confidence}` : ""}
        {candidate.matchedBoardLabel
          ? ` · ${t("admin.suggestedMatch")}: ${candidate.matchedBoardLabel}`
          : ""}
      </p>

      {/* Jelölt↔jelölt duplikátum-gyanú (F2.1-utó-8) — CSAK jelzés, a
          moderátor dönt: elutasítja az egyiket, vagy jóváhagyja mindkettőt,
          ha mégis két külön termék. */}
      {candidate.duplicateHint ? (
        <p className="mt-1 text-xs text-caution-text">
          {t("admin.duplicateHint", {
            title: candidate.duplicateHint.title,
            source: candidate.duplicateHint.sourceName ?? "—",
            percent: Math.round(candidate.duplicateHint.score * 100),
          })}
        </p>
      ) : null}

      {candidate.url ? (
        <p className="mt-1 text-xs">
          <a
            className="text-petrol underline"
            href={candidate.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t("admin.openSource")}
          </a>
        </p>
      ) : null}

      {/* Deszka/kiegészítő kapcsoló (F2.3 3. szakasz) — a jóváhagyás ÉS az
          összefésülés legördülője is ehhez igazodik. */}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text">{t("admin.kindLabel")}</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value === "accessory" ? "accessory" : "board")}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-text"
          >
            <option value="board">{t("admin.kindBoard")}</option>
            <option value="accessory">{t("admin.kindAccessory")}</option>
          </select>
        </label>
        {kind === "accessory" ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">{t("admin.categoryLabel")}</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as GearCategory)}
              className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-text"
            >
              {GEAR_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {t(`gear.categories.${cat}.title`)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {/* JÓVÁHAGYÁS. A deszkánál TÖBB kategória is választható (F2.1-utó-41),
          és a beküldés KÉTLÉPCSŐS: a megerősítő lépés felsorolja, hol fog
          megjelenni a deszka. Ez felhasználói kérés (2026-08-22), és jó oka
          van: a besorolás vezérli a Deszkaválasztó cél-illesztését, tehát nem
          egy legördülő maradéka, hanem tudatos döntés. */}
      <Form method="post" className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="intent" value="approve" />
        <input type="hidden" name="candidateId" value={candidate.id} />
        <input type="hidden" name="kind" value={kind} />
        {kind === "accessory" ? (
          <>
            <input type="hidden" name="accessoryType" value={category} />
            <Button type="submit" variant="primary" className="self-start">
              {t("admin.approve")}
            </Button>
          </>
        ) : (
          <>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium text-text">
                {t("admin.typeLabel")}
              </legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {BOARD_TYPES.map((type) => (
                  <label key={type} className="flex items-center gap-1.5 text-sm text-text">
                    <input
                      type="checkbox"
                      name="boardTypes"
                      value={type}
                      checked={chosenTypes.includes(type)}
                      onChange={(event) =>
                        setChosenTypes((prev) =>
                          event.target.checked
                            ? [...prev, type]
                            : prev.filter((item) => item !== type),
                        )
                      }
                      className="h-4 w-4 accent-petrol"
                    />
                    {t(`boardType.${type}`)}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* A MÁSODIK lépés: a moderátor lássa, mit állít, mielőtt véglegesíti. */}
            {confirming ? (
              <div className="rounded-lg border border-caution bg-caution-bg p-3 text-sm">
                <p className="text-caution-text">
                  {t("admin.approveConfirm", {
                    types: chosenTypes.map((type) => t(`boardType.${type}`)).join(", "),
                  })}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="submit" variant="primary">
                    {t("admin.approveFinal")}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
                    {t("admin.approveBack")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="primary"
                className="self-start"
                disabled={chosenTypes.length === 0}
                onClick={() => setConfirming(true)}
              >
                {t("admin.approve")}
              </Button>
            )}
          </>
        )}
      </Form>
      {/* Összefésülés meglévő deszkába/kiegészítőbe — a dupla-név elleni védelem. */}
      <Form method="post" className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="intent" value="merge" />
        <input type="hidden" name="candidateId" value={candidate.id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text">{t("admin.mergeLabel")}</span>
          <select
            name="boardId"
            // BIZONYTALAN TIPPET NEM VÁLASZTUNK ELŐ (felhasználói jelzés,
            // 2026-08-21). Élesben mért eset: az „Aqua Marina BLADE Windsurf"
            // jelöltnél a legördülő a „Blaze"-t kínálta készen, 46%-os
            // egyezéssel — pedig a Blade és a Blaze KÉT KÜLÖN modell, és a
            // Blade nincs is a katalógusban. Egy figyelmetlen kattintás
            // véglegesen összeolvasztotta volna őket.
            //
            // A moderációs sorba szinte kizárólag bizonytalan egyezés kerül (a
            // biztosat a figyelő magától összekapcsolja), tehát ez a gyakorlatban
            // üres alapértéket jelent — a moderátornak TUDATOSAN kell választania.
            defaultValue={
              candidate.confidence !== null && candidate.confidence >= CERTAIN_MATCH
                ? (candidate.matchedBoardId ?? "")
                : ""
            }
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-text"
          >
            <option value="">—</option>
            {mergeChoices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="secondary">
          {t("admin.merge")}
        </Button>
      </Form>

      <div className="mt-3">
        <IntentForm intent="reject" candidateId={candidate.id}>
          {t("admin.reject")}
        </IntentForm>
      </div>
    </Card>
  );
}

function SpecItem({ label, value }: { label: string; value: string | null }) {
  const { t } = useTranslation("catalog");
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-text-3">{label}</dt>
      <dd className={value === null ? "text-text-3" : "text-text"}>
        {value ?? t("admin.unknown")}
      </dd>
    </div>
  );
}

function formatCm(value: number | null): string | null {
  return value === null ? null : `${Math.round(value)} cm`;
}

function IntentForm({
  intent,
  candidateId,
  boardId,
  children,
}: {
  intent: string;
  candidateId?: string;
  boardId?: string;
  children: React.ReactNode;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value={intent} />
      {candidateId ? <input type="hidden" name="candidateId" value={candidateId} /> : null}
      {boardId ? <input type="hidden" name="boardId" value={boardId} /> : null}
      <Button type="submit" variant="ghost">
        {children}
      </Button>
    </Form>
  );
}
