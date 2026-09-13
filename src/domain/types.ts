export type Position = 'player' | 'goalkeeper';

export interface Player {
  id: string;
  name: string;
  position: Position;
  /** Jersey number: unique per active roster. Goalkeepers use 1-3, field players 4-19. */
  number: number;
  active: boolean;
}

export const GOALKEEPER_NUMBER_RANGE = { min: 1, max: 3 } as const;
export const FIELD_PLAYER_NUMBER_RANGE = { min: 4, max: 19 } as const;

export function numberRangeFor(position: Position): { min: number; max: number } {
  return position === 'goalkeeper' ? GOALKEEPER_NUMBER_RANGE : FIELD_PLAYER_NUMBER_RANGE;
}

export type MatchStatus = 'scheduled' | 'live' | 'finished';

export interface MatchClock {
  elapsedSeconds: number;
  running: boolean;
  /** epoch ms when the clock was last started, null while paused */
  lastStartedAt: number | null;
  /** True forever once the clock has been started for the first time — survives pause/reset. */
  hasStartedOnce: boolean;
  /** True once the clock has auto-paused at the 30-minute mark (first half over). */
  halftimeReached: boolean;
  /** True once "Iniciar segunda parte" has been pressed — the halftime prompt won't show again. */
  secondHalfStarted: boolean;
}

/** Elapsed seconds at which the first half ends and the clock auto-pauses. */
export const HALFTIME_SECONDS = 30 * 60;

export interface Match {
  id: string;
  opponent: string;
  date: string; // ISO date
  competition: string;
  isHome: boolean;
  calledPlayerIds: string[];
  status: MatchStatus;
  clock: MatchClock;
  createdAt: number;
  seasonId: string;
  /** Optional link to a recording/highlights of the match, added after the fact. */
  link?: string | null;
}

export interface Season {
  id: string;
  /** e.g. "2026/2027" */
  name: string;
  startDate: string; // ISO date
  /** epoch ms when the season was closed, or null while it's the active one */
  closedAt: number | null;
}

export type Zone = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface FieldShotEventData {
  result: 'goal' | 'miss';
  /** Absent when the shot missed the goal frame entirely ("fuera"), so it has no in-goal placement. */
  zone?: Zone;
  context: 'open_play' | 'penalty';
}

export interface GkShotEventData {
  result: 'save' | 'goal';
  zone: Zone;
  context: 'open_play' | 'penalty';
}

export interface CourtChangeEventData {
  action: 'enter' | 'exit';
}

interface BaseEvent {
  id: string;
  matchId: string;
  playerId: string;
  /** seconds elapsed in the match clock when the event happened */
  timestamp: number;
  /**
   * Real-world epoch ms when this event was recorded — used only to figure out
   * "the last thing anotado" for Deshacer, since it must survive a page reload
   * (unlike `timestamp`, which is match-clock time and can repeat/collide).
   * Absent on events recorded before this field existed.
   */
  createdAt?: number;
}

export type MatchEvent =
  | (BaseEvent & { eventType: 'shot'; eventData: FieldShotEventData })
  | (BaseEvent & { eventType: 'gk_shot'; eventData: GkShotEventData })
  | (BaseEvent & { eventType: 'assist' })
  | (BaseEvent & { eventType: 'turnover' })
  | (BaseEvent & { eventType: 'recovery' })
  | (BaseEvent & { eventType: 'steps' })
  | (BaseEvent & { eventType: 'card_yellow' })
  | (BaseEvent & { eventType: 'card_red' })
  | (BaseEvent & { eventType: 'card_blue' })
  | (BaseEvent & { eventType: 'exclusion_2min' })
  | (BaseEvent & { eventType: 'court_change'; eventData: CourtChangeEventData });

export type EventType = MatchEvent['eventType'];

/** Simple field-player events that carry no extra data beyond player/time. */
export type SimpleFieldEventType =
  | 'assist'
  | 'turnover'
  | 'recovery'
  | 'steps'
  | 'card_yellow'
  | 'card_red'
  | 'card_blue'
  | 'exclusion_2min';
