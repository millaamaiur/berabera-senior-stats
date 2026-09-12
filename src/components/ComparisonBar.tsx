interface ComparisonBarProps {
  label: string;
  leftValue: string;
  rightValue: string;
  /** How much of the bar the left (our) side fills, from 0 to 1. */
  leftShare: number;
}

/** A "sofascore-style" split bar for comparing one stat between us and the rival. */
export function ComparisonBar({ label, leftValue, rightValue, leftShare }: ComparisonBarProps) {
  const leftPct = Math.round(Math.min(1, Math.max(0, leftShare)) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-bold text-amber-400">{leftValue}</span>
        <span className="text-center text-xs text-slate-400">{label}</span>
        <span className="font-bold text-sky-400">{rightValue}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
        <div className="bg-amber-500" style={{ width: `${leftPct}%` }} />
        <div className="bg-sky-500" style={{ width: `${100 - leftPct}%` }} />
      </div>
    </div>
  );
}

/** Relative share of `a` within `a + b`, defaulting to an even split when both are zero. */
export function shareOf(a: number, b: number): number {
  return a + b === 0 ? 0.5 : a / (a + b);
}
