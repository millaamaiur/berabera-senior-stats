import { useMemo } from 'react';
import type { MatchEvent } from '../domain/types';
import { HALFTIME_SECONDS } from '../domain/types';
import { computeScoreDiffBuckets } from '../stats/matchStats';

interface GoalMomentumChartProps {
  events: MatchEvent[];
  durationSeconds: number;
}

const W = 220;
const H = 56;
const MID = H / 2;
const GAP = 0.6;
const MAX_BAR = MID - 6;
/**
 * Any real lead gets at least this much height — otherwise a match led
 * wire-to-wire by a small, steady margin scales every bar down near zero
 * relative to a big final lead, and reads as "close/tied the whole time"
 * when really one side was never behind.
 */
const MIN_BAR = 5;

/** Compact "who was ahead, and by how much" chart — one bar per minute of the match. */
export function GoalMomentumChart({ events, durationSeconds }: GoalMomentumChartProps) {
  const buckets = useMemo(() => computeScoreDiffBuckets(events, durationSeconds, 60), [events, durationSeconds]);

  if (durationSeconds === 0) return null;

  const maxAbs = Math.max(1, ...buckets.map((b) => Math.abs(b.diff)));
  const barWidth = W / buckets.length;
  const scaleH = (d: number) => (d === 0 ? 0 : MIN_BAR + (Math.abs(d) / maxAbs) * (MAX_BAR - MIN_BAR));
  const halftimeIndex = Math.floor(HALFTIME_SECONDS / (durationSeconds / buckets.length));

  return (
    <div className="w-full max-w-[240px] shrink-0">
      <p className="mb-1.5 text-right text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Minuto a minuto</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" preserveAspectRatio="none">
        {halftimeIndex > 0 && halftimeIndex < buckets.length && (
          <line
            x1={halftimeIndex * barWidth}
            y1={0}
            x2={halftimeIndex * barWidth}
            y2={H}
            style={{ stroke: 'var(--line-soft-1)' }}
            strokeDasharray="3 3"
          />
        )}
        {buckets.map((b, i) => (
          <rect
            key={i}
            x={i * barWidth + GAP / 2}
            y={b.diff >= 0 ? MID - scaleH(b.diff) : MID}
            width={Math.max(barWidth - GAP, 0.6)}
            height={scaleH(b.diff)}
            rx={1}
            fill={b.diff > 0 ? '#f59e0b' : b.diff < 0 ? '#f43f5e' : 'transparent'}
          />
        ))}
        <line x1={0} y1={MID} x2={W} y2={MID} style={{ stroke: 'var(--line-soft-2)' }} strokeWidth={1} />
      </svg>
    </div>
  );
}
