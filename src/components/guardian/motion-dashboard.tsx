"use client";

import { useEffect, useState } from "react";
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
};

// ── Inline icons ───────────────────────────────────────────────────────────
type IconProps = { c: string };
const Icons = {
  Cal: ({ c }: IconProps) => (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="4.5" /><path d="M7 2.5 v9 M2.5 7 h9" />
    </svg>
  ),
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
  const [calibrating, setCalibrating] = useState(false);
  // When set, the picker overrides the activity reported by the wearable —
  // used for demoing the four animations without waiting for the phone-app
  // classifier to send the right label. `null` = follow live telemetry.
  const [activityOverride, setActivityOverride] = useState<Activity | null>(
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
  const effectiveActivity: Activity = activityOverride ?? d.activity;

  // Orientation from the accelerometer (gravity vector).
  const roll = (Math.atan2(d.ay, d.az) * 180) / Math.PI;
  const pitch = (Math.atan2(-d.ax, Math.hypot(d.ay, d.az)) * 180) / Math.PI;
  const tilt = Math.hypot(roll, pitch);
  const impact = Math.hypot(d.ax, d.ay, d.az);

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

  function calibrate() {
    setCalibrating(true);
    setTimeout(() => setCalibrating(false), 3000);
  }

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

          <button
            type="button"
            onClick={calibrate}
            disabled={calibrating}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: 999,
              border: `1px solid ${C.divider}`,
              background: "#fff",
              color: C.ink,
              fontSize: 13,
              fontWeight: 700,
              cursor: calibrating ? "default" : "pointer",
            }}
          >
            <Icons.Cal c={C.ink} />
            {calibrating ? "Calibrating…" : "Calibrate"}
          </button>

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
