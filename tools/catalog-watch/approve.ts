/**
 * catalog-watch — a jóváhagyás PAYLOAD-ja (F2.1-utó-19, 2026-08-19).
 *
 * MIÉRT VAN ITT MÁSOLAT: az alkalmazás oldali `buildBoardInsert`
 * (`src/modules/catalog/data/candidates.server.ts`) a `@core/*` aliast
 * használja, ami CSAK a Vite-bundleren át oldódik fel. Ez a fájl viszont sima
 * `node`-dal fut (CLI + heti cron), ahol az alias ismeretlen — ugyanaz a
 * megkötés, amit a `match.ts` fejléce is leír.
 *
 * AZ ELCSÚSZÁS ELLEN ŐRSZEM-TESZT VÉD (`approve.test.ts`): a teszt vitest
 * alatt fut, ahol az alias FELOLDÓDIK, ezért be tudja tölteni az app-oldali
 * `buildBoardInsert`-et, és mezőről mezőre összeveti a kettőt. Ha az app-oldali
 * payload változik és ez a másolat nem, a teszt elhasal.
 */
import type { GearCategory } from "../../src/modules/catalog/gear.ts";
import type { BoardType, ExtractedProduct } from "./types.ts";

/**
 * Egy jóváhagyott jelölt `boards`-sora.
 *
 * A méretek KEREKÍTVE mennek (a séma egész centimétert tárol), a súly viszont
 * tizedessel — a deszkasúly tizede számít a vásárlónak.
 */
export function buildBoardInsertPayload(
  extracted: ExtractedProduct,
  options: { brandId: string; boardType: BoardType; slug: string; seenAt: string },
): Record<string, unknown> {
  const specs = extracted.specs;
  return {
    brand_id: options.brandId,
    model_name: extracted.modelName === "" ? extracted.rawTitle : extracted.modelName,
    model_year: extracted.modelYear,
    slug: { hu: options.slug, en: options.slug },
    kind: "board",
    board_type: options.boardType,
    length_cm: specs.lengthCm === null ? null : Math.round(specs.lengthCm),
    width_cm: specs.widthCm === null ? null : Math.round(specs.widthCm),
    thickness_cm: specs.thicknessCm === null ? null : Math.round(specs.thicknessCm),
    volume_l: specs.volumeL === null ? null : Math.round(specs.volumeL),
    weight_kg: specs.weightKg,
    max_load_kg: specs.maxLoadKg === null ? null : Math.round(specs.maxLoadKg),
    inflatable: specs.inflatable ?? true,
    image_url: extracted.imageUrl,
    images: galleryImagesPayload(extracted),
    availability_hu: extracted.inStock ?? false,
    status: "active",
    first_seen_at: options.seenAt,
    last_seen_at: options.seenAt,
  };
}

/**
 * Egy jóváhagyott KIEGÉSZÍTŐ-jelölt `boards`-sora (F2.3 3. szakasz).
 *
 * A `buildBoardInsertPayload` párja; szándékosan KÜLÖN függvény, mert a két
 * alak más mezőt visel (`board_type` kontra `accessory_type`) — ugyanaz az
 * indoklás, mint az app-oldali eredetinél. Az elcsúszást ott is őrszem-teszt
 * védi (`approve.test.ts`).
 */
export function buildAccessoryInsertPayload(
  extracted: ExtractedProduct,
  options: { brandId: string; accessoryType: GearCategory; slug: string; seenAt: string },
): Record<string, unknown> {
  const specs = extracted.specs;
  return {
    brand_id: options.brandId,
    model_name: extracted.modelName === "" ? extracted.rawTitle : extracted.modelName,
    model_year: extracted.modelYear,
    slug: { hu: options.slug, en: options.slug },
    kind: "accessory",
    accessory_type: options.accessoryType,
    length_cm: specs.lengthCm === null ? null : Math.round(specs.lengthCm),
    width_cm: specs.widthCm === null ? null : Math.round(specs.widthCm),
    thickness_cm: specs.thicknessCm === null ? null : Math.round(specs.thicknessCm),
    volume_l: specs.volumeL === null ? null : Math.round(specs.volumeL),
    weight_kg: specs.weightKg,
    max_load_kg: specs.maxLoadKg === null ? null : Math.round(specs.maxLoadKg),
    inflatable: specs.inflatable ?? true,
    image_url: extracted.imageUrl,
    images: galleryImagesPayload(extracted),
    availability_hu: extracted.inStock ?? false,
    status: "active",
    first_seen_at: options.seenAt,
    last_seen_at: options.seenAt,
  };
}

/**
 * A `boards.images` értéke a jelöltből. A jóváhagyás MINDEN begyűjtött
 * galéria-jelöltet beír (legfeljebb 8-at, `galleryCandidates`) — a tömeges
 * jóváhagyónál nincs ember a hurokban, a válogatás és a sorrend a
 * `/admin/katalogus` dolga. Egy fölösleges kép a teljes képernyős nézetben
 * legfeljebb egy legyintés, a hiányzó kép viszont pótolhatatlan.
 */
function galleryImagesPayload(extracted: ExtractedProduct): { url: string; source: "brand" }[] {
  return (extracted.imageUrls ?? []).map((url) => ({ url, source: "brand" as const }));
}
