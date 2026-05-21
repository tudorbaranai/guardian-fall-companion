import { Card } from "@/components/ui/card";
import type { DeviceSnapshot } from "@/lib/device";
import { ActivityIcon } from "./icons";

/** Pretty labels for the on-device sleep classifier. */
const SLEEP_LABEL: Record<NonNullable<DeviceSnapshot["sleepState"]>, string> = {
  awake: "Awake",
  resting: "Resting",
  light: "Light sleep",
  deep: "Deep sleep",
};

const POSTURE_LABEL: Record<NonNullable<DeviceSnapshot["posture"]>, string> = {
  upright: "Upright",
  reclined: "Reclined",
  lying: "Lying down",
  inverted: "Inverted",
};

/**
 * A compact wellness summary that surfaces the new on-device classifier
 * outputs: steps + live cadence, sleep stage, HRV proxy, resting HR, and
 * the current posture. Everything degrades to "—" when the device hasn't
 * reported that field yet, so the row stays useful before the firmware
 * starts shipping every column.
 */
export function WellnessRow({ snapshot }: { snapshot: DeviceSnapshot }) {
  const { stepCount, cadenceSpm, sleepState, hrvRmssd, restingHr, posture } =
    snapshot;

  const title =
    sleepState && sleepState !== "awake"
      ? SLEEP_LABEL[sleepState]
      : stepCount !== null
        ? `${stepCount.toLocaleString()} steps today`
        : "Wellness today";

  return (
    <Card className="flex-row items-center gap-3.5 rounded-[18px] bg-surface px-[18px] py-4 shadow-card ring-1 ring-navy/10">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy/8 text-navy">
        <ActivityIcon size={22} sw={1.9} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[18px] font-bold leading-tight text-ink">
          {title}
        </div>
        <div className="mt-1 grid grid-cols-2 gap-x-5 gap-y-0.5 text-[14px] text-ink-2 sm:grid-cols-3 lg:grid-cols-5">
          <WellnessCell label="Cadence" value={fmtCadence(cadenceSpm)} />
          <WellnessCell
            label="Posture"
            value={posture ? POSTURE_LABEL[posture] : "—"}
          />
          <WellnessCell
            label="Sleep"
            value={sleepState ? SLEEP_LABEL[sleepState] : "—"}
          />
          <WellnessCell label="HRV" value={fmtHrv(hrvRmssd)} />
          <WellnessCell label="Resting HR" value={fmtRestingHr(restingHr)} />
        </div>
      </div>
    </Card>
  );
}

function WellnessCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-ink-3">
        {label}
      </span>
      <span className="font-bold text-ink">{value}</span>
    </div>
  );
}

function fmtCadence(spm: number | null): string {
  if (spm === null) return "—";
  if (spm === 0) return "Still";
  return `${spm} spm`;
}

function fmtHrv(ms: number | null): string {
  return ms === null ? "—" : `${ms} ms`;
}

function fmtRestingHr(bpm: number | null): string {
  return bpm === null ? "—" : `${bpm} bpm`;
}
