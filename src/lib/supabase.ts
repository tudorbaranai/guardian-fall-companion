/**
 * Supabase — the wearable's live link and history store.
 *
 * Telemetry and fall rows reach Supabase via an out-of-scope ingestion path
 * (sensors → phone → Supabase). The browser is read-only against those
 * tables: it seeds from the latest row on mount, then keeps in sync via
 * Supabase Realtime (a single WebSocket per browser tab) with a slow
 * 30 s catch-up SELECT as a safety net for WebSocket dropouts.
 *
 * Writing from the browser is limited to caregiver-side actions (SOS and
 * dismissals on `fall_events`) — telemetry itself is never written here.
 *
 * See `supabase/migrations/` for the schema + the realtime publication.
 */
import { createClient } from "@supabase/supabase-js";
import {
  ACTIVITIES,
  POSTURES,
  SLEEP_STATES,
  type Activity,
  type Posture,
  type SleepState,
  type Telemetry,
} from "./telemetry";

const VALID_ACTIVITIES = new Set<string>(ACTIVITIES);

// Both must be present at build time — see `.env.example` for the contract.
// We refuse to fall back to a hard-coded project so a public clone can't
// accidentally write into someone else's tables.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your environment (see .env.example).",
  );
}

/** Single device for this build; the schema is keyed by `device_id`. */
const DEVICE_ID = "device01";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ── Telemetry ──────────────────────────────────────────────────────────────

interface TelemetryRow extends Telemetry {
  id: number;
  device_id: string;
  recorded_at: string;
}

/** A telemetry row decorated with its server-side timestamp. */
export interface TelemetryEvent {
  reading: Telemetry;
  at: Date;
}

/** Coerce any nullable numeric column to 0 — Supabase stores `null` for any
 *  field the writer (phone app) skipped, but the Telemetry type assumes
 *  numbers everywhere. Without this, `Math.atan2(null, null)` etc. would
 *  produce NaN on the Motion dashboard. */
function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Derive the activity from the wearable's row.
 *
 * The firmware writes the activity in two formats:
 *   - the legacy `activity` string column (most rows leave it null), AND
 *   - four exclusive boolean-ish smallint flags: `stationary`, `walking`,
 *     `running`, and the `fall_state` column which doubles as "Falling".
 *
 * We trust the flags first (that's what the current firmware writes) and
 * fall back to the legacy string. Unknown values collapse to "Stationary"
 * so the mannequin always has a safe pose. */
function activityOf(row: Record<string, unknown>): Activity {
  if (row.fall_state === 1) return "Falling";
  if (row.running === 1) return "Running";
  if (row.walking === 1) return "Walking";
  if (row.stationary === 1) return "Stationary";
  const raw = row.activity;
  if (typeof raw === "string" && VALID_ACTIVITIES.has(raw)) {
    return raw as Activity;
  }
  return "Stationary";
}

/** The on-device classifier writes posture as a smallint 0–3. */
function postureOf(raw: unknown): Posture | null {
  if (typeof raw !== "number") return null;
  return POSTURES[raw] ?? null;
}

/** Sleep state — smallint 0–3 from the device. */
function sleepOf(raw: unknown): SleepState | null {
  if (typeof raw !== "number") return null;
  return SLEEP_STATES[raw] ?? null;
}

/** Nullable smallint/integer columns — pass through finite numbers, else null. */
function intOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Pass-through for numeric columns that may legitimately be null — the row
 *  is partial (sensor not connected, firmware skipped the field) and we want
 *  to keep the dashboard's last good value rather than overwrite with a 0. */
function nullable(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function rowToEvent(row: TelemetryRow): TelemetryEvent {
  const r = row as unknown as Record<string, unknown>;
  const reading: Telemetry = {
    // Vitals — keep null when the firmware skipped them. applyTelemetry
    // already knows to retain the previous reading on null/zero hr & spo2;
    // we extend the same treatment to temp and batt_v so a partial row
    // doesn't blank the card to "0.0°C / 0V".
    hr: nullable(row.hr) ?? 0,
    spo2: nullable(row.spo2) ?? 0,
    temp: nullable(row.temp) ?? 0,
    stress: nullable(row.stress) ?? 0,
    batt_v: nullable(row.batt_v) ?? 0,
    batt_pct: n(row.batt_pct),
    ax: n(row.ax),
    ay: n(row.ay),
    // Stationary upright reads ~1 g on Z — a zero from a phone that skipped
    // IMU still gives the 3D mannequin a sensible "device at rest" pose.
    az: typeof row.az === "number" && Number.isFinite(row.az) ? row.az : 1,
    gx: n(row.gx),
    gy: n(row.gy),
    gz: n(row.gz),
    activity: activityOf(r),
    posture: postureOf(r.posture),
    sleepState: sleepOf(r.sleep_state),
    stepCount: intOrNull(r.step_count),
    cadenceSpm: intOrNull(r.cadence_spm),
    hrvRmssd: intOrNull(r.hrv_rmssd),
    restingHr: intOrNull(r.resting_hr),
    fallState: r.fall_state === 1 ? 1 : r.fall_state === 0 ? 0 : null,
    timeLeftMin: intOrNull(r.time_left_min),
  };
  return { reading, at: new Date(row.recorded_at) };
}

/** Latest telemetry row, used to seed the dashboard on mount. */
export async function fetchLatestTelemetry(): Promise<TelemetryEvent | null> {
  try {
    const { data } = await supabase
      .from("telemetry_readings")
      .select("*")
      .eq("device_id", DEVICE_ID)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? rowToEvent(data as TelemetryRow) : null;
  } catch {
    return null;
  }
}

/** How often the catch-up SELECT runs to cover WebSocket dropouts. The
 *  primary live link is Realtime — this is purely a safety net. */
const CATCH_UP_MS = 30_000;

/**
 * Watch for new telemetry rows.
 *
 * Primary path: Supabase Realtime — one WebSocket, sub-100 ms latency.
 * Safety net: a 30 s catch-up `SELECT` for rows newer than the last seen
 * `recorded_at`, in case the WebSocket briefly drops. Both feed the same
 * `onInsert` callback and dedupe through the shared cursor.
 *
 * Realtime requires `public.telemetry_readings` to be in the
 * `supabase_realtime` publication — see
 * `supabase/migrations/20260521120000_realtime.sql`.
 */
export function subscribeTelemetry(
  onInsert: (e: TelemetryEvent) => void,
  since?: Date,
): () => void {
  let cursor = (since ?? new Date(0)).toISOString();
  let cancelled = false;

  const fire = (row: TelemetryRow) => {
    if (cancelled) return;
    // The cursor only advances — out-of-order arrivals (rare) get dropped
    // so the same row never fires twice across Realtime + catch-up.
    if (row.recorded_at <= cursor) return;
    cursor = row.recorded_at;
    onInsert(rowToEvent(row));
  };

  const channel = supabase
    .channel("guardian-telemetry")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "telemetry_readings",
        filter: `device_id=eq.${DEVICE_ID}`,
      },
      (payload) => fire(payload.new as TelemetryRow),
    )
    .subscribe();

  const catchUp = async () => {
    if (cancelled) return;
    try {
      const { data } = await supabase
        .from("telemetry_readings")
        .select("*")
        .eq("device_id", DEVICE_ID)
        .gt("recorded_at", cursor)
        .order("recorded_at", { ascending: true })
        .limit(50);
      for (const row of (data as TelemetryRow[] | null) ?? []) fire(row);
    } catch {
      /* keep heartbeating */
    }
  };
  const heartbeat = setInterval(catchUp, CATCH_UP_MS);

  return () => {
    cancelled = true;
    clearInterval(heartbeat);
    supabase.removeChannel(channel);
  };
}

// ── Fall events ────────────────────────────────────────────────────────────

/** A new fall, as observed by the dashboard. */
export interface FallEventEvent {
  id: number;
  detectedAt: Date;
}

/** The latest unresolved fall, if any — used to re-latch the alert on page
 *  load so a refresh during an active fall doesn't lose the dialog. */
export async function fetchOpenFallEvent(): Promise<FallEventEvent | null> {
  try {
    const { data } = await supabase
      .from("fall_events")
      .select("id, detected_at")
      .eq("device_id", DEVICE_ID)
      .is("resolved_at", null)
      .order("detected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id as number,
      detectedAt: new Date(data.detected_at as string),
    };
  } catch {
    return null;
  }
}

/**
 * Watch for new `fall_events` rows.
 *
 * Same Realtime + 30 s catch-up pattern as telemetry. Realtime requires
 * `public.fall_events` to be in the `supabase_realtime` publication.
 */
export function subscribeFallEvents(
  onInsert: (e: FallEventEvent) => void,
  since?: Date,
): () => void {
  let cursor = (since ?? new Date(0)).toISOString();
  let cancelled = false;

  const fire = (row: { id: number; detected_at: string }) => {
    if (cancelled) return;
    if (row.detected_at <= cursor) return;
    cursor = row.detected_at;
    onInsert({ id: row.id, detectedAt: new Date(row.detected_at) });
  };

  const channel = supabase
    .channel("guardian-fall-events")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "fall_events",
        filter: `device_id=eq.${DEVICE_ID}`,
      },
      (payload) => fire(payload.new as { id: number; detected_at: string }),
    )
    .subscribe();

  const catchUp = async () => {
    if (cancelled) return;
    try {
      const { data } = await supabase
        .from("fall_events")
        .select("id, detected_at")
        .eq("device_id", DEVICE_ID)
        .gt("detected_at", cursor)
        .order("detected_at", { ascending: true })
        .limit(20);
      for (const row of (data as { id: number; detected_at: string }[] | null) ?? []) {
        fire(row);
      }
    } catch {
      /* keep heartbeating */
    }
  };
  const heartbeat = setInterval(catchUp, CATCH_UP_MS);

  return () => {
    cancelled = true;
    clearInterval(heartbeat);
    supabase.removeChannel(channel);
  };
}

/** Opens a fall-event row; returns its id so it can be resolved later. */
export async function recordFallStart(): Promise<number | null> {
  try {
    const { data } = await supabase
      .from("fall_events")
      .insert({ device_id: DEVICE_ID })
      .select("id")
      .single();
    return (data?.id as number | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Closes a fall-event row when the caregiver dismisses the alert. */
export async function recordFallResolve(
  id: number,
  falseAlarm: boolean,
): Promise<void> {
  try {
    await supabase
      .from("fall_events")
      .update({ resolved_at: new Date().toISOString(), false_alarm: falseAlarm })
      .eq("id", id);
  } catch {
    /* best-effort */
  }
}

// ── Daily activity durations ──────────────────────────────────────────────

/** Per-activity time spent in the current local day, in seconds. */
export interface ActivityDurations {
  byActivity: Record<Activity, number>;
  /** Sum of `byActivity` — the amount of the day actually covered by
   *  telemetry rows. The rest of the 24-hour window is "off body" / no data. */
  totalRecorded: number;
  /** Local midnight at the start of the day this snapshot covers. */
  dayStart: Date;
  /** End of the window — capped at "now" if the day is still in progress. */
  dayEnd: Date;
}

/**
 * Compute how long the wearer spent in each activity since local midnight.
 *
 * Each row is treated as covering the interval until the next row arrives.
 * A 5-minute cap on consecutive gaps keeps a long writer outage from being
 * counted as one giant block of whatever the last reported activity was.
 *
 * The last row's duration runs from its `recorded_at` to `dayEnd` (now),
 * also capped at the same 5-minute threshold so a stale device doesn't
 * inflate the current activity indefinitely.
 */
export async function fetchActivityDurations(): Promise<ActivityDurations> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();

  const empty: ActivityDurations = {
    byActivity: { Walking: 0, Running: 0, Stationary: 0, Falling: 0 },
    totalRecorded: 0,
    dayStart,
    dayEnd,
  };

  try {
    // We need both the legacy `activity` text column and the boolean-ish
    // smallint flags (`stationary/walking/running/fall_state`) because
    // `activityOf` prefers the flags and only falls back to the string.
    const { data } = await supabase
      .from("telemetry_readings")
      .select("recorded_at, activity, stationary, walking, running, fall_state")
      .eq("device_id", DEVICE_ID)
      .gte("recorded_at", dayStart.toISOString())
      .order("recorded_at", { ascending: true })
      .limit(20_000);

    const rows = (data as Record<string, unknown>[] | null) ?? [];
    if (rows.length === 0) return empty;

    const MAX_DELTA_S = 5 * 60;
    const byActivity: Record<Activity, number> = {
      Walking: 0,
      Running: 0,
      Stationary: 0,
      Falling: 0,
    };
    let total = 0;

    for (let i = 0; i < rows.length; i++) {
      const tStart = new Date(rows[i].recorded_at as string).getTime();
      const tEnd =
        i + 1 < rows.length
          ? new Date(rows[i + 1].recorded_at as string).getTime()
          : dayEnd.getTime();
      const deltaS = Math.min((tEnd - tStart) / 1000, MAX_DELTA_S);
      if (deltaS <= 0) continue;

      const act: Activity = activityOf(rows[i]);
      byActivity[act] += deltaS;
      total += deltaS;
    }

    return { byActivity, totalRecorded: total, dayStart, dayEnd };
  } catch {
    return empty;
  }
}

/** One fall-event row, as read back for the history view. */
export interface FallEventRow {
  id: number;
  detected_at: string;
  resolved_at: string | null;
  false_alarm: boolean;
}

/** Reads the most recent fall events, newest first. */
export async function fetchFallEvents(limit = 50): Promise<FallEventRow[]> {
  try {
    const { data } = await supabase
      .from("fall_events")
      .select("id, detected_at, resolved_at, false_alarm")
      .eq("device_id", DEVICE_ID)
      .order("detected_at", { ascending: false })
      .limit(limit);
    return (data as FallEventRow[] | null) ?? [];
  } catch {
    return [];
  }
}
