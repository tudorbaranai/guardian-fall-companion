/**
 * Date helpers for the fall-history views — shared by the dedicated `/history`
 * page and the compact Fall history card on the Overview dashboard so both
 * format dates the same way.
 */

import type { FallEventRow } from "./supabase";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "Tuesday, 11 Feb · 14:32" — the absolute moment of an event. */
export function fullDate(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} · ${hh}:${mm}`;
}

/** "Today" / "3 days ago" / "5 weeks ago" relative to `now`. */
export function relativeDay(iso: string, now: Date): string {
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round(
    (startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000,
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

/** Number of falls in `events` whose detected_at is within the last 7 days. */
export function fallsThisWeek(events: FallEventRow[], now: Date): number {
  const cutoff = now.getTime() - 7 * 86_400_000;
  return events.filter((e) => new Date(e.detected_at).getTime() >= cutoff)
    .length;
}

/** The short headline used on event cards in both views. */
export function eventTitle(e: FallEventRow): string {
  if (e.false_alarm) return "Fall detected — marked as false alarm";
  if (e.resolved_at) return "Fall detected — caregiver responded";
  return "Fall detected — awaiting response";
}
