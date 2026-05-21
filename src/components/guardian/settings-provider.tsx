"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_SETTINGS,
  FALSE_ALARM_WINDOWS,
  type AppSettings,
  type CareContactRecord,
  type FalseAlarmSeconds,
} from "@/lib/settings";

const STORAGE_KEY = "guardian:settings:v1";

interface SettingsContextValue {
  settings: AppSettings;
  /** Has the persisted snapshot been read off localStorage yet? Used to
   *  avoid a server / first-paint flicker before hydration completes. */
  ready: boolean;
  setFalseAlarmSeconds: (seconds: FalseAlarmSeconds) => void;
  setEmergencyCountry: (code: string) => void;
  setQuietHours: (on: boolean) => void;
  addContact: (input: Omit<CareContactRecord, "id">) => void;
  removeContact: (id: string) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Validates a parsed localStorage payload — falls back to defaults on any
 *  inconsistency rather than letting the app crash on stale data. */
function sanitise(raw: unknown): AppSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const r = raw as Partial<AppSettings>;
  const seconds = FALSE_ALARM_WINDOWS.includes(
    r.falseAlarmSeconds as FalseAlarmSeconds,
  )
    ? (r.falseAlarmSeconds as FalseAlarmSeconds)
    : DEFAULT_SETTINGS.falseAlarmSeconds;
  return {
    falseAlarmSeconds: seconds,
    emergencyCountry:
      typeof r.emergencyCountry === "string" ? r.emergencyCountry : "RO",
    contacts: Array.isArray(r.contacts)
      ? r.contacts.filter(
          (c): c is CareContactRecord =>
            !!c &&
            typeof c.id === "string" &&
            typeof c.name === "string" &&
            typeof c.relation === "string" &&
            typeof c.email === "string" &&
            typeof c.phone === "string",
        )
      : [],
    quietHours: r.quietHours === true,
  };
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Persists caregiver settings in `localStorage` and exposes mutators. Mounted
 * in the root layout so any page can `useSettings()`.
 */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  // Load from localStorage on mount — synchronising React state with a
  // platform API is exactly what useEffect is for, so we silence the
  // set-state-in-effect rule here.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setSettings(sanitise(JSON.parse(raw)));
    } catch {
      /* swallow — defaults remain in effect */
    }
    setReady(true);
  }, []);

  // Persist on every change (skip the initial pre-ready render).
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* quota exceeded / private mode — silently ignore */
    }
  }, [settings, ready]);

  const setFalseAlarmSeconds = useCallback((seconds: FalseAlarmSeconds) => {
    setSettings((s) => ({ ...s, falseAlarmSeconds: seconds }));
  }, []);

  const setEmergencyCountry = useCallback((code: string) => {
    setSettings((s) => ({ ...s, emergencyCountry: code }));
  }, []);

  const setQuietHours = useCallback((on: boolean) => {
    setSettings((s) => ({ ...s, quietHours: on }));
  }, []);

  const addContact = useCallback(
    (input: Omit<CareContactRecord, "id">) => {
      setSettings((s) => ({
        ...s,
        contacts: [...s.contacts, { ...input, id: newId() }],
      }));
    },
    [],
  );

  const removeContact = useCallback((id: string) => {
    setSettings((s) => ({
      ...s,
      contacts: s.contacts.filter((c) => c.id !== id),
    }));
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      ready,
      setFalseAlarmSeconds,
      setEmergencyCountry,
      setQuietHours,
      addContact,
      removeContact,
    }),
    [
      settings,
      ready,
      setFalseAlarmSeconds,
      setEmergencyCountry,
      setQuietHours,
      addContact,
      removeContact,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

/** Read the persisted settings + their mutators. Must be inside `SettingsProvider`. */
export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}
