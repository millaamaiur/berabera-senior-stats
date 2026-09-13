import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppData, activeSeason } from '../stores/useAppData';
import { computeMatchScore, computeTeamSeasonStats, matchOutcome } from '../stats/matchStats';
import { ClubLogo } from '../components/ClubLogo';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { closeSeasonAndStartNext } from '../stores/seasonActions';
import { useAuthStore } from '../stores/useAuthStore';
import { daysUntil, formatDate, scheduleLabel } from '../utils/time';

export function Home() {
  const matches = useAppData((s) => s.matches);
  const events = useAppData((s) => s.events);
  const seasons = useAppData((s) => s.seasons);
  const { ask, dialog } = useConfirmDialog();
  const unlocked = useAuthStore((s) => s.unlocked);

  const season = activeSeason(seasons);

  const seasonMatches = useMemo(
    () => (season ? matches.filter((m) => m.seasonId === season.id) : matches),
    [matches, season]
  );
  const seasonMatchIds = useMemo(() => new Set(seasonMatches.map((m) => m.id)), [seasonMatches]);
  const seasonEvents = useMemo(() => events.filter((e) => seasonMatchIds.has(e.matchId)), [events, seasonMatchIds]);

  const team = useMemo(() => computeTeamSeasonStats(seasonMatches, seasonEvents), [seasonMatches, seasonEvents]);

  const recentForm = useMemo(() => {
    return seasonMatches
      .filter((m) => m.status === 'finished')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-5)
      .map((m) => {
        const matchEvents = events.filter((e) => e.matchId === m.id);
        const { goalsFor, goalsAgainst } = computeMatchScore(matchEvents);
        return { match: m, outcome: matchOutcome(goalsFor, goalsAgainst), goalsFor, goalsAgainst };
      });
  }, [seasonMatches, events]);

  const nextMatch = useMemo(() => {
    return [...matches]
      .filter((m) => m.status !== 'finished' && !m.clock.hasStartedOnce && daysUntil(m.date) >= 0)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
  }, [matches]);

  async function handleCloseSeason() {
    const firstConfirm = await ask({
      title: '¿Cerrar la temporada actual?',
      message: 'Los partidos jugados se quedan en el historial, pero el resumen de arriba empezará de cero en una temporada nueva.',
      confirmLabel: 'Cerrar temporada',
    });
    if (!firstConfirm) return;

    const secondConfirm = await ask({
      title: 'Última confirmación',
      message: 'Esta acción no se puede deshacer. ¿Confirmas que quieres cerrar la temporada ahora?',
      danger: true,
      confirmLabel: 'Sí, cerrar temporada',
    });
    if (!secondConfirm) return;

    await closeSeasonAndStartNext();
  }

  return (
    <div className="flex flex-col gap-7 p-4 pt-6 sm:p-6">
      <div className="flex flex-col items-center gap-2 sm:hidden">
        <ClubLogo className="h-16 w-16 object-contain" />
      </div>

      {nextMatch && (
        <Link
          to={`/anotar/${nextMatch.id}`}
          className="flex items-center justify-between gap-3 rounded-3xl bg-gradient-to-br from-amber-500/15 via-white/5 to-transparent p-4 ring-1 ring-amber-500/30 transition-transform touch-manipulation active:scale-[0.99] sm:p-5"
        >
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-400">Próximo partido</p>
            <p className="mt-1 truncate text-lg font-extrabold text-white">vs {nextMatch.opponent}</p>
            <p className="text-sm text-slate-400">
              {formatDate(nextMatch.date)} · {nextMatch.competition} · {nextMatch.isHome ? 'Casa' : 'Fuera'}
            </p>
          </div>
          <Badge color="amber">{scheduleLabel(nextMatch.date)}</Badge>
        </Link>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-extrabold tracking-tight text-white">Temporada {season?.name ?? ''}</h2>
          {unlocked && (
            <button
              type="button"
              onClick={handleCloseSeason}
              className="rounded-full bg-white/8 px-3.5 py-2 text-xs font-bold text-slate-200 transition-transform touch-manipulation active:scale-95"
            >
              Cerrar temporada
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
          <StatCard label="PJ" value={team.played} />
          <StatCard label="PG" value={team.wins} />
          <StatCard label="PE" value={team.draws} />
          <StatCard label="PP" value={team.losses} />
          <StatCard label="GF" value={team.goalsFor} />
          <StatCard label="GC" value={team.goalsAgainst} />
          <StatCard label="Dif." value={team.goalDiff} />
        </div>
        {recentForm.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Forma reciente</span>
            <div className="flex gap-1.5">
              {recentForm.map(({ match, outcome, goalsFor, goalsAgainst }) => (
                <Link
                  key={match.id}
                  to={`/partidos/${match.id}`}
                  title={`vs ${match.opponent} · ${goalsFor}-${goalsAgainst}`}
                  className={[
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold text-white transition-transform touch-manipulation active:scale-90',
                    outcome === 'win' ? 'bg-emerald-500' : outcome === 'loss' ? 'bg-rose-500' : 'bg-slate-500',
                  ].join(' ')}
                >
                  {outcome === 'win' ? 'V' : outcome === 'loss' ? 'D' : 'E'}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {dialog}
    </div>
  );
}
