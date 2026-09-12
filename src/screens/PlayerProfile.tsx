import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppData } from '../stores/useAppData';
import {
  computeDefensiveOnCourtStats,
  computeFieldPlayerStats,
  computeGoalkeeperStats,
  computeMatchScore,
  computeZoneStats,
  matchOutcome,
} from '../stats/matchStats';
import { computeMinutesPlayed } from '../stats/onCourt';
import { formatClock, formatDate } from '../utils/time';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';

export function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const players = useAppData((s) => s.players);
  const matches = useAppData((s) => s.matches);
  const events = useAppData((s) => s.events);

  const player = players.find((p) => p.id === id);

  const totalMinutes = useMemo(() => {
    if (!player) return 0;
    return matches.reduce((sum, m) => {
      const matchEvents = events.filter((e) => e.matchId === m.id);
      return sum + computeMinutesPlayed(matchEvents, player.id, m.clock.elapsedSeconds);
    }, 0);
  }, [player, matches, events]);

  const playedMatches = useMemo(
    () =>
      matches.filter(
        (m) => player && m.calledPlayerIds.includes(player.id) && (m.status === 'finished' || m.clock.hasStartedOnce)
      ),
    [matches, player]
  );

  const defenseStats = useMemo(() => {
    if (!player) return { attacksFaced: 0, goalsAgainst: 0, stopped: 0, stopPct: 0 };
    let goalsAgainst = 0;
    let stopped = 0;
    for (const m of matches) {
      const matchEvents = events.filter((e) => e.matchId === m.id);
      const s = computeDefensiveOnCourtStats(matchEvents, player.id);
      goalsAgainst += s.goalsAgainst;
      stopped += s.stopped;
    }
    const attacksFaced = goalsAgainst + stopped;
    return { attacksFaced, goalsAgainst, stopped, stopPct: attacksFaced ? Math.round((stopped / attacksFaced) * 100) : 0 };
  }, [player, matches, events]);

  if (!player) {
    return <p className="p-4 text-white">Jugador no encontrado.</p>;
  }

  const isGoalkeeper = player.position === 'goalkeeper';
  const fieldStats = !isGoalkeeper ? computeFieldPlayerStats(events, player.id) : null;
  const gkStats = isGoalkeeper ? computeGoalkeeperStats(events, player.id) : null;
  const zoneStats = computeZoneStats(events, player.id, isGoalkeeper ? 'gk_shot' : 'shot');
  const maxZoneShots = Math.max(1, ...zoneStats.map((z) => z.shots));

  return (
    <div className="flex flex-col gap-7 p-4 pt-6 sm:p-6">
      <div className="flex items-center gap-4">
        <PlayerAvatar playerId={player.id} name={player.name} className="h-20 w-20" />
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">{player.name}</h2>
          <p className="text-slate-400">{isGoalkeeper ? 'Portero' : 'Jugador de campo'} · Nº {player.number}</p>
        </div>
      </div>

      <section className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <StatCard label="Partidos" value={playedMatches.length} />
        <StatCard label="Minutos" value={formatClock(totalMinutes)} />
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
        <StatCard label="GC en pista" value={defenseStats.goalsAgainst} />
        <StatCard label="% Def. equipo" value={defenseStats.attacksFaced ? `${defenseStats.stopPct}%` : '—'} />
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

      <section>
        <h3 className="mb-2 text-lg font-bold text-white">Partidos</h3>
        <div className="flex flex-col gap-2">
          {playedMatches.map((m) => {
            const matchEvents = events.filter((e) => e.matchId === m.id);
            const { goalsFor, goalsAgainst } = computeMatchScore(matchEvents);
            const outcome = matchOutcome(goalsFor, goalsAgainst);
            return (
              <Link
                key={m.id}
                to={`/partidos/${m.id}`}
                className="flex items-center justify-between rounded-2xl bg-white/5 p-3 text-white ring-1 ring-white/10 transition-transform touch-manipulation active:scale-[0.99]"
              >
                <span className="font-semibold">
                  {formatDate(m.date)} vs {m.opponent}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-sm text-slate-400">
                    {goalsFor} - {goalsAgainst}
                  </span>
                  {m.status === 'finished' ? (
                    <Badge color={outcome === 'win' ? 'emerald' : outcome === 'loss' ? 'rose' : 'slate'}>
                      {outcome === 'win' ? 'V' : outcome === 'loss' ? 'D' : 'E'}
                    </Badge>
                  ) : (
                    <Badge color="amber">EN VIVO</Badge>
                  )}
                </span>
              </Link>
            );
          })}
          {playedMatches.length === 0 && <p className="p-2 text-slate-400">Sin partidos todavía.</p>}
        </div>
      </section>
    </div>
  );
}
