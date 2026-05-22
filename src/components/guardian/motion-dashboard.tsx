"use client";

import { useEffect, useRef, useState } from "react";
import { secondsSince } from "@/lib/device";
import { longDate } from "@/lib/format";
import { ACTIVITIES, type Activity, type Telemetry } from "@/lib/telemetry";
import { ActivityDonutCard } from "./activity-donut-card";
import { useDevice } from "./device-provider";
import { Mannequin3D } from "./mannequin-3d";
import { MockDataToggle } from "./mock-data-toggle";

/**
 * Motion dashboard — recreated from the Claude Design "MPU-6050" handoff,
 * integrated into the Guardian app. Reads the live accelerometer / gyroscope
 * stream from the same Supabase feed as the rest of the app (via `useDevice`)
 * and renders the axis panels plus the 3D posture mannequin.
 *
 * The body fills the viewport: the 3D stage and the axis panels stretch to
 * occupy the page, and the axis sparklines grow with them.
 */

const C = {
  ink: "#131826",
  muted: "#384258",
  faint: "#5a6378",
  alert: "#a6293c",
  divider: "rgba(27,58,92,0.10)",
  track: "rgba(27,58,92,0.08)",
  border: "rgba(27,58,92,0.10)",
};
const MONO = "var(--font-geist-mono), ui-monospace, monospace";

/** A device at rest — gravity straight down — used before any reading lands. */
const REST: Telemetry = {
  hr: 0, spo2: 0, temp: 0, stress: 0, batt_v: 0, batt_pct: 0,
  ax: 0, ay: 0, az: 1, gx: 0, gy: 0, gz: 0,
  activity: "Stationary",
  posture: null, sleepState: null,
  stepCount: null, cadenceSpm: null,
  hrvRmssd: null, restingHr: null,
  fallState: null, timeLeftMin: null,
};

function elapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Activity test picker ──────────────────────────────────────────────────
/**
 * Segmented pill that lets the operator force a specific activity onto the
 * mannequin without waiting for the phone-side classifier. "Auto" releases
 * the override and the dashboard follows live telemetry again. When an
 * override is active the pill switches to navy so it's obvious the
 * dashboard is in a test posture rather than reflecting reality.
 */
function ActivityPicker({
  value,
  onChange,
  liveValue,
}: {
  value: Activity | null;
  onChange: (next: Activity | null) => void;
  liveValue: Activity;
}) {
  const isOverridden = value !== null;
  const items: { key: Activity | null; label: string }[] = [
    { key: null, label: "Auto" },
    ...ACTIVITIES.map((a) => ({ key: a as Activity | null, label: a })),
  ];

  return (
    <div
      role="group"
      aria-label="Test override — activity"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: 4,
        borderRadius: 999,
        border: `1px solid ${isOverridden ? "rgba(27,58,92,0.25)" : C.divider}`,
        background: isOverridden ? "rgba(27,58,92,0.06)" : "#fff",
        transition: "background 0.18s ease, border-color 0.18s ease",
      }}
    >
      <span
        style={{
          padding: "0 8px 0 10px",
          fontFamily: MONO,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: isOverridden ? "#1b3a5c" : C.faint,
        }}
        title={
          isOverridden
            ? "Test override is active — the mannequin ignores live data"
            : `Following live telemetry (currently ${liveValue})`
        }
      >
        {isOverridden ? "Test" : "Live"}
      </span>
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.label}
            type="button"
            onClick={() => onChange(it.key)}
            aria-pressed={active}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "none",
              background: active ? "#1b3a5c" : "transparent",
              color: active ? "#fff" : C.ink,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              transition: "background 0.18s ease, color 0.18s ease",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export function MotionDashboard() {
  const { snapshot, telemetry, simulate } = useDevice();
  const [clock, setClock] = useState(() => new Date());
  // When set, the picker overrides the activity reported by the wearable —
  // used for demoing the four animations without waiting for the phone-app
  // classifier to send the right label. `null` = follow live telemetry.
  const [activityOverride, setActivityOverride] = useState<Activity | null>(
    null,
  );
  // Calibration baseline — captured automatically on the first real telemetry
  // row. Subtracted from subsequent readings so the wearable's mounting tilt
  // is treated as the new zero and the mannequin stands upright at rest.
  const [baseline, setBaseline] = useState<{ roll: number; pitch: number } | null>(
    null,
  );
  // Debounced activity — only flips after 2 consecutive rows agree on the new
  // state. Stops the mannequin from flickering between animations if the
  // firmware classifier spits out one stray row.
  const [stableActivity, setStableActivity] = useState<Activity>("Stationary");
  const pendingActivity = useRef<{ activity: Activity; count: number } | null>(
    null,
  );

  // 1-second clock — drives the "alarm 00:07" / "since" elapsed timers.
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const fallen = snapshot.status === "fall";
  const live = snapshot.connected && telemetry !== null;
  const d = telemetry ?? REST;

  // Debounce live activity transitions — accept a new state only after we've
  // seen it in 2 consecutive telemetry rows. The override (manual picker)
  // still bypasses this so the operator can demo any animation instantly.
  useEffect(() => {
    if (!telemetry) return;
    const incoming = telemetry.activity;
    if (incoming === stableActivity) {
      pendingActivity.current = null;
      return;
    }
    const p = pendingActivity.current;
    if (p && p.activity === incoming) {
      // Second consecutive row with this state — commit the change.
      setStableActivity(incoming);
      pendingActivity.current = null;
    } else {
      pendingActivity.current = { activity: incoming, count: 1 };
    }
  }, [telemetry, stableActivity]);

  const effectiveActivity: Activity = activityOverride ?? stableActivity;

  // Orientation from the accelerometer (gravity vector). Standard Z-up
  // convention — REST (ax=0, ay=0, az=1) gives a clean 0 tilt. Real device
  // data can land on any axis the firmware happens to point "down", so the
  // auto-calibrate effect below captures the first real reading as the
  // baseline and we subtract it from then on.
  const rawRoll = (Math.atan2(d.ay, d.az) * 180) / Math.PI;
  const rawPitch =
    (Math.atan2(-d.ax, Math.hypot(d.ay, d.az)) * 180) / Math.PI;
  const roll = baseline ? rawRoll - baseline.roll : rawRoll;
  const pitch = baseline ? rawPitch - baseline.pitch : rawPitch;
  const tilt = Math.hypot(roll, pitch);
  // Magnitude — writers shipping raw m/s² (|g| ≈ 9.8) and writers shipping
  // normalized g both render the same impact readout.
  const mag = Math.hypot(d.ax, d.ay, d.az) || 1;
  const impact = mag > 4 ? mag / 9.80665 : mag;

  // Auto-calibrate the first time real telemetry arrives. The wearable's
  // mounting offset (which axis is "down" on the body) varies device-to-
  // device, so we treat whatever the first reading reports as "upright"
  // and animate tilt relative to that.
  const autoCalibratedRef = useRef(false);
  useEffect(() => {
    if (autoCalibratedRef.current) return;
    if (!telemetry) return;
    const m = Math.hypot(telemetry.ax, telemetry.ay, telemetry.az);
    if (m < 0.5) return;
    const r = (Math.atan2(telemetry.ay, telemetry.az) * 180) / Math.PI;
    const p =
      (Math.atan2(
        -telemetry.ax,
        Math.hypot(telemetry.ay, telemetry.az),
      ) *
        180) /
      Math.PI;
    setBaseline({ roll: r, pitch: p });
    autoCalibratedRef.current = true;
  }, [telemetry]);

  const sinceSec = snapshot.fallEvent
    ? secondsSince(snapshot.fallEvent.detectedAt, clock)
    : 0;
  const sinceLabel = fallen ? elapsed(sinceSec) : "steady";

  const statusLine = fallen
    ? `${longDate(clock)} · alarm ${elapsed(sinceSec)}`
    : live
      ? `${longDate(clock)} · streaming`
      : longDate(clock);

  const headline = fallen
    ? "Fall detected"
    : live
      ? "Motion is steady"
      : "Waiting for sensor";
  const subtitle = fallen
    ? "Sensor reported impact and sustained tilt past threshold."
    : live
      ? "Six axes are inside the expected envelope."
      : "No live telemetry from the wearable yet.";

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pb-[120px] pt-6 lg:px-8 lg:pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div
            suppressHydrationWarning
            style={{
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: fallen ? C.alert : C.faint,
              marginBottom: 10,
            }}
          >
            {statusLine}
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 38,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: fallen ? C.alert : C.ink,
            }}
          >
            {headline}
          </h1>
          <p style={{ marginTop: 7, marginBottom: 0, fontSize: 15, color: C.muted }}>
            {subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <MockDataToggle />
          <ActivityPicker
            value={activityOverride}
            onChange={setActivityOverride}
            liveValue={d.activity}
          />

          {fallen && (
            <button
              type="button"
              onClick={() => simulate("well")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "11px 18px",
                borderRadius: 999,
                border: "none",
                background: C.alert,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4.5 H4 L6.5 2.5 V9.5 L4 7.5 H2 Z" />
                <path d="M9 4 Q10.5 6 9 8" />
              </svg>
              Silence alarm
            </button>
          )}
        </div>
      </div>

      {/* Body grid — mannequin on the left, activity donut on the right.
          Below `xl`, the mannequin stays full-width so it does not get
          squeezed on narrower desktop widths. */}
      <div className="grid gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_460px] xl:grid-rows-[minmax(0,1fr)]">
        <div
          className="min-h-[520px] min-w-0"
          style={{
            borderRadius: 20,
            border: `1px solid ${fallen ? "rgba(166,41,60,0.35)" : C.border}`,
            overflow: "hidden",
            transition: "border-color 0.6s ease",
          }}
        >
          <Mannequin3D
            roll={roll}
            pitch={pitch}
            fallen={fallen}
            activity={effectiveActivity}
            posture={d.posture}
            cadence={d.cadenceSpm}
            tilt={tilt}
            impact={impact}
            since={sinceLabel}
          />
        </div>

        <div className="flex justify-center xl:justify-start">
          <ActivityDonutCard />
        </div>
      </div>
    </div>
  );
}
