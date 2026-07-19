import { describe, expect, it } from "vitest";

import { parseEwkbPoint, pointFromGeom } from "./wkb";

const SRID_FLAG = 0x20000000;
const WKB_POINT_TYPE = 1;

/** EWKB (SRID-flagelt) Point hex-string felépítése — a round-trip tesztekhez. */
function buildEwkbPointHex(
  lng: number,
  lat: number,
  options: { littleEndian?: boolean; srid?: number | null } = {},
): string {
  const littleEndian = options.littleEndian ?? true;
  const hasSrid = options.srid !== null;
  const srid = options.srid ?? 4326;

  const length = hasSrid ? 1 + 4 + 4 + 16 : 1 + 4 + 16;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  let offset = 0;

  view.setUint8(offset, littleEndian ? 1 : 0);
  offset += 1;

  const typeAndFlags = hasSrid ? WKB_POINT_TYPE | SRID_FLAG : WKB_POINT_TYPE;
  view.setUint32(offset, typeAndFlags, littleEndian);
  offset += 4;

  if (hasSrid) {
    view.setUint32(offset, srid, littleEndian);
    offset += 4;
  }

  view.setFloat64(offset, lng, littleEndian);
  offset += 8;
  view.setFloat64(offset, lat, littleEndian);
  offset += 8;

  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

describe("parseEwkbPoint", () => {
  it("visszaadja a Balatonföldvár-koordinátát (little-endian, SRID-flagelt)", () => {
    const hex = buildEwkbPointHex(17.865, 46.845);
    expect(parseEwkbPoint(hex)).toEqual({ lng: 17.865, lat: 46.845 });
  });

  it("kis- és nagybetűs hexet egyaránt elfogad", () => {
    const hex = buildEwkbPointHex(17.865, 46.845).toLowerCase();
    expect(parseEwkbPoint(hex)).toEqual({ lng: 17.865, lat: 46.845 });
  });

  it("big-endian bájtsorrendet is kezel", () => {
    const hex = buildEwkbPointHex(19.04, 47.4979, { littleEndian: false });
    expect(parseEwkbPoint(hex)).toEqual({ lng: 19.04, lat: 47.4979 });
  });

  it("SRID-flag nélküli (sima WKB) Pointot is elfogadja", () => {
    const hex = buildEwkbPointHex(19.04, 47.4979, { srid: null });
    expect(parseEwkbPoint(hex)).toEqual({ lng: 19.04, lat: 47.4979 });
  });

  it("null-t ad üres stringre", () => {
    expect(parseEwkbPoint("")).toBeNull();
  });

  it("null-t ad nem-hex karaktereket tartalmazó stringre", () => {
    expect(parseEwkbPoint("nem-ez-egy-hex-string")).toBeNull();
  });

  it("null-t ad páratlan hosszú (csonka bájt) hexre", () => {
    expect(parseEwkbPoint("0101000020E610000")).toBeNull();
  });

  it("null-t ad túl rövid, header-nyi hexre", () => {
    expect(parseEwkbPoint("0101000020E6100000")).toBeNull();
  });

  it("null-t ad ismeretlen bájtsorrend-jelzőre", () => {
    const hex = buildEwkbPointHex(17.865, 46.845);
    const corrupted = `02${hex.slice(2)}`;
    expect(parseEwkbPoint(corrupted)).toBeNull();
  });

  it("null-t ad nem-Point geometria-típusra (pl. LineString = 2)", () => {
    const buffer = new ArrayBuffer(9);
    const view = new DataView(buffer);
    view.setUint8(0, 1);
    view.setUint32(1, 2 | SRID_FLAG, true);
    view.setUint32(5, 4326, true);
    const hex = Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    expect(parseEwkbPoint(hex)).toBeNull();
  });

  it("null-t ad nem string bemenetre", () => {
    expect(parseEwkbPoint(undefined)).toBeNull();
    expect(parseEwkbPoint(null)).toBeNull();
    expect(parseEwkbPoint(12345)).toBeNull();
  });
});

describe("pointFromGeom", () => {
  // ÉLES FORMA (F1.4 verifikáció): a projekt PostgREST-je GeoJSON-objektumot ad.
  it("GeoJSON Point-objektumból {lng,lat} (a projekt éles formája)", () => {
    const geom = {
      type: "Point",
      crs: { type: "name", properties: { name: "EPSG:4326" } },
      coordinates: [17.865, 46.845],
    };
    expect(pointFromGeom(geom)).toEqual({ lng: 17.865, lat: 46.845 });
  });

  it("EWKB hex-stringet is elfogad (parseEwkbPoint-ra delegál)", () => {
    const hex = buildEwkbPointHex(19.04, 47.4979);
    expect(pointFromGeom(hex)).toEqual({ lng: 19.04, lat: 47.4979 });
  });

  it("null-t ad nem-Point GeoJSON-ra", () => {
    expect(pointFromGeom({ type: "LineString", coordinates: [[0, 0], [1, 1]] })).toBeNull();
  });

  it("null-t ad hiányos/rossz koordinátára és null/undefined-re", () => {
    expect(pointFromGeom({ type: "Point", coordinates: [17.865] })).toBeNull();
    expect(pointFromGeom({ type: "Point", coordinates: ["a", "b"] })).toBeNull();
    expect(pointFromGeom(null)).toBeNull();
    expect(pointFromGeom(undefined)).toBeNull();
  });
});
