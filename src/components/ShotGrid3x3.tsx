import type { Zone } from '../domain/types';

interface ShotGrid3x3Props {
  onSelectZone: (zone: Zone | null) => void;
  highlightZone?: Zone;
  /** Show a "Fuera" option below the grid, for shots that missed the goal frame entirely. */
  allowOutside?: boolean;
}

const ZONES: Zone[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function ShotGrid3x3({ onSelectZone, highlightZone, allowOutside }: ShotGrid3x3Props) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/5 p-2 shadow-inner ring-1 ring-white/10">
        {ZONES.map((zone) => (
          <button
            key={zone}
            type="button"
            onClick={() => onSelectZone(zone)}
            className={[
              'flex aspect-square items-center justify-center rounded-xl text-2xl font-bold ring-1 transition active:scale-95 touch-manipulation',
              highlightZone === zone
                ? 'bg-amber-500 text-slate-900 ring-amber-400'
                : 'bg-white/8 text-white ring-white/10 active:bg-white/12',
            ].join(' ')}
          >
            {zone}
          </button>
        ))}
      </div>
      {allowOutside && (
        <button
          type="button"
          onClick={() => onSelectZone(null)}
          className="rounded-xl bg-white/8 py-3 text-lg font-bold text-white ring-1 ring-white/10 transition active:scale-95 active:bg-white/12 touch-manipulation"
        >
          Fuera
        </button>
      )}
    </div>
  );
}
