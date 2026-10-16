/**
 * A-03 (MVP-Bauplan, Spur A) – der Spielplan zeigt Spielseiten über die eine Anzeige-Funktion.
 * @TM-015: ein unbesetzter Platz zeigt seine Herkunft (Ansicht „Spielplan der Turnierleitung“).
 * @TM-033: kein Text aus dem Übergangsfeld `teamA/teamB` als Ersatz.
 */
import { describe, it, expect } from 'vitest';
import { generateFullSchedule } from '..';
import type { Match, Team, Tournament } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { vs, withStaleSides } from '../../../test/matchSlotFixtures';

const teams: Team[] = ['A', 'B'].flatMap((group, g) =>
  [1, 2, 3, 4].map((n) => ({ id: testUuid(g * 10 + n), name: `Team ${group}${n}`, group })),
);

const tournamentOf = (overrides: Partial<Tournament> = {}): Tournament =>
  createMockTournament({
    teams,
    numberOfTeams: 8,
    numberOfGroups: 2,
    numberOfFields: 1,
    groupSystem: 'groupsAndFinals',
    finalsConfig: { preset: 'top-4' },
    ...overrides,
  });

describe('generateFullSchedule – Anzeige der Seiten', () => {
  it('@TM-015 frisch erzeugt: Halbfinale zeigt die Herkunft, Gruppenspiel den Teamnamen, Finale den Sieger des Halbfinals', () => {
    const schedule = generateFullSchedule(tournamentOf());

    const group = schedule.allMatches.find((m) => m.phase === 'groupStage');
    expect(group?.homeTeam).toMatch(/^Team [AB]\d$/);
    const semi = schedule.allMatches.find((m) => m.label === '1. Halbfinale');
    expect(semi?.homeTeam).toBe('tournament:slot.groupRank');
    expect(semi?.awayTeam).toBe('tournament:slot.groupRank');
    const final = schedule.allMatches.find((m) => m.finalType === 'final');
    expect(final?.homeTeam).toBe('tournament:slot.winnerOf');
    expect(final?.awayTeam).toBe('tournament:slot.winnerOf');
    const third = schedule.allMatches.find((m) => m.finalType === 'thirdPlace');
    expect(third?.homeTeam).toBe('tournament:slot.loserOf');
  });

  it('@TM-015 gespeichert und neu geladen: gleiche Anzeige, Namen über die Team-ID aus dem Slot', () => {
    const fresh = generateFullSchedule(tournamentOf());
    const persisted: Match[] = fresh.allMatches.map((m, index) => ({
      id: m.id,
      round: index + 1,
      field: m.field,
      slot: m.slot,
      slotA: m.slotA,
      slotB: m.slotB,
      group: m.group,
      isFinal: m.phase !== 'groupStage',
      phase: m.phase,
      finalType: m.finalType,
      label: m.label,
      scheduledTime: m.startTime,
    }));

    const loaded = generateFullSchedule(tournamentOf({ matches: persisted }));

    expect(loaded.allMatches.map((m) => [m.homeTeam, m.awayTeam])).toEqual(
      fresh.allMatches.map((m) => [m.homeTeam, m.awayTeam]),
    );
  });

  it('@TM-033 Gegenbeispiel: ein Name im Übergangsfeld teamB wird nicht angezeigt, der Slot gilt', () => {
    const persisted: Match[] = [
      withStaleSides({ id: 'm1', round: 1, field: 1, slot: 0, ...vs(teams[0].id, teams[1].id), group: 'A' }, teams[0].id, 'Team B2'),
    ];
    const loaded = generateFullSchedule(tournamentOf({ matches: persisted, finalsConfig: { preset: 'none' } }));

    expect(loaded.allMatches[0].homeTeam).toBe(teams[0].name);
    expect(loaded.allMatches[0].awayTeam).toBe(teams[1].name);
  });

  it('@TM-015 gespeicherte Gruppenspiele ohne Finalrunde: die Finalrunde wird erzeugt und mit Herkunft angezeigt', () => {
    const fresh = generateFullSchedule(tournamentOf());
    const groupOnly: Match[] = fresh.allMatches
      .filter((m) => m.phase === 'groupStage')
      .map((m, index) => ({
        id: m.id, round: index + 1, field: m.field, slot: m.slot,
        teamA: m.originalTeamA, teamB: m.originalTeamB, slotA: m.slotA, slotB: m.slotB,
        group: m.group, phase: 'groupStage', isFinal: false, scheduledTime: m.startTime,
      }));

    const loaded = generateFullSchedule(tournamentOf({ matches: groupOnly }));

    const semi = loaded.allMatches.find((m) => m.label === '1. Halbfinale');
    expect(semi?.homeTeam).toBe('tournament:slot.groupRank');
    expect(loaded.allMatches.filter((m) => m.phase === 'groupStage')).toHaveLength(groupOnly.length);
  });
});
