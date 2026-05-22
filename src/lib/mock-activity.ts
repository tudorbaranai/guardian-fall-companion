import type { Activity, Telemetry } from "./telemetry";
import type { ActivityDurations } from "./supabase";

const ACTIVITY_LOOP: { activity: Exclude<Activity, "Falling">; seconds: number }[] = [
  { activity: "Stationary", seconds: 8 },
  { activity: "Walking", seconds: 14 },
  { activity: "Running", seconds: 9 },
  { activity: "Walking", seconds: 10 },
  { activity: "Stationary", seconds: 7 },
];

const LOOP_SECONDS = ACTIVITY_LOOP.reduce((sum, item) => sum + item.seconds, 0);
const TAU = Math.PI * 2;

function loopPosition(elapsedSeconds: number) {
  let cursor = ((elapsedSeconds % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
  for (const item of ACTIVITY_LOOP) {
    if (cursor < item.seconds) {
      return {
        activity: item.activity,
        phaseSeconds: cursor,
        phaseProgress: cursor / item.seconds,
      };
    }
    cursor -= item.seconds;
  }
  return { activity: "Stationary" as const, phaseSeconds: 0, phaseProgress: 0 };
}

function jitter(scale: number): number {
  return (Math.random() - 0.5) * scale;
}

export function mockMotionAxes(elapsedSeconds: number): Pick<
  Telemetry,
  | "ax"
  | "ay"
  | "az"
  | "gx"
  | "gy"
  | "gz"
  | "activity"
  | "posture"
  | "sleepState"
  | "stepCount"
  | "cadenceSpm"
  | "hrvRmssd"
  | "restingHr"
  | "fallState"
  | "timeLeftMin"
> {
  const { activity, phaseSeconds } = loopPosition(elapsedSeconds);
  // Approximate cumulative step count — Walking adds steps fast, Running
  // even faster, Stationary not at all. Good enough for a demo readout.
  const stepCount = Math.round(elapsedSeconds * 1.6 + 4200);
  const wellness = {
    posture: "upright" as const,
    sleepState: "awake" as const,
    stepCount,
    hrvRmssd: 58,
    restingHr: 64,
    fallState: 0 as const,
    // ~37 hours of runtime, gently counting down so the readout doesn't
    // feel frozen during long demos.
    timeLeftMin: Math.max(60, 2220 - Math.floor(elapsedSeconds / 60)),
  };

  if (activity === "Walking") {
    const step = Math.sin(phaseSeconds * TAU * 1.55);
    const stride = Math.cos(phaseSeconds * TAU * 1.55);
    return {
      ax: step * 0.075 + jitter(0.012),
      ay: Math.sin(phaseSeconds * TAU * 0.55) * 0.035 + jitter(0.01),
      az: 1 + Math.abs(step) * 0.085 + jitter(0.012),
      gx: stride * 18 + jitter(2.5),
      gy: step * 9 + jitter(2),
      gz: Math.sin(phaseSeconds * TAU * 0.75) * 5 + jitter(1.5),
      activity,
      ...wellness,
      cadenceSpm: 105,
    };
  }

  if (activity === "Running") {
    const step = Math.sin(phaseSeconds * TAU * 2.45);
    const stride = Math.cos(phaseSeconds * TAU * 2.45);
    return {
      ax: step * 0.16 + jitter(0.025),
      ay: Math.sin(phaseSeconds * TAU * 0.85) * 0.07 + jitter(0.018),
      az: 1 + Math.abs(step) * 0.18 + jitter(0.025),
      gx: stride * 38 + jitter(5),
      gy: step * 20 + jitter(4),
      gz: Math.sin(phaseSeconds * TAU * 1.1) * 12 + jitter(3),
      activity,
      ...wellness,
      cadenceSpm: 160,
    };
  }

  return {
    ax: Math.sin(elapsedSeconds * 1.4) * 0.025 + jitter(0.005),
    ay: Math.sin(elapsedSeconds * 1.1 + 1.3) * 0.02 + jitter(0.005),
    az: 1 + Math.sin(elapsedSeconds * 1.4) * 0.01 + jitter(0.004),
    gx: Math.sin(elapsedSeconds * 1.4) * 0.6,
    gy: Math.sin(elapsedSeconds * 1.1 + 1.3) * 0.5,
    gz: Math.sin(elapsedSeconds * 0.8) * 0.3,
    activity,
    ...wellness,
    cadenceSpm: 0,
  };
}

export function mockActivityDurations(now = new Date()): ActivityDurations {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const secondsIntoDay = Math.max(0, (now.getTime() - dayStart.getTime()) / 1000);
  const recorded = Math.min(Math.max(secondsIntoDay * 0.38, 52 * 60), 6.5 * 3600);
  const current = loopPosition(now.getTime() / 1000).activity;

  const byActivity: Record<Activity, number> = {
    Walking: recorded * 0.3,
    Running: recorded * 0.11,
    Stationary: recorded * 0.59,
    Falling: 0,
  };
  byActivity[current] += 4 * 60;

  return {
    byActivity,
    totalRecorded: Object.values(byActivity).reduce((sum, seconds) => sum + seconds, 0),
    dayStart,
    dayEnd: now,
  };
}
