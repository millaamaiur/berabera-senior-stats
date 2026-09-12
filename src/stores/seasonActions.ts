import { dataProvider, seasonNameForDate } from '../data';
import type { Season } from '../domain/types';
import { createId } from '../utils/id';
import { useAppData, activeSeason } from './useAppData';
import { writeOrQueue } from '../data/offline/queue';

/** Closes the current season (if any) and opens a fresh one starting today. */
export async function closeSeasonAndStartNext(): Promise<void> {
  const current = activeSeason(useAppData.getState().seasons);

  const next: Season = {
    id: createId('season'),
    name: seasonNameForDate(new Date()),
    startDate: new Date().toISOString().slice(0, 10),
    closedAt: null,
  };

  const closedCurrent = current ? { ...current, closedAt: Date.now() } : null;
  useAppData.setState((s) => ({
    seasons: [...s.seasons.map((se) => (closedCurrent && se.id === closedCurrent.id ? closedCurrent : se)), next],
  }));

  if (closedCurrent) {
    await writeOrQueue({ collection: 'seasons', method: 'upsert', payload: closedCurrent }, () =>
      dataProvider.seasons.upsert(closedCurrent)
    );
  }
  await writeOrQueue({ collection: 'seasons', method: 'upsert', payload: next }, () => dataProvider.seasons.upsert(next));
}
