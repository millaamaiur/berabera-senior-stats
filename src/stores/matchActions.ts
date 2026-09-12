import { dataProvider } from '../data';
import type { Match } from '../domain/types';
import { createId } from '../utils/id';
import { useAppData, activeSeason } from './useAppData';

export interface NewMatchInput {
  opponent: string;
  date: string;
  competition: string;
  isHome: boolean;
  calledPlayerIds: string[];
}

export async function createMatch(input: NewMatchInput): Promise<Match> {
  const seasons = await dataProvider.seasons.getAll();
  const season = activeSeason(seasons);

  const match: Match = {
    id: createId('match'),
    opponent: input.opponent,
    date: input.date,
    competition: input.competition,
    isHome: input.isHome,
    calledPlayerIds: input.calledPlayerIds,
    status: 'scheduled',
    clock: { elapsedSeconds: 0, running: false, lastStartedAt: null, hasStartedOnce: false, halftimeReached: false, secondHalfStarted: false },
    createdAt: Date.now(),
    seasonId: season?.id ?? '',
  };
  await dataProvider.matches.upsert(match);
  await useAppData.getState().reload();
  return match;
}

export async function finishMatch(match: Match): Promise<void> {
  await dataProvider.matches.upsert({
    ...match,
    status: 'finished',
    clock: { ...match.clock, running: false, lastStartedAt: null },
  });
  await useAppData.getState().reload();
}

export async function deleteMatch(id: string): Promise<void> {
  await dataProvider.matches.delete(id);
  await useAppData.getState().reload();
}

/** Wipes every recorded event and sends the match back to 'scheduled', as if it had never started. */
export async function cancelMatch(match: Match): Promise<void> {
  const events = await dataProvider.events.getByMatch(match.id);
  for (const event of events) {
    await dataProvider.events.delete(event.id);
  }
  await dataProvider.matches.upsert({
    ...match,
    status: 'scheduled',
    clock: { elapsedSeconds: 0, running: false, lastStartedAt: null, hasStartedOnce: false, halftimeReached: false, secondHalfStarted: false },
  });
  await useAppData.getState().reload();
}
