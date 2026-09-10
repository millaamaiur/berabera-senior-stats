import type { Zone } from '../domain/types';

interface ShotGrid3x3Props {
  onSelectZone: (zone: Zone) => void;
  highlightZone?: Zone;
}

const ZONES: Zone[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function ShotGrid3x3({ onSelectZone, highlightZone }: ShotGrid3x3Props) {
  return (
    <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-2 rounded-xl border-4 border-slate-500 bg-slate-800 p-2">
      {ZONES.map((zone) => (
        <button
          key={zone}
          type="button"
          onClick={() => onSelectZone(zone)}
          className={[
            'flex aspect-square items-center justify-center rounded-lg border-2 text-2xl font-bold transition-colors touch-manipulation',
            highlightZone === zone
              ? 'border-amber-400 bg-amber-500 text-slate-900'
              : 'border-slate-600 bg-slate-700 text-white active:bg-slate-600',
          ].join(' ')}
        >
          {zone}
        </button>
      ))}
    </div>
  );
}
