import { describe, it, expect } from 'vitest';
import {
  parseStartTime,
  addMinutes,
  formatTime,
  calculateTotalMatchDuration,
  determineFinalPhase,
  resolveTeamName,
  translatePlaceholder,
  createInitialStandings,
  scheduleMatches,
} from '../scheduleHelpers';
import type { Match, Team, TournamentGroup } from '../../../types/tournament';

// =============================================================================
// parseStartTime
// =============================================================================

describe('parseStartTime', () => {
  it('parses ISO date format (YYYY-MM-DD)', () => {
    const result = parseStartTime('2026-03-15', '09:00');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2); // March = 2
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
  });

  it('parses German date format (DD.MM.YYYY)', () => {
    const result = parseStartTime('15.03.2026', '14:30');
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });

  it('falls back to today for unrecognized format', () => {
    const now = new Date();
    const result = parseStartTime('unknown', '10:00');
    expect(result.getFullYear()).toBe(now.getFullYear());
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(0);
  });

  it('handles time slot with single-digit hours', () => {
    const result = parseStartTime('2026-01-01', '9:05');
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(5);
  });

  it('sets seconds and milliseconds to 0', () => {
    const result = parseStartTime('2026-01-01', '12:00');
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });
});

// =============================================================================
// addMinutes
// =============================================================================

describe('addMinutes', () => {
  it('adds positive minutes', () => {
    const base = new Date(2026, 0, 1, 10, 0);
    const result = addMinutes(base, 30);
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(30);
  });

  it('adds negative minutes', () => {
    const base = new Date(2026, 0, 1, 10, 30);
    const result = addMinutes(base, -15);
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(15);
  });

  it('crosses hour boundary', () => {
    const base = new Date(2026, 0, 1, 10, 45);
    const result = addMinutes(base, 30);
    expect(result.getHours()).toBe(11);
    expect(result.getMinutes()).toBe(15);
  });

  it('does not mutate original date', () => {
    const base = new Date(2026, 0, 1, 10, 0);
    const originalTime = base.getTime();
    addMinutes(base, 30);
    expect(base.getTime()).toBe(originalTime);
  });
});

// =============================================================================
// formatTime
// =============================================================================

describe('formatTime', () => {
  it('formats with zero-padded hours and minutes', () => {
    expect(formatTime(new Date(2026, 0, 1, 9, 5))).toBe('09:05');
  });

  it('formats midnight as 00:00', () => {
    expect(formatTime(new Date(2026, 0, 1, 0, 0))).toBe('00:00');
  });

  it('formats afternoon time', () => {
    expect(formatTime(new Date(2026, 0, 1, 14, 30))).toBe('14:30');
  });
});

// =============================================================================
// calculateTotalMatchDuration
// =============================================================================

describe('calculateTotalMatchDuration', () => {
  it('returns gameDuration for 1 period', () => {
    expect(calculateTotalMatchDuration(10, 1, 2)).toBe(10);
  });

  it('adds halftime breaks for 2 periods', () => {
    // 10 min game + 1 break * 2 min = 12
    expect(calculateTotalMatchDuration(10, 2, 2)).toBe(12);
  });

  it('adds multiple breaks for 3 periods', () => {
    // 15 min game + 2 breaks * 3 min = 21
    expect(calculateTotalMatchDuration(15, 3, 3)).toBe(21);
  });

  it('returns gameDuration for 0 periods (edge case)', () => {
    expect(calculateTotalMatchDuration(10, 0, 5)).toBe(10);
  });
});

// =============================================================================
// determineFinalPhase
// =============================================================================

describe('determineFinalPhase', () => {
  const baseMatch: Match = {
    id: 'test',
    round: 1,
    field: 1,
    teamA: 'A',
    teamB: 'B',
  };

  it('returns "final" when finalType is set', () => {
    expect(determineFinalPhase({ ...baseMatch, finalType: 'thirdPlace' })).toBe('final');
  });

  it('detects roundOf16 from match id', () => {
    expect(determineFinalPhase({ ...baseMatch, id: 'r16-1' })).toBe('roundOf16');
  });

  it('detects quarterfinal from match id', () => {
    expect(determineFinalPhase({ ...baseMatch, id: 'qf1' })).toBe('quarterfinal');
  });

  it('detects semifinal from match id containing "sf"', () => {
    expect(determineFinalPhase({ ...baseMatch, id: 'sf-1' })).toBe('semifinal');
  });

  it('detects semifinal from match id containing "semi"', () => {
    expect(determineFinalPhase({ ...baseMatch, id: 'semi1' })).toBe('semifinal');
  });

  it('defaults to "final" for unknown id patterns', () => {
    expect(determineFinalPhase({ ...baseMatch, id: 'final' })).toBe('final');
  });
});

// =============================================================================
// translatePlaceholder
// =============================================================================

describe('translatePlaceholder', () => {
  it('translates group placeholder to German', () => {
    const result = translatePlaceholder('group-a-1st', 'de');
    expect(result).toBe('Gruppe A - 1. Platz');
  });

  it('translates group placeholder to English', () => {
    const result = translatePlaceholder('group-b-2nd', 'en');
    expect(result).toBe('Gruppe B - 2nd Place');
  });

  it('uses custom group name when provided', () => {
    const groups: TournamentGroup[] = [
      { id: 'A', customName: 'Lions' },
      { id: 'B', customName: 'Tigers' },
    ];
    const result = translatePlaceholder('group-a-1st', 'de', groups);
    expect(result).toBe('Lions - 1. Platz');
  });

  it('translates final placeholders (German)', () => {
    expect(translatePlaceholder('semi1-winner', 'de')).toBe('Sieger HF 1');
    expect(translatePlaceholder('qf1-loser', 'de')).toBe('Verlierer VF 1');
  });

  it('translates final placeholders (English)', () => {
    expect(translatePlaceholder('semi1-winner', 'en')).toBe('Winner SF 1');
    expect(translatePlaceholder('qf2-winner', 'en')).toBe('Winner QF 2');
  });

  it('returns original placeholder for unknown strings', () => {
    expect(translatePlaceholder('unknown-thing', 'de')).toBe('unknown-thing');
  });

  it('handles 3rd/4th ordinal suffixes in English', () => {
    const result = translatePlaceholder('group-c-3rd', 'en');
    expect(result).toBe('Gruppe C - 3rd Place');
  });

  it('handles 4th ordinal suffix in English', () => {
    const result = translatePlaceholder('group-d-4th', 'en');
    expect(result).toBe('Gruppe D - 4th Place');
  });
});

// =============================================================================
// resolveTeamName
// =============================================================================

describe('resolveTeamName', () => {
  const teamMap = new Map([
    ['team-1', 'FC Bayern'],
    ['team-2', 'BVB Dortmund'],
  ]);

  it('resolves known team ID to name', () => {
    expect(resolveTeamName('team-1', teamMap, 'de')).toBe('FC Bayern');
  });

  it('falls back to translatePlaceholder for unknown ID', () => {
    expect(resolveTeamName('group-a-1st', teamMap, 'de')).toBe('Gruppe A - 1. Platz');
  });

  it('passes groups through to translatePlaceholder', () => {
    const groups: TournamentGroup[] = [{ id: 'A', customName: 'Wolves' }];
    expect(resolveTeamName('group-a-1st', teamMap, 'en', groups)).toBe('Wolves - 1st Place');
  });
});

// =============================================================================
// createInitialStandings
// =============================================================================

describe('createInitialStandings', () => {
  it('creates standings with all zeros for each team', () => {
    const teams: Team[] = [
      { id: 't1', name: 'Team A' },
      { id: 't2', name: 'Team B' },
    ];
    const standings = createInitialStandings(teams);

    expect(standings).toHaveLength(2);
    expect(standings[0].team).toBe(teams[0]);
    expect(standings[0].played).toBe(0);
    expect(standings[0].won).toBe(0);
    expect(standings[0].drawn).toBe(0);
    expect(standings[0].lost).toBe(0);
    expect(standings[0].goalsFor).toBe(0);
    expect(standings[0].goalsAgainst).toBe(0);
    expect(standings[0].goalDifference).toBe(0);
    expect(standings[0].points).toBe(0);
  });

  it('returns empty array for empty teams', () => {
    expect(createInitialStandings([])).toEqual([]);
  });
});

// =============================================================================
// scheduleMatches
// =============================================================================

describe('scheduleMatches', () => {
  const teamMap = new Map([
    ['t1', 'Team A'],
    ['t2', 'Team B'],
    ['t3', 'Team C'],
    ['t4', 'Team D'],
  ]);

  it('schedules matches with correct times and numbers', () => {
    const matches: Match[] = [
      { id: 'm1', round: 1, field: 1, teamA: 't1', teamB: 't2', slot: 0 },
      { id: 'm2', round: 1, field: 2, teamA: 't3', teamB: 't4', slot: 0 },
      { id: 'm3', round: 2, field: 1, teamA: 't1', teamB: 't3', slot: 1 },
    ];

    const result = scheduleMatches({
      matches,
      startTime: new Date(2026, 0, 1, 10, 0),
      numberOfFields: 2,
      gameDuration: 10,
      breakDuration: 2,
      gamePeriods: 1,
      halftimeBreak: 0,
      phase: 'groupStage',
      teamMap,
      locale: 'de',
      startMatchNumber: 1,
    });

    expect(result).toHaveLength(3);
    // First slot: 10:00
    expect(result[0].time).toBe('10:00');
    expect(result[0].matchNumber).toBe(1);
    expect(result[0].homeTeam).toBe('Team A');
    expect(result[0].awayTeam).toBe('Team B');
    expect(result[1].time).toBe('10:00');
    expect(result[1].matchNumber).toBe(2);
    // Second slot: 10:00 + 10 (game) + 2 (break) = 10:12
    expect(result[2].time).toBe('10:12');
    expect(result[2].matchNumber).toBe(3);
  });

  it('calculates duration including halftime breaks', () => {
    const matches: Match[] = [
      { id: 'm1', round: 1, field: 1, teamA: 't1', teamB: 't2', slot: 0 },
    ];

    const result = scheduleMatches({
      matches,
      startTime: new Date(2026, 0, 1, 10, 0),
      numberOfFields: 1,
      gameDuration: 12,
      breakDuration: 3,
      gamePeriods: 2,
      halftimeBreak: 2,
      phase: 'groupStage',
      teamMap,
      locale: 'de',
      startMatchNumber: 1,
    });

    // 12 min game + 1 break * 2 min halftime = 14 min total
    expect(result[0].duration).toBe(14);
  });

  it('uses round-based sorting when slot is undefined', () => {
    const matches: Match[] = [
      { id: 'm2', round: 2, field: 1, teamA: 't3', teamB: 't4' },
      { id: 'm1', round: 1, field: 1, teamA: 't1', teamB: 't2' },
    ];

    const result = scheduleMatches({
      matches,
      startTime: new Date(2026, 0, 1, 10, 0),
      numberOfFields: 1,
      gameDuration: 10,
      breakDuration: 2,
      gamePeriods: 1,
      halftimeBreak: 0,
      phase: 'groupStage',
      teamMap,
      locale: 'de',
      startMatchNumber: 1,
    });

    // Round 1 (slot=0) should come first
    expect(result[0].homeTeam).toBe('Team A');
    expect(result[1].homeTeam).toBe('Team C');
  });

  it('sets phase to groupStage or detects final phase', () => {
    const matches: Match[] = [
      { id: 'semi1', round: 1, field: 1, teamA: 't1', teamB: 't2', isFinal: true, slot: 0 },
    ];

    const result = scheduleMatches({
      matches,
      startTime: new Date(2026, 0, 1, 10, 0),
      numberOfFields: 1,
      gameDuration: 10,
      breakDuration: 2,
      gamePeriods: 1,
      halftimeBreak: 0,
      phase: 'final',
      teamMap,
      locale: 'de',
      startMatchNumber: 1,
    });

    expect(result[0].phase).toBe('semifinal');
  });
});
