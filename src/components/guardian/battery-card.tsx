import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { batteryStatus, type BatteryInfo } from "@/lib/device";
import type { Tone } from "./status-pill";
import { StatusPill } from "./status-pill";
import { BoltIcon } from "./icons";
import { batteryLevelTone } from "./battery-level-indicator";

/**
 * Battery card — a compact version of the Claude Design "Battery Card"
 * handoff. Sits in the desktop right column beside the Fall history card.
 *
 * The horizontal battery glyph's fill width is driven directly by
 * `battery.percent`, and its colour by the derived battery status.
 */

/** Faint pinstripe texture laid over the battery fill. */
const PINSTRIPE =
  "repeating-linear-gradient(90deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 14px, rgba(255,255,255,0.18) 14px, rgba(255,255,255,0.18) 16px)";

const PILL_LABEL = {
  healthy: "Healthy",
  low: "Low",
  critical: "Critical",
  charging: "Charging",
} as const;

/**
 * Time left, computed locally from a rolling window of voltage samples —
 * see `estimateRuntime` in `lib/device.ts`. The firmware's `time_left_min`
 * column is ignored: it drifts and goes missing for long stretches, and
 * voltage gives us better resolution than the chunky integer percent.
 * Returns "—" until the buffer is wide enough to produce a confident slope.
 */
function timeRemainingLabel(b: BatteryInfo): string {
  if (b.charging) return "Charging";
  if (b.timeLeftMin === null || b.timeLeftMin <= 0) return "—";
  const total = b.timeLeftMin;
  const days = Math.floor(total / (60 * 24));
  const hours = Math.floor((total - days * 60 * 24) / 60);
  const minutes = total - days * 60 * 24 - hours * 60;
  if (days > 0) return `~ ${days}d ${hours}h`;
  if (hours > 0) return `~ ${hours}h ${minutes}m`;
  return `~ ${minutes}m`;
}

function Meta({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-2">
        {label}
      </span>
      <span className="text-[15px] font-bold tracking-[-0.01em] text-ink">
        {value}
        {suffix && (
          <span className="ml-1 text-[11px] font-normal text-ink-3">
            {suffix}
          </span>
        )}
      </span>
    </div>
  );
}

export function BatteryCard({
  battery,
  empty = false,
  offline = false,
}: {
  battery: BatteryInfo;
  /** True when no telemetry row has arrived yet — the caller is the only one
   *  who knows this. Without it we would conflate "device reports 0%" with
   *  "no data", which hides real (even if zero-valued) telemetry. */
  empty?: boolean;
  /** When the wearable is disconnected, the low-battery reminder is hidden:
   *  the threshold alert can't fire while we can't see the battery anyway. */
  offline?: boolean;
}) {
  const noReadings = empty;
  const status = batteryStatus(battery);
  const tone: Tone =
    status === "critical" ? "alert" : status === "low" ? "amber" : "sage";
  const levelTone = batteryLevelTone(battery);
  const fillBg = levelTone.fill;
  const percent = Math.max(0, Math.min(100, Math.round(battery.percent)));

  const ancillary = battery.charging
    ? "Charging steadily"
    : battery.dischargeRatePerHour > 0
      ? `Discharging at ${battery.dischargeRatePerHour}%/hr`
      : "Discharge rate — not reported";

  if (noReadings) {
    return (
      <Card className="flex h-full flex-col gap-0 rounded-[20px] bg-surface p-5 shadow-card ring-1 ring-navy/10">
        <h3 className="mb-2.5 text-[19px] font-bold tracking-[-0.01em] text-ink">
          Battery
        </h3>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-ink-2">
          <div className="grid size-10 place-items-center rounded-full bg-navy/8 text-navy">
            <BoltIcon size={16} />
          </div>
          <p className="text-[15px] font-bold text-ink">
            Waiting for sensor data
          </p>
          <p className="max-w-[24ch] text-[12px] leading-snug text-ink-3">
            The wearable hasn&apos;t reported its battery level yet.
          </p>
        </div>
        {!offline && (
          <p className="mt-auto pt-5 text-[12px] leading-snug text-ink-2">
            <strong className="font-bold text-ink">Reminder</strong> ·
            You&apos;re alerted if battery drops below{" "}
            <strong className="font-bold text-ink">
              {battery.lowThreshold}%
            </strong>
            .
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col gap-0 rounded-[20px] bg-surface p-5 shadow-card ring-1 ring-navy/10">
      <h3 className="mb-2.5 text-[19px] font-bold tracking-[-0.01em] text-ink">
        Battery
      </h3>

      {/* Hero — percentage and the live battery glyph share one row. The
          glyph takes the remaining width so it scales with the card. */}
      <div className="flex flex-col gap-2.5">
        <div
          className="flex items-center gap-4"
          aria-label={`${levelTone.label}: ${percent}%`}
        >
          {/* Battery glyph — fill width tracks the live percentage. Sits
              first as the universal "battery" marker; the precise reading
              follows. Border, padding and cap scale with the body so the
              chrome stays in proportion. */}
          <div className="flex h-6 w-16 shrink-0 items-stretch" aria-hidden>
            <div className="flex flex-1 items-stretch rounded-[5px] border border-ink bg-canvas p-0.5">
              <div
                className={cn(
                  "battery-fill relative overflow-hidden rounded-[3px]",
                  fillBg,
                )}
                style={{ width: `${percent}%` }}
              >
                <div
                  className="absolute inset-0"
                  style={{ backgroundImage: PINSTRIPE }}
                />
              </div>
            </div>
            <div className="ml-0.5 h-[45%] w-1 self-center rounded-r-[1px] bg-ink" />
          </div>
          <div className="flex shrink-0 items-baseline">
            <span className="text-[42px] font-bold leading-[0.9] tracking-[-0.03em] text-ink">
              {percent}
            </span>
            <span className="ml-0.5 text-[17px] font-bold text-ink-3">%</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <StatusPill tone={tone}>{PILL_LABEL[status]}</StatusPill>
          <span className="text-[12px] text-ink-3">{ancillary}</span>
        </div>
      </div>

      {/* Telemetry */}
      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3">
        <Meta label="Time remaining" value={timeRemainingLabel(battery)} />
        <Meta
          label="Voltage"
          value={battery.voltage > 0 ? battery.voltage.toFixed(2) : "—"}
          suffix={battery.voltage > 0 ? "V" : undefined}
        />
      </div>

      {/* Footer reminder — hidden when the device is offline, since the
          threshold alert can't fire without a live battery reading. */}
      {!offline && (
        <p className="mt-auto pt-5 text-[12px] leading-snug text-ink-2">
          <strong className="font-bold text-ink">Reminder</strong> ·
          You&apos;re alerted if battery drops below{" "}
          <strong className="font-bold text-ink">
            {battery.lowThreshold}%
          </strong>
          .
        </p>
      )}
    </Card>
  );
}
