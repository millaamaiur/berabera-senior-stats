import { Link } from 'react-router-dom';
import { useAppData } from '../stores/useAppData';
import { computeMatchScore, matchOutcome } from '../stats/matchStats';
import { deleteMatch } from '../stores/matchActions';
import { daysUntil, formatDate } from '../utils/time';
import type { Match } from '../domain/types';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { useAuthStore } from '../stores/useAuthStore';

const OUTCOME_LABEL: Record<string, string> = { win: 'V', loss: 'D', draw: 'E' };
const OUTCOME_COLOR: Record<string, string> = {
  win: 'text-emerald-400 border-emerald-500',
  loss: 'text-rose-400 border-rose-500',
  draw: 'text-slate-300 border-slate-500',
};

function scheduleLabel(match: Match): string {
  const days = daysUntil(match.date);
  if (days === 0) return 'Hoy';
  if (days > 0) return `En ${days} día${days === 1 ? '' : 's'}`;
  return 'Pendiente';
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M4 7h16M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function Matches() {
  const matches = useAppData((s) => s.matches);
  const events = useAppData((s) => s.events);
  const { ask, dialog } = useConfirmDialog();
  const unlocked = useAuthStore((s) => s.unlocked);

  const sorted = [...matches].sort((a, b) => b.date.localeCompare(a.date));

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
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Partidos</h2>
        {unlocked && (
          <Link
            to="/partidos/nuevo"
            className="rounded-lg border-2 border-amber-500 bg-amber-500/10 px-3 py-2 font-semibold text-amber-400"
          >
            + Nuevo partido
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map((match) => {
          const matchEvents = events.filter((e) => e.matchId === match.id);
          const { goalsFor, goalsAgainst } = computeMatchScore(matchEvents);
          const outcome = matchOutcome(goalsFor, goalsAgainst);
          const to = match.status === 'finished' ? `/partidos/${match.id}` : `/anotar/${match.id}`;
          return (
            <div key={match.id} className="flex items-center gap-2 rounded-xl border-2 border-slate-700 bg-slate-800 p-3 text-white">
              <Link to={to} className="flex flex-1 items-center justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{match.opponent}</p>
                  <p className="text-sm text-slate-400">
                    {formatDate(match.date)} · {match.competition} · {match.isHome ? 'Casa' : 'Fuera'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xl font-bold">
                    {goalsFor} - {goalsAgainst}
                  </span>
                  {match.status === 'finished' ? (
                    <span className={`rounded-full border-2 px-2 py-1 text-xs font-bold ${OUTCOME_COLOR[outcome]}`}>
                      {OUTCOME_LABEL[outcome]}
                    </span>
                  ) : match.clock.hasStartedOnce ? (
                    <span className="rounded-full border-2 border-amber-500 px-2 py-1 text-xs font-bold text-amber-400">
                      EN VIVO
                    </span>
                  ) : (
                    <span className="rounded-full border-2 border-slate-500 px-2 py-1 text-xs font-bold text-slate-300">
                      {scheduleLabel(match)}
                    </span>
                  )}
                </div>
              </Link>
              {unlocked && (
                <button
                  type="button"
                  onClick={() => handleDelete(match)}
                  aria-label={`Eliminar partido contra ${match.opponent}`}
                  className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && <p className="text-slate-400">Todavía no hay partidos.</p>}
      </div>
      {dialog}
    </div>
  );
}
