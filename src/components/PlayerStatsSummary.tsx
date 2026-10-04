import type { MatchEvent, Player } from '../domain/types';
import {
  computeFieldPlayerStats,
  computeGoalkeeperStats,
  computeZoneStats,
  type DefensiveOnCourtStats,
} from '../stats/matchStats';
import { formatClock } from '../utils/time';
import { StatCard } from './StatCard';

interface PlayerStatsSummaryProps {
  player: Player;
  /** Already scoped to whatever this summary covers — every match, or just one. */
  events: MatchEvent[];
  minutesSeconds: number;
  defense: DefensiveOnCourtStats;
  /** Leading "Partidos" card; omitted for a single-match summary, where it'd always be 1. */
  matchesPlayed?: number;
}

export function PlayerStatsSummary({ player, events, minutesSeconds, defense, matchesPlayed }: PlayerStatsSummaryProps) {
  const isGoalkeeper = player.position === 'goalkeeper';
  const fieldStats = !isGoalkeeper ? computeFieldPlayerStats(events, player.id) : null;
  const gkStats = isGoalkeeper ? computeGoalkeeperStats(events, player.id) : null;
  const zoneStats = computeZoneStats(events, player.id, isGoalkeeper ? 'gk_shot' : 'shot');
  const maxZoneShots = Math.max(1, ...zoneStats.map((z) => z.shots));

  return (
    <>
      <section className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {matchesPlayed !== undefined && <StatCard label="Partidos" value={matchesPlayed} />}
        <StatCard label="Minutos" value={formatClock(minutesSeconds)} />
        {fieldStats && (
          <>
            <StatCard label="Goles" value={fieldStats.goals} />
            <StatCard label="Lanz." value={fieldStats.shots} />
            <StatCard label="% Acierto" value={`${fieldStats.shotPct}%`} />
            {fieldStats.penaltiesTaken > 0 && (
              <>
                <StatCard label="Penaltis lanz." value={fieldStats.penaltiesTaken} />
                <StatCard label="Penaltis gol" value={fieldStats.penaltiesScored} />
                <StatCard label="% Penaltis" value={`${fieldStats.penaltyScorePct}%`} />
              </>
            )}
            <StatCard label="Pérdidas" value={fieldStats.turnovers} />
            <StatCard label="Recup." value={fieldStats.recoveries} />
            <StatCard label="Pasos" value={fieldStats.steps} />
            <StatCard label="Amarillas" value={fieldStats.yellowCards} />
            <StatCard label="Rojas" value={fieldStats.redCards} />
            <StatCard label="Azules" value={fieldStats.blueCards} />
            <StatCard label="Exclus." value={fieldStats.exclusions} />
          </>
        )}
        {gkStats && (
          <>
            <StatCard label="Lanz. recib." value={gkStats.shotsFaced} />
            <StatCard label="Paradas" value={gkStats.saves} />
            <StatCard label="Goles recib." value={gkStats.goalsConceded} />
            <StatCard label="% Paradas" value={`${gkStats.savePct}%`} />
            <StatCard label="Penaltis recib." value={gkStats.penaltiesFaced} />
            <StatCard label="Penaltis parados" value={gkStats.penaltiesSaved} />
            <StatCard label="Penaltis gol" value={gkStats.penaltiesConceded} />
            <StatCard label="% Parada penalti" value={`${gkStats.penaltySavePct}%`} />
          </>
        )}
        <StatCard label="GC en pista" value={defense.goalsAgainst} />
        <StatCard label="% Def. equipo" value={defense.attacksFaced ? `${defense.stopPct}%` : '—'} />
      </section>

      <section>
        <h3 className="mb-2 text-lg font-bold text-white">Zonas de lanzamiento</h3>
        <p className="mb-2 text-xs text-slate-500">El color indica el volumen de lanzamientos a cada zona</p>
        <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-2">
          {zoneStats.map((z) => {
            const intensity = z.shots > 0 ? 0.18 + 0.62 * (z.shots / maxZoneShots) : 0;
            return (
              <div
                key={z.zone}
                className="rounded-xl p-2 text-center text-white ring-1 ring-white/10"
                style={{ backgroundColor: `rgba(37, 99, 235, ${intensity})` }}
              >
                <p className="text-xs text-slate-300">Zona {z.zone}</p>
                <p className="font-bold">
                  {z.goals}/{z.shots}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
