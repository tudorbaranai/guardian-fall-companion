"use client";

import { useEffect, useState, type ComponentType } from "react";
import { type DeviceSnapshot, type Vital } from "@/lib/device";
import { TREND_RANGES, trendSeries, type RangeKey } from "@/lib/trends";
import {
  SEVERITY_TONE,
  vitalLabel,
  vitalSeverity,
  type VitalKey,
} from "@/lib/vitals";
import { cn } from "@/lib/utils";
import { useDevice } from "./device-provider";
import { StatusPill } from "./status-pill";
import { DetailChart } from "./detail-chart";
import {
  CloseIcon,
  DropIcon,
  HeartIcon,
  ThermometerIcon,
  WaveIcon,
} from "./icons";

type IconType = ComponentType<{ size?: number; sw?: number }>;

interface VitalMeta {
  key: VitalKey;
  label: string;
  unit: string;
  Icon: IconType;
  pick: (s: DeviceSnapshot) => Vital;
  normalLow: number;
  normalHigh: number;
  rangeText: string;
  /** Decimal places for displayed values. */
  decimals: number;
  /** Bounds + step for the synthetic trend walk. */
  trendLow: number;
  trendHigh: number;
  trendStep: number;
}

const META: Record<VitalKey, VitalMeta> = {
  heart: {
    key: "heart",
    label: "Heart rate",
    unit: "bpm",
    Icon: HeartIcon,
    pick: (s) => s.heartRate,
    normalLow: 60,
    normalHigh: 100,
    rangeText: "60–100 bpm",
    decimals: 0,
    trendLow: 58,
    trendHigh: 96,
    trendStep: 3.5,
  },
  oxygen: {
    key: "oxygen",
    label: "Oxygen level",
    unit: "%",
    Icon: DropIcon,
    pick: (s) => s.oxygen,
    normalLow: 95,
    normalHigh: 100,
    rangeText: "95–100%",
    decimals: 0,
    trendLow: 93,
    trendHigh: 99,
    trendStep: 0.9,
  },
  temperature: {
    key: "temperature",
    label: "Wrist temperature",
    unit: "°C",
    Icon: ThermometerIcon,
    pick: (s) => s.bodyTemperature,
    normalLow: 30,
    normalHigh: 32.5,
    rangeText: "30.0–32.5 °C",
    decimals: 1,
    trendLow: 30,
    trendHigh: 32.5,
    trendStep: 0.16,
  },
  stress: {
    key: "stress",
    label: "Stress level",
    unit: "/ 100",
    Icon: WaveIcon,
    pick: (s) => s.stress,
    normalLow: 0,
    normalHigh: 40,
    rangeText: "0–40 out of 100",
    decimals: 0,
    trendLow: 10,
    trendHigh: 52,
    trendStep: 5,
  },
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-surface px-3.5 py-3 ring-1 ring-navy/10">
      <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-ink-2">
        {label}
      </p>
      <p className="mt-0.5 text-[22px] font-bold leading-none text-ink">
        {value}
      </p>
    </div>
  );
}

/**
 * The detailed view of a single vital — opened by tapping its card on the
 * Overview dashboard. A dismissible modal: backdrop, Escape or the X close it.
 * A 6h / 24h / 7d selector re-scopes the trend chart and its summary stats.
 */
export function VitalDetailModal({
  vital,
  onClose,
}: {
  vital: VitalKey | null;
  onClose: () => void;
}) {
  const [range, setRange] = useState<RangeKey>("24h");

  // Escape to close + background scroll lock, only while open.
  useEffect(() => {
    if (!vital) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [vital, onClose]);

  const { snapshot } = useDevice();
  if (!vital) return null;

  const meta = META[vital];
  const v = meta.pick(snapshot);
  const tone = SEVERITY_TONE[vitalSeverity(vital, v.value)];
  const { Icon } = meta;

  const rangeMeta = TREND_RANGES.find((r) => r.key === range) ?? TREND_RANGES[1];
  const series = trendSeries(
    `${vital}-${range}`,
    rangeMeta.count,
    v.value,
    meta.trendLow,
    meta.trendHigh,
    meta.trendStep,
  );

  const fmt = (n: number) =>
    meta.decimals === 1 ? n.toFixed(1) : Math.round(n).toString();
  const lowest = fmt(Math.min(...series));
  const highest = fmt(Math.max(...series));
  const average = fmt(series.reduce((a, b) => a + b, 0) / series.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="modal-backdrop-in absolute inset-0 cursor-default bg-navy/25 backdrop-blur-md"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${meta.label} — detail`}
        className="modal-pop-in relative flex max-h-[94dvh] w-full max-w-[560px] flex-col gap-5 overflow-y-auto rounded-[26px] bg-canvas p-6 shadow-[0_24px_70px_rgba(19,24,38,0.35)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-navy/8 text-navy">
              <Icon size={24} sw={1.9} />
            </div>
            <div>
              <h2 className="text-[22px] font-bold leading-tight text-ink">
                {meta.label}
              </h2>
              <p className="text-[13px] text-ink-2">Detailed trend</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy/8 text-ink-2 hover:bg-navy/15"
          >
            <CloseIcon size={20} sw={2.4} />
          </button>
        </div>

        {/* Current reading */}
        <div className="flex items-end justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[48px] font-bold leading-none tracking-[-0.01em] text-ink">
              {v.value}
            </span>
            <span className="text-[19px] text-ink-2">{meta.unit}</span>
          </div>
          <StatusPill tone={tone}>{vitalLabel(vital, v.value)}</StatusPill>
        </div>

        {/* Time-range selector */}
        <div
          role="group"
          aria-label="Time range"
          className="flex gap-1 rounded-full bg-navy/5 p-1"
        >
          {TREND_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={cn(
                "flex-1 rounded-full px-3 py-2 text-[14px] font-bold transition-colors",
                range === r.key
                  ? "bg-navy text-[#eaf1f8]"
                  : "text-ink-2 hover:text-ink",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Detailed chart */}
        <div className="rounded-[18px] bg-surface p-3.5 shadow-card ring-1 ring-navy/10">
          <DetailChart
            data={series}
            tone={tone}
            normalLow={meta.normalLow}
            normalHigh={meta.normalHigh}
            unit={meta.unit}
          />
        </div>
        <p className="-mt-2 text-[13px] leading-relaxed text-ink-2">
          Showing the last {rangeMeta.label}. The shaded band is the normal
          range ({meta.rangeText}).
        </p>

        {/* Summary stats over the selected range */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Lowest" value={lowest} />
          <Stat label="Average" value={average} />
          <Stat label="Highest" value={highest} />
        </div>
      </div>
    </div>
  );
}
