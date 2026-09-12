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
    <div className="overflow-x-auto rounded-xl border-2 border-slate-700">
      <table className="w-full text-left text-sm text-white">
        <thead className="bg-slate-800 text-slate-300">
          <tr>
            <th className="p-2">Jugador</th>
            <th className="p-2 text-right">Minutos</th>
            <th className="p-2 text-right">Goles/Lanz.</th>
            <th className="p-2 text-right">Otros</th>
            <th className="p-2 text-right">GC en pista</th>
            <th className="p-2 text-right">% Def.</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((p) => {
            const minutes = computeMinutesPlayed(matchEvents, p.id, elapsedSeconds);
            const def = computeDefensiveOnCourtStats(matchEvents, p.id);
            if (p.position === 'goalkeeper') {
              const gk = computeGoalkeeperStats(matchEvents, p.id);
              return (
                <tr key={p.id} className="border-t border-slate-700 odd:bg-slate-900 even:bg-slate-800/60">
                  <td className="p-2">
                    <Link to={`/jugadores/${p.id}`} className="flex items-center gap-2 font-semibold text-amber-400">
                      <PlayerAvatar playerId={p.id} name={p.name} className="h-8 w-8" />
                      {p.name}
                    </Link>
                  </td>
                  <td className="p-2 text-right">{formatClock(minutes)}</td>
                  <td className="p-2 text-right">
                    {gk.saves}/{gk.shotsFaced} paradas
                  </td>
                  <td className="p-2 text-right">{gk.penaltiesSaved}/{gk.penaltiesFaced} penaltis parados</td>
                  <td className="p-2 text-right">{def.goalsAgainst}</td>
                  <td className="p-2 text-right">{def.attacksFaced ? `${def.stopPct}%` : '—'}</td>
                </tr>
              );
            }
            const fs = computeFieldPlayerStats(matchEvents, p.id);
            return (
              <tr key={p.id} className="border-t border-slate-700 odd:bg-slate-900 even:bg-slate-800/60">
                <td className="p-2">
                  <Link to={`/jugadores/${p.id}`} className="flex items-center gap-2 font-semibold text-amber-400">
                    <PlayerAvatar playerId={p.id} name={p.name} className="h-8 w-8" />
                    {p.name}
                  </Link>
                </td>
                <td className="p-2 text-right">{formatClock(minutes)}</td>
                <td className="p-2 text-right">
                  {fs.goals}/{fs.shots}
                </td>
                <td className="p-2 text-right">
                  {fs.turnovers} pérd. · {fs.assists} asist. · {fs.recoveries} recup.
                </td>
                <td className="p-2 text-right">{def.goalsAgainst}</td>
                <td className="p-2 text-right">{def.attacksFaced ? `${def.stopPct}%` : '—'}</td>
              </tr>
            );
          })}
          {roster.length === 0 && (
            <tr>
              <td colSpan={6} className="p-2 text-center text-slate-400">
                Sin jugadores convocados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
