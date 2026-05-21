/**
 * Per-incident icon + colour palette, shared by the Overview's Fall history
 * card and the dedicated /history page so the two views never drift.
 *
 * Three states match what an emergency-response operator expects:
 *   • Awaiting    → alert triangle, red.    Still active, needs attention.
 *   • Resolved    → check, green.           Caregiver responded.
 *   • False alarm → X, navy / muted.        Wearer dismissed it as not real.
 */
import type { ComponentType, SVGProps } from "react";
import type { FallEventRow } from "@/lib/supabase";
import { AlertIcon, BellOffIcon, CheckIcon } from "./icons";

export type IncidentState = "awaiting" | "resolved" | "false-alarm";

type IncidentIconProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number;
  sw?: number;
};

/** Map a stored fall-event row to one of the three display states. */
export function incidentState(e: FallEventRow): IncidentState {
  if (e.false_alarm) return "false-alarm";
  if (e.resolved_at) return "resolved";
  return "awaiting";
}

/** The icon component, tile colour classes, and screen-reader label
 *  for each state. Callers pick the icon size / stroke that fits. */
export const INCIDENT_BADGE: Record<
  IncidentState,
  {
    Icon: ComponentType<IncidentIconProps>;
    /** Tailwind classes for the icon's coloured tile background + foreground. */
    tile: string;
    /** Spoken label — set on the tile via `aria-label`. */
    label: string;
  }
> = {
  awaiting: {
    Icon: AlertIcon,
    tile: "bg-alert-bg text-alert",
    label: "Awaiting response",
  },
  resolved: {
    Icon: CheckIcon,
    tile: "bg-sage-bg text-sage-deep",
    label: "Resolved by caregiver",
  },
  "false-alarm": {
    Icon: BellOffIcon,
    tile: "bg-navy/8 text-navy",
    label: "Dismissed as false alarm",
  },
};

/** Convenience — `INCIDENT_BADGE[incidentState(e)]`. */
export function incidentBadge(e: FallEventRow) {
  return INCIDENT_BADGE[incidentState(e)];
}
