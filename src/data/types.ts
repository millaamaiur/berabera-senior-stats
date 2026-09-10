import type { Match, MatchEvent, Player, Season } from '../domain/types';

export interface PlayerRepository {
  getAll(): Promise<Player[]>;
  getById(id: string): Promise<Player | undefined>;
  upsert(player: Player): Promise<void>;
}

export interface MatchRepository {
  getAll(): Promise<Match[]>;
  getById(id: string): Promise<Match | undefined>;
  upsert(match: Match): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface EventRepository {
  getAll(): Promise<MatchEvent[]>;
  getByMatch(matchId: string): Promise<MatchEvent[]>;
  add(event: MatchEvent): Promise<void>;
  update(event: MatchEvent): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SeasonRepository {
  getAll(): Promise<Season[]>;
  upsert(season: Season): Promise<void>;
}

export interface DataProvider {
  players: PlayerRepository;
  matches: MatchRepository;
  events: EventRepository;
  seasons: SeasonRepository;
}
