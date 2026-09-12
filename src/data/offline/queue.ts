import { playerRepository } from '../supabase/playerRepository';
import { matchRepository } from '../supabase/matchRepository';
import { eventRepository } from '../supabase/eventRepository';
import { seasonRepository } from '../supabase/seasonRepository';
import type { Match, MatchEvent, Player, Season } from '../../domain/types';
import { useSyncStatus } from '../../stores/useSyncStatus';

const QUEUE_KEY = 'bbs:pendingQueue';
const FAILED_KEY = 'bbs:failedQueue';

type PendingOp =
  | { id: string; collection: 'players'; method: 'upsert'; payload: Player }
  | { id: string; collection: 'matches'; method: 'upsert'; payload: Match }
  | { id: string; collection: 'matches'; method: 'delete'; payload: string }
  | { id: string; collection: 'events'; method: 'add'; payload: MatchEvent }
  | { id: string; collection: 'events'; method: 'update'; payload: MatchEvent }
  | { id: string; collection: 'events'; method: 'delete'; payload: string }
  | { id: string; collection: 'seasons'; method: 'upsert'; payload: Season };

export type QueueableOp = Omit<PendingOp, 'id'>;

function readQueue(): PendingOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingOp[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingOp[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // storage unavailable — the write is lost from the queue, nothing more we can do locally.
  }
  useSyncStatus.getState().setPendingCount(queue.length);
}

function readFailedQueue(): PendingOp[] {
  try {
    const raw = localStorage.getItem(FAILED_KEY);
    return raw ? (JSON.parse(raw) as PendingOp[]) : [];
  } catch {
    return [];
  }
}

function writeFailedQueue(list: PendingOp[]): void {
  try {
    localStorage.setItem(FAILED_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable — nothing more we can do locally.
  }
  useSyncStatus.getState().setFailedCount(list.length);
}

/**
 * Tells apart "we're offline, try again later" from "the server definitively
 * rejected this." A real Postgres/PostgREST rejection always carries an error
 * `code` (e.g. a foreign-key violation because the match this event pointed
 * at was deleted while the write sat in the queue); a request that never
 * reached the server at all (no wifi) throws a plain fetch failure with no
 * such code. Only the second case is worth retrying — retrying the first
 * forever would just wait for a rejection that will never change.
 */
function isConnectivityError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const code = (error as { code?: unknown } | null)?.code;
  return !code;
}

function runOp(op: PendingOp): Promise<void> {
  switch (op.collection) {
    case 'players':
      return playerRepository.upsert(op.payload);
    case 'matches':
      return op.method === 'upsert' ? matchRepository.upsert(op.payload) : matchRepository.delete(op.payload);
    case 'events':
      if (op.method === 'add') return eventRepository.add(op.payload);
      if (op.method === 'update') return eventRepository.update(op.payload);
      return eventRepository.delete(op.payload);
    case 'seasons':
      return seasonRepository.upsert(op.payload);
  }
}

function enqueue(op: QueueableOp): void {
  const queue = readQueue();
  queue.push({ ...op, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` } as PendingOp);
  writeQueue(queue);
}

let flushing = false;

/**
 * Replays the pending queue against Supabase, in order. Stops at the first
 * connectivity failure (still offline — leaves it at the front to retry
 * later). A write the server actually rejects is set aside into a separate
 * failed-queue instead, so one permanently-broken op can never block
 * everything queued behind it.
 */
export async function flushQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  useSyncStatus.getState().setSyncing(true);
  try {
    let queue = readQueue();
    while (queue.length > 0) {
      try {
        await runOp(queue[0]);
        queue = queue.slice(1);
        writeQueue(queue);
      } catch (error) {
        if (isConnectivityError(error)) break;
        writeFailedQueue([...readFailedQueue(), queue[0]]);
        queue = queue.slice(1);
        writeQueue(queue);
      }
    }
  } finally {
    flushing = false;
    useSyncStatus.getState().setSyncing(false);
  }
}

/** Runs a write against Supabase; if it fails (offline or otherwise), queues it for later instead of throwing. */
export async function writeOrQueue(op: QueueableOp, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch {
    enqueue(op);
  }
}

let started = false;

/** Call once at app startup: reports the queue length and starts retrying it. */
export function initOfflineSync(): void {
  if (started) return;
  started = true;
  useSyncStatus.getState().setPendingCount(readQueue().length);
  useSyncStatus.getState().setFailedCount(readFailedQueue().length);
  window.addEventListener('online', () => void flushQueue());
  setInterval(() => void flushQueue(), 20_000);
  void flushQueue();
}
