import { describe, expect, it } from 'vitest';
import { elapsedAt, nextPeriodEnd } from './clock';
import type { MatchClock } from './types';

function clock(overrides: Partial<MatchClock> = {}): MatchClock {
  return {
    elapsedSeconds: 0,
    running: false,
    lastStartedAt: null,
    hasStartedOnce: true,
    halftimeReached: false,
    secondHalfStarted: false,
    ...overrides,
  };
}

describe('nextPeriodEnd', () => {
  it('is 30:00 during the first half, 60:00 during the second, and none after that', () => {
    expect(nextPeriodEnd(clock())).toBe(1800);
    expect(nextPeriodEnd(clock({ halftimeReached: true, secondHalfStarted: true }))).toBe(3600);
    expect(nextPeriodEnd(clock({ halftimeReached: true, fullTimeReached: true }))).toBeNull();
  });

  it('treats a match saved before fullTimeReached existed as still in the second half', () => {
    expect(nextPeriodEnd(clock({ halftimeReached: true }))).toBe(3600);
  });
});

describe('elapsedAt', () => {
  it('returns the stored value while paused', () => {
    expect(elapsedAt(clock({ elapsedSeconds: 1234 }), 999_999)).toBe(1234);
  });

  it('adds the running time since the last start', () => {
    const c = clock({ elapsedSeconds: 100, running: true, lastStartedAt: 1_700_000_000_000 });
    expect(elapsedAt(c, 1_700_000_005_000)).toBe(105);
  });

  // Regression: the clock used to keep running past 60:00 until "Finalizar" was
  // pressed, so whoever was on court at the end got credited with 30:02+.
  const T0 = 1_700_000_000_000;

  it('never runs past 60:00 in the second half, even long after the buzzer', () => {
    const c = clock({ elapsedSeconds: 3590, running: true, lastStartedAt: T0, halftimeReached: true, secondHalfStarted: true });
    expect(elapsedAt(c, T0 + 12_000)).toBe(3600);
    expect(elapsedAt(c, T0 + 300_000)).toBe(3600);
  });

  it('never runs past 30:00 in the first half', () => {
    const c = clock({ elapsedSeconds: 1795, running: true, lastStartedAt: T0 });
    expect(elapsedAt(c, T0 + 60_000)).toBe(1800);
  });

  it('runs freely after 60:00 if resumed for a prórroga', () => {
    const c = clock({ elapsedSeconds: 3600, running: true, lastStartedAt: T0, halftimeReached: true, fullTimeReached: true });
    expect(elapsedAt(c, T0 + 30_000)).toBe(3630);
  });
});
