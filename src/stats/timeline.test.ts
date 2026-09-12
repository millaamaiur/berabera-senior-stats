import { describe, expect, it } from 'vitest';
import type { Player } from '../domain/types';
import { buildTimeline } from './timeline';
import { courtChange, shot } from './testFixtures';

const fieldA: Player = { id: 'fieldA', name: 'Field A', position: 'player', number: 4, active: true };
const fieldB: Player = { id: 'fieldB', name: 'Field B', position: 'player', number: 5, active: true };
const gkA: Player = { id: 'gkA', name: 'GK A', position: 'goalkeeper', number: 1, active: true };
const gkB: Player = { id: 'gkB', name: 'GK B', position: 'goalkeeper', number: 2, active: true };
const players = [fieldA, fieldB, gkA, gkB];

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

  it('sorts every row chronologically', () => {
    const events = [shot('fieldA', 200, 'goal'), shot('fieldA', 50, 'miss')];
    const rows = buildTimeline(events, players);
    expect(rows.map((r) => r.timestamp)).toEqual([50, 200]);
  });
});
