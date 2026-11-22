import { create } from 'zustand';
import { dataProvider } from '../data';
import { createId } from '../utils/id';
import type {
  AttackDefensePair,
  CourtChangeEventData,
  CourtSpot,
  FieldShotEventData,
  GkShotEventData,
  Match,
  MatchEvent,
  Phase,
  SimpleFieldEventType,
  TurnoverEventData,
} from '../domain/types';
import { HALFTIME_SECONDS } from '../domain/types';
import { elapsedAt, nextPeriodEnd } from '../domain/clock';
import { getCurrentOnCourt, isAttackDefenseChange } from '../stats/onCourt';
import { getCourtSpots } from '../stats/courtSpots';
import { useAppData } from './useAppData';
import { useToast } from './useToast';
import { withPendingWrites, writeOrQueue } from '../data/offline/queue';
import { loadSnapshot, saveSnapshot } from '../data/offline/snapshot';
import { describeEventForToast } from '../utils/eventLabels';
import { HAPTIC, vibrate } from '../utils/haptics';

/** A handball side can only ever have 6 court players + 1 goalkeeper on the field at once. */
export const COURT_LIMITS = { player: 6, goalkeeper: 1 } as const;

interface LiveMatchState {
  match: Match | null;
  events: MatchEvent[];
  selectedPlayerId: string | null;
  loading: boolean;
  /** This match's attack-defense pairs (at most 2), remembered on this device. */
  adPairs: AttackDefensePair[];

  loadMatch: (matchId: string) => Promise<void>;
  clear: () => void;
  selectPlayer: (playerId: string | null) => void;

  startClock: () => Promise<void>;
  pauseClock: () => Promise<void>;
  checkPeriodEnd: () => Promise<void>;
  getElapsedSeconds: () => number;
  updateCalledPlayers: (calledPlayerIds: string[]) => Promise<void>;
  updateDate: (date: string) => Promise<void>;

  /**
   * Returns false when the move is rejected (e.g. the 6+1 court limit is already full).
   * `spot` is where an entering player is drawn on the court.
   */
  toggleCourt: (playerId: string, spot?: CourtSpot) => Promise<boolean>;
  /**
   * Applies a whole substitution (any number of exits + entries) as one atomic
   * batch sharing a single timestamp, so the timeline can always pair them up
   * into a single "cambio" row — unlike calling toggleCourt in a loop, where
   * each write's network round-trip could push the elapsed-seconds reading
   * into the next second and silently break the pairing.
   * `spots` says where each entering player is drawn (by their id), normally
   * the spot of whoever they replace.
   * Returns the ids from `inIds` that couldn't find a free spot.
   */
  confirmSubstitution: (
    outIds: string[],
    inIds: string[],
    spots?: Partial<Record<string, CourtSpot>>
  ) => Promise<string[]>;
  setAdPairs: (pairs: AttackDefensePair[]) => void;
  /**
   * One tap on ATAQUE / DEFENSA: every pair whose player for the other phase is
   * on court swaps, all at once and sharing one timestamp, each newcomer on the
   * spot of the one going off. Recorded as court changes flagged `ad`, so
   * minutes and who-was-on-court stay exact without a "Cambio" each time.
   */
  switchAttackDefense: (to: Phase) => Promise<void>;
  /** `eventData` only for a counterattack turnover; every other simple event carries none. */
  recordSimpleEvent: (playerId: string, eventType: SimpleFieldEventType, eventData?: TurnoverEventData) => Promise<void>;
  recordShot: (playerId: string, eventData: FieldShotEventData) => Promise<void>;
  recordGkShot: (playerId: string, eventData: GkShotEventData) => Promise<void>;
  /** Removes the most recently recorded event for this match — works even right after a page reload. */
  undo: () => Promise<void>;
  updateEvent: (event: MatchEvent) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;

  syncGlobalData: () => Promise<void>;
}

/**
 * Persists a match. Never throws: with no connection this queues the write and
 * retries later, so the caller (which always updates local state first) never
 * has to care whether the network is actually up right now.
 */
async function persistMatch(match: Match): Promise<void> {
  await writeOrQueue({ collection: 'matches', method: 'upsert', payload: match }, () => dataProvider.matches.upsert(match));
}

/**
 * Pairs live with the offline snapshots, so locking the app wipes them along
 * with everything else it keeps on the device.
 */
const adPairsKey = (matchId: string) => `adPairs:${matchId}`;

export const useLiveMatchStore = create<LiveMatchState>((set, get) => ({
  match: null,
  events: [],
  selectedPlayerId: null,
  loading: false,
  adPairs: [],

  loadMatch: async (matchId: string) => {
    set({ loading: true });
    let match: Match | null | undefined;
    let events: MatchEvent[];
    try {
      [match, events] = await Promise.all([
        dataProvider.matches.getById(matchId),
        dataProvider.events.getByMatch(matchId),
      ]);
    } catch {
      // No connection (or the request otherwise failed) — fall back to whatever
      // app data is already loaded/cached, so an offline scorer can still open
      // and keep recording a match they'd already loaded once.
      const cached = useAppData.getState();
      match = cached.matches.find((m) => m.id === matchId) ?? null;
      events = cached.events.filter((e) => e.matchId === matchId);
    }
    // Whatever was recorded on this device but hasn't uploaded yet (e.g. the app
    // was closed or reloaded mid-match with no wifi) must still be on screen —
    // otherwise the score, clock and Deshacer would all work off an older copy.
    match = withPendingWrites(match ? [match] : [], 'matches').find((m) => m.id === matchId) ?? null;
    events = withPendingWrites(events, 'events').filter((e) => e.matchId === matchId);
    if (!match) {
      set({ loading: false, match: null, events: [] });
      return;
    }
    const wasScheduled = match.status === 'scheduled';
    if (wasScheduled) match = { ...match, status: 'live' };
    set({ match, events, selectedPlayerId: null, loading: false, adPairs: loadSnapshot<AttackDefensePair>(adPairsKey(matchId)) });
    if (wasScheduled) await persistMatch(match);
  },

  clear: () => set({ match: null, events: [], selectedPlayerId: null, adPairs: [] }),

  setAdPairs: (pairs) => {
    const { match } = get();
    if (!match) return;
    set({ adPairs: pairs });
    saveSnapshot(adPairsKey(match.id), pairs);
  },

  switchAttackDefense: async (to) => {
    const { match, events, adPairs, getElapsedSeconds } = get();
    if (!match) return;
    const onCourt = getCurrentOnCourt(events);
    const players = useAppData.getState().players;
    const spotOf = new Map([...getCourtSpots(events, players)].map(([spot, id]) => [id, spot]));
    // A pair only swaps when its player for the other phase is on court and
    // its player for this one isn't — anything else (both off after a normal
    // change, say) is left alone rather than guessed at.
    const swaps = adPairs
      .map((p) => (to === 'defense' ? { out: p.attackerId, in: p.defenderId } : { out: p.defenderId, in: p.attackerId }))
      .filter((s) => onCourt.has(s.out) && !onCourt.has(s.in));
    if (swaps.length === 0) return;

    const timestamp = Math.floor(getElapsedSeconds());
    const batchStart = Date.now();
    const newEvents: MatchEvent[] = swaps.flatMap((s, i) => {
      const spot = spotOf.get(s.out);
      const exit: CourtChangeEventData = { action: 'exit', ad: to };
      const enter: CourtChangeEventData = spot ? { action: 'enter', spot, ad: to } : { action: 'enter', ad: to };
      return [
        { id: createId('evt'), matchId: match.id, playerId: s.out, timestamp, createdAt: batchStart + 2 * i, eventType: 'court_change', eventData: exit },
        { id: createId('evt'), matchId: match.id, playerId: s.in, timestamp, createdAt: batchStart + 2 * i + 1, eventType: 'court_change', eventData: enter },
      ] as MatchEvent[];
    });

    set({ events: [...get().events, ...newEvents] });
    const names = swaps.map((s) => players.find((p) => p.id === s.in)?.name ?? '?').join(', ');
    useToast.getState().show(`${to === 'defense' ? 'Defensa' : 'Ataque'} · entra${swaps.length > 1 ? 'n' : ''} ${names}`);
    vibrate(HAPTIC.tap);
    for (const event of newEvents) {
      await writeOrQueue({ collection: 'events', method: 'add', payload: event }, () => dataProvider.events.add(event));
    }
  },

  selectPlayer: (playerId) => set({ selectedPlayerId: playerId }),

  getElapsedSeconds: () => {
    const { match } = get();
    return match ? elapsedAt(match.clock, Date.now()) : 0;
  },

  startClock: async () => {
    const { match } = get();
    if (!match || match.clock.running) return;
    const updated: Match = {
      ...match,
      clock: {
        ...match.clock,
        running: true,
        lastStartedAt: Date.now(),
        hasStartedOnce: true,
        secondHalfStarted: match.clock.halftimeReached ? true : match.clock.secondHalfStarted,
      },
    };
    set({ match: updated });
    await persistMatch(updated);
  },

  pauseClock: async () => {
    const { match, getElapsedSeconds } = get();
    if (!match || !match.clock.running) return;
    const elapsedSeconds = getElapsedSeconds();
    const updated: Match = {
      ...match,
      clock: { ...match.clock, elapsedSeconds, running: false, lastStartedAt: null },
    };
    set({ match: updated });
    await persistMatch(updated);
  },

  /**
   * Auto-pauses the clock the moment it reaches 30:00, and again at 60:00 — once
   * each per match. Either one only stops the clock: the scorer stays on the
   * recording screen so the last seconds' plays can still be noted before
   * starting the second half / pressing "Finalizar".
   */
  checkPeriodEnd: async () => {
    const { match, getElapsedSeconds } = get();
    if (!match || !match.clock.running) return;
    const end = nextPeriodEnd(match.clock);
    if (end === null || getElapsedSeconds() < end) return;
    const isHalftime = end === HALFTIME_SECONDS;
    const updated: Match = {
      ...match,
      clock: {
        ...match.clock,
        elapsedSeconds: end,
        running: false,
        lastStartedAt: null,
        ...(isHalftime ? { halftimeReached: true } : { fullTimeReached: true }),
      },
    };
    set({ match: updated });
    await persistMatch(updated);
    useToast
      .getState()
      .show(isHalftime ? 'Descanso · anota lo que falte antes de la segunda parte' : 'Fin del tiempo · anota lo que falte y pulsa Finalizar');
    vibrate(HAPTIC.goal);
  },

  updateCalledPlayers: async (calledPlayerIds: string[]) => {
    const { match } = get();
    if (!match) return;
    const updated: Match = { ...match, calledPlayerIds };
    set({ match: updated });
    await persistMatch(updated);
    await useAppData.getState().reload();
  },

  updateDate: async (date: string) => {
    const { match } = get();
    if (!match) return;
    const updated: Match = { ...match, date };
    set({ match: updated });
    await persistMatch(updated);
    await useAppData.getState().reload();
  },

  toggleCourt: async (playerId: string, spot?: CourtSpot) => {
    const { match, events } = get();
    if (!match) return false;
    const onCourt = getCurrentOnCourt(events);
    const entering = !onCourt.has(playerId);
    if (entering) {
      const players = useAppData.getState().players;
      const player = players.find((p) => p.id === playerId);
      if (player) {
        const sameKindOnCourt = players.filter((p) => onCourt.has(p.id) && p.position === player.position).length;
        if (sameKindOnCourt >= COURT_LIMITS[player.position]) return false;
      }
    }
    const eventData: CourtChangeEventData =
      entering && spot ? { action: 'enter', spot } : { action: entering ? 'enter' : 'exit' };
    await pushEvent(get, set, match, playerId, 'court_change', eventData);
    return true;
  },

  confirmSubstitution: async (outIds: string[], inIds: string[], spots = {}) => {
    const { match, events, getElapsedSeconds } = get();
    if (!match) return [];
    const timestamp = Math.floor(getElapsedSeconds());
    // Base + running offset keeps every event in this batch individually
    // orderable by createdAt, in the same order they're pushed below — so
    // Deshacer, which undoes "whatever has the latest createdAt", peels a
    // multi-swap back off one leg at a time in the right order.
    const batchStart = Date.now();
    let nextCreatedAt = 0;

    const newEvents: MatchEvent[] = outIds.map(
      (id) =>
        ({
          id: createId('evt'),
          matchId: match.id,
          playerId: id,
          timestamp,
          createdAt: batchStart + nextCreatedAt++,
          eventType: 'court_change',
          eventData: { action: 'exit' },
        }) as MatchEvent
    );

    // Validate entries against the roster as it stands right after the exits
    // above (not the live "current" on-court set), so a same-batch swap (e.g.
    // goalkeeper out + goalkeeper in) always sees the freed slot.
    const onCourtAfterExits = getCurrentOnCourt(events);
    for (const id of outIds) onCourtAfterExits.delete(id);
    const players = useAppData.getState().players;
    const rejected: string[] = [];

    for (const id of inIds) {
      const player = players.find((p) => p.id === id);
      if (player) {
        const sameKindOnCourt = players.filter((p) => onCourtAfterExits.has(p.id) && p.position === player.position).length;
        if (sameKindOnCourt >= COURT_LIMITS[player.position]) {
          rejected.push(id);
          continue;
        }
        onCourtAfterExits.add(id);
      }
      newEvents.push({
        id: createId('evt'),
        matchId: match.id,
        playerId: id,
        timestamp,
        createdAt: batchStart + nextCreatedAt++,
        eventType: 'court_change',
        eventData: spots[id] ? { action: 'enter', spot: spots[id] } : { action: 'enter' },
      } as MatchEvent);
    }

    const { events: currentEvents } = get();
    set({ events: [...currentEvents, ...newEvents] });
    for (const event of newEvents) {
      await writeOrQueue({ collection: 'events', method: 'add', payload: event }, () => dataProvider.events.add(event));
    }

    const acceptedIn = inIds.filter((id) => !rejected.includes(id));
    const outNames = outIds.map((id) => players.find((p) => p.id === id)?.name ?? '?').join(', ');
    const inNames = acceptedIn.map((id) => players.find((p) => p.id === id)?.name ?? '?').join(', ');
    useToast.getState().show(outNames && inNames ? `Cambio: ${outNames} → ${inNames}` : `Cambio: ${outNames || inNames}`);
    vibrate(HAPTIC.tap);
    return rejected;
  },

  recordSimpleEvent: async (playerId, eventType, eventData) => {
    const { match } = get();
    if (!match) return;
    await pushEvent(get, set, match, playerId, eventType, eventData);
  },

  recordShot: async (playerId, eventData) => {
    const { match } = get();
    if (!match) return;
    await pushEvent(get, set, match, playerId, 'shot', eventData);
  },

  recordGkShot: async (playerId, eventData) => {
    const { match } = get();
    if (!match) return;
    await pushEvent(get, set, match, playerId, 'gk_shot', eventData);
  },

  undo: async () => {
    const { events } = get();
    // An attack-defense switch is undone by tapping the other phase, not here:
    // Deshacer goes back to the last thing actually anotado.
    const undoable = events.filter((e) => !isAttackDefenseChange(e));
    if (undoable.length === 0) return;
    const last = [...undoable].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
    set({ events: events.filter((e) => e.id !== last.id) });
    await writeOrQueue({ collection: 'events', method: 'delete', payload: last.id }, () => dataProvider.events.delete(last.id));

    const playerName = useAppData.getState().players.find((p) => p.id === last.playerId)?.name;
    useToast.getState().show(`Deshecho: ${describeEventForToast(last, playerName ?? '—')}`);
    vibrate(HAPTIC.undo);
  },

  updateEvent: async (event: MatchEvent) => {
    const { events } = get();
    set({ events: events.map((e) => (e.id === event.id ? event : e)) });
    await writeOrQueue({ collection: 'events', method: 'update', payload: event }, () => dataProvider.events.update(event));
  },

  deleteEvent: async (id: string) => {
    const { events } = get();
    set({ events: events.filter((e) => e.id !== id) });
    await writeOrQueue({ collection: 'events', method: 'delete', payload: id }, () => dataProvider.events.delete(id));
  },

  syncGlobalData: async () => {
    await useAppData.getState().reload();
  },
}));

async function pushEvent(
  get: () => LiveMatchState,
  set: (partial: Partial<LiveMatchState>) => void,
  match: Match,
  playerId: string,
  eventType: MatchEvent['eventType'],
  eventData: unknown
): Promise<void> {
  const elapsed = get().getElapsedSeconds();
  const event = {
    id: createId('evt'),
    matchId: match.id,
    playerId,
    timestamp: Math.floor(elapsed),
    createdAt: Date.now(),
    eventType,
    eventData,
  } as MatchEvent;

  const { events } = get();
  set({ events: [...events, event] });
  await writeOrQueue({ collection: 'events', method: 'add', payload: event }, () => dataProvider.events.add(event));

  const playerName = useAppData.getState().players.find((p) => p.id === playerId)?.name ?? '—';
  useToast.getState().show(describeEventForToast(event, playerName));
  const isGoal = (event.eventType === 'shot' || event.eventType === 'gk_shot') && event.eventData.result === 'goal';
  vibrate(isGoal ? HAPTIC.goal : HAPTIC.tap);
}
