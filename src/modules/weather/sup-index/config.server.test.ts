import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_SUPINDEX_CONFIG } from "./config";
import { loadSupIndexConfig, SUPINDEX_KEY_PREFIX } from "./config.server";

/** Minimál Supabase-kliens-stub: from().select().like() → { data, error }. */
function stubClient(response: { data: unknown; error: unknown }): {
  client: SupabaseClient;
  like: ReturnType<typeof vi.fn>;
} {
  const like = vi.fn().mockResolvedValue(response);
  const select = vi.fn().mockReturnValue({ like });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as SupabaseClient, like };
}

describe("loadSupIndexConfig", () => {
  it("a supindex.* prefixre szűr és tipizált konfigot ad", async () => {
    const { client, like } = stubClient({
      data: [
        { key: "supindex.storm.level1_cap", value: 2 },
        { key: "supindex.offshore.multiplier", value: 0.4 },
      ],
      error: null,
    });
    const cfg = await loadSupIndexConfig(client);
    expect(like).toHaveBeenCalledWith("key", `${SUPINDEX_KEY_PREFIX}%`);
    expect(cfg.storm.level1Cap).toBe(2);
    expect(cfg.offshore.multiplier).toBe(0.4);
  });

  it("DB-hiba → default-fallback (fail-safe)", async () => {
    const { client } = stubClient({ data: null, error: { message: "boom" } });
    expect(await loadSupIndexConfig(client)).toEqual(DEFAULT_SUPINDEX_CONFIG);
  });

  it("dobó kliens → default-fallback", async () => {
    const client = {
      from: () => {
        throw new Error("network");
      },
    } as unknown as SupabaseClient;
    expect(await loadSupIndexConfig(client)).toEqual(DEFAULT_SUPINDEX_CONFIG);
  });
});
