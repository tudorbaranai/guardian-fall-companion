/**
 * Caregiver-side settings — persisted in the browser's localStorage and
 * exposed app-wide through `SettingsProvider`.
 *
 * Three things live here:
 *  1. The false-alarm window (seconds the wearer has to dismiss before the
 *     emergency call is placed automatically).
 *  2. The emergency-services country (drives the number the alert dials).
 *  3. The caregiver's custom contacts — extra people who get notified by
 *     email when a fall is detected.
 *
 * The shape is intentionally flat so that the settings JSON can be inspected
 * directly in DevTools' Application → Local Storage panel during a demo.
 */

/** A person the caregiver added as an emergency contact. */
export interface CareContactRecord {
  /** Stable UUID-ish id — used for keying React lists and for removal. */
  id: string;
  name: string;
  relation: string;
  /** Optional — but at least one of email/phone is required by the form. */
  email: string;
  phone: string;
}

/** A national emergency-services entry the caregiver can pick from. */
export interface EmergencyEntry {
  /** ISO 3166-1 alpha-2 country code, e.g. "RO". */
  code: string;
  /** Display name in English. */
  label: string;
  /** The number the alert dials. */
  number: string;
}

/** A curated set of countries — enough for the competition demo without
 *  drowning the dropdown. Add more as needed. */
export const EMERGENCY_NUMBERS: EmergencyEntry[] = [
  { code: "RO", label: "Romania", number: "112" },
  { code: "EU", label: "European Union (general)", number: "112" },
  { code: "US", label: "United States", number: "911" },
  { code: "CA", label: "Canada", number: "911" },
  { code: "UK", label: "United Kingdom", number: "999" },
  { code: "AU", label: "Australia", number: "000" },
  { code: "NZ", label: "New Zealand", number: "111" },
  { code: "JP", label: "Japan", number: "119" },
  { code: "CN", label: "China", number: "120" },
  { code: "IN", label: "India", number: "112" },
  { code: "BR", label: "Brazil", number: "192" },
  { code: "MX", label: "Mexico", number: "911" },
  { code: "ZA", label: "South Africa", number: "10177" },
  { code: "AE", label: "United Arab Emirates", number: "998" },
];

/** Allowed false-alarm dismiss windows, in seconds. */
export const FALSE_ALARM_WINDOWS = [5, 10, 15, 30, 60, 120, 150] as const;
export type FalseAlarmSeconds = (typeof FALSE_ALARM_WINDOWS)[number];

/** The whole settings object — what `SettingsProvider` stores. */
export interface AppSettings {
  falseAlarmSeconds: FalseAlarmSeconds;
  /** ISO country code matched against `EMERGENCY_NUMBERS`. */
  emergencyCountry: string;
  contacts: CareContactRecord[];
  /** When true, the alert dialog still appears but the device suppresses
   *  audible / vibration cues during the configured night window. Off by
   *  default — the safe choice. */
  quietHours: boolean;
}

/** First-run defaults. */
export const DEFAULT_SETTINGS: AppSettings = {
  falseAlarmSeconds: 30,
  emergencyCountry: "RO",
  contacts: [],
  quietHours: false,
};

/** Looks up the emergency entry for a country code, with a safe fallback. */
export function emergencyFor(country: string): EmergencyEntry {
  return (
    EMERGENCY_NUMBERS.find((e) => e.code === country) ?? EMERGENCY_NUMBERS[0]
  );
}
