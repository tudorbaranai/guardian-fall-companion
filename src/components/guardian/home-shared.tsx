import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GuardianStatus } from "@/lib/device";
import { PhoneIcon } from "./icons";

interface StatusCopy {
  title: string;
  sub: string;
}

/**
 * Plain-language copy for the status hero. `offline` takes precedence over
 * `status` — a stale "well" reading isn't a live one, and we shouldn't
 * pretend otherwise. The live-status branches only run when we can actually
 * see the wearer.
 */
export function statusCopy(
  status: GuardianStatus,
  name: string,
  offline = false,
): StatusCopy {
  if (offline) {
    return {
      title: `${name}'s device is offline`,
      sub: "Live readings will resume when it reconnects.",
    };
  }
  switch (status) {
    case "well":
      return {
        title: `${name} is well`,
        sub: "All systems are watching her.",
      };
    case "warning":
      return {
        title: `Check in on ${name}`,
        sub: "Something small needs your attention.",
      };
    case "fall":
      return {
        title: "A fall was detected",
        sub: "An emergency response is in progress.",
      };
  }
}

/**
 * "Call Maria" — prominent, but never dominant. `block` fills its container
 * (mobile); `inline` sits in a header row (desktop).
 */
export function CallButton({
  name,
  phone,
  variant = "block",
}: {
  name: string;
  phone: string;
  variant?: "block" | "inline";
}) {
  const block = variant === "block";
  return (
    <Button
      asChild
      className={cn(
        "bg-navy font-bold tracking-[0.02em] text-[#eaf1f8] hover:bg-navy",
        block
          ? "h-[60px] w-full gap-2.5 rounded-[18px] text-[20px]"
          : "h-11 gap-2 rounded-[14px] px-4 text-[15px]",
      )}
      style={{
        boxShadow: block
          ? "0 8px 20px rgba(27,58,92,0.28)"
          : "0 4px 12px rgba(27,58,92,0.20)",
      }}
    >
      <a href={`tel:${phone}`}>
        <PhoneIcon size={block ? 22 : 18} sw={2} />
        Call {name}
      </a>
    </Button>
  );
}
