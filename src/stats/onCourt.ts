import type { MatchEvent } from '../domain/types';

export type CourtChangeEvent = Extract<MatchEvent, { eventType: 'court_change' }>;

/**
 * Court changes in the order they happened. Ties on match-clock time (every
 * lineup pick is at 0:00) fall back to when each was recorded: events come back
 * from the server sorted by their random id, so without this a player taken out
 * and put back in before kickoff could replay as out.
 */
export function courtChangesFor(events: MatchEvent[], playerId?: string): CourtChangeEvent[] {
  return events
    .filter((e): e is CourtChangeEvent => e.eventType === 'court_change' && (!playerId || e.playerId === playerId))
    .sort((a, b) => a.timestamp - b.timestamp || (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

/** True for the court changes of an attack-defense switch (see CourtChangeEventData.ad). */
export function isAttackDefenseChange(event: MatchEvent): boolean {
  return event.eventType === 'court_change' && event.eventData.ad !== undefined;
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

/** Who was on court at a given match-clock timestamp, replaying enter/exit events up to that moment. */
export function getOnCourtAt(events: MatchEvent[], timestamp: number): Set<string> {
  return getCurrentOnCourt(events.filter((e) => e.timestamp <= timestamp));
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
