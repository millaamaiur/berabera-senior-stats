import { FULLTIME_SECONDS, HALFTIME_SECONDS, type MatchClock } from './types';

/** Where the clock has to stop next (30:00, then 60:00), or null once past both — e.g. a cup match's prórroga. */
export function nextPeriodEnd(clock: MatchClock): number | null {
  if (!clock.halftimeReached) return HALFTIME_SECONDS;
  if (!clock.fullTimeReached) return FULLTIME_SECONDS;
  return null;
}

/**
 * Elapsed match seconds at `now`. While running, it's capped at the next period
 * end, so neither the on-screen clock nor an event's timestamp can overshoot
 * 30:00/60:00 in the gap before the auto-pause kicks in — about a second
 * normally, but much longer if the device slept through the buzzer.
 */
export function elapsedAt(clock: MatchClock, now: number): number {
  if (!clock.running || !clock.lastStartedAt) return clock.elapsedSeconds;
  const raw = clock.elapsedSeconds + (now - clock.lastStartedAt) / 1000;
  const end = nextPeriodEnd(clock);
  return end === null ? raw : Math.min(raw, end);
}
