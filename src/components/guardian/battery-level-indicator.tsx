import {
  batteryLevel,
  type BatteryInfo,
  type BatteryLevel,
} from "@/lib/device";
import { cn } from "@/lib/utils";

const LEVEL_TONE: Record<
  BatteryLevel,
  { text: string; fill: string; soft: string; label: string }
> = {
  healthy: {
    text: "text-sage-deep",
    fill: "bg-sage-deep",
    soft: "bg-sage-bg",
    label: "Healthy battery",
  },
  low: {
    text: "text-amber",
    fill: "bg-amber",
    soft: "bg-amber-bg",
    label: "Low battery",
  },
  critical: {
    text: "text-alert",
    fill: "bg-alert",
    soft: "bg-alert-bg",
    label: "Critical battery",
  },
};

export function batteryLevelTone(battery: Pick<BatteryInfo, "percent">) {
  return LEVEL_TONE[batteryLevel(battery)];
}

function clampPercent(percent: number) {
  return Math.max(0, Math.min(100, Math.round(percent)));
}

export function BatteryLevelIcon({
  battery,
  size = 24,
  className,
}: {
  battery: Pick<BatteryInfo, "percent">;
  size?: number;
  className?: string;
}) {
  const percent = clampPercent(battery.percent);
  const tone = batteryLevelTone(battery);
  const fillWidth = (percent / 100) * 20;

  return (
    <svg
      aria-hidden="true"
      className={cn(tone.text, className)}
      width={size}
      height={Math.round(size * 0.62)}
      viewBox="0 0 32 20"
      fill="none"
    >
      <rect
        x="2"
        y="4"
        width="24"
        height="12"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <rect x="27.5" y="8" width="2.5" height="4" rx="1" fill="currentColor" />
      {fillWidth > 0 && (
        <rect
          x="4"
          y="6"
          width={fillWidth}
          height="8"
          rx="2"
          fill="currentColor"
        />
      )}
    </svg>
  );
}

export function BatteryLevelReadout({
  battery,
  className,
}: {
  battery: Pick<BatteryInfo, "percent">;
  className?: string;
}) {
  const percent = clampPercent(battery.percent);
  const tone = batteryLevelTone(battery);

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", tone.text, className)}
      aria-label={`${tone.label}: ${percent}%`}
    >
      <BatteryLevelIcon battery={battery} size={24} />
      <span>{percent}%</span>
    </span>
  );
}
