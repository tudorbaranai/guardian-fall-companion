"use client";

import { cn } from "@/lib/utils";
import { useDevice } from "./device-provider";

/**
 * Discreet toggle for swapping the dashboard between honest zeros and the
 * plausible mock data. Useful for demos and screenshots; it stays out of the
 * way otherwise. Live readings overlay whichever baseline is in effect,
 * so the toggle never hides real data.
 */
export function MockDataToggle({ className }: { className?: string }) {
  const { isMock, toggleMock } = useDevice();
  return (
    <button
      type="button"
      onClick={toggleMock}
      aria-pressed={isMock}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] transition-colors",
        isMock
          ? "bg-navy text-[#eaf1f8] hover:bg-navy/90"
          : "border border-navy/15 text-ink-3 hover:bg-navy/8 hover:text-ink-2",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          isMock ? "bg-[#eaf1f8]" : "bg-ink-3",
        )}
      />
      {isMock ? "Mock data on" : "Use mock data"}
    </button>
  );
}
