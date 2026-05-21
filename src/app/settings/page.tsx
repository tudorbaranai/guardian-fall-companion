"use client";

import { useState } from "react";
import { Select } from "radix-ui";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { batteryStatus } from "@/lib/device";
import {
  EMERGENCY_NUMBERS,
  FALSE_ALARM_WINDOWS,
  emergencyFor,
  type FalseAlarmSeconds,
} from "@/lib/settings";
import { PageShell } from "@/components/guardian/page-shell";
import { useDevice } from "@/components/guardian/device-provider";
import { useSettings } from "@/components/guardian/settings-provider";
import { AddContactDialog } from "@/components/guardian/add-contact-dialog";
import {
  BoltIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  PhoneIcon,
  ShieldIcon,
} from "@/components/guardian/icons";

/**
 * Settings — caregiver-facing knobs for the device, the care circle and the
 * alert behaviour. Live values (battery / connection) come from `useDevice`;
 * editable values are persisted in `localStorage` via `useSettings`.
 */
export default function SettingsPage() {
  return (
    <PageShell
      title="Settings"
      intro="Manage Maria's device, her care circle, and how alerts are handled."
    >
      <div className="flex flex-col gap-6">
        <DeviceGroup />
        <CareCircleGroup />
        <AlertsGroup />
      </div>
    </PageShell>
  );
}

// ── Device ──────────────────────────────────────────────────────────────────

function DeviceGroup() {
  const { snapshot } = useDevice();
  const battery = snapshot.battery;
  const noBattery = battery.percent === 0 && battery.voltage === 0;
  const batStatus = batteryStatus(battery);

  return (
    <SettingsGroup heading="Device">
      <ReadOnlyRow
        label="Wearable battery"
        value={
          noBattery
            ? "No reading yet"
            : `${Math.round(battery.percent)}%${
                battery.charging
                  ? " — charging"
                  : battery.dischargeRatePerHour > 0
                    ? ` — discharging at ${battery.dischargeRatePerHour}%/hr`
                    : ""
              }`
        }
        accent={
          batStatus === "critical" || batStatus === "low" ? "amber" : "sage"
        }
      />
      <Divider />
      <ConnectionRow connected={snapshot.connected} />
    </SettingsGroup>
  );
}

function ConnectionRow({ connected }: { connected: boolean }) {
  return (
    <div className="flex min-h-[60px] items-center justify-between gap-3 px-[18px] py-3.5">
      <div className="min-w-0">
        <p className="text-[17px] font-bold text-ink">Connection</p>
        <p className="mt-0.5 text-[14px] text-ink-2">
          {connected
            ? "Supabase link to the wearable is live."
            : "Waiting for the wearable to publish telemetry."}
        </p>
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold",
          connected ? "bg-sage-bg text-sage-deep" : "bg-amber-bg text-amber",
        )}
      >
        <span
          className={cn(
            "size-2 rounded-full",
            connected ? "bg-sage-deep" : "bg-amber",
          )}
        />
        {connected ? "Connected" : "Offline"}
      </span>
    </div>
  );
}

// ── Care circle ─────────────────────────────────────────────────────────────

function CareCircleGroup() {
  const { snapshot } = useDevice();
  const { settings, removeContact } = useSettings();
  const [adding, setAdding] = useState(false);

  return (
    <SettingsGroup heading="Care circle">
      {snapshot.careCircle.map((c, i) => (
        <div key={c.name}>
          {i > 0 && <Divider />}
          <ReadOnlyRow
            label={c.name}
            value={`${c.relation} · notified for emergencies`}
          />
        </div>
      ))}
      {settings.contacts.map((c) => (
        <div key={c.id}>
          <Divider />
          <ContactRow
            name={c.name}
            relation={c.relation}
            email={c.email}
            phone={c.phone}
            onRemove={() => removeContact(c.id)}
          />
        </div>
      ))}
      <Divider />
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex min-h-[60px] items-center justify-between gap-3 px-[18px] py-3.5 text-left transition-colors hover:bg-navy/4"
      >
        <div className="min-w-0">
          <p className="text-[17px] font-bold text-navy">Add a contact</p>
          <p className="mt-0.5 text-[14px] text-ink-2">
            They will be emailed when a fall is detected.
          </p>
        </div>
        <span className="grid size-9 place-items-center rounded-full bg-navy text-[20px] font-bold leading-none text-[#eaf1f8]">
          +
        </span>
      </button>
      <AddContactDialog open={adding} onClose={() => setAdding(false)} />
    </SettingsGroup>
  );
}

function ContactRow({
  name,
  relation,
  email,
  phone,
  onRemove,
}: {
  name: string;
  relation: string;
  email: string;
  phone: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex min-h-[60px] items-center justify-between gap-3 px-[18px] py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-bold text-ink">{name}</p>
        <p className="mt-0.5 text-[14px] text-ink-2">
          {relation}
          {email && (
            <>
              {" · "}
              <span className="text-ink">{email}</span>
            </>
          )}
          {phone && (
            <>
              {" · "}
              <span className="text-ink">{phone}</span>
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy/8 text-ink-2 hover:bg-alert-bg hover:text-alert"
      >
        <CloseIcon size={16} sw={2.2} />
      </button>
    </div>
  );
}

// ── Alerts ──────────────────────────────────────────────────────────────────

function AlertsGroup() {
  const {
    settings,
    setFalseAlarmSeconds,
    setEmergencyCountry,
    setQuietHours,
  } = useSettings();
  const entry = emergencyFor(settings.emergencyCountry);
  const [confirmingOn, setConfirmingOn] = useState(false);

  function requestToggleQuietHours(next: boolean) {
    // Activating quiet hours silences audible cues overnight, so the
    // wearer might not hear an alert — confirm before enabling.
    // Turning it back off is the safe direction and needs no warning.
    if (!settings.quietHours && next) {
      setConfirmingOn(true);
      return;
    }
    setQuietHours(next);
  }

  return (
    <SettingsGroup heading="Alerts">
      <div className="flex min-h-[60px] items-center justify-between gap-3 px-[18px] py-3.5">
        <div className="min-w-0">
          <p className="text-[17px] font-bold text-ink">
            False-alarm cancel window
          </p>
          <p className="mt-0.5 text-[14px] text-ink-2">
            Time Maria has to dismiss the alert before services are called.
          </p>
        </div>
        <SelectPill
          aria-label="False-alarm window"
          value={String(settings.falseAlarmSeconds)}
          onChange={(v) =>
            setFalseAlarmSeconds(Number(v) as FalseAlarmSeconds)
          }
          options={FALSE_ALARM_WINDOWS.map((s) => ({
            value: String(s),
            label: `${s} s`,
          }))}
        />
      </div>
      <Divider />
      <div className="flex min-h-[60px] items-center justify-between gap-3 px-[18px] py-3.5">
        <div className="min-w-0">
          <p className="text-[17px] font-bold text-ink">Emergency services</p>
          <p className="mt-0.5 text-[14px] text-ink-2">
            <span className="inline-flex items-center gap-1.5 font-bold text-ink">
              <PhoneIcon size={14} sw={1.9} />
              {entry.number}
            </span>{" "}
            · called automatically if no one dismisses the alert.
          </p>
        </div>
        <SelectPill
          aria-label="Emergency country"
          value={settings.emergencyCountry}
          onChange={setEmergencyCountry}
          compact
          options={EMERGENCY_NUMBERS.map((e) => ({
            value: e.code,
            label: `${e.code} · ${e.number}`,
          }))}
        />
      </div>
      <Divider />
      <div className="flex min-h-[60px] items-center justify-between gap-3 px-[18px] py-3.5">
        <div className="min-w-0">
          <p className="text-[17px] font-bold text-ink">Quiet hours</p>
          <p className="mt-0.5 text-[14px] text-ink-2">
            {settings.quietHours
              ? "Audible cues silenced overnight (22:00–07:00). The alert dialog still appears."
              : "Off — alerts ring through at all hours."}
          </p>
        </div>
        <Toggle
          aria-label="Quiet hours"
          on={settings.quietHours}
          onChange={requestToggleQuietHours}
        />
      </div>

      <QuietHoursOnDialog
        open={confirmingOn}
        onConfirm={() => {
          setQuietHours(true);
          setConfirmingOn(false);
        }}
        onCancel={() => setConfirmingOn(false)}
      />
    </SettingsGroup>
  );
}

/** Sage / amber switch with a sliding thumb. Pure form input — no haptics. */
function Toggle({
  on,
  onChange,
  ...rest
}: {
  on: boolean;
  onChange: (next: boolean) => void;
} & Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "value"
>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      {...rest}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors",
        on
          ? "border-sage-deep/40 bg-sage-deep"
          : "border-navy/20 bg-navy/10",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all",
          on ? "left-[22px]" : "left-0.5",
        )}
      />
      <span className="sr-only">{on ? "Quiet hours on" : "Quiet hours off"}</span>
    </button>
  );
}

/** Confirmation modal — fires only when the caregiver is *enabling* quiet
 *  hours, because that is the change that silences audible cues overnight
 *  and could let an alert go unnoticed. Turning it back off is safe. */
function QuietHoursOnDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
        className="modal-backdrop-in absolute inset-0 cursor-default bg-navy/25 backdrop-blur-md"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="modal-pop-in relative flex w-full max-w-[420px] flex-col gap-3 rounded-[22px] bg-canvas px-5 py-5 shadow-[0_24px_70px_rgba(19,24,38,0.35)]"
      >
        <h3 className="text-[20px] font-bold tracking-[-0.01em] text-ink">
          Turn quiet hours on?
        </h3>
        <p className="text-[15px] leading-snug text-ink-2">
          Audible cues will be silenced overnight (22:00–07:00), so a fall
          alert during that window might not be heard. The visual alert
          still appears. Alerts are meant to ring at all times — only enable
          this if you are sure.
        </p>
        <div className="mt-1 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-[14px] border border-navy/15 px-4 text-[15px] font-bold text-ink"
          >
            Keep quiet hours off
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 rounded-[14px] bg-alert px-4 text-[15px] font-bold text-[#f8e9eb]"
          >
            Yes, turn on
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Layout primitives ───────────────────────────────────────────────────────

function SettingsGroup({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2.5 text-[14px] font-bold uppercase tracking-[0.06em] text-ink-2">
        {heading}
      </h2>
      <Card className="gap-0 rounded-[18px] bg-surface py-0 shadow-card ring-1 ring-navy/10">
        {children}
      </Card>
    </section>
  );
}

function Divider() {
  return <div className="border-t border-navy/10" />;
}

function ReadOnlyRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "sage" | "amber";
}) {
  return (
    <div className="flex min-h-[60px] items-center justify-between gap-3 px-[18px] py-3.5">
      <div className="min-w-0">
        <p className="text-[17px] font-bold text-ink">{label}</p>
        {value && (
          <p
            className={cn(
              "mt-0.5 text-[14px]",
              accent === "amber"
                ? "text-amber"
                : accent === "sage"
                  ? "text-sage-deep"
                  : "text-ink-2",
            )}
          >
            {value}
          </p>
        )}
      </div>
      {accent === "sage" && (
        <ShieldIcon size={18} sw={1.9} className="shrink-0 text-sage-deep" />
      )}
      {accent === "amber" && (
        <BoltIcon size={16} className="shrink-0 text-amber" />
      )}
    </div>
  );
}

/**
 * Pill-shaped select. Trigger keeps the original pill look; the dropdown
 * menu is a Radix Select popover so we can style it to match the app
 * (rounded card, soft shadow, checkmark on the selected option, hover
 * highlight) instead of leaving it to the browser's native list.
 */
function SelectPill({
  value,
  onChange,
  options,
  compact,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  /** Narrower variant with lighter type — used for short option labels
   *  like "RO · 112" where the full pill width would be overkill. */
  compact?: boolean;
  "aria-label"?: string;
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-10 items-center justify-between gap-2 rounded-full border border-navy/15 bg-surface px-3.5 text-[14px] text-ink outline-none transition-colors hover:bg-navy/4 focus-visible:border-navy/40 focus-visible:ring-2 focus-visible:ring-navy/15 data-[state=open]:border-navy/40 data-[state=open]:bg-navy/4",
          compact ? "min-w-[120px] font-normal" : "min-w-[120px] max-w-[260px] font-bold",
        )}
      >
        <Select.Value />
        <Select.Icon className="text-ink-3">
          <ChevronDownIcon size={14} sw={2.2} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          align="end"
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-navy/10 bg-surface p-1.5 shadow-[0_12px_32px_-8px_rgba(27,58,92,0.18)] ring-1 ring-navy/5 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <Select.Viewport>
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-3 py-2 text-[14px] text-ink-2 outline-none data-[highlighted]:bg-navy/8 data-[highlighted]:text-ink data-[state=checked]:font-bold data-[state=checked]:text-ink"
              >
                <Select.ItemText>{o.label}</Select.ItemText>
                <Select.ItemIndicator className="text-sage-deep">
                  <CheckIcon size={16} sw={2.6} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
