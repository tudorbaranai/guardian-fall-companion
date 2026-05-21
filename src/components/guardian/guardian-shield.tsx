import type { GuardianStatus } from "@/lib/device";
import { CheckIcon, ShieldIcon, WifiOffIcon } from "./icons";

/**
 * The Guardian's signature element: a filled circular badge whose icon
 * tracks what we currently know about the wearer.
 *
 *   • offline              → navy circle + wifi-off. We can't see her.
 *   • well                 → sage circle + check.   "All good."
 *   • warning / fall       → navy circle + shield.  Needs attention.
 *
 * Offline takes precedence over status — a stale "well" reading is not
 * the same as a live one, so we show the disconnect mark instead.
 */
export function GuardianShield({
  size = 132,
  status = "well",
  offline = false,
}: {
  size?: number;
  status?: GuardianStatus;
  offline?: boolean;
}) {
  const isWell = !offline && status === "well";
  // Sage-green for the all-good badge, navy for everything else.
  const badgeBg = isWell
    ? "linear-gradient(160deg, #6fa47c 0%, #4f7d5d 100%)"
    : "linear-gradient(160deg, #2e5278 0%, #1b3a5c 100%)";
  // Alert states (warning / fall) keep a lifted-chip shadow that signals
  // "focal element". The calm and offline states stay flat.
  const flat = isWell || offline;
  const badgeShadow = flat
    ? "none"
    : "0 8px 22px rgba(27,58,92,0.30), inset 0 1px 0 rgba(255,255,255,0.15)";

  return (
    <div
      className="flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div
        className="flex items-center justify-center rounded-full text-sage-bg"
        style={{
          width: size * 0.62,
          height: size * 0.62,
          background: badgeBg,
          boxShadow: badgeShadow,
        }}
      >
        {offline ? (
          <WifiOffIcon size={size * 0.36} sw={2} />
        ) : isWell ? (
          <CheckIcon size={size * 0.36} sw={2.6} />
        ) : (
          <ShieldIcon size={size * 0.36} sw={1.5} />
        )}
      </div>
    </div>
  );
}
