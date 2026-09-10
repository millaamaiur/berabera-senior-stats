import type { MatchEvent } from '../domain/types';

type CourtChangeEvent = Extract<MatchEvent, { eventType: 'court_change' }>;

function courtChangesFor(events: MatchEvent[], playerId?: string): CourtChangeEvent[] {
  return events
    .filter((e): e is CourtChangeEvent => e.eventType === 'court_change' && (!playerId || e.playerId === playerId))
    .sort((a, b) => a.timestamp - b.timestamp);
}

/** Players currently marked as on-court, derived purely from enter/exit events. */
export function getCurrentOnCourt(events: MatchEvent[]): Set<string> {
  const onCourt = new Set<string>();
  for (const e of courtChangesFor(events)) {
    if (e.eventData.action === 'enter') onCourt.add(e.playerId);
    else onCourt.delete(e.playerId);
  }
  return onCourt;
}

/**
 * Minutes played by a player, in seconds, from paired enter/exit intervals.
 * Does not assume any fixed number of players on court at once.
 */
export function computeMinutesPlayed(events: MatchEvent[], playerId: string, nowSeconds: number): number {
  let total = 0;
  let enteredAt: number | null = null;
  for (const change of courtChangesFor(events, playerId)) {
    if (change.eventData.action === 'enter') {
      if (enteredAt === null) enteredAt = change.timestamp;
    } else if (enteredAt !== null) {
      total += Math.max(0, change.timestamp - enteredAt);
      enteredAt = null;
    }
  }
  if (enteredAt !== null) {
    total += Math.max(0, nowSeconds - enteredAt);
  }
  return total;
}
