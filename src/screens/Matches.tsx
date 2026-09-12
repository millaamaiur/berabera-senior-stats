import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppData } from '../stores/useAppData';
import { computeMatchScore, matchOutcome } from '../stats/matchStats';
import { deleteMatch } from '../stores/matchActions';
import { formatDate, scheduleLabel } from '../utils/time';
import type { Match } from '../domain/types';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { Badge } from '../components/Badge';
import { SegmentedControl } from '../components/SegmentedControl';
import { useAuthStore } from '../stores/useAuthStore';

const OUTCOME_LABEL: Record<string, string> = { win: 'V', loss: 'D', draw: 'E' };
const OUTCOME_COLOR: Record<string, 'emerald' | 'rose' | 'slate'> = { win: 'emerald', loss: 'rose', draw: 'slate' };

type StatusFilter = 'all' | 'played' | 'upcoming';

function hasBeenPlayed(match: Match): boolean {
  return match.status === 'finished' || match.clock.hasStartedOnce;
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M4 7h16M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function Matches() {
  const matches = useAppData((s) => s.matches);
  const events = useAppData((s) => s.events);
  const { ask, dialog } = useConfirmDialog();
  const unlocked = useAuthStore((s) => s.unlocked);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...matches]
      .filter((m) => !q || m.opponent.toLowerCase().includes(q))
      .filter((m) => statusFilter === 'all' || (statusFilter === 'played') === hasBeenPlayed(m))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [matches, query, statusFilter]);

  async function handleDelete(match: Match) {
    const hasStats = events.some((e) => e.matchId === match.id);
    const firstConfirm = await ask({
      title: `¿Eliminar el partido contra ${match.opponent}?`,
      message: hasStats
        ? 'Se borrarán también su convocatoria y todas sus estadísticas registradas. No se puede deshacer.'
        : 'Se borrará también su convocatoria.',
      danger: true,
      confirmLabel: 'Eliminar',
    });
    if (!firstConfirm) return;

    const secondConfirm = await ask({
      title: 'Última confirmación',
      message: `Vas a eliminar definitivamente el partido contra ${match.opponent}. Esta acción no se puede deshacer.`,
      danger: true,
      confirmLabel: 'Sí, eliminar',
    });
    if (!secondConfirm) return;

    await deleteMatch(match.id);
  }

  return (
    <div className="flex flex-col gap-4 p-4 pt-6 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold tracking-tight text-white">Partidos</h2>
        {unlocked && (
          <Link
            to="/partidos/nuevo"
            className="rounded-full bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition-transform touch-manipulation active:scale-95"
          >
            + Nuevo
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-amber-400 sm:w-64">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar rival..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
        </label>
        <SegmentedControl
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'played', label: 'Jugados' },
            { value: 'upcoming', label: 'Próximos' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((match) => {
          const matchEvents = events.filter((e) => e.matchId === match.id);
          const { goalsFor, goalsAgainst } = computeMatchScore(matchEvents);
          const outcome = matchOutcome(goalsFor, goalsAgainst);
          const to = match.status === 'finished' ? `/partidos/${match.id}` : `/anotar/${match.id}`;
          return (
            <div
              key={match.id}
              className="flex items-center gap-2 rounded-2xl bg-white/5 p-3 text-white ring-1 ring-white/10 transition-transform touch-manipulation active:scale-[0.99]"
            >
              <Link to={to} className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{match.opponent}</p>
                  <p className="text-sm text-slate-400">
                    {formatDate(match.date)} · {match.competition} · {match.isHome ? 'Casa' : 'Fuera'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xl font-extrabold">
                    {goalsFor} - {goalsAgainst}
                  </span>
                  {match.status === 'finished' ? (
                    <Badge color={OUTCOME_COLOR[outcome]}>{OUTCOME_LABEL[outcome]}</Badge>
                  ) : match.clock.hasStartedOnce ? (
                    <Badge color="amber">EN VIVO</Badge>
                  ) : (
                    <Badge color="slate">{scheduleLabel(match.date)}</Badge>
                  )}
                </div>
              </Link>
              {unlocked && (
                <button
                  type="button"
                  onClick={() => handleDelete(match)}
                  aria-label={`Eliminar partido contra ${match.opponent}`}
                  className="shrink-0 rounded-full p-2 text-slate-500 active:bg-rose-500/10 active:text-rose-400"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="p-2 text-slate-400">{matches.length === 0 ? 'Todavía no hay partidos.' : 'Ningún partido coincide con la búsqueda.'}</p>
        )}
      </div>
      {dialog}
    </div>
  );
}
