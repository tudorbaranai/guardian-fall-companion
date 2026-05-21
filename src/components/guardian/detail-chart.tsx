"use client";

import { useId } from "react";
import type { Tone } from "./status-pill";
import { smoothLine, toneHex, type Point } from "./chart-utils";

const W = 320;
const H = 176;
const PAD = { left: 38, right: 12, top: 14, bottom: 24 };

/**
 * A detailed trend chart for a single vital — the larger view shown when a
 * caregiver opens a vital card. Draws the reading history as a smooth line
 * with a gradient fill, a shaded normal-range band, horizontal gridlines with
 * value labels, and a marker on every reading. Scales uniformly to its width.
 */
export function DetailChart({
  data,
  tone,
  normalLow,
  normalHigh,
  unit,
}: {
  data: number[];
  tone: Tone;
  normalLow: number;
  normalHigh: number;
  unit: string;
}) {
  const color = toneHex[tone];
  const gradientId = useId();

  const plotX = PAD.left;
  const plotY = PAD.top;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Y domain spans both the data and the normal range, with headroom.
  const dataMin = Math.min(...data);
  const dataMax = Math.max(...data);
  const span = Math.max(dataMax, normalHigh) - Math.min(dataMin, normalLow) || 1;
  const lo = Math.max(0, Math.min(dataMin, normalLow) - span * 0.14);
  const hi = Math.max(dataMax, normalHigh) + span * 0.14;
  const domain = hi - lo || 1;

  const yOf = (v: number) => plotY + plotH - ((v - lo) / domain) * plotH;
  const xOf = (i: number) =>
    plotX + (i / Math.max(1, data.length - 1)) * plotW;

  const pts: Point[] = data.map((v, i) => ({ x: xOf(i), y: yOf(v) }));
  const line = smoothLine(pts);
  const last = pts[pts.length - 1];
  const area = `${line} L ${last.x.toFixed(1)} ${plotY + plotH} L ${pts[0].x.toFixed(1)} ${plotY + plotH} Z`;

  const bandTop = yOf(Math.min(hi, normalHigh));
  const bandBottom = yOf(Math.max(lo, normalLow));

  const fmt = (v: number) =>
    unit === "°C" ? v.toFixed(1) : Math.round(v).toString();
  const gridValues = [hi, (hi + lo) / 2, lo];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full"
      role="img"
      aria-label="Trend of recent readings"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Normal-range band */}
      <rect
        x={plotX}
        y={bandTop}
        width={plotW}
        height={Math.max(0, bandBottom - bandTop)}
        fill="#5f8a6a"
        fillOpacity={0.12}
      />
      <text
        x={plotX + plotW - 3}
        y={bandTop + 10}
        textAnchor="end"
        fontSize="8.5"
        fontWeight="700"
        fill="#356548"
      >
        Normal range
      </text>

      {/* Gridlines + Y-axis labels */}
      {gridValues.map((gv, i) => {
        const gy = yOf(gv);
        return (
          <g key={i}>
            <line
              x1={plotX}
              y1={gy}
              x2={plotX + plotW}
              y2={gy}
              stroke="rgba(27,58,92,0.12)"
              strokeWidth="1"
            />
            <text
              x={plotX - 7}
              y={gy + 3.2}
              textAnchor="end"
              fontSize="9.5"
              fontWeight="700"
              fill="#5a6378"
            >
              {fmt(gv)}
            </text>
          </g>
        );
      })}

      {/* Trend area + line */}
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Reading markers */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2} fill={color} fillOpacity={0.55} />
      ))}
      <circle
        cx={last.x}
        cy={last.y}
        r={4.5}
        fill={color}
        stroke="#ffffff"
        strokeWidth={2.5}
      />

      {/* X-axis caption */}
      <text x={plotX} y={H - 7} fontSize="9.5" fontWeight="700" fill="#5a6378">
        Oldest
      </text>
      <text
        x={plotX + plotW}
        y={H - 7}
        textAnchor="end"
        fontSize="9.5"
        fontWeight="700"
        fill="#5a6378"
      >
        Now
      </text>
    </svg>
  );
}
