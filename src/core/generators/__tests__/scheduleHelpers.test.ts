import { describe, it, expect } from 'vitest';
import {
  parseStartTime,
  addMinutes,
  formatTime,
  calculateTotalMatchDuration,
  determineFinalPhase,
  createInitialStandings,
  scheduleMatches,
} from '../scheduleHelpers';
import type { Match, Team } from '../../../types/tournament';
import { testUuid, vs, slots, groupRank, resultOf, withStaleSides } from '../../../test/matchSlotFixtures';

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
    ...slots(groupRank('A', 1), groupRank('A', 2)),
  };

  it('A-12a Platzierungsspiel (finalType gesetzt, Phase final) → final', () => {
    expect(determineFinalPhase({ ...baseMatch, finalType: 'thirdPlace', phase: 'final' })).toBe('final');
  });

  it.each(['roundOf16', 'quarterfinal', 'semifinal', 'final'] as const)('A-12a Phase vom Generator: %s bleibt %s', (phase) => {
    expect(determineFinalPhase({ ...baseMatch, phase })).toBe(phase);
  });

  it.each(['r16-1', 'qf1', 'sf-1', 'semi1'])(
    'A-12a C-FINALPHASE-AUS-ID Gegenbeispiel: ohne Phase wird nichts aus der Spiel-ID „%s“ geraten → final',
    (id) => {
      expect(determineFinalPhase({ ...baseMatch, id })).toBe('final');
    },
  );

  it('A-12a Gegenbeispiel: eine unbekannte Phase (groupStage, Tippfehler) zählt im Finalzweig als final', () => {
    expect(determineFinalPhase({ ...baseMatch, phase: 'groupStage' })).toBe('final');
    expect(determineFinalPhase({ ...baseMatch, phase: 'semiFinal' })).toBe('final');
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
//
// A-03: `translatePlaceholder` / `resolveTeamName` sind durch `slotLabel` ersetzt – ihre Aussagen
// (Gruppenrang mit Gruppennamen, Sieger/Verlierer, unbekannt) stehen in
// src/core/models/__tests__/slotLabel.test.ts; hier prüfen die Tests, dass der Spielplan sie nutzt.
// =============================================================================

describe('scheduleMatches', () => {
  const [T1, T2, T3, T4] = [1, 2, 3, 4].map(testUuid);
  const teams: Team[] = [
    { id: T1, name: 'Team A' },
    { id: T2, name: 'Team B' },
    { id: T3, name: 'Team C' },
    { id: T4, name: 'Team D' },
  ];
  const base = {
    startTime: new Date(2026, 0, 1, 10, 0),
    breakDuration: 2,
    gamePeriods: 1,
    halftimeBreak: 0,
    teams,
    locale: 'de' as const,
    startMatchNumber: 1,
  };

  it('schedules matches with correct times and numbers', () => {
    const matches: Match[] = [
      { id: 'm1', round: 1, field: 1, ...vs(T1, T2), slot: 0 },
      { id: 'm2', round: 1, field: 2, ...vs(T3, T4), slot: 0 },
      { id: 'm3', round: 2, field: 1, ...vs(T1, T3), slot: 1 },
    ];

    const result = scheduleMatches({ ...base, matches, numberOfFields: 2, gameDuration: 10, phase: 'groupStage' });

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
    const matches: Match[] = [{ id: 'm1', round: 1, field: 1, ...vs(T1, T2), slot: 0 }];

    const result = scheduleMatches({
      ...base,
      matches,
      numberOfFields: 1,
      gameDuration: 12,
      breakDuration: 3,
      gamePeriods: 2,
      halftimeBreak: 2,
      phase: 'groupStage',
    });

    // 12 min game + 1 break * 2 min halftime = 14 min total
    expect(result[0].duration).toBe(14);
  });

  it('uses round-based sorting when slot is undefined', () => {
    const matches: Match[] = [
      { id: 'm2', round: 2, field: 1, ...vs(T3, T4) },
      { id: 'm1', round: 1, field: 1, ...vs(T1, T2) },
    ];

    const result = scheduleMatches({ ...base, matches, numberOfFields: 1, gameDuration: 10, phase: 'groupStage' });

    // Round 1 (slot=0) should come first
    expect(result[0].homeTeam).toBe('Team A');
    expect(result[1].homeTeam).toBe('Team C');
  });

  it('A-12a Finalspiel trägt die Phase vom Generator, Gruppenspiel groupStage', () => {
    const matches: Match[] = [
      { id: testUuid(301), round: 1, field: 1, ...vs(T1, T2), isFinal: true, phase: 'semifinal', slot: 0 },
      { id: testUuid(302), round: 1, field: 2, ...vs(T3, T4), slot: 0 },
    ];

    const result = scheduleMatches({ ...base, matches, numberOfFields: 2, gameDuration: 10, phase: 'final' });

    expect(result.map((m) => m.phase)).toEqual(['semifinal', 'groupStage']);
  });

  it('@TM-015 offene Seite zeigt im Spielplan ihre Herkunft, besetzte Seite den Namen', () => {
    const semi1 = testUuid(201);
    const matches: Match[] = [
      { id: semi1, round: 1, field: 1, ...slots(groupRank('A', 2), groupRank('B', 1)), isFinal: true, slot: 0, label: '1. Halbfinale' },
      { id: testUuid(202), round: 2, field: 1, ...slots(resultOf(semi1, 'winner'), resultOf(semi1, 'loser')), isFinal: true, slot: 1 },
    ];

    const result = scheduleMatches({ ...base, matches, numberOfFields: 1, gameDuration: 10, phase: 'final' });

    expect(result[0].homeTeam).toBe('tournament:slot.groupRank');
    expect(result[1].homeTeam).toBe('tournament:slot.winnerOf');
    expect(result[1].awayTeam).toBe('tournament:slot.loserOf');
  });

  it('@TM-033 Gegenbeispiel: ein Teamname im Übergangsfeld teamA wird nicht angezeigt', () => {
    const matches: Match[] = [
      withStaleSides({ id: 'm1', round: 1, field: 1, ...vs(T1, T2), slot: 0 }, 'Team B', 'Team A'),
    ];

    const result = scheduleMatches({ ...base, matches, numberOfFields: 1, gameDuration: 10, phase: 'groupStage' });

    expect(result[0].homeTeam).toBe('Team A');
    expect(result[0].awayTeam).toBe('Team B');
  });
});
