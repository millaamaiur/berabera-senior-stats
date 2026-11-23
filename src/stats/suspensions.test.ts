import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../domain/types';
import { activeSuspensions, blockedPlayerIds, exclusionCount, getSuspensions, returnerFor, suspensionGroup } from './suspensions';
import { computeMinutesPlayed } from './onCourt';

function exclusion(id: string, playerId: string, timestamp: number, opts: { outId?: string; autoReturn?: boolean; permanent?: boolean } = {}): MatchEvent {
  return {
    id,
    matchId: 'm1',
    playerId,
    timestamp,
    eventType: 'exclusion_2min',
    eventData: {
      suspension: { outId: opts.outId ?? playerId, spot: 'left_back', autoReturn: opts.autoReturn ?? true, permanent: opts.permanent ?? false },
    },
  } as MatchEvent;
}

function change(id: string, playerId: string, timestamp: number, action: 'enter' | 'exit', excl?: string, back?: boolean): MatchEvent {
  return {
    id,
    matchId: 'm1',
    playerId,
    timestamp,
    eventType: 'court_change',
    eventData: { action, ...(excl ? { excl } : {}), ...(back ? { back: true } : {}) },
  } as MatchEvent;
}

describe('getSuspensions', () => {
  it('runs for 2 minutes of match clock from the exclusion', () => {
    const [s] = getSuspensions([exclusion('x1', 'p7', 600)]);
    expect(s).toMatchObject({ rootId: 'x1', excludedId: 'p7', outId: 'p7', start: 600, end: 720, returned: false });
  });

  it('knows when the automatic return has been recorded', () => {
    const events = [exclusion('x1', 'p7', 600), change('c1', 'p7', 600, 'exit', 'x1'), change('c2', 'p7', 720, 'enter', 'x1', true)];
    expect(getSuspensions(events)[0].returned).toBe(true);
  });

  it('ignores exclusions recorded before suspensions were tracked', () => {
    const legacy = { id: 'old', matchId: 'm1', playerId: 'p7', timestamp: 600, eventType: 'exclusion_2min' } as MatchEvent;
    expect(getSuspensions([legacy])).toHaveLength(0);
  });
});

describe('who can come on', () => {
  it('blocks the excluded player only while the 2 minutes run', () => {
    const suspensions = getSuspensions([exclusion('x1', 'p7', 600)]);
    expect(blockedPlayerIds(suspensions, 700).has('p7')).toBe(true);
    expect(blockedPlayerIds(suspensions, 720).has('p7')).toBe(false);
    expect(activeSuspensions(suspensions, 719)).toHaveLength(1);
    expect(activeSuspensions(suspensions, 720)).toHaveLength(0);
  });

  it('blocks a sent-off player for good', () => {
    const suspensions = getSuspensions([exclusion('x1', 'p7', 600, { autoReturn: false, permanent: true })]);
    expect(blockedPlayerIds(suspensions, 5000).has('p7')).toBe(true);
  });

  it('blocks both the keeper and the field player who made room for the new one', () => {
    const suspensions = getSuspensions([exclusion('x1', 'gk1', 600, { outId: 'p14' })]);
    const blocked = blockedPlayerIds(suspensions, 650);
    expect(blocked.has('gk1')).toBe(true);
    expect(blocked.has('p14')).toBe(true);
  });
});

describe('exclusionCount', () => {
  it('counts the 2 minutos a player already has', () => {
    const events = [exclusion('x1', 'p7', 100), exclusion('x2', 'p7', 900), exclusion('x3', 'p9', 950)];
    expect(exclusionCount(events, 'p7')).toBe(2);
  });
});

describe('suspensionGroup', () => {
  const events = [
    change('in', 'p7', 0, 'enter'),
    exclusion('x1', 'p7', 600),
    change('c1', 'p7', 600, 'exit', 'x1'),
    change('c2', 'p7', 720, 'enter', 'x1', true),
  ];

  it('takes the exclusion with its exit and return', () => {
    expect(suspensionGroup(events, 'x1').map((e) => e.id).sort()).toEqual(['c1', 'c2', 'x1']);
    expect(suspensionGroup(events, 'c1').map((e) => e.id).sort()).toEqual(['c1', 'c2', 'x1']);
  });

  it('leaves any other event on its own', () => {
    expect(suspensionGroup(events, 'in').map((e) => e.id)).toEqual(['in']);
  });
});

describe('minutes with a suspension', () => {
  it('leaves the 2 minutes off the player’s time on court', () => {
    const events = [
      change('in', 'p7', 0, 'enter'),
      exclusion('x1', 'p7', 600),
      change('c1', 'p7', 600, 'exit', 'x1'),
      change('c2', 'p7', 720, 'enter', 'x1', true),
    ];
    expect(computeMinutesPlayed(events, 'p7', 1200)).toBe(1080);
  });
});

describe('returnerFor', () => {
  const [s] = getSuspensions([exclusion('x1', 'att1', 600)]);
  const pairs = [
    { attackerId: 'att1', defenderId: 'def1' },
    { attackerId: 'att2', defenderId: 'def2' },
  ];

  it('brings back whoever left when there are no pairs', () => {
    expect(returnerFor(s, [], new Set(['def2']))).toBe('att1');
  });

  it('brings back the pair’s defender while the other pair is defending', () => {
    expect(returnerFor(s, pairs, new Set(['def2']))).toBe('def1');
  });

  it('brings back the pair’s attacker while the other pair is attacking', () => {
    expect(returnerFor(s, pairs, new Set(['att2']))).toBe('att1');
  });

  it('falls back to whoever left when no other pair tells the phase', () => {
    expect(returnerFor(s, pairs.slice(0, 1), new Set())).toBe('att1');
  });
});
