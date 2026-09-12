import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppData, activeSeason } from '../stores/useAppData';
import { computeFieldPlayerStats, computeGoalkeeperStats, computeTeamSeasonStats } from '../stats/matchStats';
import { ClubLogo } from '../components/ClubLogo';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { StatCard } from '../components/StatCard';
import { SegmentedControl } from '../components/SegmentedControl';
import { Badge } from '../components/Badge';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { closeSeasonAndStartNext } from '../stores/seasonActions';
import { useAuthStore } from '../stores/useAuthStore';
import { daysUntil, formatDate, scheduleLabel } from '../utils/time';

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

export function Home() {
  const players = useAppData((s) => s.players);
  const matches = useAppData((s) => s.matches);
  const events = useAppData((s) => s.events);
  const seasons = useAppData((s) => s.seasons);
  const [sortKey, setSortKey] = useState<SortKey>('goals');
  const [gkSortKey, setGkSortKey] = useState<GkSortKey>('saves');
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

  const nextMatch = useMemo(() => {
    return [...matches]
      .filter((m) => m.status !== 'finished' && !m.clock.hasStartedOnce && daysUntil(m.date) >= 0)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
  }, [matches]);

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
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-white">Jugadores</h2>
          <SegmentedControl value={sortKey} options={SORT_OPTIONS} onChange={setSortKey} />
        </div>
        <div className="flex flex-col gap-2">
          {rows.map(({ player, stats }) => (
            <Link
              key={player.id}
              to={`/jugadores/${player.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5 ring-1 ring-white/10 transition-transform touch-manipulation active:scale-[0.98]"
            >
              <PlayerAvatar playerId={player.id} name={player.name} className="h-11 w-11" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white">{player.name}</p>
                <p className="truncate text-xs text-slate-400">
                  {stats.turnovers} pérd. · {stats.recoveries} recup. · {stats.exclusions} exclus.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-center">
                <p className="text-xl font-extrabold text-amber-400">{stats[sortKey]}</p>
                <p className="text-[0.6rem] uppercase tracking-wide text-slate-500">
                  {SORT_OPTIONS.find((o) => o.value === sortKey)?.label}
                </p>
              </div>
            </Link>
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
            <Link
              key={player.id}
              to={`/jugadores/${player.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5 ring-1 ring-white/10 transition-transform touch-manipulation active:scale-[0.98]"
            >
              <PlayerAvatar playerId={player.id} name={player.name} className="h-11 w-11" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white">{player.name}</p>
                <p className="truncate text-xs text-slate-400">
                  {stats.shotsFaced} lanz. recib. · {stats.saves} paradas · {stats.goalsConceded} goles recib.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-center">
                <p className="text-xl font-extrabold text-amber-400">
                  {gkSortKey === 'savePct' ? `${stats[gkSortKey]}%` : stats[gkSortKey]}
                </p>
                <p className="text-[0.6rem] uppercase tracking-wide text-slate-500">
                  {GK_SORT_OPTIONS.find((o) => o.value === gkSortKey)?.label}
                </p>
              </div>
            </Link>
          ))}
          {gkRows.length === 0 && <p className="p-2 text-slate-400">No hay porteros en la plantilla.</p>}
        </div>
      </section>

      {dialog}
    </div>
  );
}
