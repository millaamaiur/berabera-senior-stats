import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppData, activeSeason } from '../stores/useAppData';
import { computeFieldPlayerStats, computeGoalkeeperStats, computeTeamSeasonStats } from '../stats/matchStats';
import { ClubLogo } from '../components/ClubLogo';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { closeSeasonAndStartNext } from '../stores/seasonActions';
import { useAuthStore } from '../stores/useAuthStore';

type SortKey = 'goals' | 'assists' | 'turnovers' | 'exclusions';
type GkSortKey = 'saves' | 'goalsConceded' | 'savePct';

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
    <div className="flex flex-col gap-6 p-4">
      <ClubLogo className="h-20 w-20 self-center object-contain sm:hidden" />

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-white">Temporada {season?.name ?? ''}</h2>
          {unlocked && (
            <button
              type="button"
              onClick={handleCloseSeason}
              className="rounded-lg border-2 border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-300"
            >
              Cerrar temporada
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
          <Stat label="PJ" value={team.played} />
          <Stat label="PG" value={team.wins} />
          <Stat label="PE" value={team.draws} />
          <Stat label="PP" value={team.losses} />
          <Stat label="GF" value={team.goalsFor} />
          <Stat label="GC" value={team.goalsAgainst} />
          <Stat label="Dif." value={team.goalDiff} />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Jugadores</h2>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-lg border-2 border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white"
          >
            <option value="goals">Goles</option>
            <option value="assists">Asistencias</option>
            <option value="turnovers">Pérdidas</option>
            <option value="exclusions">Exclusiones</option>
          </select>
        </div>
        <div className="overflow-x-auto rounded-xl border-2 border-slate-700">
          <table className="w-full text-left text-sm text-white">
            <thead className="bg-slate-800 text-slate-300">
              <tr>
                <th className="p-2">Jugador</th>
                <th className="p-2 text-right">Goles</th>
                <th className="p-2 text-right">Asist.</th>
                <th className="p-2 text-right">Pérdidas</th>
                <th className="p-2 text-right">Exclus.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ player, stats }) => (
                <tr key={player.id} className="border-t border-slate-700 odd:bg-slate-900 even:bg-slate-800/60">
                  <td className="p-2">
                    <Link to={`/jugadores/${player.id}`} className="flex items-center gap-2 font-semibold text-amber-400">
                      <PlayerAvatar playerId={player.id} name={player.name} className="h-8 w-8" />
                      {player.name}
                    </Link>
                  </td>
                  <td className="p-2 text-right">{stats.goals}</td>
                  <td className="p-2 text-right">{stats.assists}</td>
                  <td className="p-2 text-right">{stats.turnovers}</td>
                  <td className="p-2 text-right">{stats.exclusions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Porteros</h2>
          <select
            value={gkSortKey}
            onChange={(e) => setGkSortKey(e.target.value as GkSortKey)}
            className="rounded-lg border-2 border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white"
          >
            <option value="saves">Paradas</option>
            <option value="goalsConceded">Goles recibidos</option>
            <option value="savePct">% Paradas</option>
          </select>
        </div>
        <div className="overflow-x-auto rounded-xl border-2 border-slate-700">
          <table className="w-full text-left text-sm text-white">
            <thead className="bg-slate-800 text-slate-300">
              <tr>
                <th className="p-2">Portero</th>
                <th className="p-2 text-right">Lanz. recib.</th>
                <th className="p-2 text-right">Paradas</th>
                <th className="p-2 text-right">Goles recib.</th>
                <th className="p-2 text-right">% Paradas</th>
              </tr>
            </thead>
            <tbody>
              {gkRows.map(({ player, stats }) => (
                <tr key={player.id} className="border-t border-slate-700 odd:bg-slate-900 even:bg-slate-800/60">
                  <td className="p-2">
                    <Link to={`/jugadores/${player.id}`} className="flex items-center gap-2 font-semibold text-amber-400">
                      <PlayerAvatar playerId={player.id} name={player.name} className="h-8 w-8" />
                      {player.name}
                    </Link>
                  </td>
                  <td className="p-2 text-right">{stats.shotsFaced}</td>
                  <td className="p-2 text-right">{stats.saves}</td>
                  <td className="p-2 text-right">{stats.goalsConceded}</td>
                  <td className="p-2 text-right">{stats.savePct}%</td>
                </tr>
              ))}
              {gkRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-2 text-center text-slate-400">
                    No hay porteros en la plantilla.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {dialog}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border-2 border-slate-700 bg-slate-800 p-2 text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
