import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { SEVERITY_HEX, type Severity } from "@/lib/vitals";

/**
 * Thematic animations shown on each vital card.
 *
 * Every animation is driven by the live reading: its **colour** comes from
 * the vital's severity (green → amber → red), and its **motion** responds to
 * the value — the heart trace beats at the measured BPM, oxygen bubbles
 * slow as saturation drops, the stress waves quicken with the stress index.
 * The temperature gauge instead points its needle at the actual reading on
 * a fixed scale. All motion pauses under `prefers-reduced-motion`.
 */

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/** Shared footer panel — full-bleed, light grey, divided by a hairline. */
const PANEL = "relative h-[76px] overflow-hidden border-t border-navy/10";
const PANEL_BG = "#f4f4f2";

const ECG_PATH =
  "M0 30 L60 30 L70 30 L78 14 L86 46 L94 22 L102 30 L160 30 L170 30 L178 14 L186 46 L194 22 L202 30 L260 30 L270 30 L278 14 L286 46 L294 22 L302 30 L320 30";

/** Heart rate — a live ECG trace; the sweep speed tracks the measured BPM. */
export function EcgAnim({ bpm, severity }: { bpm: number; severity: Severity }) {
  const color = SEVERITY_HEX[severity];
  // The path holds 3 PQRST spikes, so one full loop is 3 beats.
  const duration = clamp(180 / clamp(bpm, 30, 200), 0.9, 6);
  return (
    <div
      className={PANEL}
      style={
        { background: PANEL_BG, "--ecg-dur": `${duration}s` } as CSSProperties
      }
      aria-hidden
    >
      <svg
        viewBox="0 0 320 60"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={ECG_PATH} stroke={color} strokeWidth={1.8} opacity={0.14} />
        <path
          className="ecg-live"
          d={ECG_PATH}
          stroke={color}
          strokeWidth={2.2}
          style={{ filter: `drop-shadow(0 0 4px ${color}66)` }}
        />
      </svg>
      <span
        className="ecg-dot absolute size-2 rounded-full"
        style={{
          top: "50%",
          left: 0,
          marginTop: -4,
          marginLeft: -4,
          background: color,
          boxShadow: `0 0 0 4px ${color}2e`,
        }}
      />
    </div>
  );
}

const BUBBLES = [
  { left: "30%", size: 15, delay: "0s", base: 2.7 },
  { left: "50%", size: 9, delay: "0.9s", base: 3.1 },
  { left: "65%", size: 12, delay: "1.7s", base: 2.5 },
];

/** Oxygen — air bubbles drifting upward; they slow as saturation drops. */
export function BubbleAnim({
  value,
  severity,
}: {
  value: number;
  severity: Severity;
}) {
  const color = SEVERITY_HEX[severity];
  // Healthy ~97 % rises at the base rate; lower oxygen drifts slower.
  const factor = clamp(1 + (97 - value) * 0.085, 0.75, 2.4);
  return (
    <div className={PANEL} style={{ background: PANEL_BG }} aria-hidden>
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className="bubble-rise absolute bottom-1 rounded-full"
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            background: `${color}26`,
            border: `1.5px solid ${color}99`,
            animationDelay: b.delay,
            animationDuration: `${(b.base * factor).toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  );
}

const TEMP_SCALE = [22, 27, 32, 37, 42];
const TEMP_MIN = 22;
const TEMP_MAX = 42;

/** Body temperature — a gauge whose needle points at the live reading. */
export function GaugeAnim({
  value,
  severity,
}: {
  value: number;
  severity: Severity;
}) {
  const color = SEVERITY_HEX[severity];
  const pos = clamp(((value - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * 100, 0, 100);
  return (
    <div
      className={cn(PANEL, "flex items-center justify-center")}
      style={{ background: PANEL_BG }}
      aria-hidden
    >
      <div className="w-full px-7">
        <div className="mb-2 flex justify-between text-[12px] font-bold tracking-[0.05em] text-ink-3">
          {TEMP_SCALE.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        <div
          className="relative h-2.5 rounded-full"
          style={{ background: "rgba(27,58,92,0.12)" }}
        >
          <div
            className="gauge-glide absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${pos}%`, background: color }}
          />
          {[25, 50, 75].map((p) => (
            <span
              key={p}
              className="absolute w-px"
              style={{
                left: `${p}%`,
                top: -3,
                height: 16,
                background: "rgba(0,0,0,0.12)",
              }}
            />
          ))}
          <span
            className="gauge-glide absolute rounded-full bg-white"
            style={{
              top: "50%",
              left: `${pos}%`,
              width: 14,
              height: 14,
              border: `2.5px solid ${color}`,
              transform: "translate(-50%, -50%)",
              boxShadow: `0 2px 6px -1px ${color}4d`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

const WAVE_PATH = "M -20 30 Q 20 10, 60 30 T 140 30 T 220 30 T 300 30 T 380 30";

/** Stress — two soft sine waves; their drift speed tracks the stress index. */
export function SineWaveAnim({
  value,
  severity,
}: {
  value: number;
  severity: Severity;
}) {
  const color = SEVERITY_HEX[severity];
  // Calm drifts slowly; a high stress index quickens the waves.
  const frontDur = clamp(6 - value * 0.045, 2, 6);
  return (
    <div
      className={PANEL}
      style={
        {
          background: PANEL_BG,
          "--wave-front-dur": `${frontDur.toFixed(2)}s`,
          "--wave-back-dur": `${(frontDur * 1.45).toFixed(2)}s`,
        } as CSSProperties
      }
      aria-hidden
    >
      <svg
        viewBox="0 0 320 60"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        fill="none"
        strokeLinecap="round"
      >
        <path
          className="wave-back"
          d={WAVE_PATH}
          stroke={color}
          strokeWidth={1.6}
          opacity={0.2}
        />
        <path
          className="wave-front"
          d={WAVE_PATH}
          stroke={color}
          strokeWidth={2.2}
          opacity={0.85}
          style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
        />
      </svg>
    </div>
  );
}
