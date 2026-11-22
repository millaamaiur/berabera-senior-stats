import type { Phase, Player } from '../domain/types';

export interface PairView {
  attacker: Player;
  defender: Player;
}

/** At most this many attack-defense pairs at once — in practice teams use one or two. */
export const MAX_AD_PAIRS = 2;

interface AttackDefenseBarProps {
  pairs: PairView[];
  /** Which phase the court is in, judged by who's on court; null when no pair tells (or there are none). */
  phase: Phase | null;
  canAddPair: boolean;
  onSwitch: (to: Phase) => void;
  onAddPair: () => void;
  onTapPair: (pair: PairView) => void;
}

/**
 * Everything attack-defense, right above the court: the ATAQUE / DEFENSA
 * switch (once there's a pair), the pairs themselves, and «+ Pareja».
 */
export function AttackDefenseBar({ pairs, phase, canAddPair, onSwitch, onAddPair, onTapPair }: AttackDefenseBarProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {pairs.length > 0 && (
        <div className="flex shrink-0 gap-1 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10" role="group" aria-label="Ataque o defensa">
          <PhaseButton label="ATAQUE" active={phase === 'attack'} activeClass="bg-amber-500" onClick={() => onSwitch('attack')} />
          <PhaseButton label="DEFENSA" active={phase === 'defense'} activeClass="bg-[#38bdf8]" onClick={() => onSwitch('defense')} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {pairs.map((pair) => (
          <button
            key={`${pair.attacker.id}-${pair.defender.id}`}
            type="button"
            onClick={() => onTapPair(pair)}
            aria-label={`Pareja ${pair.attacker.name} (ataque) y ${pair.defender.name} (defensa)`}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/8 pr-2.5 pl-3 font-extrabold text-white ring-1 ring-white/15 touch-manipulation active:scale-95"
          >
            {pair.attacker.number} ⇄ {pair.defender.number}
            <span aria-hidden="true" className="font-bold text-slate-400">
              ×
            </span>
          </button>
        ))}
        {pairs.length === 0 && <span className="truncate text-sm text-slate-500">Sin parejas ataque-defensa</span>}
      </div>

      {/* Gone once the maximum is reached, which is exactly when the pairs need the room. */}
      {canAddPair && (
        <button
          type="button"
          onClick={onAddPair}
          className="h-11 shrink-0 rounded-full px-4 font-extrabold text-amber-400 ring-[1.5px] ring-amber-500 touch-manipulation active:scale-95"
        >
          + Pareja
        </button>
      )}
    </div>
  );
}

function PhaseButton({
  label,
  active,
  activeClass,
  onClick,
}: {
  label: string;
  active: boolean;
  activeClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={active ? undefined : onClick}
      aria-pressed={active}
      className={[
        // No colour transition: which phase is on must read at a glance, the instant it's tapped.
        'h-11 w-[5.5rem] rounded-xl text-sm font-extrabold tracking-wide touch-manipulation',
        active ? `${activeClass} text-slate-900` : 'text-slate-300 active:bg-white/10',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
