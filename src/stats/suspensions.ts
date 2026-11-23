import type { AttackDefensePair, CourtSpot, MatchEvent, SuspensionEventData } from '../domain/types';
import { SUSPENSION_SECONDS } from '../domain/types';

/** One 2 minutos / roja / azul that took a player off court, as recorded. */
export interface Suspension {
  /** The 2 minutos / roja / azul event itself. */
  rootId: string;
  /** Who got it. */
  excludedId: string;
  /** Who left their spot empty for the 2 minutes (see SuspensionEventData). */
  outId: string;
  spot?: CourtSpot;
  /** Match-clock seconds. */
  start: number;
  end: number;
  autoReturn: boolean;
  permanent: boolean;
  /** Whether the automatic return has been recorded. */
  returned: boolean;
}

function suspensionData(event: MatchEvent): SuspensionEventData['suspension'] | undefined {
  if (event.eventType === 'exclusion_2min' || event.eventType === 'card_red' || event.eventType === 'card_blue') {
    return event.eventData?.suspension;
  }
  return undefined;
}

/** Every suspension of the match, in the order they happened. */
export function getSuspensions(events: MatchEvent[]): Suspension[] {
  const returned = new Set(
    events.flatMap((e) => (e.eventType === 'court_change' && e.eventData.back && e.eventData.excl ? [e.eventData.excl] : []))
  );
  return events
    .flatMap((event) => {
      const data = suspensionData(event);
      if (!data) return [];
      return [
        {
          rootId: event.id,
          excludedId: event.playerId,
          outId: data.outId,
          spot: data.spot,
          start: event.timestamp,
          end: event.timestamp + SUSPENSION_SECONDS,
          autoReturn: data.autoReturn,
          permanent: data.permanent,
          returned: returned.has(event.id),
        },
      ];
    })
    .sort((a, b) => a.start - b.start);
}

/** Suspensions whose 2 minutes are still running at `now` (match-clock seconds). */
export function activeSuspensions(suspensions: Suspension[], now: number): Suspension[] {
  return suspensions.filter((s) => now < s.end);
}

/**
 * Players who can't be brought on right now: anyone still serving their 2
 * minutes (and whoever left their spot for a new keeper, until it's over),
 * and anyone sent off for good.
 */
export function blockedPlayerIds(suspensions: Suspension[], now: number): Set<string> {
  const blocked = new Set<string>();
  for (const s of suspensions) {
    if (s.permanent) blocked.add(s.excludedId);
    if (now < s.end) {
      blocked.add(s.excludedId);
      blocked.add(s.outId);
    }
  }
  return blocked;
}

/**
 * Who comes back when a suspension's 2 minutes are up: whoever left the spot,
 * unless they're in an attack-defense pair — then whoever of the pair plays
 * the phase the court is in (read off another pair with just one of its two
 * on court). With no such pair to tell the phase, it's whoever left.
 */
export function returnerFor(
  suspension: Suspension,
  adPairs: AttackDefensePair[],
  onCourt: ReadonlySet<string>
): string {
  const pair = adPairs.find((p) => p.attackerId === suspension.outId || p.defenderId === suspension.outId);
  const phasePair = adPairs.find((p) => p !== pair && onCourt.has(p.attackerId) !== onCourt.has(p.defenderId));
  if (!pair || !phasePair) return suspension.outId;
  return onCourt.has(phasePair.attackerId) ? pair.attackerId : pair.defenderId;
}

/** How many 2 minutos this player already has — the 3rd one is a disqualification. */
export function exclusionCount(events: MatchEvent[], playerId: string): number {
  return events.filter((e) => e.eventType === 'exclusion_2min' && e.playerId === playerId).length;
}

/**
 * The event and everything a suspension recorded with it (court changes,
 * the automatic return), so it's undone or deleted as one. Any other event
 * is just itself.
 */
export function suspensionGroup(events: MatchEvent[], id: string): MatchEvent[] {
  const event = events.find((e) => e.id === id);
  if (!event) return [];
  const rootId = event.eventType === 'court_change' && event.eventData.excl ? event.eventData.excl : event.id;
  const root = events.find((e) => e.id === rootId);
  if (!root || !suspensionData(root)) return [event];
  return events.filter((e) => e.id === rootId || (e.eventType === 'court_change' && e.eventData.excl === rootId));
}
