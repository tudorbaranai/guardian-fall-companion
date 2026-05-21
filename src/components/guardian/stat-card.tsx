import type { KeyboardEvent, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { StatusPill, type Tone } from "./status-pill";
import { ChevronRightIcon } from "./icons";

/**
 * A single vital sign, shown in plain language — not a clinical chart.
 * Label is written out in full ("Heart rate"), so the unit ("bpm") never
 * stands alone as a bare abbreviation. An optional `chart` (EKG or sparkline)
 * sits full-bleed along the bottom edge. When `onClick` is set the whole card
 * becomes a button that opens the vital's detailed view.
 */
export function StatCard({
  label,
  value,
  unit,
  statusLabel,
  tone = "sage",
  icon,
  chart,
  onClick,
  offline = false,
}: {
  label: string;
  value: number | string;
  unit: string;
  statusLabel: string;
  tone?: Tone;
  icon: ReactNode;
  chart?: ReactNode;
  onClick?: () => void;
  /**
   * When the wearable is disconnected the per-vital pill collapses to a
   * neutral "Offline" badge and the live animation is hidden — the values
   * below are stale, so we stop pretending they're streaming.
   */
  offline?: boolean;
}) {
  const pillTone: Tone = offline ? "amber" : tone;
  const pillLabel = offline ? "Offline" : statusLabel;
  const interactive = onClick
    ? {
        onClick,
        role: "button" as const,
        tabIndex: 0,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        },
        "aria-label": `${label} — open details`,
      }
    : {};

  // The chart sits full-bleed against the card's bottom edge, so the base
  // class uses `pb-0` and lets the chart provide that visual edge. When the
  // chart is suppressed (offline, or none provided) we restore a real bottom
  // pad so the status pill isn't flush against the card's bottom border.
  const hasChart = Boolean(chart) && !offline;

  return (
    <Card
      className={cn(
        "gap-3.5 rounded-[20px] bg-surface px-[18px] pt-5 shadow-card ring-1 ring-navy/10",
        hasChart ? "pb-0" : "pb-5",
        onClick &&
          "cursor-pointer transition-shadow outline-none hover:shadow-hi hover:ring-navy/25 focus-visible:ring-2 focus-visible:ring-navy/40",
      )}
      {...interactive}
    >
      <div className="flex items-center justify-between text-navy">
        <span className="flex items-center gap-2">
          {icon}
          <span className="text-[18px] font-bold uppercase tracking-[0.04em] text-ink-2">
            {label}
          </span>
        </span>
        {onClick && <ChevronRightIcon size={18} className="text-ink-3" />}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1">
          {/* Matches the battery card's hero figure (42px / 17px) so the
              overview's primary numbers share one typographic scale.
              Offline → grey the value so the reading reads as stale, not live. */}
          <span
            className={cn(
              "text-[42px] font-bold leading-[0.9] tracking-[-0.03em]",
              offline ? "text-ink-3" : "text-ink",
            )}
          >
            {value}
          </span>
          <span className="text-[17px] font-bold text-ink-3">{unit}</span>
        </div>
        <StatusPill tone={pillTone} className="ml-auto shrink-0">
          {pillLabel}
        </StatusPill>
      </div>
      {hasChart && <div className="-mx-[18px]">{chart}</div>}
    </Card>
  );
}
