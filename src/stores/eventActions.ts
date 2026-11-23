import { dataProvider } from '../data';
import type { MatchEvent } from '../domain/types';
import { useAppData } from './useAppData';
import { writeOrQueue } from '../data/offline/queue';
import { suspensionGroup } from '../stats/suspensions';

export async function updateEventAndReload(event: MatchEvent): Promise<void> {
  useAppData.setState((s) => ({ events: s.events.map((e) => (e.id === event.id ? event : e)) }));
  await writeOrQueue({ collection: 'events', method: 'update', payload: event }, () => dataProvider.events.update(event));
}

/** Deleting a 2 minutos / roja / azul also deletes the court changes it made (exit, keeper change, return). */
export async function deleteEventAndReload(id: string): Promise<void> {
  const ids = new Set(suspensionGroup(useAppData.getState().events, id).map((e) => e.id));
  if (ids.size === 0) ids.add(id);
  useAppData.setState((s) => ({ events: s.events.filter((e) => !ids.has(e.id)) }));
  for (const eventId of ids) {
    await writeOrQueue({ collection: 'events', method: 'delete', payload: eventId }, () => dataProvider.events.delete(eventId));
  }
}
