import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  getTurnstileSiteKey,
  isSupabaseConfigured,
  isTurnstileEnabled,
} from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("env — modul-import nem dob", () => {
  it("a puszta import (fent) nem dobott hibát — a modul betölthető env nélkül is", () => {
    // Ha az import dobna, ide el sem jutnánk. Explicit állítás a szerződéshez:
    expect(typeof getSupabaseUrl).toBe("function");
  });
});

describe("getSupabaseUrl / getSupabaseAnonKey — beszédes hiba híváskor", () => {
  it("hiányzó VITE_SUPABASE_URL → beszédes Error a HÍVÁSKOR", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    expect(() => getSupabaseUrl()).toThrowError(/VITE_SUPABASE_URL/);
    expect(() => getSupabaseUrl()).toThrowError(/\.env\.example/);
  });

  it("hiányzó VITE_SUPABASE_ANON_KEY → beszédes Error a HÍVÁSKOR", () => {
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    expect(() => getSupabaseAnonKey()).toThrowError(/VITE_SUPABASE_ANON_KEY/);
  });

  it("beállított env → visszaadja az értéket, nem dob", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://proj.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key-123");
    expect(getSupabaseUrl()).toBe("https://proj.supabase.co");
    expect(getSupabaseAnonKey()).toBe("anon-key-123");
  });
});

describe("isSupabaseConfigured — nem dob, csak jelez", () => {
  it("hiányzó URL vagy kulcs → false (nem dob)", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    expect(isSupabaseConfigured()).toBe(false);

    vi.stubEnv("VITE_SUPABASE_URL", "https://proj.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("mindkettő beállítva → true", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://proj.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key-123");
    expect(isSupabaseConfigured()).toBe(true);
  });
});

describe("Turnstile kapcsoló — egyetlen forrás", () => {
  it("nincs site key → kikapcsolt (null / false)", () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    expect(getTurnstileSiteKey()).toBeNull();
    expect(isTurnstileEnabled()).toBe(false);
  });

  it("van site key → bekapcsolt", () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "0x4AAA");
    expect(getTurnstileSiteKey()).toBe("0x4AAA");
    expect(isTurnstileEnabled()).toBe(true);
  });
});
