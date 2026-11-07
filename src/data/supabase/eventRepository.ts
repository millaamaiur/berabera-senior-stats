import type { EventRepository } from '../types';
import type { MatchEvent } from '../../domain/types';
import { supabase } from './client';
import { fetchAllPages } from './fetchAllPages';

export const eventRepository: EventRepository = {
  // Paginated: the whole season's events quickly passes Supabase's 1000-rows-per-response cap.
  getAll(): Promise<MatchEvent[]> {
    return fetchAllPages<MatchEvent>((from, to) =>
      supabase.from('events').select('*', { count: 'exact' }).order('id').range(from, to)
    );
  },
  getByMatch(matchId: string): Promise<MatchEvent[]> {
    return fetchAllPages<MatchEvent>((from, to) =>
      supabase.from('events').select('*', { count: 'exact' }).eq('matchId', matchId).order('id').range(from, to)
    );
  },
  async add(event: MatchEvent): Promise<void> {
    const { error } = await supabase.from('events').insert(event as never);
    if (error) throw error;
  },
  async update(event: MatchEvent): Promise<void> {
    const { error } = await supabase.from('events').upsert(event as never);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;
  },
};
