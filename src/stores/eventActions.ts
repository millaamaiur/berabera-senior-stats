import { dataProvider } from '../data';
import type { MatchEvent } from '../domain/types';
import { useAppData } from './useAppData';
import { writeOrQueue } from '../data/offline/queue';

export async function updateEventAndReload(event: MatchEvent): Promise<void> {
  useAppData.setState((s) => ({ events: s.events.map((e) => (e.id === event.id ? event : e)) }));
  await writeOrQueue({ collection: 'events', method: 'update', payload: event }, () => dataProvider.events.update(event));
}

export async function deleteEventAndReload(id: string): Promise<void> {
  useAppData.setState((s) => ({ events: s.events.filter((e) => e.id !== id) }));
  await writeOrQueue({ collection: 'events', method: 'delete', payload: id }, () => dataProvider.events.delete(id));
}
