/**
 * Stale-burok a SUP-index köré (2. fejezet 5. szabály + 5.1 kimenet).
 *
 * A stale-eldöntést a core `isStale`-je adja (30 perces küszöb,
 * `STALE_THRESHOLD_MINUTES`) — NEM írjuk újra. 30 percnél régebbi (vagy
 * értelmezhetetlen dátumú) snapshotnál az index NEM mutatható aktuálisként:
 * a UI "Elavult adat" state-et jelenít meg, cache-elt viharjelzés soha nem
 * mehet aktuálisként.
 */
import { isStale } from "@core/ui/data-age";

import { computeSupIndex } from "./sup-index";
import { type SupIndexConfig } from "./config";
import type { SupIndexInput, SupIndexReading } from "./types";

export interface EvaluateSnapshotArgs {
  input: SupIndexInput;
  /** A snapshot rögzítési ideje (weather_snapshots.fetched_at). */
  fetchedAt: Date | string;
  config?: SupIndexConfig;
  /** Injektálható "most" a determinisztikus teszteléshez. */
  now?: Date;
}

/**
 * SUP-index számítás + stale-jelzés egyben. A `result` mindig kiszámolt (hogy
 * a stale-badge is mutathasson utolsó ismert értéket), de `stale === true`
 * esetén a UI-nak elavultként KELL jelölnie.
 */
export function evaluateSnapshot(args: EvaluateSnapshotArgs): SupIndexReading {
  const { input, fetchedAt, config, now } = args;
  const result = computeSupIndex(input, config);
  const stale = now ? isStale(fetchedAt, now) : isStale(fetchedAt);
  return { result, stale };
}
