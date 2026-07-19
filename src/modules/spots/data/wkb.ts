/**
 * Minimál EWKB Point-parser (PostGIS `geometry(Point,4326)` → PostgREST hex).
 *
 * A PostgREST a `spots.geom` oszlopot EWKB hex-stringként adja vissza, pl.
 * `"0101000020E6100000" + <8 bájt lng LE double> + <8 bájt lat LE double>`.
 * Bájtsorrend: `01` = little-endian (a jellemző eset, PostGIS-kliensek ezt
 * írják), `00` = big-endian (ritka, de a szabvány megengedi — kezeljük).
 * A típus+SRID fejléc (4 bájt geometria-típus, benne a `0x20000000` SRID-
 * flag + opcionális 4 bájt SRID) toleráns: a flaget megnézzük, a SRID
 * értékét nem használjuk fel (a `spots.geom` mindig 4326).
 *
 * Csak 2D Point-ot értelmez — bármi más (más geometria-típus, Z/M-flag,
 * hibás/rövid hex) `null`-t ad, SOHA nem dob kivételt.
 */
export interface EwkbPoint {
  lng: number;
  lat: number;
}

const WKB_POINT_TYPE = 1;
/** EWKB "has SRID" flag a geometria-típus uint32-jének 30. bitjén. */
const SRID_FLAG = 0x20000000;
/** Z/M-flagek — ha bármelyik jelen van, a geometria nem sima 2D Point. */
const Z_FLAG = 0x80000000;
const M_FLAG = 0x40000000;
/** A geometria-típus alapértéke a flag-bitek levágása után. */
const TYPE_MASK = 0x0fffffff;

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    const byteHex = hex.slice(i * 2, i * 2 + 2);
    const value = Number.parseInt(byteHex, 16);
    if (Number.isNaN(value)) {
      return null;
    }
    bytes[i] = value;
  }
  return bytes;
}

/**
 * EWKB hex-string → `{ lng, lat }`, vagy `null` hibás/nem-Point/rövid input
 * esetén. Sosem dob — a hívó (route-loader) null-t kap "nincs geometria"
 * esetén, amit a UI kezel (pl. térkép nélküli kártya).
 */
export function parseEwkbPoint(hex: unknown): EwkbPoint | null {
  if (typeof hex !== "string") {
    return null;
  }
  const clean = hex.trim();
  if (clean.length === 0 || !/^[0-9a-fA-F]+$/.test(clean)) {
    return null;
  }

  const bytes = hexToBytes(clean);
  if (!bytes || bytes.length < 5) {
    return null;
  }

  const endianByte = bytes[0];
  let littleEndian: boolean;
  if (endianByte === 0x01) {
    littleEndian = true;
  } else if (endianByte === 0x00) {
    littleEndian = false;
  } else {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const typeAndFlags = view.getUint32(1, littleEndian);

  if ((typeAndFlags & Z_FLAG) !== 0 || (typeAndFlags & M_FLAG) !== 0) {
    // Csak 2D Point-ot értelmezünk.
    return null;
  }
  if ((typeAndFlags & TYPE_MASK) !== WKB_POINT_TYPE) {
    return null;
  }

  let offset = 5;
  if ((typeAndFlags & SRID_FLAG) !== 0) {
    if (bytes.length < offset + 4) {
      return null;
    }
    offset += 4; // SRID-et átlépjük — a spots.geom mindig 4326.
  }

  if (bytes.length < offset + 16) {
    return null;
  }

  const lng = view.getFloat64(offset, littleEndian);
  const lat = view.getFloat64(offset + 8, littleEndian);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  return { lng, lat };
}

/**
 * A `spots.geom` bármely PostgREST-reprezentációja → `{ lng, lat }`.
 *
 * ÉLES TAPASZTALAT (F1.4 verifikáció): a projekt PostgREST-je a PostGIS 3
 * geometriát GeoJSON-OBJEKTUMKÉNT adja vissza
 * (`{"type":"Point","coordinates":[lng,lat],...}`), nem EWKB hexként — a
 * hex-forma csak PostGIS-cast nélküli / régebbi setupokon jön. Mindkettőt
 * kezeljük; bármi más `null` (a UI "nincs geometria"-ként kezeli).
 */
export function pointFromGeom(geom: unknown): EwkbPoint | null {
  if (typeof geom === "string") {
    return parseEwkbPoint(geom);
  }
  if (
    typeof geom === "object" &&
    geom !== null &&
    (geom as { type?: unknown }).type === "Point" &&
    Array.isArray((geom as { coordinates?: unknown }).coordinates)
  ) {
    const [lng, lat] = (geom as { coordinates: unknown[] }).coordinates;
    if (
      typeof lng === "number" &&
      typeof lat === "number" &&
      Number.isFinite(lng) &&
      Number.isFinite(lat)
    ) {
      return { lng, lat };
    }
  }
  return null;
}
