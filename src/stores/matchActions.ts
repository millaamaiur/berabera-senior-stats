import { dataProvider } from '../data';
import type { Match } from '../domain/types';
import { createId } from '../utils/id';
import { useAppData, activeSeason } from './useAppData';
import { writeOrQueue } from '../data/offline/queue';

export interface NewMatchInput {
  opponent: string;
  date: string;
  competition: string;
  isHome: boolean;
  calledPlayerIds: string[];
}

export async function createMatch(input: NewMatchInput): Promise<Match> {
  // Reads the already-loaded season instead of a fresh network call, so this
  // works the moment the app has loaded once, connection or not.
  const season = activeSeason(useAppData.getState().seasons);

  const match: Match = {
    id: createId('match'),
    opponent: input.opponent,
    date: input.date,
    competition: input.competition,
    isHome: input.isHome,
    calledPlayerIds: input.calledPlayerIds,
    status: 'scheduled',
    clock: {
      elapsedSeconds: 0,
      running: false,
      lastStartedAt: null,
      hasStartedOnce: false,
      halftimeReached: false,
      secondHalfStarted: false,
      fullTimeReached: false,
    },
    createdAt: Date.now(),
    seasonId: season?.id ?? '',
  };
  useAppData.setState((s) => ({ matches: [...s.matches, match] }));
  await writeOrQueue({ collection: 'matches', method: 'upsert', payload: match }, () => dataProvider.matches.upsert(match));
  return match;
}

export async function finishMatch(match: Match): Promise<void> {
  const updated: Match = {
    ...match,
    status: 'finished',
    clock: { ...match.clock, running: false, lastStartedAt: null },
  };
  useAppData.setState((s) => ({ matches: s.matches.map((m) => (m.id === updated.id ? updated : m)) }));
  await writeOrQueue({ collection: 'matches', method: 'upsert', payload: updated }, () => dataProvider.matches.upsert(updated));
}

export async function deleteMatch(id: string): Promise<void> {
  useAppData.setState((s) => ({
    matches: s.matches.filter((m) => m.id !== id),
    events: s.events.filter((e) => e.matchId !== id),
  }));
  await writeOrQueue({ collection: 'matches', method: 'delete', payload: id }, () => dataProvider.matches.delete(id));
}

/** Wipes every recorded event and sends the match back to 'scheduled', as if it had never started. */
export async function cancelMatch(match: Match): Promise<void> {
  const updated: Match = {
    ...match,
    status: 'scheduled',
    clock: {
      elapsedSeconds: 0,
      running: false,
      lastStartedAt: null,
      hasStartedOnce: false,
      halftimeReached: false,
      secondHalfStarted: false,
      fullTimeReached: false,
    },
  };
  const eventsToDelete = useAppData.getState().events.filter((e) => e.matchId === match.id);
  useAppData.setState((s) => ({
    matches: s.matches.map((m) => (m.id === updated.id ? updated : m)),
    events: s.events.filter((e) => e.matchId !== match.id),
  }));
  for (const event of eventsToDelete) {
    await writeOrQueue({ collection: 'events', method: 'delete', payload: event.id }, () => dataProvider.events.delete(event.id));
  }
  await writeOrQueue({ collection: 'matches', method: 'upsert', payload: updated }, () => dataProvider.matches.upsert(updated));
}
