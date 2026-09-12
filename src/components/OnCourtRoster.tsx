import type { Player } from '../domain/types';

interface OnCourtRosterProps {
  onCourtPlayers: Player[];
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string | null) => void;
}

/**
 * The 7 players currently on court. Tapping selects a player for the action
 * panel — it never takes them off court, since that's only ever done through
 * a substitution.
 */
export function OnCourtRoster({ onCourtPlayers, selectedPlayerId, onSelectPlayer }: OnCourtRosterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {onCourtPlayers.map((player) => {
        const selected = player.id === selectedPlayerId;
        return (
          <button
            key={player.id}
            type="button"
            onClick={() => onSelectPlayer(selected ? null : player.id)}
            aria-label={`${player.name}, en pista${selected ? ', seleccionado' : ''}`}
            className={[
              'flex h-14 items-center justify-center gap-2 rounded-2xl px-3 font-bold shadow-md ring-1 transition-transform touch-manipulation sm:h-16',
              selected
                ? 'scale-105 bg-amber-500 text-slate-900 ring-amber-400 shadow-amber-500/30'
                : player.position === 'goalkeeper'
                  ? 'bg-sky-400/90 text-slate-900 ring-sky-500/40'
                  : 'bg-white text-emerald-900 ring-emerald-700/30',
            ].join(' ')}
          >
            <span className="opacity-60">{player.number}</span>
            <span>{player.name}</span>
          </button>
        );
      })}
      {onCourtPlayers.length === 0 && <p className="text-sm text-slate-400">No hay jugadores en pista.</p>}
    </div>
  );
}
