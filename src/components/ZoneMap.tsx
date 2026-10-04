import type { ZoneStat } from '../stats/matchStats';

interface ZoneMapProps {
  zones: ZoneStat[];
  /** Shots that missed the goal frame entirely ("Fuera"), which the 3x3 grid has no cell for. */
  outside: number;
  /** "r, g, b" of the heat color, e.g. "37, 99, 235". */
  rgb: string;
}

/** 3x3 goal heatmap (goals/shots per zone, tinted by volume), plus a "Fuera" row for shots that missed the frame. */
export function ZoneMap({ zones, outside, rgb }: ZoneMapProps) {
  const maxShots = Math.max(1, ...zones.map((z) => z.shots));
  return (
    <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {zones.map((z) => (
          <div
            key={z.zone}
            className="rounded-xl p-2 text-center text-white ring-1 ring-white/10"
            style={{ backgroundColor: `rgba(${rgb}, ${z.shots > 0 ? 0.18 + 0.62 * (z.shots / maxShots) : 0})` }}
          >
            <p className="text-xs text-slate-300">Zona {z.zone}</p>
            <p className="font-bold">
              {z.goals}/{z.shots}
            </p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-white ring-1 ring-white/10">
        <span className="text-xs text-slate-300">Fuera</span>
        <span className="font-bold">{outside}</span>
      </div>
    </div>
  );
}
