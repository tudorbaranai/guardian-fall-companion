"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  defaultSnapshot,
  emptySnapshot,
  type DeviceSnapshot,
} from "@/lib/device";
import { mockMotionAxes } from "@/lib/mock-activity";
import { applyTelemetry, type Telemetry } from "@/lib/telemetry";
import {
  fetchLatestTelemetry,
  fetchOpenFallEvent,
  recordFallResolve,
  recordFallStart,
  subscribeFallEvents,
  subscribeTelemetry,
  type FallEventEvent,
  type TelemetryEvent,
} from "@/lib/supabase";
import { emergencyFor } from "@/lib/settings";
import { useSettings } from "./settings-provider";

interface DeviceContextValue {
  snapshot: DeviceSnapshot;
  /** Slow clock, for keeping relative timestamps fresh. */
  now: Date;
  /** Manually raise (SOS) or clear (false alarm) the fall alert. */
  simulate: (state: "fall" | "well") => void;
  /** The latest raw IMU/telemetry reading — null until the first row. */
  telemetry: Telemetry | null;
  /** A short ring of recent readings, oldest → newest (for sparklines). */
  telemetryHistory: Telemetry[];
  /** True while the snapshot baseline is the plausible mock data. Live
   *  Supabase readings still overlay either baseline as they arrive. */
  isMock: boolean;
  /** Toggle the snapshot baseline between zeros and the mock demo data. */
  toggleMock: () => void;
}

const DeviceContext = createContext<DeviceContextValue | null>(null);

/** No telemetry row for this long ⇒ the wearable is treated as offline.
 *  The Supabase cadence (one row per few seconds) is much slower than the
 *  old 4 Hz live stream, so the threshold is correspondingly relaxed. */
const STALE_MS = 30_000;

/** How many recent readings to keep for the motion sparklines. */
const HISTORY_LEN = 48;

/**
 * The app's live link to the wearable device.
 *
 * Seeds the dashboard from the latest Supabase row on mount, then subscribes
 * to `telemetry_readings` inserts via Supabase Realtime and folds each row
 * into a shared `DeviceSnapshot`. New rows on `fall_events` latch the fall
 * alert — a refresh during an active fall re-latches from the still-open row.
 */
export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<DeviceSnapshot>(() =>
    emptySnapshot(),
  );
  const [now, setNow] = useState<Date>(() => new Date());
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<Telemetry[]>([]);
  const [isMock, setIsMock] = useState(false);

  // The data effect runs once on mount, so it captures `settings` and the
  // current snapshot by ref to always see the latest values without
  // rebuilding the subscription on every change.
  const { settings } = useSettings();
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);
  // Mock mode is read inside the Supabase/offline handlers and the
  // staleness watchdog. Mirroring it into a ref lets those long-lived
  // closures see the latest value without forcing the data link to
  // re-subscribe every time the user flips the toggle.
  const isMockRef = useRef(isMock);
  useEffect(() => {
    isMockRef.current = isMock;
  }, [isMock]);

  // Fire-and-forget POST to /api/notify on the rising edge of a fall, so
  // every email-having contact gets pinged. Best-effort — the alert dialog
  // still shows regardless of the result.
  const notifyContacts = useCallback((personName: string) => {
    const s = settingsRef.current;
    if (s.contacts.length === 0) return;
    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contacts: s.contacts,
        personName,
        detectedAt: new Date().toISOString(),
        emergencyLine: emergencyFor(s.emergencyCountry).number,
      }),
    }).catch(() => {
      /* best-effort */
    });
  }, []);

  // Fall latch — refs so the realtime handler always reads the current value.
  const fallActive = useRef(false);
  const fallStartedAt = useRef<Date | null>(null);
  const fallEventId = useRef<number | null>(null);
  const lastRowAt = useRef(0);

  /** Overlays the current fall latch onto a snapshot. */
  const withFall = useCallback((s: DeviceSnapshot): DeviceSnapshot => {
    if (!fallActive.current) return { ...s, status: "well", fallEvent: null };
    const at = (fallStartedAt.current ?? new Date()).toISOString();
    return {
      ...s,
      status: "fall",
      fallEvent: { detectedAt: at, alertSentAt: at, responded: false },
    };
  }, []);

  /** Apply a telemetry event to the live snapshot + sparkline ring. */
  const ingestTelemetry = useCallback(
    (event: TelemetryEvent) => {
      lastRowAt.current = Date.now();
      setSnapshot((prev) =>
        withFall(applyTelemetry(prev, event.reading, event.at)),
      );
      setTelemetry(event.reading);
      setTelemetryHistory((h) => [...h, event.reading].slice(-HISTORY_LEN));

      // Telemetry-driven fall latch — the on-device `fall_state` flag is the
      // fastest signal we have. Engage as soon as a row reports 1; the
      // matching `fall_events` insert from the phone still confirms with an
      // id, but we don't wait for it to flash the alert.
      if (event.reading.fallState === 1 && !fallActive.current) {
        fallActive.current = true;
        fallStartedAt.current = event.at;
        setSnapshot((prev) => withFall(prev));
        notifyContacts(snapshotRef.current.person.name);
      }
    },
    [withFall, notifyContacts],
  );

  /** Engage the fall latch from a new (or already-open) fall_events row. */
  const engageFall = useCallback(
    (event: FallEventEvent) => {
      if (fallActive.current) return;
      fallActive.current = true;
      fallStartedAt.current = event.detectedAt;
      fallEventId.current = event.id;
      setSnapshot((prev) => withFall(prev));
      notifyContacts(snapshotRef.current.person.name);
    },
    [notifyContacts, withFall],
  );

  // ── Supabase data link ───────────────────────────────────────────────────
  // Seed from the latest row, then poll for anything strictly newer. The
  // cursors passed to `subscribe*` keep us from re-ingesting the seed.
  useEffect(() => {
    let cancelled = false;
    let offTelemetry: (() => void) | null = null;
    let offFall: (() => void) | null = null;

    fetchLatestTelemetry().then((seed) => {
      if (cancelled) return;
      if (seed) ingestTelemetry(seed);
      offTelemetry = subscribeTelemetry(ingestTelemetry, seed?.at);
    });

    fetchOpenFallEvent().then((open) => {
      if (cancelled) return;
      if (open) engageFall(open);
      // Without an open fall, anchor the poll at mount time — otherwise we'd
      // replay every historical fall on first load.
      offFall = subscribeFallEvents(engageFall, open?.detectedAt ?? new Date());
    });

    return () => {
      cancelled = true;
      offTelemetry?.();
      offFall?.();
    };
  }, [ingestTelemetry, engageFall]);

  // Staleness watchdog — flips to offline if no row arrives for STALE_MS.
  // Suppressed in mock mode: the snapshot is synthetic and has no live
  // signal to go stale against.
  useEffect(() => {
    const id = setInterval(() => {
      if (isMockRef.current) return;
      if (lastRowAt.current && Date.now() - lastRowAt.current > STALE_MS) {
        setSnapshot((prev) =>
          prev.connected ? { ...prev, connected: false } : prev,
        );
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Relative-time clock.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  // ── Mock vitals drift ───────────────────────────────────────────────────
  // Without this the Overview widgets would freeze on the seed values from
  // `defaultSnapshot()`. A slow, low-amplitude drift makes the numbers feel
  // like they came from a sensor rather than a fixture. Real Supabase rows
  // win: same 750 ms guard as the IMU generator, so live telemetry cleanly
  // takes over. The fall latch (`status` / `fallEvent`) is preserved.
  useEffect(() => {
    if (!isMock) return;
    const clamp = (v: number, lo: number, hi: number) =>
      Math.max(lo, Math.min(hi, v));
    const startedAt = Date.now();
    const id = setInterval(() => {
      if (Date.now() - lastRowAt.current < 750) return;
      const t = (Date.now() - startedAt) / 1000;
      // Mismatched periods so the four vitals don't move in lockstep.
      const hr = clamp(
        72 + Math.sin(t * 0.10) * 4 + (Math.random() - 0.5) * 1.4,
        64,
        84,
      );
      const spo2 = clamp(
        97 + Math.sin(t * 0.07 + 1.1) * 1 + (Math.random() - 0.5) * 0.6,
        95,
        99,
      );
      // Wrist skin temperature drifts around ~31 °C, not core 36.6.
      const temp =
        Math.round(
          (31.0 +
            Math.sin(t * 0.05 + 0.4) * 0.3 +
            (Math.random() - 0.5) * 0.08) *
            10,
        ) / 10;
      const stress = clamp(
        24 + Math.sin(t * 0.08 + 2.0) * 6 + (Math.random() - 0.5) * 2,
        8,
        40,
      );
      setSnapshot((prev) => ({
        ...prev,
        heartRate: { value: Math.round(hr), status: "normal" },
        oxygen: { value: Math.round(spo2), status: "normal" },
        bodyTemperature: { value: temp, status: "normal" },
        stress: { value: Math.round(stress), status: "normal" },
        lastCheckedAt: new Date().toISOString(),
      }));
    }, 1500);
    return () => clearInterval(id);
  }, [isMock]);

  // ── Mock IMU stream ─────────────────────────────────────────────────────
  // Only the vitals baseline gets swapped by `toggleMock`; the motion
  // dashboard reads `telemetry` directly from Supabase and would otherwise
  // stay frozen on REST while mock mode is on. This generator emits a
  // plausible activity loop so the mannequin and axes show walking/running
  // motion in demos. Real Supabase rows still take priority.
  useEffect(() => {
    if (!isMock) return;
    const startedAt = Date.now();
    const id = setInterval(() => {
      if (Date.now() - lastRowAt.current < 750) return;
      const t = (Date.now() - startedAt) / 1000;
      const s = snapshotRef.current;
      const axes = mockMotionAxes(t);
      const reading: Telemetry = {
        hr: s.heartRate.value,
        spo2: s.oxygen.value,
        temp: s.bodyTemperature.value,
        stress: s.stress.value,
        batt_v: s.battery.voltage,
        batt_pct: s.battery.percent,
        ...axes,
      };
      setTelemetry(reading);
      setTelemetryHistory((h) => [...h, reading].slice(-HISTORY_LEN));
    }, 250);
    return () => clearInterval(id);
  }, [isMock]);

  /** Flip the snapshot baseline between honest zeros and the demo mock.
   *  Live Supabase readings then overlay whichever baseline is in effect. */
  const toggleMock = useCallback(() => {
    setIsMock((prev) => {
      const next = !prev;
      setSnapshot(() => (next ? defaultSnapshot() : emptySnapshot()));
      if (!next) {
        setTelemetry(null);
        setTelemetryHistory([]);
      }
      return next;
    });
  }, []);

  /** SOS raises a fall alert; a confirmed false alarm clears it. The fall
   *  row is created in Supabase so it appears in /history too. */
  const simulate = useCallback(
    (state: "fall" | "well") => {
      if (state === "fall") {
        if (!fallActive.current) {
          fallActive.current = true;
          fallStartedAt.current = new Date();
          recordFallStart().then((id) => {
            fallEventId.current = id;
          });
          notifyContacts(snapshotRef.current.person.name);
        }
      } else {
        if (fallActive.current && fallEventId.current !== null) {
          recordFallResolve(fallEventId.current, true);
          fallEventId.current = null;
        }
        fallActive.current = false;
        fallStartedAt.current = null;
      }
      setSnapshot((prev) => withFall(prev));
    },
    [notifyContacts, withFall],
  );

  return (
    <DeviceContext.Provider
      value={{
        snapshot,
        now,
        simulate,
        telemetry,
        telemetryHistory,
        isMock,
        toggleMock,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
}

/** Read the shared device state. Must be used within a `<DeviceProvider>`. */
export function useDevice(): DeviceContextValue {
  const ctx = useContext(DeviceContext);
  if (!ctx) {
    throw new Error("useDevice must be used within a DeviceProvider");
  }
  return ctx;
}
