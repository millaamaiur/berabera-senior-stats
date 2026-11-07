import type { PlayerRepository } from '../types';
import type { Player } from '../../domain/types';
import { supabase } from './client';
import { fetchAllPages } from './fetchAllPages';

export const playerRepository: PlayerRepository = {
  getAll(): Promise<Player[]> {
    return fetchAllPages<Player>((from, to) => supabase.from('players').select('*', { count: 'exact' }).order('id').range(from, to));
  },
  async getById(id: string): Promise<Player | undefined> {
    const { data, error } = await supabase.from('players').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as Player) ?? undefined;
  },
  async upsert(player: Player): Promise<void> {
    const { error } = await supabase.from('players').upsert(player);
    if (error) throw error;
  },
};
