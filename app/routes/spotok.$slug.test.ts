/**
 * Route-action tesztek `spotok.$slug.tsx`-hez — KÉT intent-ág:
 *
 *  - `intent=refresh` — PUBLIKUS (nincs `requireUser`), ismeretlen slugra
 *    `{ refresh: "not_found" }`-ot ad, NEM 404-et (a `RefreshButton` fetcherje
 *    várja a válasz-DTO-t, egy dobott 404 a hívó oldali hibahatárt ütné el).
 *  - `intent=report` — VÉDETT (requireUser + email-megerősítés).
 *
 * A Supabase-kliens és a szerver-oldali modulok (session/analytics/
 * spots.server) MOCKOLVA — ez egy tiszta route-réteg unit-teszt, nem
 * integrációs/Supabase-teszt.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  getSpotBySlug: vi.fn(),
  insertReport: vi.fn(),
  requestSpotRefresh: vi.fn(),
  getLatestSnapshot: vi.fn(),
  listReports: vi.fn(),
  requireUser: vi.fn(),
  getUser: vi.fn(),
  isEmailConfirmed: vi.fn(),
  recordEvent: vi.fn().mockResolvedValue(true),
}));

vi.mock("@core/auth/supabase.server", () => ({
  createSupabaseServerClient: () => ({
    supabase: {} as never,
    headers: new Headers(),
  }),
}));

vi.mock("@core/auth/session.server", () => ({
  requireUser: hoisted.requireUser,
  getUser: hoisted.getUser,
}));

vi.mock("@core/auth/email-confirmed", () => ({
  isEmailConfirmed: hoisted.isEmailConfirmed,
}));

vi.mock("@core/analytics/analytics.server", () => ({
  recordEvent: hoisted.recordEvent,
}));

vi.mock("@modules/spots/data/spots.server", () => ({
  getSpotBySlug: hoisted.getSpotBySlug,
  insertReport: hoisted.insertReport,
  requestSpotRefresh: hoisted.requestSpotRefresh,
  getLatestSnapshot: hoisted.getLatestSnapshot,
  listReports: hoisted.listReports,
}));

const { action } = await import("./spotok.$slug");

function postRequest(body: Record<string, string>) {
  const formData = new URLSearchParams(body);
  return new Request("https://app.hu/spotok/tihany", {
    method: "POST",
    body: formData,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

/**
 * Az action react-router `data()`-val tér vissza — ez NEM egy `Response`,
 * hanem egy `{ type: "DataWithResponseInit", data, init }` csomagoló (a
 * valódi `Response`-t a framework építi belőle a render-fában). Hiba-ágak
 * (400/404-kísérlet helyett) nyers `Response`-t DOBNAK — azokat `.rejects`-
 * szel teszteljük, nem itt.
 */
function unwrapData<T>(result: unknown): T {
  return (result as { data: T }).data;
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.recordEvent.mockResolvedValue(true);
});

describe("spotok.$slug action — intent=refresh", () => {
  it("bejelentkezés nélkül is működik és requestSpotRefresh-t hív ismert slugra", async () => {
    hoisted.getSpotBySlug.mockResolvedValue({ id: "spot-1" });
    hoisted.requestSpotRefresh.mockResolvedValue("queued");

    const response = await action({
      request: postRequest({ intent: "refresh" }),
      params: { slug: "tihany" },
    } as never);

    expect(hoisted.requireUser).not.toHaveBeenCalled();
    expect(hoisted.requestSpotRefresh).toHaveBeenCalledWith({}, "spot-1");

    expect(unwrapData(response)).toEqual({ refresh: "queued" });
  });

  it("ismeretlen slugra { refresh: 'not_found' }-ot ad, NEM 404-et (nem dob)", async () => {
    hoisted.getSpotBySlug.mockResolvedValue(null);

    const response = await action({
      request: postRequest({ intent: "refresh" }),
      params: { slug: "nincs-ilyen" },
    } as never);

    expect(unwrapData(response)).toEqual({ refresh: "not_found" });
    expect(hoisted.requestSpotRefresh).not.toHaveBeenCalled();
  });
});

describe("spotok.$slug action — intent hiányos/ismeretlen/nem-POST", () => {
  it("hiányzó intent → 400", async () => {
    await expect(
      action({ request: postRequest({}), params: { slug: "tihany" } } as never),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("ismeretlen intent → 400", async () => {
    await expect(
      action({
        request: postRequest({ intent: "torol" }),
        params: { slug: "tihany" },
      } as never),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("nem-POST hívás → 400", async () => {
    const request = new Request("https://app.hu/spotok/tihany", { method: "GET" });
    await expect(action({ request, params: { slug: "tihany" } } as never)).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe("spotok.$slug action — intent=report", () => {
  it("bejelentkezés nélkül requireUser dob (redirect) — a report VÉDETT marad", async () => {
    const redirect = new Response(null, { status: 302 });
    hoisted.requireUser.mockRejectedValue(redirect);

    await expect(
      action({
        request: postRequest({ intent: "report", conditions: "nyugodt" }),
        params: { slug: "tihany" },
      } as never),
    ).rejects.toBe(redirect);
  });

  it("bejelentkezve, de megerősítetlen e-maillel → confirmPrompt hibakulcs, insertReport NEM hívódik", async () => {
    hoisted.requireUser.mockResolvedValue({ id: "user-1", email_confirmed_at: null });
    hoisted.isEmailConfirmed.mockReturnValue(false);

    const response = await action({
      request: postRequest({ intent: "report", conditions: "nyugodt" }),
      params: { slug: "tihany" },
    } as never);

    expect(unwrapData(response)).toEqual({ ok: false, errorKey: "reports.confirmPrompt" });
    expect(hoisted.insertReport).not.toHaveBeenCalled();
  });

  it("megerősített e-maillel beküldi a jelentést", async () => {
    hoisted.requireUser.mockResolvedValue({ id: "user-1", email_confirmed_at: "2026-01-01" });
    hoisted.isEmailConfirmed.mockReturnValue(true);
    hoisted.getSpotBySlug.mockResolvedValue({ id: "spot-1" });
    hoisted.insertReport.mockResolvedValue({ ok: true });

    const response = await action({
      request: postRequest({ intent: "report", conditions: "nyugodt" }),
      params: { slug: "tihany" },
    } as never);

    expect(unwrapData(response)).toEqual({ ok: true });
    expect(hoisted.insertReport).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ spot_id: "spot-1", user_id: "user-1", conditions: "nyugodt" }),
    );
  });
});
