import { describe, expect, it } from 'vitest';
import type { MatchEvent, Player } from '../domain/types';
import { buildTimeline } from './timeline';
import { courtChange, shot } from './testFixtures';

const fieldA: Player = { id: 'fieldA', name: 'Field A', position: 'player', number: 4, active: true };
const fieldB: Player = { id: 'fieldB', name: 'Field B', position: 'player', number: 5, active: true };
const gkA: Player = { id: 'gkA', name: 'GK A', position: 'goalkeeper', number: 1, active: true };
const gkB: Player = { id: 'gkB', name: 'GK B', position: 'goalkeeper', number: 2, active: true };
const fieldC: Player = { id: 'fieldC', name: 'Field C', position: 'player', number: 6, active: true };
const fieldD: Player = { id: 'fieldD', name: 'Field D', position: 'player', number: 7, active: true };
const players = [fieldA, fieldB, gkA, gkB, fieldC, fieldD];

describe('buildTimeline', () => {
  it('drops the starting lineup (court_change at t=0)', () => {
    const rows = buildTimeline([courtChange('fieldA', 0, 'enter')], players);
    expect(rows).toHaveLength(0);
  });

  it('pairs a same-timestamp, same-position exit/enter into one substitution row', () => {
    const rows = buildTimeline([courtChange('fieldA', 300, 'exit'), courtChange('fieldB', 300, 'enter')], players);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'substitution', playerOut: fieldA, playerIn: fieldB, timestamp: 300 });
  });

  // Regression test: a simultaneous field-player swap + goalkeeper swap must
  // pair each leg with its own position, never a field player with a keeper.
  it('never cross-pairs a field-player leg with a goalkeeper leg at the same timestamp', () => {
    const events = [
      courtChange('fieldA', 300, 'exit'),
      courtChange('fieldB', 300, 'enter'),
      courtChange('gkA', 300, 'exit'),
      courtChange('gkB', 300, 'enter'),
    ];
    const rows = buildTimeline(events, players);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.kind === 'substitution')).toHaveLength(2);
    const fieldSwap = rows.find((r) => r.kind === 'substitution' && r.playerOut.id === 'fieldA');
    const gkSwap = rows.find((r) => r.kind === 'substitution' && r.playerOut.id === 'gkA');
    expect(fieldSwap).toMatchObject({ playerIn: fieldB });
    expect(gkSwap).toMatchObject({ playerIn: gkB });
  });

  it('leaves an unpaired court_change (no matching partner) as a single row', () => {
    const rows = buildTimeline([courtChange('fieldA', 300, 'exit')], players);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('single');
  });

  it('shows one attack-defense switch as a single row, not as substitutions', () => {
    const events = [
      courtChange('fieldA', 300, 'exit', 'defense'),
      courtChange('fieldB', 300, 'enter', 'defense'),
      courtChange('fieldC', 300, 'exit', 'defense'),
      courtChange('fieldD', 300, 'enter', 'defense'),
    ];
    const rows = buildTimeline(events, players);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'ad_switch', to: 'defense', timestamp: 300 });
    if (rows[0].kind !== 'ad_switch') throw new Error('expected an ad_switch row');
    expect(rows[0].playersIn.map((p) => p.id).sort()).toEqual(['fieldB', 'fieldD']);
    expect(rows[0].playersOut.map((p) => p.id).sort()).toEqual(['fieldA', 'fieldC']);
  });

  it('never pairs a substitution with an attack-defense change in the same second', () => {
    const events = [
      courtChange('fieldA', 300, 'exit', 'defense'),
      courtChange('fieldB', 300, 'enter', 'defense'),
      courtChange('fieldC', 300, 'exit'),
      courtChange('fieldD', 300, 'enter'),
    ];
    const rows = buildTimeline(events, players);
    expect(rows.map((r) => r.kind).sort()).toEqual(['ad_switch', 'substitution']);
    expect(rows.find((r) => r.kind === 'substitution')).toMatchObject({ playerOut: fieldC, playerIn: fieldD });
  });

  it('shows a 2 minutos with only its return, never as substitutions', () => {
    const root = {
      id: 'x1',
      matchId: 'm1',
      playerId: 'fieldA',
      timestamp: 600,
      eventType: 'exclusion_2min',
      eventData: { suspension: { outId: 'fieldA', autoReturn: true, permanent: false } },
    } as MatchEvent;
    const exit = { ...courtChange('fieldA', 600, 'exit'), eventData: { action: 'exit', excl: 'x1' } } as MatchEvent;
    const back = { ...courtChange('fieldA', 720, 'enter'), eventData: { action: 'enter', excl: 'x1', back: true } } as MatchEvent;
    const rows = buildTimeline([root, exit, back], players);
    expect(rows.map((r) => r.kind)).toEqual(['single', 'excl_back']);
    expect(rows[1]).toMatchObject({ timestamp: 720, player: fieldA });
  });

  it('shows the keeper change of a goalkeeper’s 2 minutos with who made room', () => {
    // Recorded as one batch: the 2 minutos first, then its court changes.
    const root = {
      id: 'x2',
      matchId: 'm1',
      playerId: 'gkA',
      timestamp: 600,
      createdAt: 1000,
      eventType: 'exclusion_2min',
      eventData: { suspension: { outId: 'fieldA', autoReturn: true, permanent: false } },
    } as MatchEvent;
    const events = [
      root,
      { ...courtChange('gkA', 600, 'exit'), createdAt: 1001, eventData: { action: 'exit', excl: 'x2' } } as MatchEvent,
      {
        ...courtChange('gkB', 600, 'enter'),
        createdAt: 1002,
        eventData: { action: 'enter', spot: 'goalkeeper', excl: 'x2' },
      } as MatchEvent,
      { ...courtChange('fieldA', 600, 'exit'), createdAt: 1003, eventData: { action: 'exit', excl: 'x2' } } as MatchEvent,
    ];
    const rows = buildTimeline(events, players);
    expect(rows.map((r) => r.kind)).toEqual(['single', 'excl_cover']);
    expect(rows[1]).toMatchObject({ playerIn: gkB, playerOut: fieldA });
  });

  it('sorts every row chronologically', () => {
    const events = [shot('fieldA', 200, 'goal'), shot('fieldA', 50, 'miss')];
    const rows = buildTimeline(events, players);
    expect(rows.map((r) => r.timestamp)).toEqual([50, 200]);
  });
});
