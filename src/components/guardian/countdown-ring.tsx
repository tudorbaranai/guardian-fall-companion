/**
 * Circular countdown for the false-alarm cancel window. Purely presentational —
 * the parent owns the timer and passes `remaining` seconds down.
 */
export function CountdownRing({
  remaining,
  total,
  size = 64,
}: {
  remaining: number;
  total: number;
  size?: number;
}) {
  const stroke = 5;
  const r = (size - stroke - 3) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = Math.max(0, Math.min(1, remaining / total));

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${remaining} seconds remaining`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(27,58,92,0.10)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-alert)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[20px] font-bold leading-none text-ink">
          {remaining}
        </span>
        <span className="text-[10px] font-bold tracking-[0.06em] text-ink-3">
          SEC
        </span>
      </div>
    </div>
  );
}
