import { describe, expect, it } from "vitest";

import { htmlToText } from "./html.ts";

/**
 * GÉPI ADAT KISZŰRÉSE (2026-08-20, funwaterboard.com). Egy HTML-attribútumba
 * ágyazott JSON a „oldalszövegbe" került, és HAMIS méretet adott: a
 * `10'6"(320cm) length 33"(83cm) width` sorban a címke a VÉTE UTÁN áll, ezért
 * a hossz mezőbe a szélesség 83 cm-e került. Nem hiány lett belőle, hanem
 * téves adat — a rosszabbik fajta.
 */
describe("htmlToText — escape-elt JSON kiszűrése", () => {
  it("a backslash-escape-eket tartalmazó sort eldobja", () => {
    const html = `<div data-x="1 x 10'6\\&quot;(320cm) length 33\\&quot;(83cm) width">
      <p>Dimensions: 320 x 84 x 15 cm</p></div>`;
    const text = htmlToText(html);
    expect(text).toContain("Dimensions: 320 x 84 x 15 cm");
    expect(text).not.toContain("(83cm) width");
  });

  it("a NORMÁL szöveget nem bántja (idézőjel önmagában maradhat)", () => {
    const text = htmlToText(`<p>A deszka 10'6" hosszú, "stabil" és könnyű.</p>`);
    expect(text).toContain(`10'6"`);
    expect(text).toContain(`"stabil"`);
  });
});
