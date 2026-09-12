import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppData } from '../stores/useAppData';
import { computeMatchScore, matchOutcome } from '../stats/matchStats';
import { buildTimeline } from '../stats/timeline';
import { describeEventDetail, EVENT_LABELS } from '../utils/eventLabels';
import { formatClock, formatDate } from '../utils/time';
import { MatchRosterTable } from '../components/MatchRosterTable';
import { EditSquadModal } from '../components/EditSquadModal';
import { EventEditorModal, targetFromTimelineRow, type EventEditorTarget } from '../components/EventEditorModal';
import { updateEventAndReload, deleteEventAndReload } from '../stores/eventActions';
import { dataProvider } from '../data';
import { writeOrQueue } from '../data/offline/queue';
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
    const updated = { ...match!, calledPlayerIds };
    useAppData.setState((s) => ({ matches: s.matches.map((m) => (m.id === updated.id ? updated : m)) }));
    await writeOrQueue({ collection: 'matches', method: 'upsert', payload: updated }, () => dataProvider.matches.upsert(updated));
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
        <MatchRosterTable roster={roster} matchEvents={matchEvents} elapsedSeconds={match.clock.elapsedSeconds} />
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
            const player = players.find((p) => p.id === row.event.playerId);
            const detail = describeEventDetail(row.event);
            const content = (
              <>
                <span className="w-14 font-mono text-slate-400">{formatClock(row.event.timestamp)}</span>
                <span className="flex-1 font-semibold">{player?.name ?? '—'}</span>
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
