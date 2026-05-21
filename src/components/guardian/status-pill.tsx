import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Tone = "sage" | "amber" | "alert" | "navy";

/** Pill background / text classes per tone. Every tone pairs colour WITH text
 *  and an icon — colour is never the only signal (accessibility requirement). */
const TONE: Record<Tone, { bg: string; text: string; dot: string }> = {
  sage: { bg: "bg-sage-bg", text: "text-sage-deep", dot: "bg-sage-deep" },
  amber: { bg: "bg-amber-bg", text: "text-amber", dot: "bg-amber" },
  alert: { bg: "bg-alert-bg", text: "text-alert", dot: "bg-alert" },
  navy: { bg: "bg-navy/8", text: "text-navy", dot: "bg-navy" },
};

/**
 * A status pill: a coloured dot (or supplied icon) plus a plain-language
 * label. Used for vitals, device state and the "Protected" hero badge.
 */
export function StatusPill({
  tone = "sage",
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <Badge
      className={cn(
        "h-auto gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold tracking-[0.02em]",
        t.bg,
        t.text,
        className,
      )}
    >
      {icon ?? <span className={cn("size-2 rounded-full", t.dot)} />}
      {children}
    </Badge>
  );
}
