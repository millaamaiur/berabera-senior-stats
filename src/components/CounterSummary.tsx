import type { CounterStats } from '../stats/matchStats';

interface CounterSummaryProps {
  stats: CounterStats;
  /** Which side to show — a field player only ever finishes ours, a goalkeeper only faces theirs. */
  show?: 'both' | 'made' | 'received';
}

/** Contraataques: how many, and how each one ended. */
export function CounterSummary({ stats, show = 'both' }: CounterSummaryProps) {
  const { made, received } = stats;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {show !== 'received' && (
        <CounterCard
          label="Hechos"
          goals={made.goals}
          total={made.total}
          breakdown={`${made.goals} gol · ${made.misses} fallo · ${made.turnovers} pérdida`}
        />
      )}
      {show !== 'made' && (
        <CounterCard
          label="Recibidos"
          goals={received.goals}
          total={received.total}
          breakdown={`${received.goals} gol · ${received.saves} parada · ${received.outside} fuera`}
        />
      )}
    </div>
  );
}

function CounterCard({ label, goals, total, breakdown }: { label: string; goals: number; total: number; breakdown: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 font-bold text-white">
        {goals} de {total} en gol
        {total > 0 && <span className="ml-1.5 text-sm font-semibold text-amber-400">({Math.round((goals / total) * 100)}%)</span>}
      </p>
      <p className="text-xs text-slate-400">{breakdown}</p>
    </div>
  );
}
