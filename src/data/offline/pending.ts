import type { Match, MatchEvent, Player, Season } from '../../domain/types';

export type PendingOp =
  | { id: string; collection: 'players'; method: 'upsert'; payload: Player }
  | { id: string; collection: 'matches'; method: 'upsert'; payload: Match }
  | { id: string; collection: 'matches'; method: 'delete'; payload: string }
  | { id: string; collection: 'events'; method: 'add'; payload: MatchEvent }
  | { id: string; collection: 'events'; method: 'update'; payload: MatchEvent }
  | { id: string; collection: 'events'; method: 'delete'; payload: string }
  | { id: string; collection: 'seasons'; method: 'upsert'; payload: Season };

export type PendingCollection = PendingOp['collection'];

/**
 * Lays writes still waiting to upload over data loaded from Supabase or the
 * offline snapshot, in the order they were made — so the screen shows
 * everything recorded on this device even before it reaches the server (e.g.
 * reopening a match with no wifi). Re-applying a write the server already has
 * is harmless: it's the same record.
 */
export function applyPendingOps<T extends { id: string }>(items: T[], ops: PendingOp[], collection: PendingCollection): T[] {
  let result = items;
  for (const op of ops) {
    if (op.collection !== collection) continue;
    if (op.method === 'delete') {
      result = result.filter((item) => item.id !== op.payload);
    } else {
      const record = op.payload as unknown as T;
      result = result.some((item) => item.id === record.id)
        ? result.map((item) => (item.id === record.id ? record : item))
        : [...result, record];
    }
  }
  return result;
}

/**
 * Whether a failed write should stay queued to retry, rather than be set aside
 * for good:
 * - No connection: the request never reached the server.
 * - No error code: same — a plain network failure, not a server answer.
 * - An auth error (PostgREST's PGRST3xx JWT errors, or Postgres 42501, RLS
 *   refusing a request without a valid session): happens when the connection
 *   comes back before the session has refreshed. The write itself is fine and
 *   will go through once the session is.
 * Any other coded error is a real rejection (e.g. its match was deleted).
 */
export function isRetryableError(error: unknown, online: boolean): boolean {
  if (!online) return true;
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code !== 'string' || code === '') return true;
  return code.startsWith('PGRST3') || code === '42501';
}
