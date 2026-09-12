import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppData } from '../stores/useAppData';
import { createPlayer, suggestPlayerNumber, toggleActive, validatePlayerNumber } from '../stores/playerActions';
import { numberRangeFor, type Position } from '../domain/types';
import { useAuthStore } from '../stores/useAuthStore';
import { Badge } from '../components/Badge';
import { SegmentedControl } from '../components/SegmentedControl';

const inputClass = 'mt-1 rounded-xl bg-white/5 px-3 py-2.5 text-white ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-amber-400';

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
    <div className="flex flex-col gap-6 p-4 pt-6 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold tracking-tight text-white">Jugadores de campo</h2>
        {unlocked && (
          <button
            type="button"
            onClick={() => (showForm ? setShowForm(false) : openForm())}
            className="rounded-full bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition-transform touch-manipulation active:scale-95"
          >
            + Añadir
          </button>
        )}
      </div>

      {unlocked && showForm && (
        <div className="flex flex-col gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-sm text-slate-300">
              Nombre
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col text-sm text-slate-300">
              Posición
              <span className="mt-1">
                <SegmentedControl
                  value={position}
                  onChange={handlePositionChange}
                  options={[
                    { value: 'player', label: 'Jugador de campo' },
                    { value: 'goalkeeper', label: 'Portero' },
                  ]}
                />
              </span>
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
                className={`w-20 ${inputClass}`}
              />
            </label>
            <button
              type="button"
              onClick={handleAdd}
              className="rounded-full bg-amber-500 px-4 py-2.5 font-bold text-slate-900 transition-transform touch-manipulation active:scale-95"
            >
              Guardar
            </button>
          </div>
          {error && <p className="text-sm font-semibold text-rose-400">{error}</p>}
        </div>
      )}

      <PlayerList players={fieldPlayers} canEdit={unlocked} />

      <h2 className="text-2xl font-extrabold tracking-tight text-white">Porteros</h2>
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
            'flex items-center justify-between rounded-2xl bg-white/5 p-3 ring-1 ring-white/10',
            player.active ? '' : 'opacity-50',
          ].join(' ')}
        >
          <Link to={`/jugadores/${player.id}`} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 font-bold text-white">
              {player.number}
            </span>
            <span className="font-bold text-white">{player.name}</span>
          </Link>
          {canEdit && (
            <button type="button" onClick={() => toggleActive(player)} className="touch-manipulation">
              <Badge color={player.active ? 'emerald' : 'slate'}>{player.active ? 'Activo' : 'Inactivo'}</Badge>
            </button>
          )}
        </div>
      ))}
      {players.length === 0 && <p className="p-2 text-slate-400">Sin jugadores.</p>}
    </div>
  );
}
