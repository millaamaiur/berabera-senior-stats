import { describe, expect, it } from 'vitest';
import { computeMinutesPlayed, getCurrentOnCourt, getOnCourtAt } from './onCourt';
import { courtChange } from './testFixtures';

describe('getCurrentOnCourt', () => {
  it('has a player on court after entering, and not after exiting', () => {
    expect(getCurrentOnCourt([courtChange('p1', 0, 'enter')]).has('p1')).toBe(true);
    expect(getCurrentOnCourt([courtChange('p1', 0, 'enter'), courtChange('p1', 100, 'exit')]).has('p1')).toBe(false);
  });

  it('replays enter/exit in timestamp order regardless of array order', () => {
    const events = [courtChange('p1', 100, 'exit'), courtChange('p1', 0, 'enter')];
    expect(getCurrentOnCourt(events).has('p1')).toBe(false);
  });
});

describe('getOnCourtAt', () => {
  it('only considers events up to the given timestamp', () => {
    const events = [courtChange('p1', 0, 'enter'), courtChange('p1', 100, 'exit')];
    expect(getOnCourtAt(events, 50).has('p1')).toBe(true);
    expect(getOnCourtAt(events, 100).has('p1')).toBe(false);
    expect(getOnCourtAt(events, 150).has('p1')).toBe(false);
  });
});

describe('computeMinutesPlayed', () => {
  it('sums every paired enter/exit interval', () => {
    const events = [
      courtChange('p1', 0, 'enter'),
      courtChange('p1', 100, 'exit'),
      courtChange('p1', 200, 'enter'),
      courtChange('p1', 250, 'exit'),
    ];
    expect(computeMinutesPlayed(events, 'p1', 9999)).toBe(150);
  });

  it('counts the still-open interval up to "now" if the player never came off', () => {
    const events = [courtChange('p1', 0, 'enter')];
    expect(computeMinutesPlayed(events, 'p1', 300)).toBe(300);
  });

  it('is 0 for a player with no court_change events at all', () => {
    expect(computeMinutesPlayed([], 'p1', 300)).toBe(0);
  });
});
