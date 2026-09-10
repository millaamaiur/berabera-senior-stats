import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppData } from '../stores/useAppData';
import { createPlayer, suggestPlayerNumber, toggleActive, validatePlayerNumber } from '../stores/playerActions';
import { numberRangeFor, type Position } from '../domain/types';
import { useAuthStore } from '../stores/useAuthStore';

export function Players() {
  const players = useAppData((s) => s.players);
  const unlocked = useAuthStore((s) => s.unlocked);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('player');
  const [number, setNumber] = useState<number>(4);
  const [error, setError] = useState<string | null>(null);

  const fieldPlayers = players.filter((p) => p.position === 'player').sort((a, b) => a.number - b.number);
  const goalkeepers = players.filter((p) => p.position === 'goalkeeper').sort((a, b) => a.number - b.number);

  function applySuggestedNumber(forPosition: Position) {
    const suggestion = suggestPlayerNumber(forPosition, players);
    const range = numberRangeFor(forPosition);
    setNumber(suggestion ?? range.min);
    setError(suggestion === null ? `No quedan dorsales libres entre ${range.min} y ${range.max}` : null);
  }

  function handlePositionChange(next: Position) {
    setPosition(next);
    applySuggestedNumber(next);
  }

  function openForm() {
    setPosition('player');
    applySuggestedNumber('player');
    setShowForm(true);
  }

  async function handleAdd() {
    if (!name.trim()) return;
    const validationError = validatePlayerNumber(number, position, players);
    if (validationError) {
      setError(validationError);
      return;
    }
    await createPlayer(name.trim(), position, number);
    setName('');
    setError(null);
    setShowForm(false);
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Jugadores de campo</h2>
        {unlocked && (
          <button
            type="button"
            onClick={() => (showForm ? setShowForm(false) : openForm())}
            className="rounded-lg border-2 border-amber-500 bg-amber-500/10 px-3 py-2 font-semibold text-amber-400"
          >
            + Añadir jugador
          </button>
        )}
      </div>

      {unlocked && showForm && (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-slate-700 bg-slate-800 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-sm text-slate-300">
              Nombre
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 rounded-lg border-2 border-slate-600 bg-slate-900 px-2 py-2 text-white"
              />
            </label>
            <label className="flex flex-col text-sm text-slate-300">
              Posición
              <select
                value={position}
                onChange={(e) => handlePositionChange(e.target.value as Position)}
                className="mt-1 rounded-lg border-2 border-slate-600 bg-slate-900 px-2 py-2 text-white"
              >
                <option value="player">Jugador de campo</option>
                <option value="goalkeeper">Portero</option>
              </select>
            </label>
            <label className="flex flex-col text-sm text-slate-300">
              Dorsal ({numberRangeFor(position).min}-{numberRangeFor(position).max})
              <input
                type="number"
                min={numberRangeFor(position).min}
                max={numberRangeFor(position).max}
                value={number}
                onChange={(e) => {
                  setNumber(Number(e.target.value));
                  setError(null);
                }}
                className="mt-1 w-20 rounded-lg border-2 border-slate-600 bg-slate-900 px-2 py-2 text-white"
              />
            </label>
            <button type="button" onClick={handleAdd} className="rounded-lg bg-amber-500 px-4 py-2 font-bold text-slate-900">
              Guardar
            </button>
          </div>
          {error && <p className="text-sm font-semibold text-rose-400">{error}</p>}
        </div>
      )}

      <PlayerList players={fieldPlayers} canEdit={unlocked} />

      <h2 className="text-lg font-bold text-white">Porteros</h2>
      <PlayerList players={goalkeepers} canEdit={unlocked} />
    </div>
  );
}

function PlayerList({
  players,
  canEdit,
}: {
  players: ReturnType<typeof useAppData.getState>['players'];
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {players.map((player) => (
        <div
          key={player.id}
          className={[
            'flex items-center justify-between rounded-xl border-2 border-slate-700 bg-slate-800 p-3',
            player.active ? '' : 'opacity-50',
          ].join(' ')}
        >
          <Link to={`/jugadores/${player.id}`} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 font-bold text-white">
              {player.number}
            </span>
            <span className="font-semibold text-white">{player.name}</span>
          </Link>
          {canEdit && (
            <button
              type="button"
              onClick={() => toggleActive(player)}
              className={[
                'rounded-lg border-2 px-3 py-1 text-sm font-semibold',
                player.active ? 'border-emerald-500 text-emerald-400' : 'border-slate-500 text-slate-400',
              ].join(' ')}
            >
              {player.active ? 'Activo' : 'Inactivo'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
