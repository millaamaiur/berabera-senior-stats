import type { SeasonRepository } from '../types';
import type { Season } from '../../domain/types';
import { supabase } from './client';

export const seasonRepository: SeasonRepository = {
  async getAll(): Promise<Season[]> {
    const { data, error } = await supabase.from('seasons').select('*');
    if (error) throw error;
    return data as Season[];
  },
  async upsert(season: Season): Promise<void> {
    const { error } = await supabase.from('seasons').upsert(season);
    if (error) throw error;
  },
};
