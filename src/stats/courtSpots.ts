import type { CourtSpot, MatchEvent, Player, Position } from '../domain/types';
import { courtChangesFor } from './onCourt';

/** Field spots in the order a player with no saved spot is placed into them. */
export const FIELD_SPOTS: CourtSpot[] = ['center_back', 'left_back', 'right_back', 'left_wing', 'right_wing', 'pivot'];

export const SPOT_LABELS: Record<CourtSpot, string> = {
  left_wing: 'Extremo izq.',
  left_back: 'Lateral izq.',
  center_back: 'Central',
  right_back: 'Lateral der.',
  right_wing: 'Extremo der.',
  pivot: 'Pivote',
  goalkeeper: 'Portero',
};

/** Which kind of player can stand on a spot: the keeper's spot is for goalkeepers only, the rest for field players. */
export function positionForSpot(spot: CourtSpot): Position {
  return spot === 'goalkeeper' ? 'goalkeeper' : 'player';
}

/**
 * Where each player currently on court is drawn, as spot → player id.
 *
 * Replays the court changes: a player entering with a spot takes it, unless
 * someone still holds it. Anyone left without a spot (events from before the
 * court layout existed, or a clash) is then put in the first free spot of their
 * kind, lowest shirt number first, so the drawing is the same on every device.
 */
export function getCourtSpots(events: MatchEvent[], players: Player[]): Map<CourtSpot, string> {
  const spotOf = new Map<string, CourtSpot | null>();
  const holderOf = new Map<CourtSpot, string>();

  for (const change of courtChangesFor(events)) {
    const playerId = change.playerId;
    if (change.eventData.action === 'enter') {
      if (spotOf.has(playerId)) continue; // already on court
      const wanted = change.eventData.spot;
      if (wanted && !holderOf.has(wanted)) {
        spotOf.set(playerId, wanted);
        holderOf.set(wanted, playerId);
      } else {
        spotOf.set(playerId, null);
      }
    } else {
      const held = spotOf.get(playerId);
      if (held) holderOf.delete(held);
      spotOf.delete(playerId);
    }
  }

  const playerById = new Map(players.map((p) => [p.id, p]));
  const unplaced = [...spotOf.entries()]
    .filter(([, spot]) => spot === null)
    .map(([id]) => playerById.get(id))
    .filter((p): p is Player => p !== undefined)
    .sort((a, b) => a.number - b.number);

  for (const player of unplaced) {
    const candidates: CourtSpot[] = player.position === 'goalkeeper' ? ['goalkeeper'] : FIELD_SPOTS;
    const free = candidates.find((spot) => !holderOf.has(spot));
    if (free) holderOf.set(free, player.id);
  }

  return holderOf;
}
