import type { Match, MatchEvent, Zone } from '../domain/types';
import { getOnCourtAt } from './onCourt';

export interface MatchScore {
  goalsFor: number;
  goalsAgainst: number;
}

export type MatchOutcome = 'win' | 'loss' | 'draw';

/**
 * Team score derived from events: goals scored by field players (`shot`)
 * vs. goals conceded by our goalkeepers (`gk_shot` with result 'goal').
 */
export function computeMatchScore(events: MatchEvent[]): MatchScore {
  let goalsFor = 0;
  let goalsAgainst = 0;
  for (const e of events) {
    if (e.eventType === 'shot' && e.eventData.result === 'goal') goalsFor++;
    if (e.eventType === 'gk_shot' && e.eventData.result === 'goal') goalsAgainst++;
  }
  return { goalsFor, goalsAgainst };
}

export function matchOutcome(goalsFor: number, goalsAgainst: number): MatchOutcome {
  if (goalsFor > goalsAgainst) return 'win';
  if (goalsFor < goalsAgainst) return 'loss';
  return 'draw';
}

export interface TeamSeasonStats {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
}

export function computeTeamSeasonStats(matches: Match[], events: MatchEvent[]): TeamSeasonStats {
  const stats: TeamSeasonStats = { played: 0, wins: 0, losses: 0, draws: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0 };
  for (const match of matches) {
    if (match.status !== 'finished') continue;
    const matchEvents = events.filter((e) => e.matchId === match.id);
    const { goalsFor, goalsAgainst } = computeMatchScore(matchEvents);
    stats.played++;
    stats.goalsFor += goalsFor;
    stats.goalsAgainst += goalsAgainst;
    const outcome = matchOutcome(goalsFor, goalsAgainst);
    if (outcome === 'win') stats.wins++;
    else if (outcome === 'loss') stats.losses++;
    else stats.draws++;
  }
  stats.goalDiff = stats.goalsFor - stats.goalsAgainst;
  return stats;
}

export interface FieldPlayerStats {
  /** Open play + penalties combined. */
  shots: number;
  goals: number;
  misses: number;
  shotPct: number;
  penaltiesTaken: number;
  penaltiesScored: number;
  penaltyScorePct: number;
  turnovers: number;
  recoveries: number;
  steps: number;
  yellowCards: number;
  redCards: number;
  blueCards: number;
  exclusions: number;
}

export function computeFieldPlayerStats(events: MatchEvent[], playerId: string): FieldPlayerStats {
  const own = events.filter((e) => e.playerId === playerId);
  const shots = own.filter((e): e is Extract<MatchEvent, { eventType: 'shot' }> => e.eventType === 'shot');
  const penalties = shots.filter((e) => e.eventData.context === 'penalty');
  const goals = shots.filter((e) => e.eventData.result === 'goal').length;
  const penaltiesScored = penalties.filter((e) => e.eventData.result === 'goal').length;
  const shotsCount = shots.length;
  return {
    shots: shotsCount,
    goals,
    misses: shotsCount - goals,
    shotPct: shotsCount ? Math.round((goals / shotsCount) * 100) : 0,
    penaltiesTaken: penalties.length,
    penaltiesScored,
    penaltyScorePct: penalties.length ? Math.round((penaltiesScored / penalties.length) * 100) : 0,
    turnovers: own.filter((e) => e.eventType === 'turnover').length,
    recoveries: own.filter((e) => e.eventType === 'recovery').length,
    steps: own.filter((e) => e.eventType === 'steps').length,
    yellowCards: own.filter((e) => e.eventType === 'card_yellow').length,
    redCards: own.filter((e) => e.eventType === 'card_red').length,
    blueCards: own.filter((e) => e.eventType === 'card_blue').length,
    exclusions: own.filter((e) => e.eventType === 'exclusion_2min').length,
  };
}

export interface GoalkeeperStats {
  /** Open play + penalties combined — this is what should always match the team's real goals-against. */
  shotsFaced: number;
  saves: number;
  goalsConceded: number;
  savePct: number;
  /** Open-play-only breakdown, for whoever wants shot-stopping numbers without penalties mixed in. */
  openPlayShotsFaced: number;
  openPlaySaves: number;
  openPlayGoalsConceded: number;
  openPlaySavePct: number;
  penaltiesFaced: number;
  penaltiesSaved: number;
  penaltiesConceded: number;
  penaltySavePct: number;
}

export function computeGoalkeeperStats(events: MatchEvent[], playerId: string): GoalkeeperStats {
  const own = events.filter(
    (e): e is Extract<MatchEvent, { eventType: 'gk_shot' }> => e.eventType === 'gk_shot' && e.playerId === playerId
  );
  const openPlay = own.filter((e) => e.eventData.context === 'open_play');
  const penalties = own.filter((e) => e.eventData.context === 'penalty');
  const openPlaySaves = openPlay.filter((e) => e.eventData.result === 'save').length;
  const openPlayGoalsConceded = openPlay.filter((e) => e.eventData.result === 'goal').length;
  const penaltiesSaved = penalties.filter((e) => e.eventData.result === 'save').length;
  const penaltiesConceded = penalties.filter((e) => e.eventData.result === 'goal').length;
  const shotsFaced = openPlay.length + penalties.length;
  const saves = openPlaySaves + penaltiesSaved;
  const goalsConceded = openPlayGoalsConceded + penaltiesConceded;
  return {
    shotsFaced,
    saves,
    goalsConceded,
    savePct: shotsFaced ? Math.round((saves / shotsFaced) * 100) : 0,
    openPlayShotsFaced: openPlay.length,
    openPlaySaves,
    openPlayGoalsConceded,
    openPlaySavePct: openPlay.length ? Math.round((openPlaySaves / openPlay.length) * 100) : 0,
    penaltiesFaced: penalties.length,
    penaltiesSaved,
    penaltiesConceded,
    penaltySavePct: penalties.length ? Math.round((penaltiesSaved / penalties.length) * 100) : 0,
  };
}

export interface DefensiveOnCourtStats {
  attacksFaced: number;
  goalsAgainst: number;
  stopped: number;
  stopPct: number;
}

/**
 * For a given player, tallies the rival shots faced (`gk_shot`, recorded against
 * whichever goalkeeper was on court) that happened while THEY were on court —
 * regardless of position — so every player gets a "goals conceded while playing"
 * and "defensive stop %" figure, not just the goalkeeper who faced the shot.
 */
export function computeDefensiveOnCourtStats(events: MatchEvent[], playerId: string): DefensiveOnCourtStats {
  let goalsAgainst = 0;
  let stopped = 0;
  for (const e of events) {
    if (e.eventType !== 'gk_shot') continue;
    if (!getOnCourtAt(events, e.timestamp).has(playerId)) continue;
    if (e.eventData.result === 'goal') goalsAgainst++;
    else stopped++;
  }
  const attacksFaced = goalsAgainst + stopped;
  return {
    attacksFaced,
    goalsAgainst,
    stopped,
    stopPct: attacksFaced ? Math.round((stopped / attacksFaced) * 100) : 0,
  };
}

export interface ZoneStat {
  zone: Zone;
  shots: number;
  goals: number;
}

/** Zone breakdown (3x3 grid) for either a shooter (`shot`) or a goalkeeper (`gk_shot`). */
export function computeZoneStats(events: MatchEvent[], playerId: string, kind: 'shot' | 'gk_shot'): ZoneStat[] {
  const zones: ZoneStat[] = Array.from({ length: 9 }, (_, i) => ({ zone: (i + 1) as Zone, shots: 0, goals: 0 }));
  for (const e of events) {
    if (e.playerId !== playerId || e.eventType !== kind) continue;
    if (e.eventData.zone === undefined) continue; // "fuera" — missed the frame, no in-goal placement to bucket
    const zone = zones[e.eventData.zone - 1];
    zone.shots++;
    if (e.eventData.result === 'goal') zone.goals++;
  }
  return zones;
}

/** Same breakdown as computeZoneStats, but for every player at once — the team's overall shot map. */
export function computeTeamZoneStats(events: MatchEvent[], kind: 'shot' | 'gk_shot'): ZoneStat[] {
  const zones: ZoneStat[] = Array.from({ length: 9 }, (_, i) => ({ zone: (i + 1) as Zone, shots: 0, goals: 0 }));
  for (const e of events) {
    if (e.eventType !== kind) continue;
    if (e.eventData.zone === undefined) continue;
    const zone = zones[e.eventData.zone - 1];
    zone.shots++;
    if (e.eventData.result === 'goal') zone.goals++;
  }
  return zones;
}

export interface TeamMatchStats {
  /** Open play + penalties combined. */
  shots: number;
  goals: number;
  shotPct: number;
  turnovers: number;
  recoveries: number;
  steps: number;
  yellowCards: number;
  redCards: number;
  blueCards: number;
  exclusions: number;
  shotsFaced: number;
  saves: number;
  goalsConceded: number;
  savePct: number;
}

/** The same tallies as computeFieldPlayerStats/computeGoalkeeperStats, but summed over the whole team for one match. */
export function computeTeamMatchStats(events: MatchEvent[]): TeamMatchStats {
  const shots = events.filter((e): e is Extract<MatchEvent, { eventType: 'shot' }> => e.eventType === 'shot');
  const goals = shots.filter((e) => e.eventData.result === 'goal').length;
  const gkShots = events.filter((e): e is Extract<MatchEvent, { eventType: 'gk_shot' }> => e.eventType === 'gk_shot');
  const saves = gkShots.filter((e) => e.eventData.result === 'save').length;
  const goalsConceded = gkShots.filter((e) => e.eventData.result === 'goal').length;
  return {
    shots: shots.length,
    goals,
    shotPct: shots.length ? Math.round((goals / shots.length) * 100) : 0,
    turnovers: events.filter((e) => e.eventType === 'turnover').length,
    recoveries: events.filter((e) => e.eventType === 'recovery').length,
    steps: events.filter((e) => e.eventType === 'steps').length,
    yellowCards: events.filter((e) => e.eventType === 'card_yellow').length,
    redCards: events.filter((e) => e.eventType === 'card_red').length,
    blueCards: events.filter((e) => e.eventType === 'card_blue').length,
    exclusions: events.filter((e) => e.eventType === 'exclusion_2min').length,
    shotsFaced: gkShots.length,
    saves,
    goalsConceded,
    savePct: gkShots.length ? Math.round((saves / gkShots.length) * 100) : 0,
  };
}

export interface ShootingLine {
  /** Every attempt we know about — on target or wide. */
  attempts: number;
  goals: number;
  shotPct: number;
  openPlayGoals: number;
  penaltiesTaken: number;
  penaltiesScored: number;
}

export interface MatchComparison {
  us: ShootingLine;
  rival: ShootingLine;
  ourShotsFaced: number;
  ourSaves: number;
  ourSavePct: number;
  rivalShotsFaced: number;
  rivalSaves: number;
  rivalSavePct: number;
}

/**
 * Best-effort two-team comparison from what the event log actually contains.
 * We only ever record OUR discrete actions (shots, cards, turnovers...) — the
 * rival team only shows up indirectly, through `gk_shot` (their shots against
 * our keeper). That's enough to reconstruct their shooting/scoring line, but
 * two approximations are unavoidable:
 * - Their "attempts" only include shots that challenged our keeper (there's no
 *   button for "rival shot wide", so a truly off-target rival attempt is
 *   simply never logged at all).
 * - Their "saves" (by our keeper's rival counterpart) are inferred as our own
 *   on-target misses — i.e. `shot` events with a zone (not "Fuera") that
 *   didn't go in — since only on-target attempts can be saved.
 *
 * "Open play" is also anything that ISN'T tagged `context: 'penalty'`, rather
 * than requiring `context === 'open_play'` — matches recorded before the
 * penalty-shot button existed have no `context` on their `shot` events at
 * all, and every one of those was necessarily a regular attempt (there was
 * no other kind to record), so treating "not a penalty" as "open play" keeps
 * old matches' numbers correct instead of quietly dropping their goals.
 */
export function computeMatchComparison(events: MatchEvent[]): MatchComparison {
  const ourShots = events.filter((e): e is Extract<MatchEvent, { eventType: 'shot' }> => e.eventType === 'shot');
  const rivalShots = events.filter((e): e is Extract<MatchEvent, { eventType: 'gk_shot' }> => e.eventType === 'gk_shot');
  const ourOnTarget = ourShots.filter((e) => e.eventData.zone !== undefined);

  const us: ShootingLine = {
    attempts: ourShots.length,
    goals: ourShots.filter((e) => e.eventData.result === 'goal').length,
    shotPct: 0,
    openPlayGoals: ourShots.filter((e) => e.eventData.context !== 'penalty' && e.eventData.result === 'goal').length,
    penaltiesTaken: ourShots.filter((e) => e.eventData.context === 'penalty').length,
    penaltiesScored: ourShots.filter((e) => e.eventData.context === 'penalty' && e.eventData.result === 'goal').length,
  };
  us.shotPct = us.attempts ? Math.round((us.goals / us.attempts) * 100) : 0;

  const rival: ShootingLine = {
    attempts: rivalShots.length,
    goals: rivalShots.filter((e) => e.eventData.result === 'goal').length,
    shotPct: 0,
    openPlayGoals: rivalShots.filter((e) => e.eventData.context !== 'penalty' && e.eventData.result === 'goal').length,
    penaltiesTaken: rivalShots.filter((e) => e.eventData.context === 'penalty').length,
    penaltiesScored: rivalShots.filter((e) => e.eventData.context === 'penalty' && e.eventData.result === 'goal').length,
  };
  rival.shotPct = rival.attempts ? Math.round((rival.goals / rival.attempts) * 100) : 0;

  const ourShotsFaced = rivalShots.length;
  const ourSaves = rivalShots.filter((e) => e.eventData.result === 'save').length;
  const rivalShotsFaced = ourOnTarget.length;
  const rivalSaves = ourOnTarget.filter((e) => e.eventData.result === 'miss').length;

  return {
    us,
    rival,
    ourShotsFaced,
    ourSaves,
    ourSavePct: ourShotsFaced ? Math.round((ourSaves / ourShotsFaced) * 100) : 0,
    rivalShotsFaced,
    rivalSaves,
    rivalSavePct: rivalShotsFaced ? Math.round((rivalSaves / rivalShotsFaced) * 100) : 0,
  };
}

export interface ScoreDiffPoint {
  /** Match-clock seconds. */
  t: number;
  /** Goals for us minus goals for the rival, as it stood at this instant. */
  diff: number;
}

/** A step function of the goal difference over time — "who was ahead, and by how much, at any point in the match." */
export function computeScoreDiffTimeline(events: MatchEvent[], durationSeconds: number): ScoreDiffPoint[] {
  const goals = events
    .filter(
      (e): e is Extract<MatchEvent, { eventType: 'shot' | 'gk_shot' }> =>
        (e.eventType === 'shot' && e.eventData.result === 'goal') || (e.eventType === 'gk_shot' && e.eventData.result === 'goal')
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  const points: ScoreDiffPoint[] = [{ t: 0, diff: 0 }];
  let diff = 0;
  for (const e of goals) {
    points.push({ t: e.timestamp, diff });
    diff += e.eventType === 'shot' ? 1 : -1;
    points.push({ t: e.timestamp, diff });
  }
  points.push({ t: Math.max(durationSeconds, goals.at(-1)?.timestamp ?? 0), diff });
  return points;
}

/** The same goal-difference-over-time story, sampled every `bucketSeconds` (default 5 min) instead of at every single goal — one bar per bucket, easier to read at a glance. */
export function computeScoreDiffBuckets(
  events: MatchEvent[],
  durationSeconds: number,
  bucketSeconds = 300
): ScoreDiffPoint[] {
  const timeline = computeScoreDiffTimeline(events, durationSeconds);
  const numBuckets = Math.max(1, Math.ceil(durationSeconds / bucketSeconds));
  const buckets: ScoreDiffPoint[] = [];
  let idx = 0;
  let currentDiff = 0;
  for (let b = 0; b < numBuckets; b++) {
    const bucketEnd = Math.min((b + 1) * bucketSeconds, durationSeconds);
    while (idx < timeline.length && timeline[idx].t <= bucketEnd) {
      currentDiff = timeline[idx].diff;
      idx++;
    }
    buckets.push({ t: bucketEnd, diff: currentDiff });
  }
  return buckets;
}
