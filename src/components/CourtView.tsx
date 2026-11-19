import type { CourtSpot, Player } from '../domain/types';
import { SPOT_LABELS } from '../stats/courtSpots';

/** The drawing's own coordinate space: the rival's half on top, our goal at the bottom. */
const VIEW = { w: 540, h: 560 };
const CHIP = { w: 116, h: 64 };

/** Top-left corner of each spot's button on the drawing, listed left to right as they're read. */
const SPOTS: { spot: CourtSpot; x: number; y: number }[] = [
  { spot: 'left_wing', x: 8, y: 40 },
  { spot: 'left_back', x: 36, y: 262 },
  { spot: 'pivot', x: 212, y: 178 },
  { spot: 'center_back', x: 212, y: 300 },
  { spot: 'right_back', x: 388, y: 262 },
  { spot: 'right_wing', x: 416, y: 40 },
  { spot: 'goalkeeper', x: 212, y: 470 },
];

export type CourtMode = 'lineup' | 'actions' | 'subs';

interface CourtViewProps {
  /** Who stands on each spot; a spot missing here is drawn as an empty, tappable hole. */
  spots: Map<CourtSpot, Player>;
  mode: CourtMode;
  selectedPlayerId: string | null;
  onTapSpot: (spot: CourtSpot, player: Player | null) => void;
}

/**
 * Half a handball court with each on-court player's button at their spot.
 * It scales to whatever room the panel has, keeping its proportions, so it
 * fits a phone in landscape as well as a tablet.
 */
export function CourtView({ spots, mode, selectedPlayerId, onTapSpot }: CourtViewProps) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center [container-type:size]">
      <div
        className="relative overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 [container-type:inline-size]"
        style={{
          width: `min(100cqw, 100cqh * ${VIEW.w / VIEW.h})`,
          height: `min(100cqh, 100cqw * ${VIEW.h / VIEW.w})`,
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          className="absolute inset-0 h-full w-full text-white/45"
          aria-hidden="true"
        >
          {/* Rival 6 m area and dashed 9 m line */}
          <path
            d="M68 0 A162 162 0 0 0 230 162 L310 162 A162 162 0 0 0 472 0 Z"
            className="fill-sky-500/15"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M0 78 A243 243 0 0 0 230 243 L310 243 A243 243 0 0 0 540 78"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="8 7"
          />
          <path d="M0 430 H540" fill="none" stroke="currentColor" strokeWidth="2" />
          {/* Our own area, where our goalkeeper stands */}
          <path d="M150 560 A120 100 0 0 1 390 560 Z" className="fill-sky-500/15" stroke="currentColor" strokeWidth="2" />
          <g className="text-white">
            <path d="M230 0 V10 H310 V0" fill="none" stroke="currentColor" strokeWidth="4" />
            <path d="M230 560 V550 H310 V560" fill="none" stroke="currentColor" strokeWidth="4" />
          </g>
        </svg>
        <span className="pointer-events-none absolute inset-x-0 top-[3%] text-center text-[length:clamp(9px,2cqw,12px)] font-bold tracking-widest text-slate-400">
          PORTERÍA RIVAL
        </span>

        {SPOTS.map(({ spot, x, y }) => {
          const player = spots.get(spot) ?? null;
          return (
            <button
              key={spot}
              type="button"
              onClick={() => onTapSpot(spot, player)}
              aria-label={player ? `${player.name}, ${SPOT_LABELS[spot]}` : `${SPOT_LABELS[spot]}: vacío`}
              aria-pressed={player ? player.id === selectedPlayerId : undefined}
              className={chipClass(player, mode, player?.id === selectedPlayerId)}
              style={{
                left: `${(x / VIEW.w) * 100}%`,
                top: `${(y / VIEW.h) * 100}%`,
                width: `${(CHIP.w / VIEW.w) * 100}%`,
                height: `${(CHIP.h / VIEW.h) * 100}%`,
              }}
            >
              {player ? (
                <>
                  <span className="text-[length:clamp(15px,4.4cqw,28px)] leading-none font-black">{player.number}</span>
                  <span className="w-full truncate px-1 text-[length:clamp(10px,2.3cqw,15px)] font-semibold opacity-80">
                    {player.name}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[length:clamp(15px,4.4cqw,28px)] leading-none font-bold">+</span>
                  <span className="w-full truncate px-1 text-[length:clamp(10px,2.3cqw,15px)] font-semibold">
                    {SPOT_LABELS[spot]}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function chipClass(player: Player | null, mode: CourtMode, selected: boolean): string {
  const base =
    'absolute flex flex-col items-center justify-center gap-[2%] rounded-2xl shadow-md transition-transform touch-manipulation active:scale-95';
  if (!player) {
    return `${base} border-2 border-dashed border-white/30 bg-black/10 text-slate-400 shadow-none`;
  }
  // Same colours the on-court chips have always had: a white pill, light blue
  // for the goalkeeper, amber once picked. Literal colours, so light mode (which
  // darkens the sky-400 token for text) can't turn the keeper's pill dark.
  const look = selected
    ? 'scale-105 bg-amber-500 text-slate-900 ring-2 ring-amber-300 shadow-amber-500/30'
    : player.position === 'goalkeeper'
      ? 'bg-[#38bdf8] text-slate-900 ring-1 ring-sky-500/40'
      : 'bg-[#fff] text-emerald-900 ring-1 ring-emerald-700/30';
  // While making changes, every player reads as "tap to take me off".
  const subs = mode === 'subs' && !selected ? 'outline-2 outline-offset-2 outline-dashed outline-rose-400' : '';
  return [base, look, subs].join(' ');
}
