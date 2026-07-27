/**
 * OG-kép (megosztás-kártya) helper — 6. fejezet 5. pont.
 *
 * MI VÁLTOZOTT AZ F1.8-HOZ KÉPEST: a korábbi STUB nem létező útvonalakat adott
 * vissza (`/og/board/<slug>.png`), és sehol nem volt bekötve — a megosztott
 * linkek EGYÁLTALÁN nem kaptak képet. Most van egy valódi, márkázott
 * alapértelmezett kártya, a deszka-adatlapok pedig a saját termékképüket
 * használják.
 *
 * MIÉRT NINCS (MÉG) FUTÁSIDEJŰ GENERÁLÁS: a dinamikus kártya (pl. „X100 11'0"
 * — 76% neked") satori + resvg-wasm párost és beágyazott betűkészletet kíván,
 * ami ~8 MB függőséget tesz a serverless csomagba, és minden crawler-kérésnél
 * lefuttatná az ajánló-algoritmust. Ez az arány jelenleg nem indokolt; a
 * döntés újranyitható, ha a megosztás valós forgalmat hoz.
 */

/** A márkázott alapértelmezett megosztás-kártya (1200×630, `public/og/`). */
export const DEFAULT_OG_IMAGE_PATH = "/og/default.png";

/** Az OG-kártya méretei — a `og:image:width/height` metákhoz. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/**
 * Abszolút OG-kép-URL. A relatív útvonalat az origin elé fűzi; a MÁR abszolút
 * URL-t (pl. a katalógus külső termékképe) változatlanul hagyja.
 *
 * Az abszolút alak kötelező: a közösségi crawlerek a relatív `og:image`-et nem
 * oldják fel.
 */
export function resolveOgImage(origin: string, imagePath?: string | null): string {
  const path = imagePath && imagePath.length > 0 ? imagePath : DEFAULT_OG_IMAGE_PATH;
  if (/^https?:\/\//i.test(path)) return path;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
