import type { MatchEvent } from '../domain/types';

let counter = 0;

function makeId(): string {
  counter += 1;
  return `evt-${counter}`;
}

/** Builds a field-player shot event. Omit `zone` to represent "Fuera" (missed the frame entirely). */
export function shot(
  playerId: string,
  timestamp: number,
  result: 'goal' | 'miss',
  opts: { zone?: number; context?: 'open_play' | 'penalty' } = {}
): MatchEvent {
  return {
    id: makeId(),
    matchId: 'm1',
    playerId,
    timestamp,
    eventType: 'shot',
    eventData: { result, zone: opts.zone as never, context: opts.context ?? 'open_play' },
  } as MatchEvent;
}

/** Builds a goalkeeper shot-faced event (a rival attempt against us). Omit `zone` for "Fuera" (missed the frame, never challenged the keeper). */
export function gkShot(
  playerId: string,
  timestamp: number,
  result: 'save' | 'goal' | 'miss',
  zone?: number,
  context: 'open_play' | 'penalty' = 'open_play'
): MatchEvent {
  return {
    id: makeId(),
    matchId: 'm1',
    playerId,
    timestamp,
    eventType: 'gk_shot',
    eventData: { result, zone: zone as never, context },
  } as MatchEvent;
}

export function courtChange(playerId: string, timestamp: number, action: 'enter' | 'exit'): MatchEvent {
  return {
    id: makeId(),
    matchId: 'm1',
    playerId,
    timestamp,
    eventType: 'court_change',
    eventData: { action },
  } as MatchEvent;
}

type SimpleType = 'turnover' | 'recovery' | 'steps' | 'card_yellow' | 'card_red' | 'card_blue' | 'exclusion_2min';

export function simple(eventType: SimpleType, playerId: string, timestamp: number): MatchEvent {
  return { id: makeId(), matchId: 'm1', playerId, timestamp, eventType } as MatchEvent;
}
