import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveMatchStore } from '../stores/useLiveMatchStore';
import { useAppData } from '../stores/useAppData';
import { finishMatch, cancelMatch } from '../stores/matchActions';
import { computeMatchScore } from '../stats/matchStats';
import { getCurrentOnCourt } from '../stats/onCourt';
import { formatClock, formatDate, daysUntil } from '../utils/time';
import { LineupPicker } from '../components/LineupPicker';
import { OnCourtRoster } from '../components/OnCourtRoster';
import { SubstitutionModal } from '../components/SubstitutionModal';
import { ActionPanel } from '../components/ActionPanel';
import { ActionPanelPlaceholder } from '../components/ActionPanelPlaceholder';
import { LiveTimeline } from '../components/LiveTimeline';
import { EditSquadModal } from '../components/EditSquadModal';
import { EditMatchDateModal } from '../components/EditMatchDateModal';
import { EventEditorModal, targetFromTimelineRow, type EventEditorTarget } from '../components/EventEditorModal';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { PinLock } from '../components/PinLock';
import { useAuthStore } from '../stores/useAuthStore';

export function AnotarSession() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { ask, dialog: confirmDialog } = useConfirmDialog();
  const unlocked = useAuthStore((s) => s.unlocked);

  const match = useLiveMatchStore((s) => s.match);
  const events = useLiveMatchStore((s) => s.events);
  const selectedPlayerId = useLiveMatchStore((s) => s.selectedPlayerId);
  const undoStack = useLiveMatchStore((s) => s.undoStack);
  const loadMatch = useLiveMatchStore((s) => s.loadMatch);
  const clear = useLiveMatchStore((s) => s.clear);
  const selectPlayer = useLiveMatchStore((s) => s.selectPlayer);
  const startClock = useLiveMatchStore((s) => s.startClock);
  const pauseClock = useLiveMatchStore((s) => s.pauseClock);
  const resetClock = useLiveMatchStore((s) => s.resetClock);
  const getElapsedSeconds = useLiveMatchStore((s) => s.getElapsedSeconds);
  const toggleCourt = useLiveMatchStore((s) => s.toggleCourt);
  const undo = useLiveMatchStore((s) => s.undo);
  const updateEvent = useLiveMatchStore((s) => s.updateEvent);
  const deleteEvent = useLiveMatchStore((s) => s.deleteEvent);
  const updateCalledPlayers = useLiveMatchStore((s) => s.updateCalledPlayers);
  const updateDate = useLiveMatchStore((s) => s.updateDate);
  const syncGlobalData = useLiveMatchStore((s) => s.syncGlobalData);

  const players = useAppData((s) => s.players);
  const matches = useAppData((s) => s.matches);

  const [, forceTick] = useState(0);
  const [showSubs, setShowSubs] = useState(false);
  const [showSquad, setShowSquad] = useState(false);
  const [showEditDate, setShowEditDate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventEditorTarget | null>(null);

  useEffect(() => {
    if (matchId) loadMatch(matchId);
    return () => {
      syncGlobalData();
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    if (!match?.clock.running) return;
    const interval = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [match?.clock.running]);

  if (!unlocked) {
    return <PinLock message="Introduce el PIN para anotar este partido" />;
  }

  if (!match) {
    return <p className="p-4 text-white">Cargando partido...</p>;
  }

  const calledPlayers = players.filter((p) => match.calledPlayerIds.includes(p.id));
  const onCourtIds = getCurrentOnCourt(events);
  const onCourtPlayers = calledPlayers.filter((p) => onCourtIds.has(p.id));
  const benchPlayers = calledPlayers.filter((p) => !onCourtIds.has(p.id));
  const { goalsFor, goalsAgainst } = computeMatchScore(events);
  const selectedPlayer = onCourtPlayers.find((p) => p.id === selectedPlayerId) ?? null;

  // Once the match clock has been started for the first time we never go back
  // to the lineup picker — even after a pause/reset — substitutions take over.
  const lineupDone = match.clock.hasStartedOnce;
  const lineupComplete =
    onCourtPlayers.filter((p) => p.position === 'player').length === 6 &&
    onCourtPlayers.filter((p) => p.position === 'goalkeeper').length === 1;
  // The very first start is only allowed on match day itself; resuming after
  // a pause (lineupDone already true) is never re-blocked by the date.
  const isMatchDay = daysUntil(match.date) === 0;
  const canStart = lineupDone || (lineupComplete && isMatchDay);
  const startDisabledReason = canStart
    ? undefined
    : !lineupComplete
      ? 'Completa la alineación (6 + portero) para iniciar'
      : 'Solo puedes iniciar el partido el día programado';

  const lockedPlayerIds = new Set([...onCourtIds, ...events.map((e) => e.playerId)]);

  async function handleReset() {
    if (await ask({ title: 'Reiniciar el cronómetro', message: 'Volverá a 00:00.' })) {
      await resetClock();
    }
  }

  async function handleFinish() {
    if (!match) return;
    if (await ask({ title: 'Finalizar el partido', message: 'Podrás seguir consultando sus estadísticas.' })) {
      const elapsedSeconds = getElapsedSeconds();
      await finishMatch({ ...match, clock: { ...match.clock, elapsedSeconds } });
      navigate(`/partidos/${match.id}`);
    }
  }

  async function handleCancel() {
    if (!match) return;
    const firstConfirm = await ask({
      title: '¿Cancelar este partido?',
      message: 'Se borrarán todos los eventos registrados (goles, cambios, tarjetas...) y el partido volverá a estar sin empezar.',
      danger: true,
      confirmLabel: 'Cancelar partido',
    });
    if (!firstConfirm) return;

    const secondConfirm = await ask({
      title: 'Última confirmación',
      message: 'Esta acción no se puede deshacer. ¿Confirmas que quieres cancelar el partido?',
      danger: true,
      confirmLabel: 'Sí, cancelar',
    });
    if (!secondConfirm) return;

    await cancelMatch(match);
    navigate('/partidos');
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden p-2 sm:p-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-slate-700 bg-slate-800 p-2 sm:p-3">
        <div>
          <p className="text-xs text-slate-400 sm:text-sm">vs</p>
          <p className="text-base font-bold text-white sm:text-lg">{match.opponent}</p>
          {lineupDone ? (
            <p className="text-xs text-slate-400">{formatDate(match.date)}</p>
          ) : (
            <button
              type="button"
              onClick={() => setShowEditDate(true)}
              className="text-xs font-semibold text-amber-400 underline decoration-dotted"
            >
              {formatDate(match.date)} · editar fecha
            </button>
          )}
        </div>
        <p className="text-2xl font-black text-white sm:text-3xl">
          {goalsFor} - {goalsAgainst}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={[
              'w-20 rounded-lg border-2 bg-slate-900 px-2 py-2 text-center font-mono text-2xl transition-colors',
              match.clock.running ? 'border-emerald-500 text-emerald-400' : 'border-slate-600 text-slate-400',
            ].join(' ')}
          >
            {formatClock(getElapsedSeconds())}
          </span>
          {match.clock.running ? (
            <button type="button" onClick={() => pauseClock()} className={btnClass('slate')}>
              Pausar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => startClock()}
              disabled={!canStart}
              className={btnClass('emerald') + (canStart ? '' : ' opacity-40')}
              title={startDisabledReason}
            >
              Iniciar
            </button>
          )}
          <button type="button" onClick={handleReset} className={btnClass('slate')}>
            Reset
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowSquad(true)} className={btnClass('slate')}>
            Convocatoria
          </button>
          <button
            type="button"
            onClick={() => undo()}
            disabled={undoStack.length === 0}
            className={[
              'rounded-lg px-4 py-3 font-bold touch-manipulation',
              undoStack.length === 0 ? 'bg-slate-800 text-slate-500' : 'bg-rose-600 text-white',
            ].join(' ')}
          >
            Deshacer
          </button>
          {lineupDone && (
            <>
              <button type="button" onClick={handleCancel} className={btnClass('rose')}>
                Cancelar partido
              </button>
              <button type="button" onClick={handleFinish} className={btnClass('amber')}>
                Finalizar
              </button>
            </>
          )}
        </div>
      </div>

      {lineupDone ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-slate-700 bg-slate-800 p-3">
          <OnCourtRoster onCourtPlayers={onCourtPlayers} selectedPlayerId={selectedPlayerId} onSelectPlayer={selectPlayer} />
          <button type="button" onClick={() => setShowSubs(true)} className={btnClass('amber')}>
            Hacer cambios
          </button>
        </div>
      ) : (
        <LineupPicker calledPlayers={calledPlayers} onCourtIds={onCourtIds} onToggleCourt={toggleCourt} />
      )}

      <div className={['grid min-h-0 flex-1 grid-cols-2 gap-2 transition-opacity', lineupDone ? '' : 'opacity-50'].join(' ')}>
        <div className="min-h-0 overflow-y-auto rounded-xl border-2 border-slate-700 bg-slate-800/60 p-3">
          {selectedPlayer ? (
            <ActionPanel player={selectedPlayer} />
          ) : lineupDone ? (
            <ActionPanelPlaceholder />
          ) : (
            <p className="flex h-full items-center justify-center text-center text-slate-400">
              {startDisabledReason ?? 'Pulsa "Iniciar" para empezar el partido'}
            </p>
          )}
        </div>
        <div className="min-h-0 overflow-y-auto rounded-xl border-2 border-slate-700 bg-slate-800/60 p-3">
          <LiveTimeline
            events={events}
            players={players}
            onRowClick={(row) => setEditingEvent(targetFromTimelineRow(row, players))}
          />
        </div>
      </div>

      {showSubs && (
        <SubstitutionModal
          onCourtPlayers={onCourtPlayers}
          benchPlayers={benchPlayers}
          onToggleCourt={toggleCourt}
          onClose={() => setShowSubs(false)}
        />
      )}

      {showSquad && (
        <EditSquadModal
          allPlayers={players.filter((p) => p.active)}
          calledPlayerIds={match.calledPlayerIds}
          lockedPlayerIds={lockedPlayerIds}
          onSave={updateCalledPlayers}
          onClose={() => setShowSquad(false)}
        />
      )}

      {editingEvent && (
        <EventEditorModal
          target={editingEvent}
          onUpdateEvent={updateEvent}
          onDeleteEvent={deleteEvent}
          onClose={() => setEditingEvent(null)}
        />
      )}

      {showEditDate && (
        <EditMatchDateModal
          match={match}
          allMatches={matches}
          onSave={updateDate}
          onClose={() => setShowEditDate(false)}
        />
      )}

      {confirmDialog}
    </div>
  );
}

function btnClass(color: 'slate' | 'emerald' | 'rose' | 'amber'): string {
  const colors: Record<string, string> = {
    slate: 'bg-slate-700 text-white',
    emerald: 'bg-emerald-500 text-slate-900',
    rose: 'bg-rose-600 text-white',
    amber: 'bg-amber-500 text-slate-900',
  };
  return `rounded-lg px-4 py-3 font-bold touch-manipulation ${colors[color]}`;
}
