/**
 * Deszkaválasztó wizard — 5 lépéses, KLIENS-oldali (app-jellegű nézet, 6. fejezet).
 * A lépegetés kliens-állapot; az utolsó lépésen egy `<Form method="post">` küldi
 * MINDEN választ hidden inputként a route action-jének (az futtatja az algoritmust
 * + logolja az advisor_sessiont). Az opció-kártyák alapból az első opcióra állnak
 * (design: kiválasztott = petrol keret); a testsúly kötelező (30–200 kg).
 */
import { useState } from "react";
import { Form } from "react-router";
import { useTranslation } from "react-i18next";

import { Button, cx } from "@core/ui";

import type {
  AdvisorUse,
  Experience,
  Passenger,
  StorageChoice,
  WaterChoice,
} from "../select/types";

const TOTAL_STEPS = 5;
const PASSENGERS: Passenger[] = ["none", "child", "dog"];
const EXPERIENCES: Experience[] = ["kezdo", "halado", "versenyzo"];
const WATERS: WaterChoice[] = ["to", "folyo", "vedett"];
const USES: AdvisorUse[] = ["allround", "tura", "verseny", "joga", "horgasz"];
const STORAGES: StorageChoice[] = ["any", "inflatable_only"];

export function AdvisorWizard() {
  const { t } = useTranslation("advisor");

  const [step, setStep] = useState(0);
  const [weight, setWeight] = useState("");
  const [passenger, setPassenger] = useState<Passenger>("none");
  const [experience, setExperience] = useState<Experience>("kezdo");
  const [water, setWater] = useState<WaterChoice>("to");
  const [use, setUse] = useState<AdvisorUse>("allround");
  const [budget, setBudget] = useState("");
  const [storage, setStorage] = useState<StorageChoice>("any");
  const [weightError, setWeightError] = useState(false);

  const weightValid = () => {
    const n = Number(weight);
    return Number.isFinite(n) && n >= 30 && n <= 200;
  };

  const goNext = () => {
    if (step === 0 && !weightValid()) {
      setWeightError(true);
      return;
    }
    setWeightError(false);
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  };

  const isLast = step === TOTAL_STEPS - 1;

  return (
    <Form method="post" className="mx-auto flex min-h-svh max-w-md flex-col gap-6 p-4 sm:p-6">
      {/* Hidden mezők — a teljes válasz-készlet a submithez. */}
      <input type="hidden" name="weightKg" value={weight} />
      <input type="hidden" name="passenger" value={passenger} />
      <input type="hidden" name="experience" value={experience} />
      <input type="hidden" name="water" value={water} />
      <input type="hidden" name="use" value={use} />
      <input type="hidden" name="budgetHuf" value={budget} />
      <input type="hidden" name="storage" value={storage} />

      <header className="flex flex-col gap-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-petrol transition-[width]"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-text-3">
          {t("wizard.step", { current: step + 1, total: TOTAL_STEPS })}
        </span>
      </header>

      <div className="flex flex-col gap-4">
        {step === 0 ? (
          <>
            <Question text={t("wizard.weight.q")} />
            <label className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={30}
                max={200}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-32 rounded-[var(--radius-card)] border border-line px-3 py-2 text-lg"
                aria-label={t("wizard.weight.q")}
              />
              <span className="text-text-2">{t("wizard.weight.unit")}</span>
            </label>
            {weightError ? (
              <p className="text-sm text-caution-text">{t("wizard.error.invalidWeight")}</p>
            ) : null}

            <Question text={t("wizard.passenger.q")} />
            <OptionGroup
              options={PASSENGERS}
              value={passenger}
              onSelect={setPassenger}
              label={(o) => t(`passenger.${o}`)}
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Question text={t("wizard.experience.q")} />
            <OptionGroup
              options={EXPERIENCES}
              value={experience}
              onSelect={setExperience}
              label={(o) => t(`level.${o}`)}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Question text={t("wizard.water.q")} />
            <OptionGroup
              options={WATERS}
              value={water}
              onSelect={setWater}
              label={(o) => t(`water.${o}`)}
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Question text={t("wizard.use.q")} />
            <OptionGroup
              options={USES}
              value={use}
              onSelect={setUse}
              label={(o) => t(`use.${o}`)}
            />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Question text={t("wizard.budget.q")} />
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-40 rounded-[var(--radius-card)] border border-line px-3 py-2 text-lg"
                  aria-label={t("wizard.budget.q")}
                />
                <span className="text-text-2">{t("wizard.budget.unit")}</span>
              </label>
              <Button
                type="button"
                variant={budget === "" ? "secondary" : "ghost"}
                onClick={() => setBudget("")}
              >
                {t("wizard.budget.any")}
              </Button>
            </div>

            <Question text={t("wizard.storage.q")} />
            <OptionGroup
              options={STORAGES}
              value={storage}
              onSelect={setStorage}
              label={(o) => t(`storage.${o}`)}
            />
          </>
        ) : null}
      </div>

      <div className="mt-auto flex gap-3">
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            {t("wizard.back")}
          </Button>
        ) : null}
        {isLast ? (
          <Button type="submit" variant="primary" className="flex-[2]">
            {t("wizard.submit")}
          </Button>
        ) : (
          <Button type="button" variant="primary" className="flex-[2]" onClick={goNext}>
            {t("wizard.next")} →
          </Button>
        )}
      </div>
    </Form>
  );
}

function Question({ text }: { text: string }) {
  return (
    <h2
      className="text-2xl font-semibold text-ink-deep"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {text}
    </h2>
  );
}

function OptionGroup<T extends string>({
  options,
  value,
  onSelect,
  label,
}: {
  options: readonly T[];
  value: T;
  onSelect: (option: T) => void;
  label: (option: T) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(option)}
            className={cx(
              "flex min-h-[var(--tap-min)] items-center rounded-2xl border-2 bg-surface px-4 py-3 text-left font-semibold transition-colors",
              selected ? "border-petrol bg-petrol/5 text-ink-deep" : "border-line text-text-2",
            )}
          >
            {label(option)}
          </button>
        );
      })}
    </div>
  );
}
