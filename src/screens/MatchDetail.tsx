import { useMemo, useState } from 'react';
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
import { buildTimeline } from '../stats/timeline';
import { describeEventDetail, EVENT_LABELS, playerLabelFor } from '../utils/eventLabels';
import { formatClock, formatDate } from '../utils/time';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { EditSquadModal } from '../components/EditSquadModal';
import { EventEditorModal, targetFromTimelineRow, type EventEditorTarget } from '../components/EventEditorModal';
import { updateEventAndReload, deleteEventAndReload } from '../stores/eventActions';
import { dataProvider } from '../data';
import { useAuthStore } from '../stores/useAuthStore';

export function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const matches = useAppData((s) => s.matches);
  const players = useAppData((s) => s.players);
  const events = useAppData((s) => s.events);
  const [showSquad, setShowSquad] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventEditorTarget | null>(null);
  const unlocked = useAuthStore((s) => s.unlocked);

  const match = matches.find((m) => m.id === id);
  const matchEvents = useMemo(() => events.filter((e) => e.matchId === id).sort((a, b) => a.timestamp - b.timestamp), [
    events,
    id,
  ]);

  if (!match) return <p className="p-4 text-white">Partido no encontrado.</p>;

  const { goalsFor, goalsAgainst } = computeMatchScore(matchEvents);
  const outcome = matchOutcome(goalsFor, goalsAgainst);
  const roster = players.filter((p) => match.calledPlayerIds.includes(p.id));
  const onCourtIdsAtEnd = new Set(matchEvents.filter((e) => e.eventType === 'court_change').map((e) => e.playerId));
  const lockedPlayerIds = new Set([...onCourtIdsAtEnd, ...matchEvents.map((e) => e.playerId)]);

  async function handleSaveSquad(calledPlayerIds: string[]) {
    await dataProvider.matches.upsert({ ...match!, calledPlayerIds });
    await useAppData.getState().reload();
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div>
        <h2 className="text-2xl font-bold text-white">Bera Bera Senior vs {match.opponent}</h2>
        <p className="text-slate-400">
          {formatDate(match.date)} · {match.competition} · {match.isHome ? 'Casa' : 'Fuera'}
        </p>
        <p className="mt-2 text-4xl font-black text-white">
          {goalsFor} - {goalsAgainst}
          <span className="ml-3 text-base font-semibold text-amber-400">
            {outcome === 'win' ? 'Victoria' : outcome === 'loss' ? 'Derrota' : 'Empate'}
          </span>
        </p>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Jugadores convocados</h3>
          {unlocked && (
            <button
              type="button"
              onClick={() => setShowSquad(true)}
              className="rounded-lg border-2 border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-300"
            >
              Editar convocatoria
            </button>
          )}
        </div>
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
                const minutes = computeMinutesPlayed(matchEvents, p.id, match.clock.elapsedSeconds);
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
                      <td className="p-2 text-right">{gk.penaltiesSaved}/{gk.penaltiesFaced} penaltis</td>
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
                      {fs.turnovers} pérd. · {fs.assists} asist.
                    </td>
                    <td className="p-2 text-right">{def.goalsAgainst}</td>
                    <td className="p-2 text-right">{def.attacksFaced ? `${def.stopPct}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-lg font-bold text-white">Timeline</h3>
        <div className="flex flex-col gap-1">
          {buildTimeline(matchEvents, players).map((row) => {
            const rowClass = 'flex items-center gap-3 rounded-lg bg-slate-800 px-3 py-2 text-left text-sm text-white';
            if (row.kind === 'substitution') {
              const content = (
                <>
                  <span className="w-14 font-mono text-slate-400">{formatClock(row.timestamp)}</span>
                  <span className="flex flex-1 items-center gap-1.5">
                    <span className="font-bold text-rose-400">↓</span>
                    <span>{row.playerOut.name}</span>
                    <span className="font-bold text-emerald-400">↑</span>
                    <span>{row.playerIn.name}</span>
                  </span>
                  <span className="text-slate-500">Cambio</span>
                </>
              );
              return unlocked ? (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setEditingEvent(targetFromTimelineRow(row, players))}
                  className={rowClass}
                >
                  {content}
                </button>
              ) : (
                <div key={row.id} className={rowClass}>
                  {content}
                </div>
              );
            }
            const detail = describeEventDetail(row.event);
            const content = (
              <>
                <span className="w-14 font-mono text-slate-400">{formatClock(row.event.timestamp)}</span>
                <span className="flex-1 font-semibold">{playerLabelFor(row.event, players)}</span>
                <span className="text-slate-300">{EVENT_LABELS[row.event.eventType]}</span>
                {detail && <span className="text-slate-400">{detail}</span>}
              </>
            );
            return unlocked ? (
              <button
                key={row.id}
                type="button"
                onClick={() => setEditingEvent(targetFromTimelineRow(row, players))}
                className={rowClass}
              >
                {content}
              </button>
            ) : (
              <div key={row.id} className={rowClass}>
                {content}
              </div>
            );
          })}
          {matchEvents.length === 0 && <p className="text-slate-400">Sin eventos registrados.</p>}
        </div>
      </section>

      {showSquad && (
        <EditSquadModal
          allPlayers={players.filter((p) => p.active)}
          calledPlayerIds={match.calledPlayerIds}
          lockedPlayerIds={lockedPlayerIds}
          onSave={handleSaveSquad}
          onClose={() => setShowSquad(false)}
        />
      )}

      {editingEvent && (
        <EventEditorModal
          target={editingEvent}
          onUpdateEvent={updateEventAndReload}
          onDeleteEvent={deleteEventAndReload}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  );
}
