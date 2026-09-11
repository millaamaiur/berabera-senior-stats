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
  shots: number;
  goals: number;
  misses: number;
  shotPct: number;
  assists: number;
  turnovers: number;
  steps: number;
  yellowCards: number;
  redCards: number;
  blueCards: number;
  exclusions: number;
}

export function computeFieldPlayerStats(events: MatchEvent[], playerId: string): FieldPlayerStats {
  const own = events.filter((e) => e.playerId === playerId);
  const shots = own.filter((e) => e.eventType === 'shot');
  const goals = shots.filter((e) => e.eventType === 'shot' && e.eventData.result === 'goal').length;
  const shotsCount = shots.length;
  return {
    shots: shotsCount,
    goals,
    misses: shotsCount - goals,
    shotPct: shotsCount ? Math.round((goals / shotsCount) * 100) : 0,
    assists: own.filter((e) => e.eventType === 'assist').length,
    turnovers: own.filter((e) => e.eventType === 'turnover').length,
    steps: own.filter((e) => e.eventType === 'steps').length,
    yellowCards: own.filter((e) => e.eventType === 'card_yellow').length,
    redCards: own.filter((e) => e.eventType === 'card_red').length,
    blueCards: own.filter((e) => e.eventType === 'card_blue').length,
    exclusions: own.filter((e) => e.eventType === 'exclusion_2min').length,
  };
}

export interface GoalkeeperStats {
  shotsFaced: number;
  saves: number;
  goalsConceded: number;
  savePct: number;
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
  const saves = openPlay.filter((e) => e.eventData.result === 'save').length;
  const goalsConceded = openPlay.filter((e) => e.eventData.result === 'goal').length;
  const penaltiesSaved = penalties.filter((e) => e.eventData.result === 'save').length;
  const penaltiesConceded = penalties.filter((e) => e.eventData.result === 'goal').length;
  return {
    shotsFaced: openPlay.length,
    saves,
    goalsConceded,
    savePct: openPlay.length ? Math.round((saves / openPlay.length) * 100) : 0,
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
    const zone = zones[e.eventData.zone - 1];
    zone.shots++;
    if (e.eventData.result === 'goal') zone.goals++;
  }
  return zones;
}
