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
              'flex h-14 items-center justify-center gap-2 rounded-lg border-4 px-3 font-bold touch-manipulation sm:h-16',
              selected
                ? 'scale-105 border-amber-400 bg-amber-500 text-slate-900'
                : player.position === 'goalkeeper'
                  ? 'border-sky-600 bg-sky-400/90 text-slate-900'
                  : 'border-emerald-700 bg-white text-emerald-900',
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
