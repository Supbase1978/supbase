import { describe, expect, it } from "vitest";

import { buildFeedbackEmailHtml, notifyFeedback } from "./notify.server";

describe("buildFeedbackEmailHtml", () => {
  it("ESCAPE-eli a beküldött szabad szöveget (idegen bemenet)", () => {
    const html = buildFeedbackEmailHtml({
      kind: "bug",
      message: `<script>alert("xss")</script>`,
      pagePath: "/deszkak",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("útvonal nélkül is teljes levelet ad", () => {
    const html = buildFeedbackEmailHtml({ kind: "shop", message: "Hiányzik egy bolt.", pagePath: null });
    expect(html).toContain("Hiányzó bolt");
    expect(html).toContain("Beküldve innen: —");
  });
});

describe("notifyFeedback", () => {
  const INPUT = { kind: "idea" as const, message: "Egy ötlet.", pagePath: null };

  it("Resend-kulcs nélkül CSENDBEN kimarad (nem hiba)", async () => {
    expect(await notifyFeedback(INPUT, {})).toEqual({ sent: false });
  });

  it("címzett nélkül sem próbálkozik", async () => {
    expect(await notifyFeedback(INPUT, { RESEND_API_KEY: "re_teszt" })).toEqual({ sent: false });
  });
});
