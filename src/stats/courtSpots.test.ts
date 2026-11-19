import { describe, expect, it } from 'vitest';
import type { CourtSpot, MatchEvent, Player } from '../domain/types';
import { getCourtSpots } from './courtSpots';
import { getCurrentOnCourt } from './onCourt';

let createdAt = 1;

function change(playerId: string, timestamp: number, action: 'enter' | 'exit', spot?: CourtSpot): MatchEvent {
  return {
    id: `evt-${Math.random()}`,
    matchId: 'm1',
    playerId,
    timestamp,
    createdAt: createdAt++,
    eventType: 'court_change',
    eventData: spot ? { action, spot } : { action },
  } as MatchEvent;
}

function player(id: string, number: number, position: Player['position'] = 'player'): Player {
  return { id, name: id, number, position, active: true };
}

const PLAYERS = [player('gk', 1, 'goalkeeper'), player('a', 4), player('b', 7), player('c', 9), player('d', 11)];

describe('getCourtSpots', () => {
  it('puts each entering player on the spot they entered with', () => {
    const spots = getCourtSpots([change('a', 0, 'enter', 'left_wing'), change('gk', 0, 'enter', 'goalkeeper')], PLAYERS);
    expect(spots.get('left_wing')).toBe('a');
    expect(spots.get('goalkeeper')).toBe('gk');
  });

  it('gives the one coming on the spot of the one going off', () => {
    const spots = getCourtSpots(
      [change('a', 0, 'enter', 'pivot'), change('a', 300, 'exit'), change('b', 300, 'enter', 'pivot')],
      PLAYERS
    );
    expect(spots.get('pivot')).toBe('b');
    expect([...spots.values()]).not.toContain('a');
  });

  it('places players with no saved spot (older matches) in free spots, lowest number first', () => {
    const spots = getCourtSpots(
      [change('c', 0, 'enter'), change('a', 0, 'enter'), change('b', 0, 'enter', 'center_back'), change('gk', 0, 'enter')],
      PLAYERS
    );
    expect(spots.get('center_back')).toBe('b');
    expect(spots.get('left_back')).toBe('a');
    expect(spots.get('right_back')).toBe('c');
    expect(spots.get('goalkeeper')).toBe('gk');
  });

  it('never puts two players on the same spot', () => {
    const spots = getCourtSpots([change('a', 0, 'enter', 'pivot'), change('b', 0, 'enter', 'pivot')], PLAYERS);
    expect(spots.get('pivot')).toBe('a');
    expect([...spots.values()]).toContain('b');
    expect(new Set(spots.values()).size).toBe(spots.size);
  });

  it('leaves the spot empty when its player goes off with nobody coming on', () => {
    const spots = getCourtSpots([change('a', 0, 'enter', 'right_wing'), change('a', 120, 'exit')], PLAYERS);
    expect(spots.has('right_wing')).toBe(false);
  });
});

describe('court changes at the same time', () => {
  it('replay in the order they were recorded, whatever order the server returns them in', () => {
    // Put in, taken out and put back in before kickoff — all at 0:00.
    const events = [change('a', 0, 'enter', 'pivot'), change('a', 0, 'exit'), change('a', 0, 'enter', 'left_wing')];
    const shuffled = [events[2], events[1], events[0]];
    expect(getCurrentOnCourt(shuffled).has('a')).toBe(true);
    expect(getCourtSpots(shuffled, PLAYERS).get('left_wing')).toBe('a');
  });
});
