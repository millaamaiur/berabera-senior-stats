import { create } from 'zustand';
import { dataProvider } from '../data';
import type { Match, MatchEvent, Player, Season } from '../domain/types';
import { clearSnapshots, loadSnapshot, saveSnapshot } from '../data/offline/snapshot';
import { withPendingWrites } from '../data/offline/queue';

interface AppDataState {
  players: Player[];
  matches: Match[];
  events: MatchEvent[];
  seasons: Season[];
  loaded: boolean;
  reload: () => Promise<void>;
  /** Forgets all data, in memory and the offline snapshot — for when the app gets locked. */
  clear: () => void;
}

export const useAppData = create<AppDataState>((set) => ({
  players: [],
  matches: [],
  events: [],
  seasons: [],
  loaded: false,
  reload: async () => {
    let players: Player[];
    let matches: Match[];
    let events: MatchEvent[];
    let seasons: Season[];
    try {
      [players, matches, events, seasons] = await Promise.all([
        dataProvider.players.getAll(),
        dataProvider.matches.getAll(),
        dataProvider.events.getAll(),
        dataProvider.seasons.getAll(),
      ]);
      saveSnapshot('players', players);
      saveSnapshot('matches', matches);
      saveSnapshot('events', events);
      saveSnapshot('seasons', seasons);
    } catch (error) {
      console.error('Failed to load app data, falling back to the last local snapshot', error);
      players = loadSnapshot<Player>('players');
      matches = loadSnapshot<Match>('matches');
      events = loadSnapshot<MatchEvent>('events');
      seasons = loadSnapshot<Season>('seasons');
    }
    // Either source can be missing writes this device made that haven't uploaded yet.
    set({
      players: withPendingWrites(players, 'players'),
      matches: withPendingWrites(matches, 'matches'),
      events: withPendingWrites(events, 'events'),
      seasons: withPendingWrites(seasons, 'seasons'),
      loaded: true,
    });
  },
  clear: () => {
    clearSnapshots();
    set({ players: [], matches: [], events: [], seasons: [], loaded: false });
  },
}));

/** The season currently in progress (closedAt === null), if any. */
export function activeSeason(seasons: Season[]): Season | undefined {
  return seasons.find((s) => s.closedAt === null);
}
