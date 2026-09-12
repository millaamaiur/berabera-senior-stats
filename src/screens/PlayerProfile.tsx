import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppData } from '../stores/useAppData';
import { computeDefensiveOnCourtStats, computeFieldPlayerStats, computeGoalkeeperStats, computeZoneStats } from '../stats/matchStats';
import { computeMinutesPlayed } from '../stats/onCourt';
import { formatClock, formatDate } from '../utils/time';
import { PlayerAvatar } from '../components/PlayerAvatar';

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
    () => matches.filter((m) => player && m.calledPlayerIds.includes(player.id)),
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
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <PlayerAvatar playerId={player.id} name={player.name} className="h-20 w-20 border-4" />
        <div>
          <h2 className="text-2xl font-bold text-white">{player.name}</h2>
          <p className="text-slate-400">{isGoalkeeper ? 'Portero' : 'Jugador de campo'} · Nº {player.number}</p>
        </div>
      </div>

      <section className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat label="Partidos" value={playedMatches.length} />
        <Stat label="Minutos" value={formatClock(totalMinutes)} />
        {fieldStats && (
          <>
            <Stat label="Goles" value={fieldStats.goals} />
            <Stat label="Lanz." value={fieldStats.shots} />
            <Stat label="% Acierto" value={`${fieldStats.shotPct}%`} />
            {fieldStats.penaltiesTaken > 0 && (
              <>
                <Stat label="Penaltis lanz." value={fieldStats.penaltiesTaken} />
                <Stat label="Penaltis gol" value={fieldStats.penaltiesScored} />
                <Stat label="% Penaltis" value={`${fieldStats.penaltyScorePct}%`} />
              </>
            )}
            <Stat label="Asist." value={fieldStats.assists} />
            <Stat label="Pérdidas" value={fieldStats.turnovers} />
            <Stat label="Recup." value={fieldStats.recoveries} />
            <Stat label="Pasos" value={fieldStats.steps} />
            <Stat label="Amarillas" value={fieldStats.yellowCards} />
            <Stat label="Rojas" value={fieldStats.redCards} />
            <Stat label="Azules" value={fieldStats.blueCards} />
            <Stat label="Exclus." value={fieldStats.exclusions} />
          </>
        )}
        {gkStats && (
          <>
            <Stat label="Lanz. recib." value={gkStats.shotsFaced} />
            <Stat label="Paradas" value={gkStats.saves} />
            <Stat label="Goles recib." value={gkStats.goalsConceded} />
            <Stat label="% Paradas" value={`${gkStats.savePct}%`} />
            <Stat label="Penaltis recib." value={gkStats.penaltiesFaced} />
            <Stat label="Penaltis parados" value={gkStats.penaltiesSaved} />
            <Stat label="Penaltis gol" value={gkStats.penaltiesConceded} />
            <Stat label="% Parada penalti" value={`${gkStats.penaltySavePct}%`} />
          </>
        )}
        <Stat label="GC en pista" value={defenseStats.goalsAgainst} />
        <Stat label="% Def. equipo" value={defenseStats.attacksFaced ? `${defenseStats.stopPct}%` : '—'} />
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
                className="rounded-lg border-2 border-slate-700 p-2 text-center text-white"
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
          {playedMatches.map((m) => (
            <Link
              key={m.id}
              to={`/partidos/${m.id}`}
              className="flex items-center justify-between rounded-xl border-2 border-slate-700 bg-slate-800 p-3 text-white"
            >
              <span>
                {formatDate(m.date)} vs {m.opponent}
              </span>
              <span className="text-slate-400">{m.status}</span>
            </Link>
          ))}
          {playedMatches.length === 0 && <p className="text-slate-400">Sin partidos todavía.</p>}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border-2 border-slate-700 bg-slate-800 p-2 text-center">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[0.65rem] text-slate-400">{label}</p>
    </div>
  );
}
