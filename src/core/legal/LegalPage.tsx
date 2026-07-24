/**
 * Jogi oldal renderer (F1.8) — a `LegalDocument` strukturált tartalmát jeleníti
 * meg (cím, hatály, minta-figyelmeztetés, szakaszok). Az ÁSZF és az Adatvédelmi
 * tájékoztató route-ja is ezt használja, a megfelelő locale-dokumentummal.
 */
import type { LegalDocument } from "./content";

export interface LegalPageProps {
  document: LegalDocument;
}

export function LegalPage({ document }: LegalPageProps) {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1
          className="text-3xl font-semibold text-ink-deep"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {document.title}
        </h1>
        <p className="text-sm text-text-3">{document.effectiveLabel}</p>
      </header>

      <p className="rounded-[var(--radius-card)] border border-line bg-mist p-3 text-sm text-text-2">
        {document.disclaimer}
      </p>

      {document.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-ink-deep">{section.heading}</h2>
          {section.paragraphs.map((paragraph, index) => (
            <p key={index} className="text-sm text-text-2">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
