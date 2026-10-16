/**
 * B-04c Fixrunde 3 – Fix 3 (@W2A-009, @W2A-039): Generator-Kette trägt `finalType`.
 * Nur Test, Generator-Code bleibt unverändert.
 *
 * Pflichttest:
 *   - generateFullSchedule (groupsAndFinals, top-4, zwei Gruppen à vier Teams) liefert
 *     genau ein Spiel mit finalType 'thirdPlace'; die Regel über resolveTiebreakMode
 *     (Runde aus der Phase, finalType aus dem Spiel) ergibt 'shootout' (placement).
 * Gegenbeispiel:
 *   - Das Finale (finalType 'final') ergibt 'overtime-then-shootout'.
 *   - Halbfinale ohne finalType.
 * Mutation:
 *   - `finalType: match.finalType` in scheduleHelpers.ts auskommentieren → rot
 *
 * Hinweis: Die erzeugten Spiel-IDs sind UUIDs (nicht 'third-place'/'final'); die Spiele
 * werden daher über `finalType` gewählt.
 */
import { describe, it, expect } from 'vitest';
import { generateFullSchedule } from '../../generators';
import { knockoutRoundOf, resolveTiebreakMode } from '../tiebreakDecision';
import type { Team, Tournament } from '../../../types/tournament';
import { testUuid } from '../../../test/testIds';

const teams: Team[] = ['A', 'B'].flatMap((gruppe) =>
  [1, 2, 3, 4].map((nr) => ({
    id: testUuid((gruppe === 'A' ? 0 : 4) + nr),
    name: `Team ${gruppe}${nr}`,
    group: gruppe,
  })),
);

const finalsConfig = {
  preset: 'top-4' as const,
  tiebreakerByRound: { final: 'overtime-then-shootout' as const, placement: 'shootout' as const },
};

const turnier = {
  id: 'gen-finaltype',
  title: 'Generator finalType',
  date: '2024-01-15',
  timeSlot: '10:00',
  location: { name: 'Sporthalle Test' },
  ageClass: 'U15',
  sport: 'football',
  tournamentType: 'classic',
  mode: 'classic',
  numberOfTeams: 8,
  numberOfFields: 1,
  numberOfGroups: 2,
  groupSystem: 'groupsAndFinals',
  groupPhaseGameDuration: 10,
  groupPhaseBreakDuration: 2,
  minRestSlots: 0,
  teams,
  matches: [],
  pointSystem: { win: 3, draw: 1, loss: 0 },
  placementLogic: [{ id: 'points', enabled: true }],
  finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
  isKidsTournament: false,
  hideScoresForPublic: false,
  hideRankingsForPublic: false,
  resultMode: 'goals',
  status: 'published',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  finalsConfig,
} as unknown as Tournament;

describe('B-04c Fixrunde 3 – Generator trägt finalType bis zur Regel (@W2A-009, @W2A-039)', () => {
  it('Pflichttest: das Spiel um Platz 3 trägt finalType thirdPlace und löst die Platzierungsregel auf', () => {
    const schedule = generateFullSchedule(turnier);
    const platzDrei = schedule.allMatches.filter((m) => m.finalType === 'thirdPlace');

    expect(platzDrei).toHaveLength(1);
    const [m] = platzDrei;
    expect(m).toBeDefined();
    if (!m) {
      throw new Error('Spiel um Platz 3 fehlt');
    }
    expect(resolveTiebreakMode(finalsConfig, knockoutRoundOf(m.phase), m.finalType)).toBe(
      'shootout',
    );
  });

  it('Gegenbeispiel: das Finale behält seine Finale-Regel, Halbfinale trägt kein finalType', () => {
    const schedule = generateFullSchedule(turnier);

    const finale = schedule.allMatches.find((m) => m.finalType === 'final');
    expect(finale).toBeDefined();
    if (!finale) {
      throw new Error('Finale fehlt');
    }
    expect(resolveTiebreakMode(finalsConfig, knockoutRoundOf(finale.phase), finale.finalType)).toBe(
      'overtime-then-shootout',
    );

    const halbfinale = schedule.allMatches.filter(
      (m) => m.finalType === undefined && m.phase !== 'groupStage',
    );
    expect(halbfinale).toHaveLength(2);
    for (const spiel of halbfinale) {
      expect(spiel.finalType).toBeUndefined();
    }
  });
});
