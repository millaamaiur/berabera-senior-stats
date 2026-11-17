import { playerRepository } from '../supabase/playerRepository';
import { matchRepository } from '../supabase/matchRepository';
import { eventRepository } from '../supabase/eventRepository';
import { seasonRepository } from '../supabase/seasonRepository';
import { useSyncStatus } from '../../stores/useSyncStatus';
import { useAuthStore } from '../../stores/useAuthStore';
import { applyPendingOps, isRetryableError, type PendingCollection, type PendingOp } from './pending';
import { loadSnapshot, saveSnapshot } from './snapshot';

const QUEUE_KEY = 'bbs:pendingQueue';
const FAILED_KEY = 'bbs:failedQueue';

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

/** Everything recorded on this device that hasn't reached Supabase yet, laid over `items` — see applyPendingOps. */
export function withPendingWrites<T extends { id: string }>(items: T[], collection: PendingCollection): T[] {
  return applyPendingOps(items, readQueue(), collection);
}

/**
 * Keeps the offline snapshot in step with every write that reaches Supabase.
 * It's otherwise only refreshed by a full reload, so a match reopened offline
 * would be missing whatever was recorded online since (the lineup, the first
 * goals...) — all safely on the server, but not on screen to keep scoring from.
 */
function recordInSnapshot(op: QueueableOp): void {
  const { collection } = op;
  saveSnapshot(collection, applyPendingOps(loadSnapshot<{ id: string }>(collection), [{ ...op, id: '' } as PendingOp], collection));
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
 * retryable failure (offline, or the session not refreshed yet — leaves it at
 * the front to retry later). A write the server actually rejects is set aside
 * into a separate failed-queue instead, so one permanently-broken op can never
 * block everything queued behind it.
 */
export async function flushQueue(): Promise<void> {
  // Without a session every write is rejected, which would wrongly move still-good
  // ops into the failed-queue for good — so wait until the app is unlocked again.
  if (flushing || !useAuthStore.getState().unlocked) return;
  flushing = true;
  useSyncStatus.getState().setSyncing(true);
  try {
    let queue = readQueue();
    while (queue.length > 0) {
      try {
        await runOp(queue[0]);
        recordInSnapshot(queue[0]);
        queue = queue.slice(1);
        writeQueue(queue);
      } catch (error) {
        if (isRetryableError(error, navigator.onLine)) break;
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

/**
 * Gives every set-aside write another go, back at the front of the queue in
 * its original order. Returns how many are still failing afterwards.
 */
export async function retryFailed(): Promise<number> {
  const failed = readFailedQueue();
  if (failed.length > 0) {
    writeFailedQueue([]);
    writeQueue([...failed, ...readQueue()]);
  }
  await flushQueue();
  return readFailedQueue().length;
}

/** Runs a write against Supabase; if it fails (offline or otherwise), queues it for later instead of throwing. */
export async function writeOrQueue(op: QueueableOp, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch {
    enqueue(op);
    return;
  }
  recordInSnapshot(op);
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
