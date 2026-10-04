import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppData } from '../stores/useAppData';
import {
  computeDefensiveOnCourtStats,
  computeFieldPlayerStats,
  computeGoalkeeperStats,
  computeMatchScore,
  matchOutcome,
} from '../stats/matchStats';
import { computeMinutesPlayed } from '../stats/onCourt';
import { formatClock, formatDate } from '../utils/time';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PlayerStatsSummary } from '../components/PlayerStatsSummary';
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

  return (
    <div className="flex flex-col gap-7 p-4 pt-6 sm:p-6">
      <div className="flex items-center gap-4">
        <PlayerAvatar playerId={player.id} name={player.name} className="h-20 w-20" />
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">{player.name}</h2>
          <p className="text-slate-400">{isGoalkeeper ? 'Portero' : 'Jugador de campo'} · Nº {player.number}</p>
        </div>
      </div>

      <PlayerStatsSummary
        player={player}
        events={events}
        minutesSeconds={totalMinutes}
        defense={defenseStats}
        matchesPlayed={playedMatches.length}
      />

      <section>
        <h3 className="mb-2 text-lg font-bold text-white">Partidos</h3>
        <p className="mb-2 text-xs text-slate-500">Toca un partido para ver sus estadísticas en él</p>
        <div className="flex flex-col gap-2">
          {playedMatches.map((m) => {
            const matchEvents = events.filter((e) => e.matchId === m.id);
            const { goalsFor, goalsAgainst } = computeMatchScore(matchEvents);
            const outcome = matchOutcome(goalsFor, goalsAgainst);
            const minutes = computeMinutesPlayed(matchEvents, player.id, m.clock.elapsedSeconds);
            let headline: string;
            if (isGoalkeeper) {
              const gk = computeGoalkeeperStats(matchEvents, player.id);
              headline = `${gk.saves}/${gk.shotsFaced} paradas`;
            } else {
              const field = computeFieldPlayerStats(matchEvents, player.id);
              headline = `${field.goals}/${field.shots} goles`;
            }
            return (
              <Link
                key={m.id}
                to={`/jugadores/${player.id}/partidos/${m.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-3 text-white ring-1 ring-white/10 transition-transform touch-manipulation active:scale-[0.99]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {formatDate(m.date)} vs {m.opponent}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatClock(minutes)} · {headline}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-3">
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
