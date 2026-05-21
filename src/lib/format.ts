/** Small presentation helpers shared by the dashboard screens. */

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

/** "Tuesday · 9:41" — weekday and 24h clock. */
export function shortDate(now: Date): string {
  const hh = now.getHours();
  const mm = now.getMinutes().toString().padStart(2, "0");
  return `${WEEKDAYS[now.getDay()]} · ${hh}:${mm}`;
}

/** "Tuesday, 18 May · 9:41" — fuller form for the desktop header. */
export function longDate(now: Date): string {
  const hh = now.getHours();
  const mm = now.getMinutes().toString().padStart(2, "0");
  return `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} · ${hh}:${mm}`;
}

/** Time-of-day greeting. */
export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
