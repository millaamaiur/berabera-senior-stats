import { useState } from 'react';
import type { Player } from '../domain/types';

interface EditSquadModalProps {
  allPlayers: Player[];
  calledPlayerIds: string[];
  /** Players who can't be removed: currently on court, or already have a recorded event this match. */
  lockedPlayerIds: Set<string>;
  onSave: (calledPlayerIds: string[]) => Promise<void>;
  onClose: () => void;
}

/** Add or remove players from a match's squad after it's already been created. */
export function EditSquadModal({ allPlayers, calledPlayerIds, lockedPlayerIds, onSave, onClose }: EditSquadModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(calledPlayerIds));

  function toggle(id: string) {
    if (lockedPlayerIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    await onSave([...selected]);
    onClose();
  }

  const fieldPlayers = allPlayers.filter((p) => p.position === 'player');
  const goalkeepers = allPlayers.filter((p) => p.position === 'goalkeeper');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-3xl bg-panel/95 p-4 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Editar convocatoria</h3>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-slate-400" aria-label="Cerrar">
            ×
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Los jugadores en pista o con algún evento registrado no se pueden quitar (candado gris).
        </p>

        <Group title="Jugadores de campo" players={fieldPlayers} selected={selected} locked={lockedPlayerIds} onToggle={toggle} />
        <Group title="Porteros" players={goalkeepers} selected={selected} locked={lockedPlayerIds} onToggle={toggle} />

        <div className="flex justify-end gap-2 border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/8 px-4 py-2.5 font-semibold text-white transition-transform touch-manipulation active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-amber-500 px-4 py-2.5 font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition-transform touch-manipulation active:scale-95"
          >
            Guardar convocatoria ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({
  title,
  players,
  selected,
  locked,
  onToggle,
}: {
  title: string;
  players: Player[];
  selected: Set<string>;
  locked: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="flex flex-wrap gap-2">
        {players.map((player) => {
          const isSelected = selected.has(player.id);
          const isLocked = locked.has(player.id);
          return (
            <button
              key={player.id}
              type="button"
              onClick={() => onToggle(player.id)}
              disabled={isLocked}
              className={[
                'flex h-11 items-center justify-center gap-1.5 rounded-full px-3 font-semibold ring-1 touch-manipulation',
                isSelected ? 'bg-amber-500/20 text-amber-300 ring-amber-500/40' : 'bg-white/5 text-slate-400 ring-white/10',
                isLocked ? 'opacity-60' : '',
              ].join(' ')}
            >
              {isLocked && <span aria-hidden="true">🔒</span>}
              <span className="opacity-70">{player.number}</span>
              <span>{player.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
