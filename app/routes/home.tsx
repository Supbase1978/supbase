import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "[APPNÉV] — SUP deszkaválasztó, spotok, közösség" },
    {
      name: "description",
      content:
        "Deszkaválasztó, katalógus Népítélettel, SUP-index a magyar vizekre és szolgáltatói directory — egy helyen.",
    },
  ];
};

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-4 p-8">
      <p className="text-sm text-text-3">SUP Platform — F1 (MVP) fejlesztés alatt</p>
      <h1
        className="text-4xl font-semibold text-ink-deep"
        style={{ fontFamily: "var(--font-display)" }}
      >
        [APPNÉV]
      </h1>
      <p className="text-text-2">
        Deszkaválasztó · Katalógus + Népítélet · Spot-térkép + SUP-index ·
        Szolgáltatói directory
      </p>
    </main>
  );
}
