import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAppData, activeSeason } from '../stores/useAppData';
import { computeFieldPlayerStats, computeGoalkeeperStats } from '../stats/matchStats';
import { createPlayer, suggestPlayerNumber, toggleActive, validatePlayerNumber } from '../stores/playerActions';
import { numberRangeFor, type Player, type Position } from '../domain/types';
import { useAuthStore } from '../stores/useAuthStore';
import { Badge } from '../components/Badge';
import { SegmentedControl } from '../components/SegmentedControl';
import { PlayerAvatar } from '../components/PlayerAvatar';

const inputClass = 'mt-1 rounded-xl bg-white/5 px-3 py-2.5 text-white ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-amber-400';

type SortKey = 'goals' | 'turnovers' | 'recoveries' | 'exclusions';
type GkSortKey = 'saves' | 'goalsConceded' | 'savePct';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'goals', label: 'Goles' },
  { value: 'turnovers', label: 'Pérdidas' },
  { value: 'recoveries', label: 'Recup.' },
  { value: 'exclusions', label: 'Exclus.' },
];

const GK_SORT_OPTIONS: { value: GkSortKey; label: string }[] = [
  { value: 'saves', label: 'Paradas' },
  { value: 'goalsConceded', label: 'Goles recib.' },
  { value: 'savePct', label: '% Paradas' },
];

export function Players() {
  const players = useAppData((s) => s.players);
  const matches = useAppData((s) => s.matches);
  const events = useAppData((s) => s.events);
  const seasons = useAppData((s) => s.seasons);
  const unlocked = useAuthStore((s) => s.unlocked);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('player');
  const [number, setNumber] = useState<number>(4);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('goals');
  const [gkSortKey, setGkSortKey] = useState<GkSortKey>('saves');

  const season = activeSeason(seasons);
  const seasonMatches = useMemo(
    () => (season ? matches.filter((m) => m.seasonId === season.id) : matches),
    [matches, season]
  );
  const seasonMatchIds = useMemo(() => new Set(seasonMatches.map((m) => m.id)), [seasonMatches]);
  const seasonEvents = useMemo(() => events.filter((e) => seasonMatchIds.has(e.matchId)), [events, seasonMatchIds]);

  const rows = useMemo(() => {
    return players
      .filter((p) => p.position === 'player')
      .map((p) => ({ player: p, stats: computeFieldPlayerStats(seasonEvents, p.id) }))
      .sort((a, b) => b.stats[sortKey] - a.stats[sortKey]);
  }, [players, seasonEvents, sortKey]);

  const gkRows = useMemo(() => {
    return players
      .filter((p) => p.position === 'goalkeeper')
      .map((p) => ({ player: p, stats: computeGoalkeeperStats(seasonEvents, p.id) }))
      .sort((a, b) => b.stats[gkSortKey] - a.stats[gkSortKey]);
  }, [players, seasonEvents, gkSortKey]);

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
    <div className="flex flex-col gap-7 p-4 pt-6 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold tracking-tight text-white">Jugadores</h2>
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

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-white">Jugadores de campo</h2>
          <SegmentedControl value={sortKey} options={SORT_OPTIONS} onChange={setSortKey} />
        </div>
        <div className="flex flex-col gap-2">
          {rows.map(({ player, stats }) => (
            <PlayerRow
              key={player.id}
              player={player}
              unlocked={unlocked}
              statLine={
                <>
                  {stats.turnovers} pérd. · {stats.recoveries} recup. · {stats.exclusions} exclus.
                </>
              }
              statValue={stats[sortKey]}
              statLabel={SORT_OPTIONS.find((o) => o.value === sortKey)?.label ?? ''}
            />
          ))}
          {rows.length === 0 && <p className="p-2 text-slate-400">No hay jugadores de campo.</p>}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-white">Porteros</h2>
          <SegmentedControl value={gkSortKey} options={GK_SORT_OPTIONS} onChange={setGkSortKey} />
        </div>
        <div className="flex flex-col gap-2">
          {gkRows.map(({ player, stats }) => (
            <PlayerRow
              key={player.id}
              player={player}
              unlocked={unlocked}
              statLine={
                <>
                  {stats.shotsFaced} lanz. recib. · {stats.saves} paradas · {stats.goalsConceded} goles recib.
                </>
              }
              statValue={gkSortKey === 'savePct' ? `${stats[gkSortKey]}%` : stats[gkSortKey]}
              statLabel={GK_SORT_OPTIONS.find((o) => o.value === gkSortKey)?.label ?? ''}
            />
          ))}
          {gkRows.length === 0 && <p className="p-2 text-slate-400">No hay porteros en la plantilla.</p>}
        </div>
      </section>
    </div>
  );
}

function PlayerRow({
  player,
  unlocked,
  statLine,
  statValue,
  statLabel,
}: {
  player: Player;
  unlocked: boolean;
  statLine: ReactNode;
  statValue: number | string;
  statLabel: string;
}) {
  return (
    <div
      className={[
        'flex items-center gap-3 rounded-2xl bg-white/5 p-2.5 ring-1 ring-white/10',
        player.active ? '' : 'opacity-50',
      ].join(' ')}
    >
      <Link
        to={`/jugadores/${player.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 transition-transform touch-manipulation active:scale-[0.98]"
      >
        <PlayerAvatar playerId={player.id} name={player.name} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-white">{player.name}</p>
          <p className="truncate text-xs text-slate-400">{statLine}</p>
        </div>
        <div className="flex shrink-0 flex-col items-center">
          <p className="text-xl font-extrabold text-amber-400">{statValue}</p>
          <p className="text-[0.6rem] uppercase tracking-wide text-slate-500">{statLabel}</p>
        </div>
      </Link>
      {unlocked && (
        <button type="button" onClick={() => toggleActive(player)} className="shrink-0 touch-manipulation">
          <Badge color={player.active ? 'emerald' : 'slate'}>{player.active ? 'Activo' : 'Inactivo'}</Badge>
        </button>
      )}
    </div>
  );
}
