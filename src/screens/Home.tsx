import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppData, activeSeason } from '../stores/useAppData';
import {
  computeMatchScore,
  computeTeamMatchStats,
  computeTeamSeasonStats,
  computeTeamZoneStats,
  matchOutcome,
} from '../stats/matchStats';
import { ClubLogo } from '../components/ClubLogo';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { closeSeasonAndStartNext } from '../stores/seasonActions';
import { useAuthStore } from '../stores/useAuthStore';
import { daysUntil, formatDate, scheduleLabel } from '../utils/time';

const OUTCOME_LABEL_PLURAL = { win: 'victorias', loss: 'derrotas', draw: 'empates' } as const;

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
  const homeStats = useMemo(
    () => computeTeamSeasonStats(seasonMatches.filter((m) => m.isHome), seasonEvents),
    [seasonMatches, seasonEvents]
  );
  const awayStats = useMemo(
    () => computeTeamSeasonStats(seasonMatches.filter((m) => !m.isHome), seasonEvents),
    [seasonMatches, seasonEvents]
  );
  const teamPerf = useMemo(() => computeTeamMatchStats(seasonEvents), [seasonEvents]);

  const finishedWithResults = useMemo(() => {
    return seasonMatches
      .filter((m) => m.status === 'finished')
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => {
        const matchEvents = events.filter((e) => e.matchId === m.id);
        const { goalsFor, goalsAgainst } = computeMatchScore(matchEvents);
        return { match: m, goalsFor, goalsAgainst, outcome: matchOutcome(goalsFor, goalsAgainst) };
      });
  }, [seasonMatches, events]);

  const recentForm = useMemo(() => finishedWithResults.slice(-5), [finishedWithResults]);

  const streak = useMemo(() => {
    if (finishedWithResults.length === 0) return null;
    const lastOutcome = finishedWithResults.at(-1)!.outcome;
    let count = 0;
    for (let i = finishedWithResults.length - 1; i >= 0; i--) {
      if (finishedWithResults[i].outcome !== lastOutcome) break;
      count++;
    }
    return { outcome: lastOutcome, count };
  }, [finishedWithResults]);

  const biggestWin = useMemo(() => {
    return [...finishedWithResults]
      .filter((r) => r.outcome === 'win')
      .sort((a, b) => b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst))[0];
  }, [finishedWithResults]);

  const scoredZones = useMemo(() => computeTeamZoneStats(seasonEvents, 'shot'), [seasonEvents]);
  const concededZones = useMemo(() => computeTeamZoneStats(seasonEvents, 'gk_shot'), [seasonEvents]);
  const maxScoredShots = Math.max(1, ...scoredZones.map((z) => z.shots));
  const maxConcededShots = Math.max(1, ...concededZones.map((z) => z.shots));

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
          <div className="mt-3 flex flex-wrap items-center gap-2">
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
            {streak && streak.count > 1 && (
              <span className="text-xs font-semibold text-slate-400">
                · Racha: {streak.count} {OUTCOME_LABEL_PLURAL[streak.outcome]}
              </span>
            )}
          </div>
        )}
      </section>

      {team.played > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-white">Rendimiento</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="Goles/partido" value={(team.goalsFor / team.played).toFixed(1)} />
            <StatCard label="Encaj./partido" value={(team.goalsAgainst / team.played).toFixed(1)} />
            <StatCard label="% Acierto tiro" value={`${teamPerf.shotPct}%`} />
            <StatCard label="% Paradas" value={`${teamPerf.savePct}%`} />
          </div>
        </section>
      )}

      {(homeStats.played > 0 || awayStats.played > 0) && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-white">La temporada en cifras</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <p className="text-xs uppercase tracking-wide text-slate-500">Casa</p>
              <p className="mt-0.5 font-bold text-white">
                {homeStats.wins}V {homeStats.draws}E {homeStats.losses}D
              </p>
              <p className="text-xs text-slate-400">
                {homeStats.goalsFor}-{homeStats.goalsAgainst} goles en {homeStats.played} PJ
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              <p className="text-xs uppercase tracking-wide text-slate-500">Fuera</p>
              <p className="mt-0.5 font-bold text-white">
                {awayStats.wins}V {awayStats.draws}E {awayStats.losses}D
              </p>
              <p className="text-xs text-slate-400">
                {awayStats.goalsFor}-{awayStats.goalsAgainst} goles en {awayStats.played} PJ
              </p>
            </div>
            {biggestWin ? (
              <Link
                to={`/partidos/${biggestWin.match.id}`}
                className="rounded-2xl bg-emerald-500/10 p-3 ring-1 ring-emerald-500/25 transition-transform touch-manipulation active:scale-[0.98]"
              >
                <p className="text-xs uppercase tracking-wide text-emerald-400">Mayor victoria</p>
                <p className="mt-0.5 font-bold text-white">vs {biggestWin.match.opponent}</p>
                <p className="text-xs text-slate-400">
                  {biggestWin.goalsFor}-{biggestWin.goalsAgainst}
                </p>
              </Link>
            ) : (
              <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                <p className="text-xs uppercase tracking-wide text-slate-500">Mayor victoria</p>
                <p className="mt-0.5 text-sm text-slate-400">Todavía ninguna esta temporada</p>
              </div>
            )}
          </div>
        </section>
      )}

      {(scoredZones.some((z) => z.shots > 0) || concededZones.some((z) => z.shots > 0)) && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-white">Zonas de gol de la temporada</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs text-slate-500">Goles marcados</p>
              <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2">
                {scoredZones.map((z) => (
                  <div
                    key={z.zone}
                    className="rounded-xl p-2 text-center text-white ring-1 ring-white/10"
                    style={{ backgroundColor: `rgba(37, 99, 235, ${z.shots > 0 ? 0.18 + 0.62 * (z.shots / maxScoredShots) : 0})` }}
                  >
                    <p className="text-xs text-slate-300">Zona {z.zone}</p>
                    <p className="font-bold">
                      {z.goals}/{z.shots}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs text-slate-500">Goles encajados</p>
              <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2">
                {concededZones.map((z) => (
                  <div
                    key={z.zone}
                    className="rounded-xl p-2 text-center text-white ring-1 ring-white/10"
                    style={{ backgroundColor: `rgba(244, 63, 94, ${z.shots > 0 ? 0.18 + 0.62 * (z.shots / maxConcededShots) : 0})` }}
                  >
                    <p className="text-xs text-slate-300">Zona {z.zone}</p>
                    <p className="font-bold">
                      {z.goals}/{z.shots}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {dialog}
    </div>
  );
}
