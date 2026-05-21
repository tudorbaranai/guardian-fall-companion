"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { fetchFallEvents, type FallEventRow } from "@/lib/supabase";
import {
  eventTitle,
  fallsThisWeek,
  fullDate,
  relativeDay,
} from "@/lib/history-format";
import { useDevice } from "./device-provider";
import { StatusPill } from "./status-pill";
import { CheckIcon, ShieldIcon } from "./icons";
import { incidentBadge } from "./incident-badge";

/** How many events to show inline on the Overview card. */
const PREVIEW_LIMIT = 2;

/**
 * Overview / Fall history — a compact mirror of the dedicated `/history`
 * page, sized to share the right column with the Battery card.
 *
 * Reads `fall_events` from Supabase on mount and again whenever the live
 * device status flips (so a fresh fall logged by the device shows up here without
 * a manual reload). The "View all →" link sends the caregiver to the full
 * page for the rest of the events.
 */
export function FallHistoryCard() {
  const { snapshot } = useDevice();
  const [events, setEvents] = useState<FallEventRow[] | null>(null);

  // Refetch on mount + whenever a fall is latched or cleared — the device
  // provider's `simulate` / realtime handler already writes the new row before
  // the status changes, so by the time we refetch the event is there.
  useEffect(() => {
    let cancelled = false;
    fetchFallEvents(PREVIEW_LIMIT).then((rows) => {
      if (!cancelled) setEvents(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [snapshot.status]);

  return (
    <Card className="flex h-full flex-col rounded-[20px] bg-surface px-6 py-5 shadow-card ring-1 ring-navy/10">
      <div className="flex items-center justify-between">
        <h3 className="text-[19px] font-bold text-ink">Fall history</h3>
        <Link
          href="/history"
          className="text-[13px] font-bold tracking-[0.02em] text-navy/80 hover:text-navy"
        >
          View all →
        </Link>
      </div>

      {events === null ? (
        <div className="mt-3.5 flex flex-1 items-center justify-center text-[14px] text-ink-2">
          Loading…
        </div>
      ) : (
        <FallHistoryBody events={events} />
      )}
    </Card>
  );
}

function FallHistoryBody({ events }: { events: FallEventRow[] }) {
  const now = new Date();
  const weekCount = fallsThisWeek(events, now);

  // Empty / all-clear — the big calm hero, matching the /history page.
  if (events.length === 0 || weekCount === 0) {
    return (
      <div className="mt-3.5 flex flex-1 flex-col gap-2.5">
        <div className="flex flex-1 items-center gap-3.5 rounded-[14px] bg-sage-bg px-5 text-sage-deep">
          <ShieldIcon size={26} sw={1.9} />
          <div className="flex-1">
            <p className="text-[18px] font-bold leading-tight">
              No falls detected this week
            </p>
            <p className="mt-1 text-[14px] text-ink-2">
              {events.length === 0
                ? "The device has not logged any falls yet."
                : `${events.length} event${events.length === 1 ? "" : "s"} on record · all clear this week.`}
            </p>
          </div>
          <StatusPill tone="sage" icon={<CheckIcon size={14} sw={2.6} />}>
            All clear
          </StatusPill>
        </div>
        {events.length > 0 && <RecentEvents events={events} now={now} />}
      </div>
    );
  }

  // Something happened this week — lead with the count, then the events.
  return (
    <div className="mt-3.5 flex flex-1 flex-col gap-2.5">
      <p className="text-[16px] font-bold leading-tight text-ink">
        {weekCount} fall{weekCount === 1 ? "" : "s"} detected this week
      </p>
      <RecentEvents events={events} now={now} />
    </div>
  );
}

/** Compact rows for the last few events — same content as the /history page. */
function RecentEvents({
  events,
  now,
}: {
  events: FallEventRow[];
  now: Date;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {events.slice(0, PREVIEW_LIMIT).map((e) => {
        const badge = incidentBadge(e);
        const { Icon } = badge;
        return (
          <li
            key={e.id}
            className="flex items-center gap-3 rounded-[12px] border border-navy/8 bg-canvas/60 px-3.5 py-2.5"
          >
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${badge.tile}`}
              aria-label={badge.label}
            >
              <Icon size={18} sw={2.1} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-ink-3">
                {relativeDay(e.detected_at, now)} · {fullDate(e.detected_at)}
              </p>
              <p className="mt-0.5 text-[14px] font-bold leading-snug text-ink">
                {eventTitle(e)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
