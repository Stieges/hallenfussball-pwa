/**
 * C-ZUSCHAUER-TABELLE-OHNE-GRUPPEN: Tabellenrechnung je Gruppe. Ohne Gruppen („Jeder gegen jeden“) eine Tabelle über alle
 * Teams, mit Gruppen je Gruppe nur deren Teams und Spiele (unverändert). Nur Zuordnung, keine Sortierkriterien.
 */
import { describe, it, expect } from 'vitest';
import { calculateStandingsPerGroup } from '../calculations';
import { createMockTeam, createMockTournament } from '../../test/factories';
import { testUuid } from '../../test/testIds';
import { teamSlot } from '../../core/models/matchSlot';
import type { Match } from '../../types/tournament';

const [A1, A2, B1, B2] = [1, 2, 3, 4].map(testUuid);
const finished = (id: string, a: string, b: string, group: string | undefined, scoreA: number, scoreB: number): Match => ({
  id, round: 1, field: 1, slotA: teamSlot(a), slotB: teamSlot(b), group, scoreA, scoreB, matchStatus: 'finished', phase: 'groupStage',
});

describe('calculateStandingsPerGroup', () => {
  it('Jeder gegen jeden: eine Tabelle über alle Teams, das beendete Spiel zählt', () => {
    const tournament = createMockTournament({
      teams: [A1, A2, B1].map((id, i) => createMockTeam({ id, name: `Team ${i}`, group: undefined })),
      matches: [finished('m1', A1, A2, 'all', 2, 0)],
    });

    const standings = calculateStandingsPerGroup(tournament);

    expect(standings.map((s) => [s.team.id, s.played, s.points])).toEqual(expect.arrayContaining([[A1, 1, 3], [A2, 1, 0], [B1, 0, 0]]));
    expect(standings).toHaveLength(3);
  });

  it('Gegenbeispiel: zwei Gruppen rechnen je Gruppe nur mit den eigenen Teams und Spielen', () => {
    const tournament = createMockTournament({
      teams: [
        createMockTeam({ id: A1, name: 'A1', group: 'A' }), createMockTeam({ id: A2, name: 'A2', group: 'A' }),
        createMockTeam({ id: B1, name: 'B1', group: 'B' }), createMockTeam({ id: B2, name: 'B2', group: 'B' }),
      ],
      matches: [finished('m1', A1, A2, 'A', 2, 0), finished('m2', B1, B2, 'B', 1, 1)],
    });

    const standings = calculateStandingsPerGroup(tournament);

    expect(standings).toHaveLength(4);
    const by = (id: string) => standings.find((s) => s.team.id === id)!;
    expect([by(A1).points, by(A2).points, by(B1).points, by(B2).points]).toEqual([3, 0, 1, 1]);
  });
});
