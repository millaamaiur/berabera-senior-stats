import type { Player } from '../domain/types';
import { COURT_LIMITS } from '../stores/useLiveMatchStore';
import { useTimedMessage } from '../utils/useTimedMessage';

interface LineupPickerProps {
  calledPlayers: Player[];
  onCourtIds: Set<string>;
  onToggleCourt: (playerId: string) => Promise<boolean>;
}

function limitMessage(position: Player['position']): string {
  return position === 'goalkeeper' ? 'Ya hay un portero titular' : 'Ya hay 6 titulares de campo';
}

/** Shown before the match clock has ever run: pick the 6 field players + 1 goalkeeper who start the match. */
export function LineupPicker({ calledPlayers, onCourtIds, onToggleCourt }: LineupPickerProps) {
  const { message, show } = useTimedMessage();

  const fieldPlayers = calledPlayers.filter((p) => p.position === 'player');
  const goalkeepers = calledPlayers.filter((p) => p.position === 'goalkeeper');
  const fieldCount = fieldPlayers.filter((p) => onCourtIds.has(p.id)).length;
  const gkCount = goalkeepers.filter((p) => onCourtIds.has(p.id)).length;

  async function handleTap(player: Player) {
    const ok = await onToggleCourt(player.id);
    if (!ok) show(limitMessage(player.position));
  }

  return (
    <div className="flex shrink-0 flex-col gap-3 rounded-xl border-2 border-amber-500/40 bg-slate-800 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-lg font-bold text-white">Elige la alineación inicial</p>
          <p className="text-sm text-slate-400">Toca a los jugadores que empiezan en pista (6 + portero)</p>
        </div>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-amber-300">
          Titulares: {fieldCount}/{COURT_LIMITS.player} + {gkCount}/{COURT_LIMITS.goalkeeper} portero
        </span>
      </div>

      {message && <p className="text-sm font-semibold text-rose-400">{message}</p>}

      <PlayerGroup title="Jugadores de campo" players={fieldPlayers} onCourtIds={onCourtIds} onTap={handleTap} />
      <PlayerGroup title="Porteros" players={goalkeepers} onCourtIds={onCourtIds} onTap={handleTap} />
    </div>
  );
}

function PlayerGroup({
  title,
  players,
  onCourtIds,
  onTap,
}: {
  title: string;
  players: Player[];
  onCourtIds: Set<string>;
  onTap: (player: Player) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="flex flex-wrap gap-2">
        {players.map((player) => {
          const selected = onCourtIds.has(player.id);
          return (
            <button
              key={player.id}
              type="button"
              onClick={() => onTap(player)}
              aria-label={`${player.name}${selected ? ', titular' : ''}`}
              className={[
                'flex h-12 items-center justify-center gap-1.5 rounded-lg border-2 px-3 font-bold touch-manipulation',
                selected
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-400'
                  : player.position === 'goalkeeper'
                    ? 'border-sky-500 bg-sky-500/10 text-sky-300'
                    : 'border-slate-500 bg-slate-700 text-white',
              ].join(' ')}
            >
              <span className="text-slate-400">{player.number}</span>
              <span>{player.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
