import type { SeasonRepository } from '../types';
import type { Season } from '../../domain/types';
import { supabase } from './client';
import { fetchAllPages } from './fetchAllPages';

export const seasonRepository: SeasonRepository = {
  getAll(): Promise<Season[]> {
    return fetchAllPages<Season>((from, to) => supabase.from('seasons').select('*', { count: 'exact' }).order('id').range(from, to));
  },
  async upsert(season: Season): Promise<void> {
    const { error } = await supabase.from('seasons').upsert(season);
    if (error) throw error;
  },
};
