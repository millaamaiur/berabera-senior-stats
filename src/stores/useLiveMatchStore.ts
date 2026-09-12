import { create } from 'zustand';
import { dataProvider } from '../data';
import { createId } from '../utils/id';
import type {
  CourtChangeEventData,
  FieldShotEventData,
  GkShotEventData,
  Match,
  MatchEvent,
  SimpleFieldEventType,
} from '../domain/types';
import { HALFTIME_SECONDS } from '../domain/types';
import { getCurrentOnCourt } from '../stats/onCourt';
import { useAppData } from './useAppData';
import { writeOrQueue } from '../data/offline/queue';

/** A handball side can only ever have 6 court players + 1 goalkeeper on the field at once. */
export const COURT_LIMITS = { player: 6, goalkeeper: 1 } as const;

interface LiveMatchState {
  match: Match | null;
  events: MatchEvent[];
  selectedPlayerId: string | null;
  loading: boolean;

  loadMatch: (matchId: string) => Promise<void>;
  clear: () => void;
  selectPlayer: (playerId: string | null) => void;

  startClock: () => Promise<void>;
  pauseClock: () => Promise<void>;
  checkHalftime: () => Promise<void>;
  getElapsedSeconds: () => number;
  updateCalledPlayers: (calledPlayerIds: string[]) => Promise<void>;
  updateDate: (date: string) => Promise<void>;

  /** Returns false when the move is rejected (e.g. the 6+1 court limit is already full). */
  toggleCourt: (playerId: string) => Promise<boolean>;
  /**
   * Applies a whole substitution (any number of exits + entries) as one atomic
   * batch sharing a single timestamp, so the timeline can always pair them up
   * into a single "cambio" row — unlike calling toggleCourt in a loop, where
   * each write's network round-trip could push the elapsed-seconds reading
   * into the next second and silently break the pairing.
   * Returns the ids from `inIds` that couldn't find a free spot.
   */
  confirmSubstitution: (outIds: string[], inIds: string[]) => Promise<string[]>;
  recordSimpleEvent: (playerId: string, eventType: SimpleFieldEventType) => Promise<void>;
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

export const useLiveMatchStore = create<LiveMatchState>((set, get) => ({
  match: null,
  events: [],
  selectedPlayerId: null,
  loading: false,

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
    if (!match) {
      set({ loading: false, match: null, events: [] });
      return;
    }
    const wasScheduled = match.status === 'scheduled';
    if (wasScheduled) match = { ...match, status: 'live' };
    set({ match, events, selectedPlayerId: null, loading: false });
    if (wasScheduled) await persistMatch(match);
  },

  clear: () => set({ match: null, events: [], selectedPlayerId: null }),

  selectPlayer: (playerId) => set({ selectedPlayerId: playerId }),

  getElapsedSeconds: () => {
    const { match } = get();
    if (!match) return 0;
    if (match.clock.running && match.clock.lastStartedAt) {
      return match.clock.elapsedSeconds + (Date.now() - match.clock.lastStartedAt) / 1000;
    }
    return match.clock.elapsedSeconds;
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

  /** Auto-pauses the clock the moment it crosses the 30-minute mark, once per match. */
  checkHalftime: async () => {
    const { match, getElapsedSeconds } = get();
    if (!match || !match.clock.running || match.clock.halftimeReached) return;
    if (getElapsedSeconds() < HALFTIME_SECONDS) return;
    const updated: Match = {
      ...match,
      clock: {
        ...match.clock,
        elapsedSeconds: HALFTIME_SECONDS,
        running: false,
        lastStartedAt: null,
        halftimeReached: true,
      },
    };
    set({ match: updated });
    await persistMatch(updated);
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

  toggleCourt: async (playerId: string) => {
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
    const eventData: CourtChangeEventData = { action: entering ? 'enter' : 'exit' };
    await pushEvent(get, set, match, playerId, 'court_change', eventData);
    return true;
  },

  confirmSubstitution: async (outIds: string[], inIds: string[]) => {
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
        eventData: { action: 'enter' },
      } as MatchEvent);
    }

    const { events: currentEvents } = get();
    set({ events: [...currentEvents, ...newEvents] });
    for (const event of newEvents) {
      await writeOrQueue({ collection: 'events', method: 'add', payload: event }, () => dataProvider.events.add(event));
    }
    return rejected;
  },

  recordSimpleEvent: async (playerId, eventType) => {
    const { match } = get();
    if (!match) return;
    await pushEvent(get, set, match, playerId, eventType, undefined);
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
    if (events.length === 0) return;
    const last = [...events].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
    set({ events: events.filter((e) => e.id !== last.id) });
    await writeOrQueue({ collection: 'events', method: 'delete', payload: last.id }, () => dataProvider.events.delete(last.id));
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
}
