/**
 * Device data layer for The Guardian.
 *
 * ── Architecture note ──────────────────────────────────────────────────────
 * The "brain" of this product is a wearable MICROCONTROLLER. It runs the fall
 * detection and reads the heart-rate / SpO2 / accelerometer sensors. This
 * web app is the *caregiver companion* — it only renders state and exposes
 * a few caregiver-side actions.
 *
 * The microcontroller pushes readings to `POST /api/device`; this app reads
 * them back with `GET /api/device`. `DeviceSnapshot` is the contract between
 * the firmware and the UI — keep it in sync with the device payload.
 * ───────────────────────────────────────────────────────────────────────────
 */

import type { Posture, SleepState } from "./telemetry";

/** Plain-language health state for a single vital sign. */
export type VitalStatus = "normal" | "elevated" | "low";

/** Overall wearer state, as classified on the microcontroller. */
export type GuardianStatus = "well" | "warning" | "fall";

export interface Vital {
  value: number;
  status: VitalStatus;
}

export interface FallEvent {
  /** ISO timestamp of when the fall was detected by the device. */
  detectedAt: string;
  /** ISO timestamp of when caregivers were alerted. */
  alertSentAt: string;
  /** True once the wearer has confirmed they are OK on the device. */
  responded: boolean;
}

export interface CareContact {
  initial: string;
  name: string;
  relation: string;
}

/** Wearable battery telemetry. */
export interface BatteryInfo {
  /** Charge level, 0–100. */
  percent: number;
  /** True while the wearable is sitting on its charger. */
  charging: boolean;
  /** Discharge rate in % per hour (meaningful when not charging). */
  dischargeRatePerHour: number;
  /** Cell voltage in volts. */
  voltage: number;
  /** The caregiver is notified once the level drops below this percent. */
  lowThreshold: number;
}

/** The full payload exchanged with the wearable microcontroller. */
export interface DeviceSnapshot {
  person: { name: string; initial: string; phone: string };
  status: GuardianStatus;
  connected: boolean;
  battery: BatteryInfo;
  /** ISO timestamp of the last successful sensor reading. */
  lastCheckedAt: string;
  heartRate: Vital;
  oxygen: Vital;
  /** Skin / body temperature in °C. */
  bodyTemperature: Vital;
  /** Stress index, 0–100, derived on-device from heart-rate variability. */
  stress: Vital;
  activity: {
    active: boolean;
    lastMovementMinsAgo: number;
    summary: string;
  };
  fallHistory: {
    fallsThisWeek: number;
    note: string;
  };
  /** Present only while a fall alert is active. */
  fallEvent: FallEvent | null;
  careCircle: CareContact[];
  // ── Wellness telemetry (new columns) ──────────────────────────────────
  /** Body posture — reported by the on-device classifier. */
  posture: Posture | null;
  /** Sleep stage — reported by the on-device classifier. */
  sleepState: SleepState | null;
  /** Steps since last device boot — running total. */
  stepCount: number | null;
  /** Instantaneous cadence in steps/min (6 s avg). */
  cadenceSpm: number | null;
  /** Heart-rate variability proxy (RMSSD, ms). */
  hrvRmssd: number | null;
  /** Baseline resting heart rate (EMA). */
  restingHr: number | null;
}

/** Seconds the wearer has to cancel a false alarm before services are called. */
export const FALL_COUNTDOWN_SECONDS = 30;

/** Emergency services number (Romania / EU). */
export const EMERGENCY_NUMBER = "112";

const CARE_CIRCLE: CareContact[] = [
  { initial: "A", name: "Ana", relation: "Daughter" },
  { initial: "M", name: "Mihai", relation: "Son" },
];

/**
 * Empty / "no readings yet" snapshot. Used as the initial UI state before
 * any telemetry row arrives, so the dashboard shows honest zeros rather
 * than mock numbers. Live readings overlay this baseline as they arrive;
 * the caregiver can also press the "Use mock data" toggle to load the
 * plausible-but-fake `defaultSnapshot` for demo purposes.
 */
export function emptySnapshot(): DeviceSnapshot {
  const epoch = new Date(0).toISOString();
  return {
    person: { name: "Maria", initial: "M", phone: "+40720000000" },
    status: "well",
    connected: false,
    battery: {
      percent: 0,
      charging: false,
      dischargeRatePerHour: 0,
      voltage: 0,
      lowThreshold: 20,
    },
    lastCheckedAt: epoch,
    heartRate: { value: 0, status: "normal" },
    oxygen: { value: 0, status: "normal" },
    bodyTemperature: { value: 0, status: "normal" },
    stress: { value: 0, status: "normal" },
    activity: {
      active: false,
      lastMovementMinsAgo: 0,
      summary: "",
    },
    fallHistory: {
      fallsThisWeek: 0,
      note: "",
    },
    fallEvent: null,
    careCircle: CARE_CIRCLE,
    posture: null,
    sleepState: null,
    stepCount: null,
    cadenceSpm: null,
    hrvRmssd: null,
    restingHr: null,
  };
}

/**
 * Default "all is well" snapshot. Used as the demo / mock-data baseline
 * when the caregiver presses the "Use mock data" toggle.
 */
export function defaultSnapshot(now: Date = new Date()): DeviceSnapshot {
  return {
    person: { name: "Maria", initial: "M", phone: "+40720000000" },
    status: "well",
    connected: true,
    battery: {
      percent: 78,
      charging: false,
      dischargeRatePerHour: 2.1,
      voltage: 3.92,
      lowThreshold: 20,
    },
    lastCheckedAt: new Date(now.getTime() - 2 * 60_000).toISOString(),
    heartRate: { value: 72, status: "normal" },
    oxygen: { value: 97, status: "normal" },
    bodyTemperature: { value: 31.0, status: "normal" },
    stress: { value: 24, status: "normal" },
    activity: {
      active: true,
      lastMovementMinsAgo: 4,
      summary: "2 short walks since morning",
    },
    fallHistory: {
      fallsThisWeek: 0,
      note: "Last fall: 14 weeks ago — false alarm",
    },
    fallEvent: null,
    careCircle: CARE_CIRCLE,
    // Plausible demo values so the wellness InfoRow has something to show.
    posture: "upright",
    sleepState: "awake",
    stepCount: 4218,
    cadenceSpm: 0,
    hrvRmssd: 58,
    restingHr: 64,
  };
}

/**
 * A snapshot in the active-fall state. The Fall Alert screen renders this
 * when the microcontroller reports `status: "fall"`.
 */
export function fallSnapshot(now: Date = new Date()): DeviceSnapshot {
  const base = defaultSnapshot(now);
  return {
    ...base,
    status: "fall",
    lastCheckedAt: now.toISOString(),
    heartRate: { value: 104, status: "elevated" },
    stress: { value: 71, status: "elevated" },
    fallEvent: {
      detectedAt: now.toISOString(),
      alertSentAt: new Date(now.getTime() - 12_000).toISOString(),
      responded: false,
    },
  };
}

/** Human, specific relative time — "2 minutes ago", never "recently". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

/** Seconds elapsed since an ISO timestamp. */
export function secondsSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
}

export type BatteryLevel = "healthy" | "low" | "critical";
export type BatteryStatus = BatteryLevel | "charging";

/** Charge-level bands shared by every battery display. */
export function batteryLevel(b: Pick<BatteryInfo, "percent">): BatteryLevel {
  if (b.percent < 20) return "critical";
  if (b.percent < 50) return "low";
  return "healthy";
}

/** Plain battery state — drives the Battery card's pill, colour and fill. */
export function batteryStatus(b: BatteryInfo): BatteryStatus {
  if (b.charging) return "charging";
  return batteryLevel(b);
}

