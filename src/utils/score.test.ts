import { describe, expect, it } from 'vitest';
import { formatScore } from './score';

describe('formatScore', () => {
  it('puts the home team first: us at home, the rival away', () => {
    expect(formatScore(true, 30, 20)).toBe('30 - 20');
    expect(formatScore(false, 30, 34)).toBe('34 - 30');
  });
});
