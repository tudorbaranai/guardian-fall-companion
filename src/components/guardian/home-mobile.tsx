import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { timeAgo, type DeviceSnapshot } from "@/lib/device";
import { greeting, shortDate } from "@/lib/format";
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
import { FallHistoryCard } from "./fall-history-card";
import { CallButton, statusCopy } from "./home-shared";
import { MockDataToggle } from "./mock-data-toggle";
import {
  DropIcon,
  HeartIcon,
  ThermometerIcon,
  WalkIcon,
  WaveIcon,
} from "./icons";

/** Caregiver Home / Dashboard — mobile layout (375–428px). */
export function HomeMobile({
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
  const noReadings =
    !snapshot.connected && new Date(snapshot.lastCheckedAt).getTime() === 0;

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-[18px] px-[18px] pb-[200px] pt-3">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 px-1">
        <div>
          <p
            suppressHydrationWarning
            className="text-[14px] font-bold uppercase tracking-[0.06em] text-ink-2"
          >
            {shortDate(now)}
          </p>
          <h1
            suppressHydrationWarning
            className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.01em] text-ink"
          >
            {greeting(now)},<br />
            Sofia
          </h1>
        </div>
        <MockDataToggle className="mt-1" />
      </header>

      {/* Status hero */}
      <Card className="items-center gap-3.5 rounded-[28px] bg-surface px-[22px] pb-[22px] pt-6 shadow-hi ring-1 ring-navy/10">
        <GuardianShield
          size={132}
          status={status}
          offline={!snapshot.connected}
        />
        <div className="flex w-full flex-col items-start gap-1">
          <h2 className="text-[32px] font-bold leading-tight tracking-[-0.01em] text-ink">
            {copy.title}
          </h2>
          <p className="text-[18px] leading-relaxed text-ink-2">{copy.sub}</p>
        </div>

        <Separator className="bg-navy/10" />

        <div className="flex w-full justify-between">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2">
              Last checked
            </p>
            <p
              suppressHydrationWarning
              className="mt-0.5 text-[16px] font-bold text-ink"
            >
              {noReadings ? "Not yet" : timeAgo(snapshot.lastCheckedAt, now)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2">
              Device
            </p>
            <p
              className={
                snapshot.connected
                  ? "mt-0.5 inline-flex items-center gap-1.5 text-[16px] font-bold text-sage-deep"
                  : "mt-0.5 inline-flex items-center gap-1.5 text-[16px] font-bold text-amber"
              }
            >
              <span
                className={
                  snapshot.connected
                    ? "size-2 rounded-full bg-sage-deep"
                    : "size-2 rounded-full bg-amber"
                }
              />
              {snapshot.connected ? "Connected" : "Offline"}
            </p>
          </div>
        </div>
      </Card>

      {/* Vitals */}
      <div className="grid grid-cols-2 gap-3">
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

      {/* Activity + fall history */}
      <div className="flex flex-col gap-2.5">
        <InfoRow
          icon={<WalkIcon size={22} sw={1.9} />}
          iconTone="sage"
          title={
            noReadings
              ? "Waiting for sensor data"
              : activity.active
                ? `${person.name} has been active today`
                : `No movement in the last 30 minutes`
          }
          subtitle={
            noReadings
              ? "The wearable hasn't sent any motion data yet."
              : `Last movement ${activity.lastMovementMinsAgo} minutes ago`
          }
        />
        <FallHistoryCard />
      </div>

      <CallButton name={person.name} phone={person.phone} />
    </div>
  );
}
