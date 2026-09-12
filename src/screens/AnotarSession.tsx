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
import { MatchRosterTable } from '../components/MatchRosterTable';
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
  const loadMatch = useLiveMatchStore((s) => s.loadMatch);
  const clear = useLiveMatchStore((s) => s.clear);
  const selectPlayer = useLiveMatchStore((s) => s.selectPlayer);
  const startClock = useLiveMatchStore((s) => s.startClock);
  const pauseClock = useLiveMatchStore((s) => s.pauseClock);
  const checkHalftime = useLiveMatchStore((s) => s.checkHalftime);
  const getElapsedSeconds = useLiveMatchStore((s) => s.getElapsedSeconds);
  const toggleCourt = useLiveMatchStore((s) => s.toggleCourt);
  const confirmSubstitution = useLiveMatchStore((s) => s.confirmSubstitution);
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
  const [dismissedHalftimeStats, setDismissedHalftimeStats] = useState(false);

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
    const interval = setInterval(() => {
      forceTick((t) => t + 1);
      checkHalftime();
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.clock.running]);

  // Ready to show the halftime summary again next time (e.g. after cancelling
  // the match) as soon as we're no longer sitting at a reached-but-not-yet-passed halftime.
  useEffect(() => {
    if (!match?.clock.halftimeReached) setDismissedHalftimeStats(false);
  }, [match?.clock.halftimeReached]);

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
  // to the lineup picker — even after a pause — substitutions take over.
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
  const showSecondHalfPrompt = match.clock.halftimeReached && !match.clock.secondHalfStarted && !match.clock.running;
  const showHalftimeScreen = showSecondHalfPrompt && !dismissedHalftimeStats;

  const lockedPlayerIds = new Set([...onCourtIds, ...events.map((e) => e.playerId)]);

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

  if (showHalftimeScreen) {
    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto p-2 sm:p-3">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/5 p-3 ring-1 ring-amber-500/40">
          <div>
            <p className="text-xs font-bold text-amber-400">DESCANSO</p>
            <p className="text-lg font-bold text-white">vs {match.opponent}</p>
          </div>
          <p className="text-3xl font-black text-white">
            {goalsFor} - {goalsAgainst}
          </p>
          <button type="button" onClick={() => setDismissedHalftimeStats(true)} className={btnClass('amber')}>
            Pasar a segunda parte
          </button>
        </div>
        <p className="text-sm text-slate-400">Estadísticas del partido hasta el descanso:</p>
        <MatchRosterTable roster={calledPlayers} matchEvents={events} elapsedSeconds={match.clock.elapsedSeconds} />
        {confirmDialog}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden p-2 sm:p-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10 sm:p-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/partidos')}
            disabled={match.clock.running}
            className={[
              'rounded-full px-3 py-3 text-sm font-semibold ring-1 touch-manipulation',
              match.clock.running ? 'text-slate-600 ring-white/5' : 'text-slate-300 ring-white/10 active:bg-white/5',
            ].join(' ')}
            title={match.clock.running ? 'Pausa el partido antes de salir' : undefined}
          >
            ← Salir
          </button>
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
        </div>
        <p className="text-2xl font-black text-white sm:text-3xl">
          {goalsFor} - {goalsAgainst}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <span
              className={[
                'w-20 rounded-xl bg-black/30 px-2 py-2 text-center font-mono text-2xl ring-1 transition-colors',
                match.clock.running ? 'text-emerald-400 ring-emerald-500/50' : 'text-slate-400 ring-white/10',
              ].join(' ')}
            >
              {formatClock(getElapsedSeconds())}
            </span>
            {showSecondHalfPrompt && <span className="mt-0.5 text-[0.65rem] font-bold text-amber-400">DESCANSO</span>}
          </div>
          {match.clock.running ? (
            <button type="button" onClick={() => pauseClock()} className={btnClass('slate')}>
              Pausar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => startClock()}
              disabled={!canStart}
              className={btnClass(showSecondHalfPrompt ? 'amber' : 'emerald') + (canStart ? '' : ' opacity-40')}
              title={startDisabledReason}
            >
              {showSecondHalfPrompt ? 'Iniciar segunda parte' : 'Iniciar'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowSquad(true)} className={btnClass('slate')}>
            Convocatoria
          </button>
          <button
            type="button"
            onClick={() => undo()}
            disabled={events.length === 0}
            className={[
              'rounded-full px-4 py-3 font-bold shadow-lg transition-transform touch-manipulation active:scale-95',
              events.length === 0 ? 'bg-white/5 text-slate-500 shadow-none' : 'bg-rose-500 text-white shadow-rose-500/20',
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
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          <OnCourtRoster onCourtPlayers={onCourtPlayers} selectedPlayerId={selectedPlayerId} onSelectPlayer={selectPlayer} />
          <button type="button" onClick={() => setShowSubs(true)} className={btnClass('amber')}>
            Hacer cambios
          </button>
        </div>
      ) : (
        <LineupPicker calledPlayers={calledPlayers} onCourtIds={onCourtIds} onToggleCourt={toggleCourt} />
      )}

      <div className={['grid min-h-0 flex-1 grid-cols-2 gap-2 transition-opacity', lineupDone ? '' : 'opacity-50'].join(' ')}>
        <div className="min-h-0 overflow-y-auto rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
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
        <div className="min-h-0 overflow-y-auto rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
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
          onConfirm={confirmSubstitution}
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
    slate: 'bg-white/8 text-white shadow-none',
    emerald: 'bg-emerald-500 text-slate-900 shadow-emerald-500/20',
    rose: 'bg-rose-500 text-white shadow-rose-500/20',
    amber: 'bg-amber-500 text-slate-900 shadow-amber-500/20',
  };
  return `rounded-full px-4 py-3 font-bold shadow-lg transition-transform touch-manipulation active:scale-95 ${colors[color]}`;
}
