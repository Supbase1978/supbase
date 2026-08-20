import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { ProductGallery } from "./ProductGallery";

const LABELS = {
  open: "Kép nagyítása",
  close: "Bezárás",
  previous: "Előző kép",
  next: "Következő kép",
  position: "{{current}}. kép a(z) {{total}}-ból",
};

const IMAGES = ["https://x.com/deck.jpg", "https://x.com/orr.jpg"];

/**
 * A jsdom nem implementálja a natív `<dialog>` modális API-ját — a komponens
 * viszont épp arra épít (fókusz-csapda, inert háttér). A `showModal`/`close`
 * pótlása annyit tesz, hogy az `open` attribútum a valósághűen viselkedik.
 */
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});

function renderGallery(images: string[] = IMAGES) {
  return render(
    <ProductGallery
      cover="https://x.com/cover.jpg"
      images={images}
      modelName="Starboard iGO"
      labels={LABELS}
    />,
  );
}

describe("ProductGallery", () => {
  afterEach(() => {
    cleanup();
  });

  it("zárt állapotban a BORÍTÓT mutatja, nagyító-gombként", () => {
    renderGallery();
    const trigger = screen.getByRole("button", { name: LABELS.open });
    expect(trigger.querySelector("img")?.getAttribute("src")).toBe("https://x.com/cover.jpg");
  });

  it("a nagy képek NEM töltődnek, amíg a nézet zárva van", () => {
    const { container } = renderGallery();
    // A listában ez a szabály: a galéria SOHA nem viszi vissza a súly-nyereséget.
    const sources = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(sources).toEqual(["https://x.com/cover.jpg"]);
  });

  it("koppintásra teljes képernyős nézet nyílik, a terméknevével", async () => {
    const user = userEvent.setup();
    renderGallery();
    await user.click(screen.getByRole("button", { name: LABELS.open }));
    expect(screen.getByRole("dialog", { name: "Starboard iGO" })).toBeTruthy();
  });

  /**
   * A koppintás-bezárás önmagában KEVÉS: billentyűzettel vagy képernyőolvasóval
   * nem lehet „koppintani". Ezért mind a négy út kell.
   */
  it("bezárható a × gombbal", async () => {
    const user = userEvent.setup();
    renderGallery();
    await user.click(screen.getByRole("button", { name: LABELS.open }));
    await user.click(screen.getByRole("button", { name: LABELS.close }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("bezárható magára a képre koppintva", async () => {
    const user = userEvent.setup();
    renderGallery();
    await user.click(screen.getByRole("button", { name: LABELS.open }));
    await user.click(screen.getByAltText("Starboard iGO — 1"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("nyíl-billentyűvel lapoz (nem csak legyintéssel)", async () => {
    const user = userEvent.setup();
    renderGallery();
    await user.click(screen.getByRole("button", { name: LABELS.open }));
    expect(screen.getByText("1. kép a(z) 3-ból")).toBeTruthy();
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText("2. kép a(z) 3-ból")).toBeTruthy();
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByText("1. kép a(z) 3-ból")).toBeTruthy();
  });

  it("a nyíl-gombok körbeérnek", async () => {
    const user = userEvent.setup();
    renderGallery();
    await user.click(screen.getByRole("button", { name: LABELS.open }));
    await user.click(screen.getByRole("button", { name: LABELS.previous }));
    expect(screen.getByText("3. kép a(z) 3-ból")).toBeTruthy();
  });

  /**
   * A HTML-forrásokból (Aqua Marina, Indiana) egyelőre EGY kép jön — ez a
   * normál eset, nem hibaállapot. Ilyenkor a lapozó felület félrevezető lenne.
   */
  it("EGY képnél nincs pöttysor, nincs lapozó gomb", async () => {
    const user = userEvent.setup();
    renderGallery([]);
    await user.click(screen.getByRole("button", { name: LABELS.open }));
    expect(screen.queryByRole("button", { name: LABELS.next })).toBeNull();
    expect(screen.queryByRole("button", { name: LABELS.previous })).toBeNull();
    expect(screen.queryByText(/kép a\(z\)/)).toBeNull();
  });

  it("csak a SZOMSZÉDOS képet tartja a DOM-ban (n±1)", async () => {
    const user = userEvent.setup();
    const { container } = renderGallery(["https://x.com/a.jpg", "https://x.com/b.jpg", "https://x.com/c.jpg"]);
    await user.click(screen.getByRole("button", { name: LABELS.open }));
    const inDialog = [...(container.querySelector("dialog")?.querySelectorAll("img") ?? [])];
    // 4 kép van összesen (borító + 3), de csak 3 kerül a DOM-ba.
    expect(inDialog).toHaveLength(3);
  });

  it("kép nélküli termékre nincs nagyító-gomb (csak a placeholder)", () => {
    render(
      <ProductGallery cover={null} images={[]} modelName="Névtelen" labels={LABELS} />,
    );
    expect(screen.queryByRole("button", { name: LABELS.open })).toBeNull();
  });
});
