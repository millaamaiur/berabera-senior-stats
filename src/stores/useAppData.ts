import { create } from 'zustand';
import { dataProvider } from '../data';
import type { Match, MatchEvent, Player, Season } from '../domain/types';

interface AppDataState {
  players: Player[];
  matches: Match[];
  events: MatchEvent[];
  seasons: Season[];
  loaded: boolean;
  reload: () => Promise<void>;
}

export const useAppData = create<AppDataState>((set) => ({
  players: [],
  matches: [],
  events: [],
  seasons: [],
  loaded: false,
  reload: async () => {
    try {
      const [players, matches, events, seasons] = await Promise.all([
        dataProvider.players.getAll(),
        dataProvider.matches.getAll(),
        dataProvider.events.getAll(),
        dataProvider.seasons.getAll(),
      ]);
      set({ players, matches, events, seasons, loaded: true });
    } catch (error) {
      console.error('Failed to load app data', error);
      set({ loaded: true });
    }
  },
}));

/** The season currently in progress (closedAt === null), if any. */
export function activeSeason(seasons: Season[]): Season | undefined {
  return seasons.find((s) => s.closedAt === null);
}
