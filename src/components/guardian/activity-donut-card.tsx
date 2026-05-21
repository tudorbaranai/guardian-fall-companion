"use client";

import { useEffect, useMemo, useState } from "react";
import { mockActivityDurations } from "@/lib/mock-activity";
import {
  fetchActivityDurations,
  type ActivityDurations,
} from "@/lib/supabase";
import { ACTIVITIES, type Activity } from "@/lib/telemetry";
import { useDevice } from "./device-provider";

/**
 * Daily activity donut — adapts the "Quiet Donut" handoff from
 * `Activity Donut.html` to the Guardian app's data model.
 *
 * The donut always fills the full 360° using only the recorded activities
 * — slices are proportional to one another, not to a 24-hour window. The
 * centre stat is "ACTIVE" = Walking + Running, and the secondary line is
 * the active share as a percentage of the recorded data.
 *
 * Falling is rendered in Guardian's alert red so the operator sees fall
 * minutes at a glance even on a calm day.
 *
 * The card refreshes every 60 s — daily summaries don't need realtime
 * cadence, but the user does want it to creep forward as the day goes on.
 */

/** Slice colours, mirroring the warm palette of the source design but
 *  swapping in Guardian's alert red for the Falling slice so it never gets
 *  lost in the warm beiges. */
const PALETTE: Record<Activity, { color: string; label: string }> = {
  Walking: { color: "#c46a4a", label: "Walking" },
  Running: { color: "#2f7a5a", label: "Running" },
  Stationary: { color: "#c9c2af", label: "Stationary" },
  Falling: { color: "#a6293c", label: "Falling" },
};

/** Colour used for the empty-state ring when no activity has been recorded
 *  yet today. Matches the "Off body" tone of the source design. */
const EMPTY_RING = "#efeadd";

// ── Donut math ────────────────────────────────────────────────────────────
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
};

const arcPath = (
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
): string => {
  // Avoid degenerate arcs (start == end) — SVG paths choke on 0-degree sweeps.
  if (endDeg - startDeg < 0.05) return "";
  const [x1, y1] = polar(cx, cy, rOuter, startDeg);
  const [x2, y2] = polar(cx, cy, rOuter, endDeg);
  const [x3, y3] = polar(cx, cy, rInner, endDeg);
  const [x4, y4] = polar(cx, cy, rInner, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`;
};

// ── Formatting helpers ────────────────────────────────────────────────────
/** "1h 24m" — the design's format. Returns "0m" for zero-second durations. */
function durationLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.round((s - h * 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** "21 May" — the small date string on the right of the header. */
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
function shortDateLabel(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Lower-case headline that responds to how active the day has been. The
 *  thresholds use the "active" hours (Walking + Running) — same as the
 *  centre stat — so the copy never disagrees with the number above it. */
function dayHeadline(activeSeconds: number, anyData: boolean): string {
  if (!anyData) return "Waiting for data";
  const activeH = activeSeconds / 3600;
  if (activeH < 0.25) return "A quiet day";
  if (activeH < 1.5) return "A calm day";
  if (activeH < 4) return "A steady day";
  return "An active day";
}

/** Render the donut + legend. Pure: takes prepared durations, never fetches. */
function Donut({ data }: { data: ActivityDurations }) {
  const recorded = data.totalRecorded;
  const activeSeconds = data.byActivity.Walking + data.byActivity.Running;
  const anyData = recorded > 0;

  // The donut now scales to the recorded total, not the 24-hour window —
  // slices always add up to a full ring. When no activity is recorded yet
  // we draw a single faint placeholder ring instead.
  const slices = useMemo(() => {
    if (recorded <= 0) return [];
    let cursor = 0;
    return ACTIVITIES.map((a) => ({
      key: a,
      seconds: data.byActivity[a],
      color: PALETTE[a].color,
    }))
      .filter((s) => s.seconds > 0)
      .map((s) => {
        const start = (cursor / recorded) * 360;
        cursor += s.seconds;
        const end = (cursor / recorded) * 360;
        return { ...s, start, end };
      });
  }, [data, recorded]);

  const cx = 150;
  const cy = 150;
  const rO = 130;
  const rI = 86;

  const activeLabel = durationLabel(activeSeconds);
  const activePct = recorded > 0 ? Math.round((activeSeconds / recorded) * 100) : 0;
  const headline = dayHeadline(activeSeconds, anyData);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 460,
        background: "#fff",
        border: "1px solid #e8e3d8",
        borderRadius: 20,
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 22,
        boxShadow:
          "0 1px 0 rgba(0,0,0,.02), 0 24px 60px -28px rgba(27,26,23,.18)",
      }}
    >
      {/* Header — "Today" + headline on the left, date / window on the right. */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#7a766d",
            }}
          >
            Today
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              marginTop: 4,
              letterSpacing: "-0.01em",
              color: "#1b1a17",
            }}
          >
            {headline}
          </div>
        </div>
        <div
          suppressHydrationWarning
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: 11,
            color: "#7a766d",
            whiteSpace: "nowrap",
          }}
        >
          {shortDateLabel(data.dayStart)} · 24h
        </div>
      </div>

      {/* Donut */}
      <div style={{ display: "grid", placeItems: "center" }}>
        <svg viewBox="0 0 300 300" width="300" height="300">
          {/* Empty-state ring — only when literally no activity has been
              recorded today. Otherwise the slices below fill the full circle. */}
          {slices.length === 0 && (
            <circle
              cx={cx}
              cy={cy}
              r={(rO + rI) / 2}
              fill="none"
              stroke={EMPTY_RING}
              strokeWidth={rO - rI}
            />
          )}
          {/* SVG arc paths can't represent a single 360° slice — the start
              and end points coincide and the path renders blank. When the
              day has only one activity we draw a stroked ring in that
              activity's colour instead, which gives the same visual. */}
          {slices.length === 1 ? (
            <circle
              cx={cx}
              cy={cy}
              r={(rO + rI) / 2}
              fill="none"
              stroke={slices[0].color}
              strokeWidth={rO - rI}
            />
          ) : (
            slices.map((s) => (
              <path
                key={s.key}
                d={arcPath(cx, cy, rO, rI, s.start, s.end)}
                fill={s.color}
                stroke="#fff"
                strokeWidth={1.5}
              />
            ))
          )}
          <circle cx={cx} cy={cy} r={rI - 4} fill="#fff" />
          <text
            x={cx}
            y={cy - 12}
            textAnchor="middle"
            fontFamily="var(--font-geist-mono), ui-monospace, monospace"
            fontSize={9.5}
            letterSpacing={2}
            fill="#7a766d"
            style={{ textTransform: "uppercase" }}
          >
            ACTIVE
          </text>
          <text
            x={cx}
            y={cy + 18}
            textAnchor="middle"
            fontSize={32}
            fontWeight={500}
            fill="#1b1a17"
          >
            {activeLabel}
          </text>
          <text x={cx} y={cy + 42} textAnchor="middle" fontSize={11} fill="#7a766d">
            {anyData ? `${activePct}% of recorded` : "no data yet"}
          </text>
        </svg>
      </div>

      {/* Legend — every activity always shown so the colour key stays
          predictable, even if a slice is zero today. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {ACTIVITIES.map((a) => (
          <LegendItem
            key={a}
            color={PALETTE[a].color}
            label={PALETTE[a].label}
            duration={durationLabel(data.byActivity[a])}
          />
        ))}
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  duration,
}: {
  color: string;
  label: string;
  duration: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: color,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flex: 1,
          fontSize: 12,
          minWidth: 0,
        }}
      >
        <span style={{ color: "#3a3833" }}>{label}</span>
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            color: "#7a766d",
          }}
        >
          {duration}
        </span>
      </div>
    </div>
  );
}

// ── Container — handles data fetch + refresh ─────────────────────────────
const EMPTY: ActivityDurations = {
  byActivity: { Walking: 0, Running: 0, Stationary: 0, Falling: 0 },
  totalRecorded: 0,
  dayStart: new Date(0),
  dayEnd: new Date(0),
};

export function ActivityDonutCard() {
  const { isMock } = useDevice();
  const [data, setData] = useState<ActivityDurations>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    if (isMock) {
      const refreshMock = () => setData(mockActivityDurations());
      refreshMock();
      const id = setInterval(refreshMock, 5000);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }

    const refresh = () => {
      fetchActivityDurations().then((d) => {
        if (!cancelled) setData(d);
      });
    };
    refresh();
    // 60 s is plenty — the wearable cadence is 5-10 s but a daily summary
    // doesn't need that resolution.
    const id = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isMock]);

  return <Donut data={data} />;
}
