/**
 * Stroke-based icon set for The Guardian. All icons inherit `currentColor`
 * and accept a `size` (px) and `sw` (stroke width). Kept deliberately simple
 * per the design brief — no hand-drawn ornamental SVGs.
 */
import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number;
  sw?: number;
};

function base(size: number, sw: number, rest: SVGProps<SVGSVGElement>) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: sw,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

export function HeartIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M12 20.5s-7.5-4.5-7.5-10.5a4.5 4.5 0 0 1 8-2.8 4.5 4.5 0 0 1 8 2.8c0 6-7.5 10.5-7.5 10.5z" />
    </svg>
  );
}

export function DropIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M12 3.5c0 0 -6 7 -6 11 a6 6 0 0 0 12 0 c0 -4 -6 -11 -6 -11z" />
    </svg>
  );
}

export function WalkIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <circle cx="13" cy="4.5" r="1.5" />
      <path d="M9 21l3-6 2 2 2 4M8 12l3-4 3 2 3 3M7 15l2-3" />
    </svg>
  );
}

export function ShieldIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M12 3 L20 6 V12 C20 16.5 16.5 19.8 12 21 C7.5 19.8 4 16.5 4 12 V6 Z" />
      <path d="M8.5 12 L11 14.5 L15.5 10" />
    </svg>
  );
}

export function CheckIcon({ size = 22, sw = 2.2, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function PhoneIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function AlertIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M12 3 L22 20 H2 Z" />
      <path d="M12 10 V14" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function ThermometerIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M12 4 a2.4 2.4 0 0 0 -2.4 2.4 v7.7 a4 4 0 1 0 4.8 0 V6.4 A2.4 2.4 0 0 0 12 4 z" />
      <circle cx="12" cy="16.6" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function WaveIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M3 12 q3 -7 6 0 t6 0 t6 0" />
    </svg>
  );
}

export function HistoryIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M4 12 a8 8 0 1 0 2.4 -5.7" />
      <path d="M4 4 V8 H8" />
      <path d="M12 8 V12 L15 14" />
    </svg>
  );
}

export function BellIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

/** Bell with a diagonal slash — "silenced / dismissed". Used for false alarms
 *  on the fall-history cards, where it reads as a status rather than an
 *  action button (which an X would). */
export function BellOffIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

/** Three radiating wifi arcs with a slash — "no signal / disconnected".
 *  Used in the status hero when the wearable's MQTT link drops. */
export function WifiOffIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M2 8.5a16 16 0 0 1 20 0" />
      <path d="M5 12.5a11 11 0 0 1 14 0" />
      <path d="M8.5 16a6 6 0 0 1 7 0" />
      <circle cx="12" cy="20" r="0.6" fill="currentColor" stroke="none" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

/** Canonical gear / cog — the universal settings symbol. */
export function SettingsIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function GridIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 18, sw = 2, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 18, sw = 2, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 16, sw = 2, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Pulse / ECG line — reads as "activity / motion over time". Used for the
 *  Motion nav entry and any "activity"-themed surface. */
export function ActivityIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

/** Sidebar / panel pictogram with an inward arrow — "collapse this panel".
 *  More semantic than a bare chevron, matching VS Code / Linear conventions. */
export function PanelLeftCloseIcon({
  size = 20,
  sw = 1.8,
  ...rest
}: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="m16 15-3-3 3-3" />
    </svg>
  );
}

/** Same panel pictogram with an outward arrow — "expand this panel". */
export function PanelLeftOpenIcon({
  size = 20,
  sw = 1.8,
  ...rest
}: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="m14 9 3 3-3 3" />
    </svg>
  );
}

export function SosIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

export function CloseIcon({ size = 22, sw = 2, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 22, sw = 2.2, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

export function BoltIcon({ size = 22, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...rest}
    >
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

export function CubeIcon({ size = 22, sw = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, sw, rest)}>
      <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />
      <path d="M12 2 V12 M3 7 L12 12 L21 7" />
    </svg>
  );
}
