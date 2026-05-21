"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fallSnapshot, secondsSince } from "@/lib/device";
import { emergencyFor } from "@/lib/settings";
import { useDevice } from "./device-provider";
import { useSettings } from "./settings-provider";
import { CountdownRing } from "./countdown-ring";
import { Avatar } from "./avatar";
import { AlertIcon, CloseIcon, PhoneIcon, ShieldIcon, SosIcon } from "./icons";

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/** Joins names naturally: "Ana", "Ana and Mihai", "Ana, Mihai and Ioana". */
function nameList(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Global fall-alert modal.
 *
 * Mounted once in the root layout. Whenever the wearable microcontroller
 * reports `status: "fall"`, this takes over the screen — a blurred backdrop
 * over whatever page the caregiver was on, with the alert dialog on top.
 * The only way out is the guarded false-alarm confirmation, which clears the
 * device state and so unmounts the modal.
 */
export function AlertModal() {
  const { snapshot } = useDevice();
  if (snapshot.status !== "fall") return null;
  return <AlertDialog />;
}

function AlertDialog() {
  const { snapshot, simulate } = useDevice();
  const { settings } = useSettings();
  const titleId = useId();
  const countdownSeconds = settings.falseAlarmSeconds;
  const emergencyNumber = emergencyFor(settings.emergencyCountry).number;

  // A stable synthesised fall, in case status is "fall" without a fallEvent.
  const [demo] = useState(() => fallSnapshot());
  const event = snapshot.fallEvent ?? demo.fallEvent!;
  const { person, careCircle } = snapshot;

  // 1-second clock. Null until mount so SSR and first client render agree;
  // until then, time is measured from the fall itself (remaining = 30).
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Lock background scroll while the modal owns the screen.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const refNow = new Date(nowMs ?? Date.parse(event.detectedAt));
  const remaining = clamp(
    countdownSeconds - secondsSince(event.detectedAt, refNow),
    0,
    countdownSeconds,
  );
  const sentAgo = secondsSince(event.alertSentAt, refNow);

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function cancelAlert() {
    setBusy(true);
    // Clears the fall on the device → this modal unmounts on the next read.
    await simulate("well");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Blurred, dimmed backdrop over the rest of the screen */}
      <div
        className="modal-backdrop-in absolute inset-0 bg-navy/25 backdrop-blur-md"
        aria-hidden
      />

      {/* The alert dialog — the Fall Alert UI, now as a modal */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-pop-in relative flex max-h-[94dvh] w-full max-w-[480px] flex-col gap-[18px] overflow-y-auto rounded-[26px] bg-canvas px-[18px] pb-6 pt-4 shadow-[0_24px_70px_rgba(19,24,38,0.35)]"
      >
        {/* Emergency header */}
        <div
          className="flex items-start gap-3.5 rounded-[22px] bg-alert-bg px-[22px] py-5 ring-1 ring-alert/20"
          style={{ boxShadow: "0 12px 28px rgba(166,41,60,0.10)" }}
        >
          <div className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl bg-alert text-[#f8e9eb]">
            <span className="alert-halo absolute -inset-1.5 rounded-[20px] ring-2 ring-alert" />
            <AlertIcon size={28} sw={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-alert">
              Emergency
            </p>
            <h1
              id={titleId}
              className="mt-1 text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink"
            >
              A fall has been detected
            </h1>
          </div>
          <button
            type="button"
            onClick={() => simulate("well")}
            aria-label="Close alert"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-alert hover:bg-white"
          >
            <CloseIcon size={18} sw={2.4} />
          </button>
        </div>

        {/* Person */}
        <div className="flex items-center gap-3.5">
          <Avatar letter={person.initial} tone="navy" size={60} />
          <div className="min-w-0 flex-1">
            <p className="text-[22px] font-bold leading-tight text-ink">
              {person.name} · Just now
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[15px] text-ink-2">
              <ShieldIcon size={16} />
              Reported by {person.name}&apos;s wearable device
            </p>
          </div>
        </div>

        {/* Countdown / response status */}
        <Card className="flex-row items-center gap-3.5 rounded-2xl bg-surface px-4 py-5 shadow-card ring-1 ring-navy/10">
          <CountdownRing remaining={remaining} total={countdownSeconds} />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-bold leading-snug text-ink">
              {remaining > 0
                ? `${person.name} has not responded.`
                : "Calling emergency services now."}
            </p>
            <p
              className="mt-0.5 text-[14px] text-ink-2"
              suppressHydrationWarning
            >
              {remaining > 0
                ? `Alert sent ${sentAgo} second${sentAgo === 1 ? "" : "s"} ago.`
                : "Stay on the line for the responders."}
            </p>
          </div>
        </Card>

        {/* Primary actions */}
        <div className="flex flex-col items-center gap-2.5">
          <Button
            asChild
            className="h-[52px] w-full max-w-[300px] gap-2 rounded-[16px] bg-navy text-[17px] font-bold tracking-[0.02em] text-[#eaf1f8] hover:bg-navy"
            style={{ boxShadow: "0 6px 16px rgba(27,58,92,0.28)" }}
          >
            <a href={`tel:${person.phone}`}>
              <PhoneIcon size={20} sw={2} />
              Call {person.name} Now
            </a>
          </Button>
          <Button
            asChild
            className="h-[52px] w-full max-w-[300px] gap-2 rounded-[16px] bg-alert text-[17px] font-bold tracking-[0.02em] text-[#f8e9eb] hover:bg-alert"
            style={{ boxShadow: "0 6px 16px rgba(166,41,60,0.26)" }}
          >
            <a href={`tel:${emergencyNumber}`}>
              <SosIcon size={20} sw={2} />
              Call Emergency Services
            </a>
          </Button>
        </div>

        {/* Other notified contacts */}
        <div className="flex items-center gap-2.5">
          <div className="flex">
            {careCircle.map((c, i) => (
              <span key={c.name} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                <Avatar
                  letter={c.initial}
                  tone={i === 0 ? "sage" : "navy"}
                  ring
                />
              </span>
            ))}
          </div>
          <p className="text-[15px] leading-snug text-ink-2">
            <strong className="text-ink">
              {nameList(careCircle.map((c) => c.name))}
            </strong>{" "}
            have also been notified.
          </p>
        </div>

        {/* Guarded false-alarm dismissal */}
        <div className="border-t border-navy/10 pt-3.5">
          {!confirming ? (
            <>
              <p className="mb-1.5 text-[14px] text-ink-2">
                {`Did ${person.name} let you know she's OK?`}
              </p>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex min-h-12 items-center gap-2 rounded-[14px] border border-navy/15 px-4 py-3 text-[16px] font-bold text-ink"
              >
                Mark as false alarm
                <span className="text-[13px] font-normal text-ink-3">
                  (asks to confirm)
                </span>
              </button>
            </>
          ) : (
            <div className="rounded-[16px] bg-amber-bg px-4 py-3.5 ring-1 ring-amber/25">
              <p className="text-[16px] font-bold text-ink">
                Cancel this alert?
              </p>
              <p className="mt-0.5 text-[14px] text-ink-2">
                {`Only do this if you have confirmed ${person.name} is safe.`}
              </p>
              <div className="mt-3 flex flex-col gap-2.5">
                <Button
                  onClick={cancelAlert}
                  disabled={busy}
                  className="h-12 rounded-[14px] bg-navy text-[16px] font-bold text-[#eaf1f8] hover:bg-navy"
                >
                  {busy ? "Cancelling…" : `Yes — ${person.name} is safe`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                  className="h-12 rounded-[14px] border-navy/15 text-[16px] font-bold text-ink"
                >
                  No, keep the alert active
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
