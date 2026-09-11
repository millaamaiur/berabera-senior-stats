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
import { getCurrentOnCourt } from '../stats/onCourt';
import { useAppData } from './useAppData';

/** A handball side can only ever have 6 court players + 1 goalkeeper on the field at once. */
export const COURT_LIMITS = { player: 6, goalkeeper: 1 } as const;

interface LiveMatchState {
  match: Match | null;
  events: MatchEvent[];
  selectedPlayerId: string | null;
  undoStack: string[];
  loading: boolean;

  loadMatch: (matchId: string) => Promise<void>;
  clear: () => void;
  selectPlayer: (playerId: string | null) => void;

  startClock: () => Promise<void>;
  pauseClock: () => Promise<void>;
  resetClock: () => Promise<void>;
  getElapsedSeconds: () => number;
  updateCalledPlayers: (calledPlayerIds: string[]) => Promise<void>;
  updateDate: (date: string) => Promise<void>;

  /** Returns false when the move is rejected (e.g. the 6+1 court limit is already full). */
  toggleCourt: (playerId: string) => Promise<boolean>;
  recordSimpleEvent: (playerId: string, eventType: SimpleFieldEventType) => Promise<void>;
  recordShot: (playerId: string, eventData: FieldShotEventData) => Promise<void>;
  recordGkShot: (playerId: string, eventData: GkShotEventData) => Promise<void>;
  undo: () => Promise<void>;
  updateEvent: (event: MatchEvent) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;

  syncGlobalData: () => Promise<void>;
}

async function persistMatch(match: Match): Promise<void> {
  await dataProvider.matches.upsert(match);
}

export const useLiveMatchStore = create<LiveMatchState>((set, get) => ({
  match: null,
  events: [],
  selectedPlayerId: null,
  undoStack: [],
  loading: false,

  loadMatch: async (matchId: string) => {
    set({ loading: true });
    const [match, events] = await Promise.all([
      dataProvider.matches.getById(matchId),
      dataProvider.events.getByMatch(matchId),
    ]);
    if (!match) {
      set({ loading: false, match: null, events: [] });
      return;
    }
    if (match.status === 'scheduled') {
      match.status = 'live';
      await persistMatch(match);
    }
    set({ match, events, selectedPlayerId: null, undoStack: [], loading: false });
  },

  clear: () => set({ match: null, events: [], selectedPlayerId: null, undoStack: [] }),

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
      clock: { ...match.clock, running: true, lastStartedAt: Date.now(), hasStartedOnce: true },
    };
    await persistMatch(updated);
    set({ match: updated });
  },

  pauseClock: async () => {
    const { match, getElapsedSeconds } = get();
    if (!match || !match.clock.running) return;
    const elapsedSeconds = getElapsedSeconds();
    const updated: Match = {
      ...match,
      clock: { elapsedSeconds, running: false, lastStartedAt: null, hasStartedOnce: match.clock.hasStartedOnce },
    };
    await persistMatch(updated);
    set({ match: updated });
  },

  resetClock: async () => {
    const { match } = get();
    if (!match) return;
    const updated: Match = {
      ...match,
      clock: { elapsedSeconds: 0, running: false, lastStartedAt: null, hasStartedOnce: match.clock.hasStartedOnce },
    };
    await persistMatch(updated);
    set({ match: updated });
  },

  updateCalledPlayers: async (calledPlayerIds: string[]) => {
    const { match } = get();
    if (!match) return;
    const updated: Match = { ...match, calledPlayerIds };
    await persistMatch(updated);
    set({ match: updated });
    await useAppData.getState().reload();
  },

  updateDate: async (date: string) => {
    const { match } = get();
    if (!match) return;
    const updated: Match = { ...match, date };
    await persistMatch(updated);
    set({ match: updated });
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
    const { undoStack, events } = get();
    const lastId = undoStack[undoStack.length - 1];
    if (!lastId) return;
    await dataProvider.events.delete(lastId);
    set({
      events: events.filter((e) => e.id !== lastId),
      undoStack: undoStack.slice(0, -1),
    });
  },

  updateEvent: async (event: MatchEvent) => {
    await dataProvider.events.update(event);
    const { events } = get();
    set({ events: events.map((e) => (e.id === event.id ? event : e)) });
  },

  deleteEvent: async (id: string) => {
    await dataProvider.events.delete(id);
    const { events, undoStack } = get();
    set({ events: events.filter((e) => e.id !== id), undoStack: undoStack.filter((eid) => eid !== id) });
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
    eventType,
    eventData,
  } as MatchEvent;

  await dataProvider.events.add(event);
  const { events, undoStack } = get();
  set({ events: [...events, event], undoStack: [...undoStack, event.id] });
}
