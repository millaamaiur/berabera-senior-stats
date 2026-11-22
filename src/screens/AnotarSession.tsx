import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { COURT_LIMITS, useLiveMatchStore } from '../stores/useLiveMatchStore';
import { useAppData } from '../stores/useAppData';
import { finishMatch, cancelMatch } from '../stores/matchActions';
import { computeMatchScore } from '../stats/matchStats';
import { getCurrentOnCourt } from '../stats/onCourt';
import { getCourtSpots } from '../stats/courtSpots';
import { formatClock, formatDate, daysUntil } from '../utils/time';
import { formatScore } from '../utils/score';
import { ActionBar, type ActionKind } from '../components/ActionBar';
import { ActionPanel, type StagedAction } from '../components/ActionPanel';
import { CourtPanel } from '../components/CourtPanel';
import { LiveTimeline } from '../components/LiveTimeline';
import { EditSquadModal } from '../components/EditSquadModal';
import { EditMatchDateModal } from '../components/EditMatchDateModal';
import { MatchRosterTable } from '../components/MatchRosterTable';
import { EventEditorModal, targetFromTimelineRow, type EventEditorTarget } from '../components/EventEditorModal';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { PinLock } from '../components/PinLock';
import { useAuthStore } from '../stores/useAuthStore';
import { useToast } from '../stores/useToast';
import type { CourtSpot, Phase, Player } from '../domain/types';
import type { PairView } from '../components/AttackDefenseBar';

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
  const checkPeriodEnd = useLiveMatchStore((s) => s.checkPeriodEnd);
  const getElapsedSeconds = useLiveMatchStore((s) => s.getElapsedSeconds);
  const toggleCourt = useLiveMatchStore((s) => s.toggleCourt);
  const confirmSubstitution = useLiveMatchStore((s) => s.confirmSubstitution);
  const recordSimpleEvent = useLiveMatchStore((s) => s.recordSimpleEvent);
  const undo = useLiveMatchStore((s) => s.undo);
  const updateEvent = useLiveMatchStore((s) => s.updateEvent);
  const deleteEvent = useLiveMatchStore((s) => s.deleteEvent);
  const updateCalledPlayers = useLiveMatchStore((s) => s.updateCalledPlayers);
  const updateDate = useLiveMatchStore((s) => s.updateDate);
  const syncGlobalData = useLiveMatchStore((s) => s.syncGlobalData);
  const adPairs = useLiveMatchStore((s) => s.adPairs);
  const setAdPairs = useLiveMatchStore((s) => s.setAdPairs);
  const switchAttackDefense = useLiveMatchStore((s) => s.switchAttackDefense);

  const players = useAppData((s) => s.players);
  const matches = useAppData((s) => s.matches);

  const [, forceTick] = useState(0);
  const [subsMode, setSubsMode] = useState(false);
  const [pendingAction, setPendingAction] = useState<StagedAction | null>(null);
  const [showSquad, setShowSquad] = useState(false);
  const [showEditDate, setShowEditDate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventEditorTarget | null>(null);
  const [showHalftimeStats, setShowHalftimeStats] = useState(false);

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
      checkPeriodEnd();
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Opt-in rather than shown automatically at 30:00: taking over the screen the
  // moment the clock paused threw away any play still being recorded.
  const showHalftimeScreen = showSecondHalfPrompt && showHalftimeStats;
  const atFullTime = match.clock.fullTimeReached === true && !match.clock.running;

  const lockedPlayerIds = new Set([...onCourtIds, ...events.map((e) => e.playerId)]);

  const courtSpots = new Map<CourtSpot, Player>();
  for (const [spot, playerId] of getCourtSpots(events, players)) {
    const player = onCourtPlayers.find((p) => p.id === playerId);
    if (player) courtSpots.set(spot, player);
  }
  const courtMode = !lineupDone ? 'lineup' : subsMode ? 'subs' : 'actions';

  // Attack-defense pairs, as players. The court's phase is read off who's on
  // court: the first pair with exactly one of its two playing says which.
  const pairs: PairView[] = adPairs.flatMap((p) => {
    const attacker = calledPlayers.find((pl) => pl.id === p.attackerId);
    const defender = calledPlayers.find((pl) => pl.id === p.defenderId);
    return attacker && defender ? [{ attacker, defender }] : [];
  });
  const phasePair = pairs.find((p) => onCourtIds.has(p.attacker.id) !== onCourtIds.has(p.defender.id));
  const phase: Phase | null = phasePair ? (onCourtIds.has(phasePair.attacker.id) ? 'attack' : 'defense') : null;
  // Someone waiting on the bench for their pair's turn comes on with the switch, not as a substitute.
  const pairedIds = new Set(pairs.flatMap((p) => [p.attacker.id, p.defender.id]));
  const pickableBench = lineupDone ? benchPlayers.filter((p) => !pairedIds.has(p.id)) : benchPlayers;

  function createPair(onCourt: Player, partner: Player, role: Phase) {
    const pair = role === 'attack' ? { attackerId: onCourt.id, defenderId: partner.id } : { attackerId: partner.id, defenderId: onCourt.id };
    setAdPairs([...adPairs, pair]);
    useToast.getState().show(`Pareja ${onCourt.number} ⇄ ${partner.number}`);
  }

  async function removePair(pair: PairView) {
    const staying = [pair.attacker, pair.defender].find((p) => onCourtIds.has(p.id));
    const confirmed = await ask({
      title: `¿Quitar la pareja ${pair.attacker.number} ⇄ ${pair.defender.number}?`,
      message: staying
        ? `Dejáis de hacer este cambio. ${staying.name} se queda en pista.`
        : 'Dejáis de hacer este cambio.',
      confirmLabel: 'Quitar pareja',
    });
    if (!confirmed) return;
    setAdPairs(adPairs.filter((p) => !(p.attackerId === pair.attacker.id && p.defenderId === pair.defender.id)));
  }

  function handleAction(kind: ActionKind) {
    if (!selectedPlayer) return;
    if (kind === 'turnover' || kind === 'recovery') {
      // Nothing else to ask: record it and leave the court ready for the next play.
      const playerId = selectedPlayer.id;
      finishAction();
      void recordSimpleEvent(playerId, kind);
      return;
    }
    setPendingAction(kind);
  }

  function finishAction() {
    setPendingAction(null);
    selectPlayer(null);
  }

  function toggleSubsMode() {
    finishAction();
    setSubsMode((on) => !on);
  }

  async function fillSpot(spot: CourtSpot, incoming: Player, outgoing: Player | null) {
    if (!lineupDone) {
      // Not awaited: the exit is already on screen before it uploads, so the
      // entry right after it sees the freed place without waiting on the network.
      const leaving = outgoing ? toggleCourt(outgoing.id) : null;
      const entered = await toggleCourt(incoming.id, spot);
      await leaving;
      if (!entered) {
        useToast
          .getState()
          .show(incoming.position === 'goalkeeper' ? 'Ya hay un portero titular' : `Ya hay ${COURT_LIMITS.player} titulares de campo`);
      }
      return;
    }
    // The one coming on takes the exact spot of the one going off — and, if
    // that player was in an attack-defense pair, their place in it too.
    if (outgoing && pairedIds.has(outgoing.id)) {
      setAdPairs(
        adPairs.map((p) => ({
          attackerId: p.attackerId === outgoing.id ? incoming.id : p.attackerId,
          defenderId: p.defenderId === outgoing.id ? incoming.id : p.defenderId,
        }))
      );
    }
    const rejected = await confirmSubstitution(outgoing ? [outgoing.id] : [], [incoming.id], { [incoming.id]: spot });
    if (rejected.length > 0) useToast.getState().show(`${incoming.name} no ha podido entrar: no había hueco libre`);
  }

  async function clearSpot(player: Player) {
    await toggleCourt(player.id);
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

  if (showHalftimeScreen) {
    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto p-2 sm:p-3">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/5 p-3 ring-1 ring-amber-500/40">
          <div>
            <p className="text-xs font-bold text-amber-400">DESCANSO</p>
            <p className="text-lg font-bold text-white">vs {match.opponent}</p>
          </div>
          <p className="text-3xl font-black text-white">{formatScore(match.isHome, goalsFor, goalsAgainst)}</p>
          <button type="button" onClick={() => setShowHalftimeStats(false)} className={btnClass('amber')}>
            Volver a anotar
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
        <p className="text-2xl font-black text-white sm:text-3xl">{formatScore(match.isHome, goalsFor, goalsAgainst)}</p>
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
            {atFullTime && <span className="mt-0.5 text-[0.65rem] font-bold text-amber-400">FINAL</span>}
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
              className={
                btnClass(showSecondHalfPrompt ? 'amber' : atFullTime ? 'slate' : 'emerald') + (canStart ? '' : ' opacity-40')
              }
              title={atFullTime ? 'Solo si el partido va a prórroga' : startDisabledReason}
            >
              {showSecondHalfPrompt ? 'Iniciar segunda parte' : atFullTime ? 'Prórroga' : 'Iniciar'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showSecondHalfPrompt && (
            <button type="button" onClick={() => setShowHalftimeStats(true)} className={btnClass('slate')}>
              Stats descanso
            </button>
          )}
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
        <ActionBar
          player={selectedPlayer}
          activeAction={pendingAction}
          subsMode={subsMode}
          onAction={handleAction}
          onToggleSubs={toggleSubsMode}
        />
      ) : (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/5 p-3 ring-1 ring-amber-500/30">
          <div>
            <p className="text-lg font-bold text-white">Elige la alineación inicial</p>
            <p className="text-sm text-slate-400">
              {startDisabledReason ?? 'Alineación completa · pulsa «Iniciar» cuando empiece el partido'}
            </p>
          </div>
          <span className="rounded-full bg-black/30 px-3 py-1 text-sm font-semibold text-amber-300">
            Titulares: {onCourtPlayers.filter((p) => p.position === 'player').length}/{COURT_LIMITS.player} +{' '}
            {onCourtPlayers.filter((p) => p.position === 'goalkeeper').length}/{COURT_LIMITS.goalkeeper} portero
          </span>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
        <div className="min-h-0 overflow-y-auto rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          {lineupDone && selectedPlayer && pendingAction ? (
            <ActionPanel
              key={`${selectedPlayer.id}-${pendingAction}`}
              player={selectedPlayer}
              action={pendingAction}
              onDone={finishAction}
              onCancel={() => setPendingAction(null)}
            />
          ) : (
            <CourtPanel
              key={courtMode}
              mode={courtMode}
              spots={courtSpots}
              benchPlayers={pickableBench}
              selectedPlayerId={selectedPlayerId}
              onSelectPlayer={selectPlayer}
              onFillSpot={fillSpot}
              onClearSpot={clearSpot}
              attackDefense={{
                pairs,
                phase,
                onSwitch: (to) => void switchAttackDefense(to),
                onTapPair: (pair) => void removePair(pair),
                onCreatePair: createPair,
              }}
            />
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
