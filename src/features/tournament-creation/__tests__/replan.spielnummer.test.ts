/**
 * Neuplanung schreibt die Spielnummer mit (Befund C-SPIELNUMMER-FEHLT): sonst landet nach „Neu planen“ wieder
 * `match_number` NULL in der Cloud. @SL-049: Spielnummern gelten wörtlich – jedes Spiel trägt eine eigene Nummer,
 * gezählt in Spielplan-Reihenfolge (Uhrzeit, dann Feld). Behaltene Spiele (@W5-009) zählen mit.
 */
import { describe, it, expect } from 'vitest';
import type { Match, Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '../../../core/generators';
import { buildReplanPreview, applyReplan } from '../utils/replan';
import { looseVs } from '../../../test/matchSlotFixtures';
import { testUuid } from '../../../test/testIds';

const baseTournament = (): Tournament =>
  ({
    id: 't1', title: 'Test Cup', ageClass: 'U13', sport: 'football', tournamentType: 'classic', mode: 'roundRobin',
    groupSystem: 'roundRobin', date: '2030-01-01', timeSlot: '09:00', startDate: '2030-01-01', startTime: '09:00',
    numberOfTeams: 4, numberOfFields: 2, numberOfGroups: 1, groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2,
    finalRoundGameDuration: 10, finalRoundBreakDuration: 2, breakBetweenPhases: 0, placementLogic: [],
    teams: [1, 2, 3, 4].map((n) => ({ id: testUuid(n), name: String.fromCharCode(64 + n) })),
    matches: [], status: 'published', publishedAt: '2026-10-04T08:00:00Z', isKidsTournament: false,
    hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 },
    finals: { final: true, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    location: { name: 'Halle' }, createdAt: '2026-10-04T08:00:00Z', updatedAt: '2026-10-04T08:00:00Z',
  }) as unknown as Tournament;

const generatedMatches = (tournament: Tournament): Match[] =>
  generateFullSchedule(tournament).allMatches.map((m, index) => ({
    id: m.id, round: index + 1, field: m.field, slotA: m.slotA, slotB: m.slotB,
  }));

/** Nummern in Spielplan-Reihenfolge (Uhrzeit, dann Feld) – muss 1, 2, 3 … ergeben. */
function nummernInPlanReihenfolge(matches: readonly Match[]): Array<number | undefined> {
  return [...matches]
    .sort((a, b) => new Date(a.scheduledTime ?? 0).getTime() - new Date(b.scheduledTime ?? 0).getTime() || a.field - b.field)
    .map((m) => m.matchNumber);
}

const einsBis = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);

describe('@SL-049 Neuplanung: jedes Spiel trägt danach seine Nummer', () => {
  it('@SL-049 C-SPIELNUMMER-FEHLT: nach „Neu planen“ mit einem gespielten Spiel sind alle Spiele 1, 2, 3 … in Spielplan-Reihenfolge nummeriert', () => {
    const established = baseTournament();
    const played: Match = { ...generatedMatches(established)[0], scoreA: 2, scoreB: 1, matchStatus: 'finished' };
    const withPlayed: Tournament = {
      ...established,
      numberOfTeams: 5,
      teams: [...established.teams, { id: testUuid(5), name: 'E' }],
      matches: [played, ...generatedMatches(established).slice(1)],
    };

    const preview = buildReplanPreview(withPlayed);
    expect(preview.status).toBe('preview');
    if (preview.status !== 'preview') { return; }
    const updated = applyReplan(withPlayed, preview);

    expect(nummernInPlanReihenfolge(updated.matches)).toEqual(einsBis(updated.matches.length));
  });

  it('@SL-049 C-SPIELNUMMER-FEHLT Gegenbeispiel: ein angehängtes Spiel ohne Gegenstück bekommt keine doppelte Nummer', () => {
    const established = baseTournament();
    const orphan: Match = {
      id: 'kept-orphan', round: 1, field: 1, ...looseVs(testUuid(9), testUuid(1)),
      scoreA: 4, scoreB: 4, matchStatus: 'finished', phase: 'groupStage',
      scheduledTime: new Date('2030-01-01T18:00:00'),
    };
    const withOrphan: Tournament = { ...established, matches: [orphan] };

    const preview = buildReplanPreview(withOrphan);
    expect(preview.status).toBe('preview');
    if (preview.status !== 'preview') { return; }
    const updated = applyReplan(withOrphan, preview);
    const nummern = updated.matches.map((m) => m.matchNumber);

    expect(new Set(nummern).size).toBe(updated.matches.length);
    expect(nummernInPlanReihenfolge(updated.matches)).toEqual(einsBis(updated.matches.length));
  });
});
