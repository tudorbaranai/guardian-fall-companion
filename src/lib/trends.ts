/**
 * Synthetic trend history for the vital detail view.
 *
 * The wearable microcontroller will eventually expose real windowed history.
 * Until then, this generates realistic, *deterministic* placeholder series so
 * the time-range selector has something coherent to show — the same range
 * always produces the same curve, and it ends at the live current reading.
 */

export type RangeKey = "6h" | "24h" | "7d";

export const TREND_RANGES: { key: RangeKey; label: string; count: number }[] = [
  { key: "6h", label: "6 hours", count: 24 },
  { key: "24h", label: "24 hours", count: 24 },
  { key: "7d", label: "7 days", count: 28 },
];

/** FNV-1a string hash → 32-bit seed. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small, fast, seeded PRNG. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A mean-reverting random walk of `count` readings, bounded to [`lo`, `hi`],
 * whose most-recent value is exactly `current`.
 */
export function trendSeries(
  seed: string,
  count: number,
  current: number,
  lo: number,
  hi: number,
  step: number,
): number[] {
  const rng = mulberry32(hashString(seed));
  const mid = (lo + hi) / 2;
  const out: number[] = [current];
  let v = current;
  for (let i = 1; i < count; i++) {
    v += (rng() - 0.5) * 2 * step;
    v += (mid - v) * 0.08; // gentle pull toward the middle of the band
    v = Math.max(lo, Math.min(hi, v));
    out.push(v);
  }
  return out.reverse(); // oldest → newest, ending at `current`
}
