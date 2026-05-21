/**
 * Vital severity — classifies a live reading into three levels and maps that
 * to the colours / tones used across the vital cards.
 *
 *   normal   → green   (reading in the healthy band)
 *   warning  → amber    (a little outside the healthy band)
 *   critical → red      (dangerously outside — e.g. a faint)
 *
 * Card animations colour themselves from `SEVERITY_HEX`; status pills use
 * `SEVERITY_TONE` (the app's StatusPill tones), so a card and its animation
 * always agree.
 */

/** The four vitals shown as cards on the Overview dashboard. */
export type VitalKey = "heart" | "oxygen" | "temperature" | "stress";

export type Severity = "normal" | "warning" | "critical";

interface Band {
  /** Below `warnLo` ⇒ critical. */
  warnLo: number;
  /** [`lo`, `hi`] is the healthy band. */
  lo: number;
  hi: number;
  /** Above `warnHi` ⇒ critical. */
  warnHi: number;
}

/**
 * Healthy / warning / critical thresholds per vital. Stress and oxygen only
 * escalate on one side (low stress is fine; oxygen cannot exceed 100).
 */
export const VITAL_BANDS: Record<VitalKey, Band> = {
  heart: { warnLo: 50, lo: 60, hi: 100, warnHi: 120 },
  oxygen: { warnLo: 90, lo: 95, hi: 100, warnHi: 101 },
  // Skin temperature read at the wrist — typically ~31 °C, much lower than
  // the 36.5 °C core/oral temperature you'd see at the doctor's office.
  temperature: { warnLo: 28, lo: 30, hi: 32.5, warnHi: 34 },
  stress: { warnLo: -1, lo: 0, hi: 40, warnHi: 70 },
};

/** Classifies a reading for a given vital. */
export function vitalSeverity(key: VitalKey, value: number): Severity {
  const b = VITAL_BANDS[key];
  if (value < b.warnLo || value > b.warnHi) return "critical";
  if (value < b.lo || value > b.hi) return "warning";
  return "normal";
}

/** Animation stroke / fill colours — a clear green → amber → red ramp. */
export const SEVERITY_HEX: Record<Severity, string> = {
  normal: "#3a7d4e",
  warning: "#d18f1e",
  critical: "#bb2a33",
};

/** Status-pill tone per severity (a subset of the app's StatusPill tones). */
export const SEVERITY_TONE: Record<Severity, "sage" | "amber" | "alert"> = {
  normal: "sage",
  warning: "amber",
  critical: "alert",
};

/** Plain-language label for a vital's status pill. */
export function vitalLabel(key: VitalKey, value: number): string {
  const severity = vitalSeverity(key, value);
  if (severity === "normal") return key === "stress" ? "Calm" : "Normal";
  if (key === "stress") {
    return severity === "critical" ? "Very tense" : "Tense";
  }
  const high = value > VITAL_BANDS[key].hi;
  if (severity === "critical") return high ? "Very high" : "Very low";
  return high ? "A little high" : "A little low";
}
