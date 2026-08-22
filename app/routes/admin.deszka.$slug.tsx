/**
 * /admin/deszka/:slug — egy JÓVÁHAGYOTT deszka adatainak javítása (F2.1-utó-42).
 *
 * MIÉRT VAN: a moderálás során óhatatlanul becsúszik hiba, és sokszor csak
 * később derül ki — „előfordulhat, hogy valamit rosszul moderálok és csak
 * később veszem észre" (felhasználói kérés, 2026-08-22). Enélkül a javítás
 * csak közvetlen adatbázis-hozzáféréssel lenne lehetséges, és a moderálás
 * minden kattintása véglegesnek érződne — ami lassítja is a döntést.
 *
 * Guard: `requireRole('moderator')` a loaderben ÉS az actionben; az RLS a
 * védőháló (`boards_mod_write`).
 *
 * AMIT NEM SZERKESZTÜNK ITT, és miért:
 *  * `slug` — URL-t törne (a katalógus-hivatkozások és a SEO is rá épül);
 *  * `brand` — márkaváltás valójában másik termék; összefésüléssel oldandó;
 *  * képek — saját szerkesztőjük van a moderációs felületen (galéria-válogatás).
 *
 * A KÉZI ÉRTÉK MEGMARAD: ellenőrizve, hogy a figyelő és az összefésülés a
 * `boards` sorból kizárólag a `last_seen_at`/`availability_hu`/kép mezőket
 * írja — a méretekhez, a névhez és a kategóriákhoz egyik sem nyúl.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { data, Form, Link } from "react-router";

import { requireRole } from "@core/auth/session.server";
import { createSupabaseServerClient } from "@core/auth/supabase.server";
import { APP_NAME } from "@core/brand";
import { Button, Card } from "@core/ui";
import { loadBoardForEdit, updateBoardData } from "@modules/catalog/data/candidates.server";
import { BOARD_TYPES, type BoardType } from "@modules/catalog/types";

import type { Route } from "./+types/admin.deszka.$slug";

/** Ugyanaz a minta, mint a nyilvános adatlapon — injekció ellen. */
const SLUG_PATTERN = /^[a-z0-9-]+$/;

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireRole(request, "moderator");
  const { supabase } = createSupabaseServerClient(request);
  const slug = params.slug ?? "";
  if (!SLUG_PATTERN.test(slug)) throw new Response("Not found", { status: 404 });

  const board = await loadBoardForEdit(supabase, slug);
  if (!board) throw new Response("Not found", { status: 404 });

  return {
    board: {
      id: board.id,
      slug,
      brandName: board.brand?.name ?? null,
      modelName: board.model_name,
      modelYear: board.model_year,
      // A halmaz az elsődleges; a régi egyértékű oszlop csak akkor jön szóba,
      // ha a sor még a `board_types` bevezetése előttről való.
      boardTypes: board.board_types.length > 0 ? board.board_types : [board.board_type],
      lengthCm: board.length_cm,
      widthCm: board.width_cm,
      thicknessCm: board.thickness_cm,
      volumeL: board.volume_l,
      weightKg: board.weight_kg,
      maxLoadKg: board.max_load_kg,
      inflatable: board.inflatable,
      unpublishedFields: board.unpublished_fields ?? [],
    },
  };
}

/** Üres mező = „nincs adat", nem nulla. A hiány ITT IS érvényes állítás. */
function optionalNumber(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim().replace(",", ".");
  if (text === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function isBoardType(value: string): value is BoardType {
  return (BOARD_TYPES as readonly string[]).includes(value);
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireRole(request, "moderator");
  const { supabase, headers } = createSupabaseServerClient(request);
  const slug = params.slug ?? "";
  if (!SLUG_PATTERN.test(slug)) throw new Response("Not found", { status: 404 });

  const board = await loadBoardForEdit(supabase, slug);
  if (!board) throw new Response("Not found", { status: 404 });

  const formData = await request.formData();
  const result = await updateBoardData(supabase, {
    boardId: board.id,
    modelName: String(formData.get("modelName") ?? ""),
    modelYear: optionalNumber(formData.get("modelYear")),
    boardTypes: formData.getAll("boardTypes").map(String).filter(isBoardType),
    lengthCm: optionalNumber(formData.get("lengthCm")),
    widthCm: optionalNumber(formData.get("widthCm")),
    thicknessCm: optionalNumber(formData.get("thicknessCm")),
    volumeL: optionalNumber(formData.get("volumeL")),
    weightKg: optionalNumber(formData.get("weightKg")),
    maxLoadKg: optionalNumber(formData.get("maxLoadKg")),
    inflatable: formData.get("inflatable") === "on",
  });
  return data(result, { headers });
}

export const meta: Route.MetaFunction = () => [
  { title: `${APP_NAME} — Deszka szerkesztése` },
  { name: "robots", content: "noindex" },
];

export default function AdminBoardEdit({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useTranslation("catalog");
  const { board } = loaderData;
  const [types, setTypes] = useState<string[]>(board.boardTypes);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink-deep">
          {[board.brandName, board.modelName].filter(Boolean).join(" ")}
        </h1>
        <Link className="text-sm text-petrol underline" to={`/deszkak/${board.slug}`}>
          {t("admin.edit.viewPublic")}
        </Link>
      </div>

      {actionData?.ok ? (
        <p className="rounded-lg bg-safe-bg px-3 py-2 text-sm text-safe-text">
          ✓ {t("admin.edit.saved")}
        </p>
      ) : null}
      {actionData && !actionData.ok ? (
        <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-text">
          {t(actionData.errorKey ?? "admin.error.updateFailed")}
        </p>
      ) : null}

      <Form method="post">
        <Card>
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("admin.edit.modelName")}>
                <input
                  name="modelName"
                  defaultValue={board.modelName}
                  required
                  className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-text"
                />
              </Field>
              <Field label={t("spec.year")}>
                <input
                  name="modelYear"
                  inputMode="numeric"
                  defaultValue={board.modelYear ?? ""}
                  className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-text"
                />
              </Field>
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium text-text">{t("admin.typeLabel")}</legend>
              {/* TÖBB KATEGÓRIA: a deszka minden bejelölt célnál megjelenik a
                  Deszkaválasztóban. A gyártók sem jelölnek ki fő kategóriát. */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {BOARD_TYPES.map((type) => (
                  <label key={type} className="flex items-center gap-1.5 text-sm text-text">
                    <input
                      type="checkbox"
                      name="boardTypes"
                      value={type}
                      checked={types.includes(type)}
                      onChange={(event) =>
                        setTypes((prev) =>
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
              {types.length === 0 ? (
                <p className="text-xs text-caution-text">{t("admin.error.noBoardType")}</p>
              ) : null}
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-3">
              <NumberField name="lengthCm" label={t("spec.length")} unit="cm" value={board.lengthCm} />
              <NumberField name="widthCm" label={t("spec.width")} unit="cm" value={board.widthCm} />
              <NumberField
                name="thicknessCm"
                label={t("spec.thickness")}
                unit="cm"
                value={board.thicknessCm}
              />
              <NumberField
                name="volumeL"
                label={t("spec.volume")}
                unit="l"
                value={board.volumeL}
                unpublished={board.unpublishedFields.includes("volumeL")}
              />
              <NumberField
                name="weightKg"
                label={t("spec.weight")}
                unit="kg"
                value={board.weightKg}
                unpublished={board.unpublishedFields.includes("weightKg")}
              />
              <NumberField
                name="maxLoadKg"
                label={t("spec.maxLoad")}
                unit="kg"
                value={board.maxLoadKg}
                unpublished={board.unpublishedFields.includes("maxLoadKg")}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                name="inflatable"
                defaultChecked={board.inflatable}
                className="h-4 w-4 accent-petrol"
              />
              {t("filters.inflatable")}
            </label>

            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" disabled={types.length === 0}>
                {t("admin.edit.save")}
              </Button>
              {/* Az ÜRES mező „nincs adat"-ot jelent, nem nullát — a hiány itt
                  is érvényes állítás, és a Deszkaválasztó másképp kezeli. */}
              <p className="text-xs text-text-3">{t("admin.edit.emptyMeansUnknown")}</p>
            </div>
          </div>
        </Card>
      </Form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-text">{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  name,
  label,
  unit,
  value,
  unpublished = false,
}: {
  name: string;
  label: string;
  unit: string;
  value: number | null;
  /** A gyártó NEM közli — az üresség itt tény, nem hiány. */
  unpublished?: boolean;
}) {
  const { t } = useTranslation("catalog");
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-text">
        {label} <span className="font-normal text-text-3">({unit})</span>
      </span>
      <input
        name={name}
        inputMode="decimal"
        defaultValue={value ?? ""}
        placeholder={unpublished ? t("spec.unpublished") : ""}
        className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-text"
      />
    </label>
  );
}
