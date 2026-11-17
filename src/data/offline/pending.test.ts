import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../../domain/types';
import { applyPendingOps, isRetryableError, type PendingOp } from './pending';
import { counterTurnover, shot } from '../../stats/testFixtures';

describe('applyPendingOps', () => {
  const onServer = shot('p1', 10, 'goal', { zone: 5 });
  const offlineGoal = shot('p1', 20, 'goal', { zone: 3 });
  const offlineTurnover = counterTurnover('p2', 30);

  // Regression: reopening a match with no wifi used to show only the last
  // server/snapshot copy, silently dropping whatever was recorded offline.
  it('adds what was recorded offline on top of what the server/snapshot had', () => {
    const ops: PendingOp[] = [
      { id: 'q1', collection: 'events', method: 'add', payload: offlineGoal },
      { id: 'q2', collection: 'events', method: 'add', payload: offlineTurnover },
    ];
    expect(applyPendingOps([onServer], ops, 'events').map((e) => e.id)).toEqual([onServer.id, offlineGoal.id, offlineTurnover.id]);
  });

  it('applies edits and deletes in order — an offline Deshacer removes the event again', () => {
    const edited: MatchEvent = { ...onServer, timestamp: 11 };
    const ops: PendingOp[] = [
      { id: 'q1', collection: 'events', method: 'update', payload: edited },
      { id: 'q2', collection: 'events', method: 'add', payload: offlineGoal },
      { id: 'q3', collection: 'events', method: 'delete', payload: offlineGoal.id },
    ];
    expect(applyPendingOps([onServer], ops, 'events')).toEqual([edited]);
  });

  it('is harmless when the server already has the write, and ignores other collections', () => {
    const ops: PendingOp[] = [
      { id: 'q1', collection: 'events', method: 'add', payload: onServer },
      { id: 'q2', collection: 'matches', method: 'delete', payload: 'm1' },
    ];
    expect(applyPendingOps([onServer], ops, 'events')).toEqual([onServer]);
  });
});

describe('isRetryableError', () => {
  it('retries anything while offline, and plain network failures with no error code', () => {
    expect(isRetryableError({ code: '23503' }, false)).toBe(true);
    expect(isRetryableError(new TypeError('Failed to fetch'), true)).toBe(true);
  });

  // Regression: coming back online before the session refreshed got these
  // classified as permanent, so the writes were set aside and never uploaded.
  it('retries auth errors instead of giving up on the write', () => {
    expect(isRetryableError({ code: 'PGRST303' }, true)).toBe(true);
    expect(isRetryableError({ code: 'PGRST301' }, true)).toBe(true);
    expect(isRetryableError({ code: '42501' }, true)).toBe(true);
  });

  it('gives up on a real rejection, like a foreign key to a deleted match', () => {
    expect(isRetryableError({ code: '23503' }, true)).toBe(false);
  });
});
