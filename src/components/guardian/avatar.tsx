import { cn } from "@/lib/utils";

/** Initial-only avatar used for the care circle and the alert subject. */
export function Avatar({
  letter,
  tone = "navy",
  size = 36,
  ring = false,
}: {
  letter: string;
  tone?: "sage" | "navy";
  size?: number;
  /** Draws a canvas-coloured ring, for overlapping avatar stacks. */
  ring?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        tone === "sage" ? "bg-sage-bg text-sage-deep" : "bg-navy/8 text-navy",
        ring && "ring-2 ring-canvas",
      )}
      style={{ width: size, height: size, fontSize: size * 0.44 }}
    >
      {letter}
    </span>
  );
}
