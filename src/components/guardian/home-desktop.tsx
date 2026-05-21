import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { timeAgo, type DeviceSnapshot } from "@/lib/device";
import { greeting, longDate } from "@/lib/format";
import {
  SEVERITY_TONE,
  vitalLabel,
  vitalSeverity,
  type VitalKey,
} from "@/lib/vitals";
import { GuardianShield } from "./guardian-shield";
import { StatCard } from "./stat-card";
import {
  BubbleAnim,
  EcgAnim,
  GaugeAnim,
  SineWaveAnim,
} from "./card-animations";
import { InfoRow } from "./info-row";
import { BatteryCard } from "./battery-card";
import { BatteryLevelReadout } from "./battery-level-indicator";
import { FallHistoryCard } from "./fall-history-card";
import { WellnessRow } from "./wellness-row";
import { CallButton, statusCopy } from "./home-shared";
import { MockDataToggle } from "./mock-data-toggle";
import {
  DropIcon,
  HeartIcon,
  ThermometerIcon,
  WalkIcon,
  WaveIcon,
} from "./icons";

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2">
        {label}
      </p>
      <p className="mt-0.5 text-[17px] font-bold text-ink">{children}</p>
    </div>
  );
}

/** Caregiver Home / Dashboard — desktop layout (1280px+, two columns). */
export function HomeDesktop({
  snapshot,
  now,
  onSelectVital,
}: {
  snapshot: DeviceSnapshot;
  now: Date;
  onSelectVital: (vital: VitalKey) => void;
}) {
  const {
    person,
    heartRate,
    oxygen,
    bodyTemperature,
    stress,
    activity,
    status,
  } = snapshot;
  const copy = statusCopy(status, person.name, !snapshot.connected);

  const heartSev = vitalSeverity("heart", heartRate.value);
  const oxygenSev = vitalSeverity("oxygen", oxygen.value);
  const tempSev = vitalSeverity("temperature", bodyTemperature.value);
  const stressSev = vitalSeverity("stress", stress.value);
  // The snapshot still has its initial epoch / zero values — no telemetry has
  // arrived yet and mock data hasn't been toggled. We show "Waiting for
  // sensor" copy in that state instead of misleading placeholders.
  const noReadings =
    !snapshot.connected && new Date(snapshot.lastCheckedAt).getTime() === 0;

  return (
    <div className="flex flex-1 flex-col gap-[22px] overflow-y-auto px-11 py-9">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <p
            suppressHydrationWarning
            className="text-[14px] font-bold uppercase tracking-[0.06em] text-ink-2"
          >
            {longDate(now)}
          </p>
          <h1
            suppressHydrationWarning
            className="mt-1.5 text-[36px] font-bold tracking-[-0.01em] text-ink"
          >
            {greeting(now)}, Sofia
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <MockDataToggle />
          <CallButton name={person.name} phone={person.phone} variant="inline" />
        </div>
      </header>

      {/* Two-column dashboard: vitals take two thirds, history/battery one third. */}
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-[22px]">
        {/* Left column */}
        <div className="flex flex-col gap-[18px]">
          <Card className="flex-row items-center gap-5 rounded-[22px] bg-surface p-5 shadow-hi ring-1 ring-navy/10">
            <GuardianShield
              size={116}
              status={status}
              offline={!snapshot.connected}
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-[28px] font-bold leading-tight tracking-[-0.01em] text-ink">
                {copy.title}
              </h2>
              <p className="mt-1 text-[18px] leading-snug text-ink-2">
                {copy.sub}
              </p>
              <Separator className="my-3 bg-navy/10" />
              <div className="flex gap-7">
                <MetaItem label="Last checked">
                  <span suppressHydrationWarning>
                    {noReadings ? "Not yet" : timeAgo(snapshot.lastCheckedAt, now)}
                  </span>
                </MetaItem>
                <MetaItem label="Device">
                  <span
                    className={
                      snapshot.connected
                        ? "inline-flex items-center gap-1.5 text-sage-deep"
                        : "inline-flex items-center gap-1.5 text-amber"
                    }
                  >
                    <span
                      className={
                        snapshot.connected
                          ? "size-2.5 rounded-full bg-sage-deep"
                          : "size-2.5 rounded-full bg-amber"
                      }
                    />
                    {snapshot.connected ? "Connected" : "Offline"}
                  </span>
                </MetaItem>
                <MetaItem label="Battery">
                  <BatteryLevelReadout battery={snapshot.battery} />
                </MetaItem>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Heart rate"
              value={heartRate.value}
              unit="bpm"
              statusLabel={vitalLabel("heart", heartRate.value)}
              tone={SEVERITY_TONE[heartSev]}
              icon={<HeartIcon size={20} sw={1.9} />}
              chart={<EcgAnim bpm={heartRate.value} severity={heartSev} />}
              onClick={() => onSelectVital("heart")}
              offline={!snapshot.connected}
            />
            <StatCard
              label="Oxygen level"
              value={oxygen.value}
              unit="%"
              statusLabel={vitalLabel("oxygen", oxygen.value)}
              tone={SEVERITY_TONE[oxygenSev]}
              icon={<DropIcon size={20} sw={1.9} />}
              chart={<BubbleAnim value={oxygen.value} severity={oxygenSev} />}
              onClick={() => onSelectVital("oxygen")}
              offline={!snapshot.connected}
            />
            <StatCard
              label="Body temperature"
              value={bodyTemperature.value}
              unit="°C"
              statusLabel={vitalLabel("temperature", bodyTemperature.value)}
              tone={SEVERITY_TONE[tempSev]}
              icon={<ThermometerIcon size={20} sw={1.9} />}
              chart={
                <GaugeAnim value={bodyTemperature.value} severity={tempSev} />
              }
              onClick={() => onSelectVital("temperature")}
              offline={!snapshot.connected}
            />
            <StatCard
              label="Stress level"
              value={stress.value}
              unit="/ 100"
              statusLabel={vitalLabel("stress", stress.value)}
              tone={SEVERITY_TONE[stressSev]}
              icon={<WaveIcon size={20} sw={1.9} />}
              chart={<SineWaveAnim value={stress.value} severity={stressSev} />}
              onClick={() => onSelectVital("stress")}
              offline={!snapshot.connected}
            />
          </div>

          <InfoRow
            icon={<WalkIcon size={26} sw={1.9} />}
            iconTone="sage"
            title={
              noReadings
                ? "Waiting for sensor data"
                : activity.active
                  ? `${person.name} has been active today`
                  : "No movement in the last 30 minutes"
            }
            subtitle={
              noReadings
                ? "The wearable hasn't sent any motion data yet."
                : `Last movement ${activity.lastMovementMinsAgo} minutes ago${
                    activity.summary ? ` · ${activity.summary}` : ""
                  }`
            }
          />

          <WellnessRow snapshot={snapshot} />
        </div>

        {/* Right column — Fall history + Battery, two equal-height cards */}
        <div className="grid grid-rows-2 gap-[18px]">
          <FallHistoryCard />
          <BatteryCard
            battery={snapshot.battery}
            empty={noReadings}
            offline={!snapshot.connected}
          />
        </div>
      </div>
    </div>
  );
}
