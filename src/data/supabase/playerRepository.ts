import type { PlayerRepository } from '../types';
import type { Player } from '../../domain/types';
import { supabase } from './client';

export const playerRepository: PlayerRepository = {
  async getAll(): Promise<Player[]> {
    const { data, error } = await supabase.from('players').select('*');
    if (error) throw error;
    return data as Player[];
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
