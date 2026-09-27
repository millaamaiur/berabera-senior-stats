import { describe, expect, it } from 'vitest';
import type { Match, MatchEvent } from '../domain/types';
import {
  computeDefensiveOnCourtStats,
  computeFieldPlayerStats,
  computeGoalkeeperStats,
  computeMatchComparison,
  computeMatchScore,
  computeScoreDiffBuckets,
  computeScoreDiffTimeline,
  computeTeamMatchStats,
  computeTeamSeasonStats,
  computeTeamZoneStats,
  computeZoneStats,
  matchOutcome,
} from './matchStats';
import { courtChange, gkShot, shot, simple } from './testFixtures';

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    opponent: 'Rival',
    date: '2026-01-01',
    competition: 'Liga',
    isHome: true,
    calledPlayerIds: [],
    status: 'finished',
    clock: {
      elapsedSeconds: 3600,
      running: false,
      lastStartedAt: null,
      hasStartedOnce: true,
      halftimeReached: true,
      secondHalfStarted: true,
    },
    createdAt: 0,
    seasonId: 's1',
    ...overrides,
  };
}

describe('computeMatchScore', () => {
  it('counts our shot goals as goalsFor and rival gk_shot goals as goalsAgainst', () => {
    const events: MatchEvent[] = [
      shot('p1', 10, 'goal'),
      shot('p1', 20, 'miss'),
      gkShot('gk1', 30, 'goal', 5),
      gkShot('gk1', 40, 'save', 5),
    ];
    expect(computeMatchScore(events)).toEqual({ goalsFor: 1, goalsAgainst: 1 });
  });

  it('ignores non-scoring events', () => {
    const events = [simple('turnover', 'p1', 5), courtChange('p1', 0, 'enter')];
    expect(computeMatchScore(events)).toEqual({ goalsFor: 0, goalsAgainst: 0 });
  });
});

describe('matchOutcome', () => {
  it('resolves win, loss and draw', () => {
    expect(matchOutcome(5, 3)).toBe('win');
    expect(matchOutcome(3, 5)).toBe('loss');
    expect(matchOutcome(4, 4)).toBe('draw');
  });
});

describe('computeTeamSeasonStats', () => {
  it('only counts finished matches, and sums goals/results across them', () => {
    const finishedWin = makeMatch({ id: 'm1', status: 'finished' });
    const finishedLoss = makeMatch({ id: 'm2', status: 'finished' });
    const stillScheduled = makeMatch({ id: 'm3', status: 'scheduled' });
    const events: MatchEvent[] = [
      { ...shot('p1', 1, 'goal'), matchId: 'm1' },
      { ...shot('p1', 2, 'goal'), matchId: 'm1' },
      { ...gkShot('gk1', 3, 'goal', 5), matchId: 'm1' },
      { ...gkShot('gk1', 1, 'goal', 5), matchId: 'm2' },
      { ...gkShot('gk1', 2, 'goal', 5), matchId: 'm2' },
      { ...shot('p1', 3, 'goal'), matchId: 'm2' },
      { ...shot('p1', 1, 'goal'), matchId: 'm3' }, // scheduled — must not count
    ];

    const stats = computeTeamSeasonStats([finishedWin, finishedLoss, stillScheduled], events);
    expect(stats).toEqual({
      played: 2,
      wins: 1,
      losses: 1,
      draws: 0,
      goalsFor: 3,
      goalsAgainst: 3,
      goalDiff: 0,
    });
  });
});

describe('computeFieldPlayerStats', () => {
  it('combines open play and penalties in the headline shot numbers, and only counts the given player', () => {
    const events: MatchEvent[] = [
      shot('p1', 1, 'goal', { zone: 5 }),
      shot('p1', 2, 'miss', { zone: 3 }),
      shot('p1', 3, 'goal', { context: 'penalty' }),
      shot('p1', 4, 'miss', { context: 'penalty' }),
      shot('other', 5, 'goal'), // a different player — must not count
      simple('turnover', 'p1', 6),
      simple('recovery', 'p1', 7),
      simple('recovery', 'p1', 8),
      simple('card_yellow', 'p1', 9),
      simple('exclusion_2min', 'p1', 10),
    ];

    const stats = computeFieldPlayerStats(events, 'p1');
    expect(stats.shots).toBe(4);
    expect(stats.goals).toBe(2);
    expect(stats.misses).toBe(2);
    expect(stats.shotPct).toBe(50);
    expect(stats.penaltiesTaken).toBe(2);
    expect(stats.penaltiesScored).toBe(1);
    expect(stats.penaltyScorePct).toBe(50);
    expect(stats.turnovers).toBe(1);
    expect(stats.recoveries).toBe(2);
    expect(stats.yellowCards).toBe(1);
    expect(stats.exclusions).toBe(1);
  });

  it('returns zeroes instead of dividing by zero when the player never shot', () => {
    const stats = computeFieldPlayerStats([], 'p1');
    expect(stats.shotPct).toBe(0);
    expect(stats.penaltyScorePct).toBe(0);
  });
});

describe('computeGoalkeeperStats', () => {
  // Regression test: the headline numbers (shotsFaced/saves/goalsConceded/savePct)
  // used to be open-play-only, so a real match's "goles recibidos" undercounted
  // by however many penalties were scored against the keeper. They must always
  // match the team's real scoreline: open play + penalties combined.
  it('combines open play and penalty shots in the headline numbers, matching the real goals conceded', () => {
    const events: MatchEvent[] = [
      ...Array.from({ length: 19 }, (_, i) => gkShot('gk1', i, 'goal', 5, 'open_play')),
      gkShot('gk1', 100, 'goal', 5, 'penalty'),
      gkShot('gk1', 101, 'save', 5, 'open_play'),
    ];

    const stats = computeGoalkeeperStats(events, 'gk1');
    expect(stats.goalsConceded).toBe(20);
    expect(stats.shotsFaced).toBe(21);
    expect(stats.saves).toBe(1);
    expect(stats.openPlayGoalsConceded).toBe(19);
    expect(stats.penaltiesConceded).toBe(1);
  });

  it('excludes "Fuera" (miss) shots entirely — they never challenged the keeper', () => {
    const events: MatchEvent[] = [gkShot('gk1', 1, 'save', 5), gkShot('gk1', 2, 'goal', 5), gkShot('gk1', 3, 'miss')];
    const stats = computeGoalkeeperStats(events, 'gk1');
    expect(stats.shotsFaced).toBe(2);
    expect(stats.saves).toBe(1);
    expect(stats.goalsConceded).toBe(1);
    expect(stats.savePct).toBe(50);
  });
});

describe('computeDefensiveOnCourtStats', () => {
  it('only counts a rival attempt if the player was on court at that instant', () => {
    const events: MatchEvent[] = [
      courtChange('p1', 0, 'enter'),
      courtChange('p1', 10, 'exit'),
      gkShot('gk1', 5, 'goal', 5), // p1 on court — counts
      gkShot('gk1', 20, 'save', 5), // p1 off court by now — must not count
    ];
    const stats = computeDefensiveOnCourtStats(events, 'p1');
    expect(stats).toEqual({ attacksFaced: 1, goalsAgainst: 1, stopped: 0, stopPct: 0 });
  });

  it('does not credit or blame anyone on court for a "Fuera" (miss) shot', () => {
    const events: MatchEvent[] = [
      courtChange('p1', 0, 'enter'),
      gkShot('gk1', 5, 'save', 5), // a real stop — counts
      gkShot('gk1', 6, 'miss'), // wide — must not inflate stopped or attacksFaced
    ];
    const stats = computeDefensiveOnCourtStats(events, 'p1');
    expect(stats).toEqual({ attacksFaced: 1, goalsAgainst: 0, stopped: 1, stopPct: 100 });
  });
});

describe('computeZoneStats / computeTeamZoneStats', () => {
  it('skips shots with no zone ("Fuera") and buckets the rest by zone', () => {
    const events: MatchEvent[] = [
      shot('p1', 1, 'goal', { zone: 5 }),
      shot('p1', 2, 'miss', { zone: 5 }),
      shot('p1', 3, 'miss'), // "Fuera" — no zone, must be skipped
      shot('other', 4, 'goal', { zone: 5 }),
    ];
    const own = computeZoneStats(events, 'p1', 'shot');
    const zone5 = own.find((z) => z.zone === 5)!;
    expect(zone5).toEqual({ zone: 5, shots: 2, goals: 1 });
    expect(own.reduce((sum, z) => sum + z.shots, 0)).toBe(2);

    const team = computeTeamZoneStats(events, 'shot');
    const teamZone5 = team.find((z) => z.zone === 5)!;
    expect(teamZone5).toEqual({ zone: 5, shots: 3, goals: 2 });
  });

  it('skips a "Fuera" (miss) gk_shot too, since it has no zone to bucket', () => {
    const events: MatchEvent[] = [gkShot('gk1', 1, 'save', 5), gkShot('gk1', 2, 'miss')];
    const zones = computeTeamZoneStats(events, 'gk_shot');
    expect(zones.reduce((sum, z) => sum + z.shots, 0)).toBe(1);
  });
});

describe('computeTeamMatchStats', () => {
  it('sums shots/goals and gk numbers across every player', () => {
    const events: MatchEvent[] = [
      shot('p1', 1, 'goal'),
      shot('p2', 2, 'goal'),
      shot('p2', 3, 'miss'),
      gkShot('gk1', 4, 'save', 5),
      gkShot('gk1', 5, 'goal', 5),
      simple('exclusion_2min', 'p1', 6),
    ];
    const stats = computeTeamMatchStats(events);
    expect(stats.shots).toBe(3);
    expect(stats.goals).toBe(2);
    expect(stats.shotPct).toBe(67);
    expect(stats.shotsFaced).toBe(2);
    expect(stats.saves).toBe(1);
    expect(stats.goalsConceded).toBe(1);
    expect(stats.exclusions).toBe(1);
  });

  it('excludes "Fuera" (miss) gk_shot events from shotsFaced/saves/savePct', () => {
    const events: MatchEvent[] = [gkShot('gk1', 1, 'save', 5), gkShot('gk1', 2, 'miss')];
    const stats = computeTeamMatchStats(events);
    expect(stats.shotsFaced).toBe(1);
    expect(stats.saves).toBe(1);
    expect(stats.savePct).toBe(100);
  });
});

describe('computeMatchComparison', () => {
  // Regression test for the real bug: matches recorded before the penalty-shot
  // button existed have `shot` events with no `context` at all. Those goals
  // must still count as "open play" instead of vanishing from both totals.
  it('treats a shot with no context field as open play, not as neither', () => {
    const legacyGoal = shot('p1', 1, 'goal');
    delete (legacyGoal as { eventData?: { context?: string } }).eventData!.context;

    const comparison = computeMatchComparison([legacyGoal]);
    expect(comparison.us.goals).toBe(1);
    expect(comparison.us.openPlayGoals).toBe(1);
    expect(comparison.us.penaltiesTaken).toBe(0);
  });

  it('derives the rival shooting line from gk_shot, and infers their saves from our on-target misses', () => {
    const events: MatchEvent[] = [
      shot('p1', 1, 'goal', { zone: 5 }),
      shot('p1', 2, 'miss', { zone: 3 }), // on target, saved by rival keeper
      shot('p1', 3, 'miss'), // "Fuera" — never challenged their keeper, must not count
      gkShot('gk1', 4, 'goal', 5, 'penalty'),
      gkShot('gk1', 5, 'save', 5),
    ];
    const comparison = computeMatchComparison(events);

    expect(comparison.us.attempts).toBe(3);
    expect(comparison.us.goals).toBe(1);

    expect(comparison.rival.attempts).toBe(2);
    expect(comparison.rival.goals).toBe(1);
    expect(comparison.rival.penaltiesTaken).toBe(1);
    expect(comparison.rival.penaltiesScored).toBe(1);

    expect(comparison.ourShotsFaced).toBe(2);
    expect(comparison.ourSaves).toBe(1);
    expect(comparison.rivalShotsFaced).toBe(2); // the two on-target shots, "Fuera" excluded
    expect(comparison.rivalSaves).toBe(1); // our one on-target miss
  });

  it('counts a rival "Fuera" (miss) shot as one of their attempts, but not as one of our keeper\'s shots faced', () => {
    const events: MatchEvent[] = [gkShot('gk1', 1, 'save', 5), gkShot('gk1', 2, 'miss')];
    const comparison = computeMatchComparison(events);

    expect(comparison.rival.attempts).toBe(2); // the wide shot was still a real attempt on goal
    expect(comparison.rival.goals).toBe(0);
    expect(comparison.rival.shotPct).toBe(0);

    expect(comparison.ourShotsFaced).toBe(1); // but it never actually challenged the keeper
    expect(comparison.ourSaves).toBe(1);
    expect(comparison.ourSavePct).toBe(100);
  });
});

describe('computeScoreDiffTimeline', () => {
  it('steps the goal difference up/down exactly at each goal, holding steady between them', () => {
    const events: MatchEvent[] = [shot('p1', 100, 'goal'), gkShot('gk1', 200, 'goal', 5), shot('p1', 300, 'goal')];
    const points = computeScoreDiffTimeline(events, 400);

    expect(points[0]).toEqual({ t: 0, diff: 0 });
    // right before/after the first goal (us): 0 -> +1
    expect(points.some((p) => p.t === 100 && p.diff === 0)).toBe(true);
    expect(points.some((p) => p.t === 100 && p.diff === 1)).toBe(true);
    // right before/after the rival's goal: +1 -> 0
    expect(points.some((p) => p.t === 200 && p.diff === 1)).toBe(true);
    expect(points.some((p) => p.t === 200 && p.diff === 0)).toBe(true);
    // final point holds the last value through the end of the match
    expect(points.at(-1)).toEqual({ t: 400, diff: 1 });
  });

  it('with no goals at all, is just a flat line at 0', () => {
    const points = computeScoreDiffTimeline([], 600);
    expect(points.every((p) => p.diff === 0)).toBe(true);
  });
});

describe('computeScoreDiffBuckets', () => {
  it('samples the running diff at each bucket boundary', () => {
    const events: MatchEvent[] = [shot('p1', 90, 'goal'), shot('p1', 150, 'goal')];
    // 3 buckets of 60s over a 180s match: [0-60], [60-120], [120-180]
    const buckets = computeScoreDiffBuckets(events, 180, 60);

    expect(buckets).toHaveLength(3);
    expect(buckets[0]).toEqual({ t: 60, diff: 0 }); // before the first goal at t=90
    expect(buckets[1]).toEqual({ t: 120, diff: 1 }); // after the first goal, before the second
    expect(buckets[2]).toEqual({ t: 180, diff: 2 }); // after both goals
  });
});
