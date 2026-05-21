/** Geometry helpers for the vital detail chart. */
import type { Tone } from "./status-pill";

/** Resolved stroke / fill colour per pill tone. */
export const toneHex: Record<Tone, string> = {
  sage: "#356548",
  amber: "#946018",
  alert: "#a6293c",
  navy: "#1b3a5c",
};

export interface Point {
  x: number;
  y: number;
}

/** Round to one decimal — keeps generated path strings compact. */
const f = (n: number) => Math.round(n * 10) / 10;

/**
 * A smooth line through `points`, using Catmull-Rom splines converted to cubic
 * Béziers — the curve passes through every point without overshooting.
 */
export function smoothLine(points: Point[]): string {
  if (points.length === 0) return "";
  let d = `M ${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${f(cp1x)} ${f(cp1y)}, ${f(cp2x)} ${f(cp2y)}, ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}
