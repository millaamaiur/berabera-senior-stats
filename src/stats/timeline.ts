import type { MatchEvent, Player } from '../domain/types';

export type TimelineRow =
  | {
      kind: 'substitution';
      id: string;
      timestamp: number;
      playerOut: Player;
      playerIn: Player;
      outEvent: MatchEvent;
      inEvent: MatchEvent;
    }
  | { kind: 'single'; id: string; timestamp: number; event: MatchEvent };

/**
 * Builds the display rows for a match's event timeline, chronological (ascending):
 * - Starting-lineup picks (court_change events logged before kickoff, at t=0) are dropped.
 * - Two court_change events left at the same timestamp, with opposite actions and the
 *   SAME position (both field players, or both goalkeepers) are merged into one
 *   substitution row — so a double change (one field swap + one goalkeeper swap at
 *   once) never cross-pairs a goalkeeper with a field player.
 */
export function buildTimeline(events: MatchEvent[], players: Player[]): TimelineRow[] {
  const playerById = new Map(players.map((p) => [p.id, p]));
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
  const relevant = sorted.filter((e) => !(e.eventType === 'court_change' && e.timestamp === 0));

  const rows: TimelineRow[] = [];
  const consumed = new Set<string>();

  for (const event of relevant) {
    if (consumed.has(event.id)) continue;

    if (event.eventType === 'court_change') {
      const eventPlayer = playerById.get(event.playerId);
      const pair = eventPlayer
        ? relevant.find(
            (other): other is Extract<MatchEvent, { eventType: 'court_change' }> =>
              other.id !== event.id &&
              !consumed.has(other.id) &&
              other.eventType === 'court_change' &&
              other.timestamp === event.timestamp &&
              other.eventData.action !== event.eventData.action &&
              playerById.get(other.playerId)?.position === eventPlayer.position
          )
        : undefined;
      if (pair) {
        const outEvent = event.eventData.action === 'exit' ? event : pair;
        const inEvent = event.eventData.action === 'enter' ? event : pair;
        const playerOut = playerById.get(outEvent.playerId);
        const playerIn = playerById.get(inEvent.playerId);
        if (playerOut && playerIn) {
          consumed.add(event.id);
          consumed.add(pair.id);
          rows.push({
            kind: 'substitution',
            id: `${outEvent.id}-${inEvent.id}`,
            timestamp: event.timestamp,
            playerOut,
            playerIn,
            outEvent,
            inEvent,
          });
          continue;
        }
      }
    }

    rows.push({ kind: 'single', id: event.id, timestamp: event.timestamp, event });
  }

  return rows;
}
