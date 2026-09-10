import { dataProvider, seasonNameForDate } from '../data';
import type { Season } from '../domain/types';
import { createId } from '../utils/id';
import { useAppData, activeSeason } from './useAppData';

/** Closes the current season (if any) and opens a fresh one starting today. */
export async function closeSeasonAndStartNext(): Promise<void> {
  const seasons = await dataProvider.seasons.getAll();
  const current = activeSeason(seasons);
  if (current) {
    await dataProvider.seasons.upsert({ ...current, closedAt: Date.now() });
  }

  const next: Season = {
    id: createId('season'),
    name: seasonNameForDate(new Date()),
    startDate: new Date().toISOString().slice(0, 10),
    closedAt: null,
  };
  await dataProvider.seasons.upsert(next);
  await useAppData.getState().reload();
}
