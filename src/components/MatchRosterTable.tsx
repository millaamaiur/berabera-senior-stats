import { Link } from 'react-router-dom';
import type { MatchEvent, Player } from '../domain/types';
import { computeDefensiveOnCourtStats, computeFieldPlayerStats, computeGoalkeeperStats } from '../stats/matchStats';
import { computeMinutesPlayed } from '../stats/onCourt';
import { formatClock } from '../utils/time';
import { PlayerAvatar } from './PlayerAvatar';

interface MatchRosterTableProps {
  roster: Player[];
  matchEvents: MatchEvent[];
  elapsedSeconds: number;
}

/** Per-player stats for a single match — shared by the match detail screen and the halftime summary. */
export function MatchRosterTable({ roster, matchEvents, elapsedSeconds }: MatchRosterTableProps) {
  return (
    <div className="flex flex-col gap-2">
      {roster.map((p) => {
        const minutes = computeMinutesPlayed(matchEvents, p.id, elapsedSeconds);
        const def = computeDefensiveOnCourtStats(matchEvents, p.id);
        const isGk = p.position === 'goalkeeper';
        const gk = isGk ? computeGoalkeeperStats(matchEvents, p.id) : null;
        const fs = !isGk ? computeFieldPlayerStats(matchEvents, p.id) : null;
        return (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5 ring-1 ring-white/10">
            <Link to={`/jugadores/${p.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
              <PlayerAvatar playerId={p.id} name={p.name} className="h-9 w-9" />
              <div className="min-w-0">
                <p className="truncate font-bold text-amber-400">{p.name}</p>
                <p className="truncate text-xs text-slate-400">
                  {formatClock(minutes)} ·{' '}
                  {gk
                    ? `${gk.saves}/${gk.shotsFaced} paradas`
                    : `${fs!.goals}/${fs!.shots} goles · ${fs!.turnovers} pérd. · ${fs!.recoveries} recup.`}
                </p>
              </div>
            </Link>
            <div className="flex shrink-0 flex-col items-center text-xs text-slate-400">
              <span className="font-bold text-white">{def.goalsAgainst}</span>
              <span>GC pista</span>
            </div>
            <div className="flex shrink-0 flex-col items-center text-xs text-slate-400">
              <span className="font-bold text-white">{def.attacksFaced ? `${def.stopPct}%` : '—'}</span>
              <span>% Def.</span>
            </div>
          </div>
        );
      })}
      {roster.length === 0 && <p className="p-2 text-slate-400">Sin jugadores convocados.</p>}
    </div>
  );
}
