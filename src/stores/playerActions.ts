import { dataProvider } from '../data';
import { numberRangeFor, type Player, type Position } from '../domain/types';
import { createId } from '../utils/id';
import { useAppData } from './useAppData';
import { writeOrQueue } from '../data/offline/queue';

/** Returns an error message when the number is out of range or already used, otherwise null. */
export function validatePlayerNumber(
  number: number,
  position: Position,
  players: Player[],
  excludePlayerId?: string
): string | null {
  const range = numberRangeFor(position);
  if (!Number.isInteger(number) || number < range.min || number > range.max) {
    return `El dorsal debe estar entre ${range.min} y ${range.max}`;
  }
  const taken = players.some((p) => p.active && p.number === number && p.id !== excludePlayerId);
  if (taken) return `El dorsal ${number} ya lo tiene otro jugador`;
  return null;
}

/** Lowest jersey number in the position's range not currently used by an active player, or null if the range is full. */
export function suggestPlayerNumber(position: Position, players: Player[]): number | null {
  const range = numberRangeFor(position);
  const taken = new Set(players.filter((p) => p.active).map((p) => p.number));
  for (let n = range.min; n <= range.max; n++) {
    if (!taken.has(n)) return n;
  }
  return null;
}

export async function createPlayer(name: string, position: Position, number: number): Promise<void> {
  const player: Player = {
    id: createId('player'),
    name,
    position,
    number,
    active: true,
  };
  useAppData.setState((s) => ({ players: [...s.players, player] }));
  await writeOrQueue({ collection: 'players', method: 'upsert', payload: player }, () => dataProvider.players.upsert(player));
}

export async function updatePlayer(player: Player): Promise<void> {
  useAppData.setState((s) => ({ players: s.players.map((p) => (p.id === player.id ? player : p)) }));
  await writeOrQueue({ collection: 'players', method: 'upsert', payload: player }, () => dataProvider.players.upsert(player));
}

export async function toggleActive(player: Player): Promise<void> {
  await updatePlayer({ ...player, active: !player.active });
}
