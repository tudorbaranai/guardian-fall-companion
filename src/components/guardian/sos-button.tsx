"use client";

import { useDevice } from "./device-provider";

/**
 * Persistent floating SOS control. Calm by default (white + navy, never red).
 * Pressing it raises a fall alert — the global modal then takes over the
 * screen. Hidden while an alert is already active (the modal covers it).
 */
export function SosButton() {
  const { snapshot, simulate } = useDevice();

  if (snapshot.status === "fall") return null;

  return (
    <button
      type="button"
      onClick={() => simulate("fall")}
      aria-label="Raise an emergency alert"
      className="fixed bottom-[104px] right-[18px] z-30 flex size-16 items-center justify-center rounded-full bg-surface text-navy ring-1 ring-navy/10 lg:bottom-7 lg:right-7"
      style={{ boxShadow: "0 10px 24px rgba(27,58,92,0.18)" }}
    >
      <span className="text-[14px] font-bold tracking-[0.08em]">SOS</span>
    </button>
  );
}
