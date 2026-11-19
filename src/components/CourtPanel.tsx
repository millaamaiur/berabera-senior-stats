import { useState } from 'react';
import type { CourtSpot, Player } from '../domain/types';
import { positionForSpot, SPOT_LABELS } from '../stats/courtSpots';
import { CourtView, type CourtMode } from './CourtView';

interface CourtPanelProps {
  mode: CourtMode;
  spots: Map<CourtSpot, Player>;
  /** Everyone called up who isn't on court right now. */
  benchPlayers: Player[];
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string | null) => void;
  /** Puts `incoming` on `spot`, taking `outgoing` (whoever stood there, if anyone) off court. */
  onFillSpot: (spot: CourtSpot, incoming: Player, outgoing: Player | null) => Promise<void>;
  /** Lineup only: leaves a spot empty again. */
  onClearSpot: (player: Player) => Promise<void>;
}

/**
 * The left half of the scoring screen while no action is being finished: the
 * court, or — after tapping a spot to fill or a player to swap — who can go there.
 */
export function CourtPanel({
  mode,
  spots,
  benchPlayers,
  selectedPlayerId,
  onSelectPlayer,
  onFillSpot,
  onClearSpot,
}: CourtPanelProps) {
  const [pickingSpot, setPickingSpot] = useState<CourtSpot | null>(null);

  function handleTapSpot(spot: CourtSpot, player: Player | null) {
    if (mode === 'actions' && player) {
      onSelectPlayer(player.id === selectedPlayerId ? null : player.id);
      return;
    }
    onSelectPlayer(null);
    setPickingSpot(spot);
  }

  /**
   * Back to the court straight away: the store puts the change on screen
   * before it's uploaded, so a slow connection in the hall never leaves this
   * list hanging (and a second tap can't land on it twice).
   */
  function run(task: () => Promise<void>) {
    setPickingSpot(null);
    void task();
  }

  if (pickingSpot) {
    const current = spots.get(pickingSpot) ?? null;
    const kind = positionForSpot(pickingSpot);
    const candidates = benchPlayers.filter((p) => p.position === kind).sort((a, b) => a.number - b.number);
    const spotLabel = SPOT_LABELS[pickingSpot];
    const title =
      mode === 'lineup'
        ? `¿Quién juega de ${spotLabel.toLowerCase()}?`
        : current
          ? `¿Quién entra por ${current.name}?`
          : `¿Quién entra de ${spotLabel.toLowerCase()}?`;
    const subtitle = mode === 'lineup' ? (current ? `Ahora: ${current.name}` : null) : spotLabel;

    return (
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-white">{title}</p>
            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => setPickingSpot(null)}
            className="shrink-0 rounded-full bg-white/8 px-4 py-2.5 font-semibold text-white ring-1 ring-white/10 touch-manipulation active:scale-95"
          >
            Cancelar
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {candidates.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => run(() => onFillSpot(pickingSpot, player, current))}
              className={[
                'flex h-16 items-center gap-2 rounded-2xl px-3 text-left font-bold ring-1 transition-transform touch-manipulation active:scale-95',
                player.position === 'goalkeeper'
                  ? 'bg-sky-500/10 text-sky-300 ring-sky-500/40'
                  : 'bg-white/8 text-white ring-white/10',
              ].join(' ')}
            >
              <span className="text-2xl font-black">{player.number}</span>
              <span className="truncate">{player.name}</span>
            </button>
          ))}
        </div>
        {candidates.length === 0 && (
          <p className="text-sm text-slate-400">
            {kind === 'goalkeeper'
              ? 'No hay ningún portero convocado en el banquillo. Añádelo en «Convocatoria».'
              : 'No hay ningún jugador de campo convocado en el banquillo. Añádelo en «Convocatoria».'}
          </p>
        )}

        {mode === 'lineup' && current && (
          <button
            type="button"
            onClick={() => run(() => onClearSpot(current))}
            className="self-start rounded-full px-4 py-2.5 font-semibold text-rose-400 ring-1 ring-rose-400/40 touch-manipulation active:scale-95"
          >
            Quitar a {current.name}
          </button>
        )}
      </div>
    );
  }

  const selected = [...spots.values()].find((p) => p.id === selectedPlayerId);
  const hint =
    mode === 'lineup'
      ? 'Toca un hueco del campo y elige quién juega ahí'
      : mode === 'subs'
        ? 'Toca al jugador que sale'
        : selected
          ? `${selected.name} · elige la acción arriba`
          : 'Toca a un jugador y luego la acción';

  return (
    <div className="flex h-full flex-col gap-2">
      <p
        className={[
          'shrink-0 text-center text-sm font-semibold',
          mode === 'subs' ? 'text-rose-400' : selected ? 'text-amber-400' : 'text-slate-400',
        ].join(' ')}
      >
        {hint}
      </p>
      <CourtView spots={spots} mode={mode} selectedPlayerId={selectedPlayerId} onTapSpot={handleTapSpot} />
    </div>
  );
}
