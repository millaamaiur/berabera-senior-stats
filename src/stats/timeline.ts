import type { MatchEvent, Phase, Player } from '../domain/types';
import { isAttackDefenseChange } from './onCourt';

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
  | { kind: 'single'; id: string; timestamp: number; event: MatchEvent }
  /** One tap on ATAQUE / DEFENSA: every pair that swapped at that moment. */
  | { kind: 'ad_switch'; id: string; timestamp: number; to: Phase; playersIn: Player[]; playersOut: Player[] }
  /** The automatic return once a player's 2 minutes are up. */
  | { kind: 'excl_back'; id: string; timestamp: number; player: Player }
  /** Another keeper in goal while ours serves 2 minutos, and the field player who made room. */
  | { kind: 'excl_cover'; id: string; timestamp: number; playerIn: Player; playerOut?: Player };

/**
 * Rows that can be opened in the event editor. An attack-defense switch is
 * undone by switching back, and a suspension's court changes go with its
 * 2 minutos / roja / azul row.
 */
export type EditableTimelineRow = Extract<TimelineRow, { kind: 'single' | 'substitution' }>;

/**
 * Builds the display rows for a match's event timeline, chronological (ascending):
 * - Starting-lineup picks (court_change events logged before kickoff, at t=0) are dropped.
 * - The court changes of one attack-defense switch (same second, same direction)
 *   become a single 'ad_switch' row, and are never paired up as a substitution.
 * - Two other court_change events left at the same timestamp, with opposite actions and the
 *   SAME position (both field players, or both goalkeepers) are merged into one
 *   substitution row — so a double change (one field swap + one goalkeeper swap at
 *   once) never cross-pairs a goalkeeper with a field player.
 */
export function buildTimeline(events: MatchEvent[], players: Player[]): TimelineRow[] {
  const playerById = new Map(players.map((p) => [p.id, p]));
  // Same second: in the order they were recorded (ids are random, so they're only a last resort).
  const sorted = [...events].sort(
    (a, b) => a.timestamp - b.timestamp || (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id)
  );
  const relevant = sorted.filter((e) => !(e.eventType === 'court_change' && e.timestamp === 0));

  const rows: TimelineRow[] = [];
  const consumed = new Set<string>();

  for (const event of relevant) {
    if (consumed.has(event.id)) continue;

    // A suspension's own court changes: the exit is already told by its
    // 2 minutos / roja / azul row, so only the return and a keeper change show.
    if (event.eventType === 'court_change' && event.eventData.excl) {
      consumed.add(event.id);
      const player = playerById.get(event.playerId);
      const rootId = event.eventData.excl;
      if (player && event.eventData.back) {
        rows.push({ kind: 'excl_back', id: event.id, timestamp: event.timestamp, player });
      } else if (player && event.eventData.action === 'enter') {
        const excludedId = events.find((e) => e.id === rootId)?.playerId;
        const madeRoom = relevant.find(
          (o) =>
            o.eventType === 'court_change' &&
            o.eventData.excl === rootId &&
            o.eventData.action === 'exit' &&
            !o.eventData.back &&
            o.playerId !== excludedId
        );
        rows.push({
          kind: 'excl_cover',
          id: event.id,
          timestamp: event.timestamp,
          playerIn: player,
          playerOut: madeRoom ? playerById.get(madeRoom.playerId) : undefined,
        });
      }
      continue;
    }

    if (event.eventType === 'court_change' && event.eventData.ad) {
      const to: Phase = event.eventData.ad;
      const batch = relevant.filter(
        (other) =>
          !consumed.has(other.id) &&
          other.eventType === 'court_change' &&
          other.eventData.ad === to &&
          other.timestamp === event.timestamp
      );
      for (const e of batch) consumed.add(e.id);
      const who = (action: 'enter' | 'exit') =>
        batch
          .filter((e) => e.eventType === 'court_change' && e.eventData.action === action)
          .map((e) => playerById.get(e.playerId))
          .filter((p): p is Player => p !== undefined);
      rows.push({
        kind: 'ad_switch',
        id: `ad-${event.id}`,
        timestamp: event.timestamp,
        to,
        playersIn: who('enter'),
        playersOut: who('exit'),
      });
      continue;
    }

    if (event.eventType === 'court_change') {
      const eventPlayer = playerById.get(event.playerId);
      const pair = eventPlayer
        ? relevant.find(
            (other): other is Extract<MatchEvent, { eventType: 'court_change' }> =>
              other.id !== event.id &&
              !consumed.has(other.id) &&
              other.eventType === 'court_change' &&
              !isAttackDefenseChange(other) &&
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

/** The small line a suspension's return or keeper change gets in a timeline. */
export function describeSuspensionRow(row: Extract<TimelineRow, { kind: 'excl_back' | 'excl_cover' }>): string {
  if (row.kind === 'excl_back') return `Vuelve ${row.player.name} · fin de los 2 minutos`;
  return `Entra ${row.playerIn.name} a la portería${row.playerOut ? ` · sale ${row.playerOut.name}` : ''}`;
}

/** "Defensa · entran Ane, Leire" — the one line an attack-defense switch gets in a timeline. */
export function describeAttackDefenseSwitch(row: Extract<TimelineRow, { kind: 'ad_switch' }>): string {
  const names = row.playersIn.map((p) => p.name).join(', ');
  return `${row.to === 'defense' ? 'Defensa' : 'Ataque'} · entra${row.playersIn.length > 1 ? 'n' : ''} ${names}`;
}
