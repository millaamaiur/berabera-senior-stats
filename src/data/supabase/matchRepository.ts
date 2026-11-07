import type { MatchRepository } from '../types';
import type { Match } from '../../domain/types';
import { supabase } from './client';
import { fetchAllPages } from './fetchAllPages';

export const matchRepository: MatchRepository = {
  getAll(): Promise<Match[]> {
    return fetchAllPages<Match>((from, to) => supabase.from('matches').select('*', { count: 'exact' }).order('id').range(from, to));
  },
  async getById(id: string): Promise<Match | undefined> {
    const { data, error } = await supabase.from('matches').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as Match) ?? undefined;
  },
  async upsert(match: Match): Promise<void> {
    const { error } = await supabase.from('matches').upsert(match);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    // Events reference matches with "on delete cascade", so this takes their events with them.
    const { error } = await supabase.from('matches').delete().eq('id', id);
    if (error) throw error;
  },
};
