import type { EventRepository } from '../types';
import type { MatchEvent } from '../../domain/types';
import { supabase } from './client';

export const eventRepository: EventRepository = {
  async getAll(): Promise<MatchEvent[]> {
    const { data, error } = await supabase.from('events').select('*');
    if (error) throw error;
    return data as MatchEvent[];
  },
  async getByMatch(matchId: string): Promise<MatchEvent[]> {
    const { data, error } = await supabase.from('events').select('*').eq('matchId', matchId);
    if (error) throw error;
    return data as MatchEvent[];
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
