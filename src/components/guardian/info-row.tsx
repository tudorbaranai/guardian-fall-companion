import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronRightIcon } from "./icons";

/**
 * A horizontal card row: a tinted icon tile, a title and a calm subtitle.
 * Used for the activity summary and the fall-history shortcut. When `href`
 * is set the whole row becomes a 56px+ touch target.
 */
export function InfoRow({
  icon,
  iconTone = "sage",
  title,
  subtitle,
  href,
}: {
  icon: ReactNode;
  iconTone?: "sage" | "navy";
  title: string;
  subtitle: string;
  href?: string;
}) {
  const inner = (
    <>
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          iconTone === "sage"
            ? "bg-sage-bg text-sage-deep"
            : "bg-navy/8 text-navy",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[18px] font-bold leading-tight text-ink">
          {title}
        </div>
        <div className="mt-0.5 text-[14px] text-ink-2">{subtitle}</div>
      </div>
      {href && <ChevronRightIcon size={20} className="text-ink-3" />}
    </>
  );

  const className =
    "flex flex-row items-center gap-3.5 rounded-[18px] bg-surface px-[18px] py-4 shadow-card ring-1 ring-navy/10";

  if (href) {
    return (
      <Link href={href} className={cn(className, "hover:ring-navy/20")}>
        {inner}
      </Link>
    );
  }
  return <Card className={className}>{inner}</Card>;
}
