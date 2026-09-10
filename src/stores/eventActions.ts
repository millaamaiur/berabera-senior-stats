import { dataProvider } from '../data';
import type { MatchEvent } from '../domain/types';
import { useAppData } from './useAppData';

export async function updateEventAndReload(event: MatchEvent): Promise<void> {
  await dataProvider.events.update(event);
  await useAppData.getState().reload();
}

export async function deleteEventAndReload(id: string): Promise<void> {
  await dataProvider.events.delete(id);
  await useAppData.getState().reload();
}
