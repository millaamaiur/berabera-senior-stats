import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppData } from '../stores/useAppData';
import { computeDefensiveOnCourtStats, computeMatchScore, matchOutcome } from '../stats/matchStats';
import { computeMinutesPlayed } from '../stats/onCourt';
import { formatDate } from '../utils/time';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PlayerStatsSummary } from '../components/PlayerStatsSummary';
import { CompactTimeline } from '../components/CompactTimeline';
import { Badge } from '../components/Badge';

/** One player's numbers in one match — reached from their profile's match list. */
export function PlayerMatchStats() {
  const { id, matchId } = useParams<{ id: string; matchId: string }>();
  const players = useAppData((s) => s.players);
  const matches = useAppData((s) => s.matches);
  const events = useAppData((s) => s.events);

  const player = players.find((p) => p.id === id);
  const match = matches.find((m) => m.id === matchId);
  const matchEvents = useMemo(() => events.filter((e) => e.matchId === matchId), [events, matchId]);

  if (!player) return <p className="p-4 text-white">Jugador no encontrado.</p>;
  if (!match) return <p className="p-4 text-white">Partido no encontrado.</p>;

  const { goalsFor, goalsAgainst } = computeMatchScore(matchEvents);
  const outcome = matchOutcome(goalsFor, goalsAgainst);
  const minutes = computeMinutesPlayed(matchEvents, player.id, match.clock.elapsedSeconds);
  const defense = computeDefensiveOnCourtStats(matchEvents, player.id);

  return (
    <div className="flex flex-col gap-7 p-4 pt-6 sm:p-6">
      <Link
        to={`/jugadores/${player.id}`}
        className="-mb-3 self-start text-sm font-semibold text-slate-400 touch-manipulation active:text-slate-200"
      >
        ← {player.name}
      </Link>

      <div className="flex flex-col gap-4 rounded-3xl bg-white/5 p-4 ring-1 ring-white/10 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <PlayerAvatar playerId={player.id} name={player.name} className="h-16 w-16 shrink-0" />
          <div className="min-w-0">
            <h2 className="truncate text-xl font-extrabold tracking-tight text-white sm:text-2xl">{player.name}</h2>
            <p className="text-sm text-slate-400">
              vs {match.opponent} · {formatDate(match.date)} · {match.competition}
            </p>
            <p className="mt-1 flex items-center gap-2">
              <span className="text-lg font-black text-white">
                {goalsFor} - {goalsAgainst}
              </span>
              {match.status === 'finished' ? (
                <Badge color={outcome === 'win' ? 'emerald' : outcome === 'loss' ? 'rose' : 'slate'}>
                  {outcome === 'win' ? 'Victoria' : outcome === 'loss' ? 'Derrota' : 'Empate'}
                </Badge>
              ) : (
                <Badge color="amber">EN VIVO</Badge>
              )}
            </p>
          </div>
        </div>
        <Link
          to={`/partidos/${match.id}`}
          className="self-start rounded-full bg-white/8 px-3.5 py-2 text-xs font-bold text-slate-200 transition-transform touch-manipulation active:scale-95 sm:self-center"
        >
          Ver partido completo
        </Link>
      </div>

      <PlayerStatsSummary player={player} events={matchEvents} minutesSeconds={minutes} defense={defense} />

      <section>
        <h3 className="mb-2 text-lg font-bold text-white">Sus acciones en el partido</h3>
        <CompactTimeline events={matchEvents} players={players} onlyPlayerId={player.id} />
      </section>
    </div>
  );
}
