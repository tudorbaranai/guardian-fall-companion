"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { fetchFallEvents, type FallEventRow } from "@/lib/supabase";
import {
  eventTitle,
  fallsThisWeek,
  fullDate,
  relativeDay,
} from "@/lib/history-format";
import { StatusPill } from "./status-pill";
import { CheckIcon } from "./icons";
import { incidentBadge } from "./incident-badge";

/**
 * Fall history list — reads `fall_events` back from Supabase, so the page
 * reflects the same events the live Supabase subscription logs.
 */
export function HistoryList() {
  const [events, setEvents] = useState<FallEventRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFallEvents().then((rows) => {
      if (!cancelled) setEvents(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (events === null) {
    return (
      <Card className="rounded-[18px] bg-surface px-[18px] py-5 text-[15px] text-ink-2 shadow-card ring-1 ring-navy/10">
        Loading fall history…
      </Card>
    );
  }

  const now = new Date();
  const weekCount = fallsThisWeek(events, now);

  return (
    <>
      <Card className="mb-4 flex-row items-center gap-3.5 rounded-[18px] bg-surface px-[18px] py-4 shadow-card ring-1 ring-navy/10">
        <div className="flex-1">
          <p className="text-[18px] font-bold text-ink">
            {weekCount === 0
              ? "No falls detected this week"
              : `${weekCount} fall${weekCount === 1 ? "" : "s"} detected this week`}
          </p>
          <p className="mt-0.5 text-[14px] text-ink-2">
            {events.length === 0
              ? "The device has not logged any falls yet."
              : `${events.length} event${events.length === 1 ? "" : "s"} on record for Maria.`}
          </p>
        </div>
        {weekCount === 0 && (
          <StatusPill tone="sage" icon={<CheckIcon size={14} sw={2.6} />}>
            All clear
          </StatusPill>
        )}
      </Card>

      {events.length > 0 && (
        <>
          <h2 className="mb-2.5 mt-6 text-[14px] font-bold uppercase tracking-[0.06em] text-ink-2">
            Earlier events
          </h2>
          <div className="flex flex-col gap-2.5">
            {events.map((e) => {
              const detail = e.false_alarm
                ? "Maria confirmed she was OK."
                : e.resolved_at
                  ? `Resolved at ${fullDate(e.resolved_at)}.`
                  : "This alert has not been dismissed yet.";
              const badge = incidentBadge(e);
              const { Icon } = badge;
              return (
                <Card
                  key={e.id}
                  className="gap-2 rounded-[18px] bg-surface px-[18px] py-4 shadow-card ring-1 ring-navy/10"
                >
                  <p className="text-[13px] font-bold uppercase tracking-[0.04em] text-ink-3">
                    {relativeDay(e.detected_at, now)} ·{" "}
                    {fullDate(e.detected_at)}
                  </p>
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${badge.tile}`}
                      aria-label={badge.label}
                    >
                      <Icon size={22} sw={2} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <p className="text-[18px] font-bold leading-snug text-ink">
                        {eventTitle(e)}
                      </p>
                      <p className="text-[15px] leading-relaxed text-ink-2">
                        {detail}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
