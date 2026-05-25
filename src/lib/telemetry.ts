/**
 * Telemetry contract — the wire format the wearable writes and the app reads.
 *
 * ── Architecture note ──────────────────────────────────────────────────────
 * The wearable's microcontroller inserts one row into Supabase
 * `telemetry_readings` per reading (cadence ~once every 5–10 s). The browser
 * subscribes to that table via Supabase Realtime and folds each row into the
 * shared `DeviceSnapshot`. There is no MQTT anymore — Supabase is both the
 * transport and the history store.
 *
 * The field names below intentionally match the `telemetry_readings` columns
 * so a row can be consumed as `Telemetry` without any renaming.
 * ───────────────────────────────────────────────────────────────────────────
 */
import type { DeviceSnapshot, VitalStatus } from "./device";

/**
 * Coarse-grained motion classification, as decided on the phone (which fuses
 * raw IMU samples it receives from the wearable over Bluetooth). The dashboard
 * uses this to drive the 3D mannequin animation on `/motion`. Unknown values
 * — and `null` — collapse to `"Stationary"` so the figure always has a safe
 * pose to render.
 */
export type Activity = "Walking" | "Running" | "Stationary" | "Falling";

/** All activity values the dashboard understands. */
export const ACTIVITIES: readonly Activity[] = [
  "Walking",
  "Running",
  "Stationary",
  "Falling",
] as const;

/** Coarse body posture from the on-device classifier. Unknown / null → upright. */
export type Posture = "upright" | "reclined" | "lying" | "inverted";
export const POSTURES: readonly Posture[] = [
  "upright",
  "reclined",
  "lying",
  "inverted",
] as const;

/** Sleep stage from the on-device classifier. Unknown / null → awake. */
export type SleepState = "awake" | "resting" | "light" | "deep";
export const SLEEP_STATES: readonly SleepState[] = [
  "awake",
  "resting",
  "light",
  "deep",
] as const;

/** One telemetry sample, as inserted into Supabase by the wearable. */
export interface Telemetry {
  /** Heart rate, BPM — 0 when no finger is on the sensor. */
  hr: number;
  /** Blood-oxygen saturation, % — 0 when no finger is on the sensor. */
  spo2: number;
  /** Skin / ambient temperature, °C. */
  temp: number;
  /** Derived stress index, 1–10. */
  stress: number;
  /** Battery voltage, V. */
  batt_v: number;
  /** Battery charge, %. */
  batt_pct: number;
  /** Accelerometer, g. */
  ax: number;
  ay: number;
  az: number;
  /** Gyroscope, °/s. */
  gx: number;
  gy: number;
  gz: number;
  /** Coarse motion state — drives the mannequin animation. */
  activity: Activity;
  /** Body posture from the on-device classifier. Null until reported. */
  posture: Posture | null;
  /** Sleep stage from the on-device classifier. Null until reported. */
  sleepState: SleepState | null;
  /** Total steps since device boot. Null until reported. */
  stepCount: number | null;
  /** Steps per minute, averaged over the last ~6 s. Null until reported. */
  cadenceSpm: number | null;
  /** Heart-rate variability (RMSSD, ms). Null until reported. */
  hrvRmssd: number | null;
  /** Resting heart-rate baseline (EMA). Null until reported. */
  restingHr: number | null;
  /** On-device fall classifier — 1 means a fall is currently confirmed. */
  fallState: 0 | 1 | null;
  /** Battery runtime estimate from the firmware (minutes). Null until the
   *  device starts reporting it. */
  timeLeftMin: number | null;
}

/** Classifies a reading against a normal band. */
function band(value: number, low: number, high: number): VitalStatus {
  if (value < low) return "low";
  if (value > high) return "elevated";
  return "normal";
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Folds a telemetry row into the app's `DeviceSnapshot`.
 *
 * `hr` / `spo2` of 0 mean "no finger on the sensor" — the last good reading
 * is kept rather than showing a misleading zero. The fall latch is driven
 * by `fall_events` rows, not by this function.
 */
export function applyTelemetry(
  prev: DeviceSnapshot,
  t: Telemetry,
  now: Date,
): DeviceSnapshot {
  // Stress arrives in two firmware versions: older devices ship a 0–10
  // index, newer ones already report on the 0–100 scale the UI uses. We
  // detect the scale by magnitude — any value above 10 must already be on
  // the 0–100 scale because a 0–10 reading can never exceed 10.
  const stressIndex = Math.min(
    100,
    Math.round(t.stress > 10 ? t.stress : t.stress * 10),
  );
  return {
    ...prev,
    connected: true,
    lastCheckedAt: now.toISOString(),
    heartRate:
      t.hr > 0
        ? { value: Math.round(t.hr), status: band(t.hr, 60, 100) }
        : prev.heartRate,
    oxygen:
      t.spo2 > 0
        ? { value: Math.round(t.spo2), status: band(t.spo2, 95, 100) }
        : prev.oxygen,
    // Wrist skin temperature — normal ≈ 31 °C. Keep the last good value
    // when the firmware ships a partial row with no temperature.
    bodyTemperature:
      t.temp > 0
        ? { value: round1(t.temp), status: band(t.temp, 30, 32.5) }
        : prev.bodyTemperature,
    stress: {
      value: stressIndex,
      status: stressIndex > 40 ? "elevated" : "normal",
    },
    battery: {
      ...prev.battery,
      percent: Math.round(t.batt_pct),
      // 0 V means the firmware didn't ship the column — keep the previous
      // reading (which stays 0 if it never arrived). The Battery card
      // renders "—" for non-positive voltages so the missing data is
      // visible rather than silently displayed as "0.00 V".
      voltage: t.batt_v > 0 ? t.batt_v : prev.battery.voltage,
      // `timeLeftMin`, `dischargeRatePerHour` and `charging` are computed
      // locally from a rolling buffer of voltage samples — see
      // `estimateRuntime` in lib/device.ts, applied in DeviceProvider after
      // this fold runs. The firmware-reported `time_left_min` is ignored.
    },
    // Wellness fields — keep the last good value when a row arrives with
    // nulls, so the Overview doesn't blink to blank between partial rows.
    posture: t.posture ?? prev.posture,
    sleepState: t.sleepState ?? prev.sleepState,
    stepCount: t.stepCount ?? prev.stepCount,
    cadenceSpm: t.cadenceSpm ?? prev.cadenceSpm,
    hrvRmssd: t.hrvRmssd ?? prev.hrvRmssd,
    restingHr: t.restingHr ?? prev.restingHr,
  };
}
