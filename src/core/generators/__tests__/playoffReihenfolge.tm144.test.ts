/**
 * @TM-144 (Record Turniermodi): Platzierungsspiele liegen vor dem Finale, das Finale ist das letzte Spiel des
 * Turniers und liegt auf Feld 1 (Befund C-FINALE-VOR-PLATZ3-IM-SEED: bei zwei und mehr Feldern lag das Finale vor
 * dem Spiel um Platz 3). Geprüft über den echten Weg `generateFullSchedule`; „Reihenfolge“ = Spielplan-Reihenfolge
 * (Spielnummer, die seit #300 Anstoß, dann Feld folgt).
 */
import { describe, it, expect } from 'vitest';
import { generateFullSchedule } from '..';
import type { FinalsConfig, Team, Tournament } from '../../../types/tournament';
import type { ScheduledMatch } from '../scheduleTypes';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';

const GROUP_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const teamsOf = (groups: number, perGroup: number): Team[] =>
  GROUP_LABELS.slice(0, groups).flatMap((group, g) =>
    Array.from({ length: perGroup }, (_, n) => ({ id: testUuid(g * 10 + n + 1), name: `Team ${group}${n + 1}`, group })),
  );

/** „Hallencup Nord“: 2 Gruppen à 4 Teams, Gruppen + Finalrunde. */
const cupOf = (finalsConfig: FinalsConfig, numberOfFields: number, groups = 2, perGroup = 4): Tournament => {
  const teams = teamsOf(groups, perGroup);
  return createMockTournament({
    teams,
    numberOfTeams: teams.length,
    numberOfGroups: groups,
    numberOfFields,
    groupSystem: 'groupsAndFinals',
    finalsConfig,
  });
};

const byNumber = (matches: readonly ScheduledMatch[]): ScheduledMatch[] =>
  [...matches].sort((a, b) => a.matchNumber - b.matchNumber);

const finalRoundLabels = (matches: readonly ScheduledMatch[]): string[] =>
  byNumber(matches.filter((m) => m.phase !== 'groupStage')).map((m) => m.label ?? '');

/** Spielplan-Reihenfolge nach Zeit und Feld – muss mit der Spielnummer übereinstimmen. */
const byTimeAndField = (matches: readonly ScheduledMatch[]): string[] =>
  [...matches].sort((a, b) => a.startTime.getTime() - b.startTime.getTime() || a.field - b.field).map((m) => m.id);

function expectFinalIsLastOnFieldOne(all: readonly ScheduledMatch[]): void {
  const final = all.find((m) => m.finalType === 'final');
  expect(final).toBeDefined();
  if (final === undefined) { return; }
  const others = all.filter((m) => m.id !== final.id);
  expect(final.field).toBe(1);
  expect(final.matchNumber).toBe(Math.max(...all.map((m) => m.matchNumber)));
  // letztes Spiel: kein anderes Spiel beginnt gleichzeitig oder später
  expect(others.every((m) => m.startTime.getTime() < final.startTime.getTime())).toBe(true);
  expect(others.every((m) => m.endTime.getTime() <= final.startTime.getTime())).toBe(true);
}

const FIELDS = [1, 2, 3] as const;

describe('@TM-144 Platzierungsspiele liegen vor dem Finale, das Finale ist das letzte Spiel', () => {
  describe.each(FIELDS)('„Hallencup Nord“ mit %i Feld(ern)', (fields) => {
    it('Halbfinale, Spiel um Platz 3 und Finale → Halbfinale, Spiel um Platz 3, Finale', () => {
      const schedule = generateFullSchedule(cupOf({ preset: 'top-4' }, fields));

      expect(finalRoundLabels(schedule.allMatches)).toEqual(['1. Halbfinale', '2. Halbfinale', 'Spiel um Platz 3', 'Finale']);
      expectFinalIsLastOnFieldOne(schedule.allMatches);
      expect(byNumber(schedule.allMatches).map((m) => m.id)).toEqual(byTimeAndField(schedule.allMatches));
    });

    it('Spiele um Platz 7, 5 und 3 sowie Finale → Spiel um Platz 7, Spiel um Platz 5, Spiel um Platz 3, Finale', () => {
      const schedule = generateFullSchedule(cupOf({ preset: 'all-places' }, fields));

      expect(finalRoundLabels(schedule.allMatches)).toEqual([
        '1. Halbfinale', '2. Halbfinale', 'Spiel um Platz 7', 'Spiel um Platz 5', 'Spiel um Platz 3', 'Finale',
      ]);
      expectFinalIsLastOnFieldOne(schedule.allMatches);
      expect(byNumber(schedule.allMatches).map((m) => m.id)).toEqual(byTimeAndField(schedule.allMatches));
    });

    it('nur Finale → Finale', () => {
      const schedule = generateFullSchedule(cupOf({ preset: 'final-only' }, fields));

      expect(finalRoundLabels(schedule.allMatches)).toEqual(['Finale']);
      expectFinalIsLastOnFieldOne(schedule.allMatches);
    });
  });

  // Die Regel gilt für jede Vorlage (Änderungsprotokoll Turniermodi 2026-10-15: „7, 5, 3, Finale“, Finale zuletzt auf Feld 1)
  describe.each(FIELDS)('weitere Vorlagen mit %i Feld(ern)', (fields) => {
    it('Top 8 (4 Gruppen): Platz 7 vor Platz 5 vor Platz 3, Finale zuletzt auf Feld 1', () => {
      const schedule = generateFullSchedule(cupOf({ preset: 'top-8' }, fields, 4, 4));
      const labels = finalRoundLabels(schedule.allMatches);

      expect(labels.slice(-2)).toEqual(['Spiel um Platz 3', 'Finale']);
      expect(labels.indexOf('Spiel um Platz 7')).toBeLessThan(labels.indexOf('Spiel um Platz 5'));
      expect(labels.indexOf('Spiel um Platz 5')).toBeLessThan(labels.indexOf('Spiel um Platz 3'));
      expectFinalIsLastOnFieldOne(schedule.allMatches);
    });

    it('Top 16 (8 Gruppen): Spiel um Platz 3 vor dem Finale, Finale zuletzt auf Feld 1', () => {
      const schedule = generateFullSchedule(cupOf({ preset: 'top-16' }, fields, 8, 2));

      expect(finalRoundLabels(schedule.allMatches).slice(-2)).toEqual(['Spiel um Platz 3', 'Finale']);
      expectFinalIsLastOnFieldOne(schedule.allMatches);
    });

    it('Top 4 mit einer Gruppe (@TM-142): Spiel um Platz 3 vor dem Finale, Finale zuletzt auf Feld 1', () => {
      const schedule = generateFullSchedule(cupOf({ preset: 'top-4' }, fields, 1, 5));

      expect(finalRoundLabels(schedule.allMatches)).toEqual(['1. Halbfinale', '2. Halbfinale', 'Spiel um Platz 3', 'Finale']);
      expectFinalIsLastOnFieldOne(schedule.allMatches);
    });
  });

  describe('Spielnummern', () => {
    it.each(FIELDS)('folgen der neuen Reihenfolge: Spiel um Platz 3 hat die Nummer vor dem Finale (%i Feld(er))', (fields) => {
      const schedule = generateFullSchedule(cupOf({ preset: 'top-4' }, fields));
      const groupCount = schedule.allMatches.filter((m) => m.phase === 'groupStage').length;
      const number = (finalType: string): number | undefined =>
        schedule.allMatches.find((m) => m.finalType === finalType)?.matchNumber;

      expect(number('thirdPlace')).toBe(groupCount + 3);
      expect(number('final')).toBe(groupCount + 4);
      expect(schedule.allMatches.map((m) => m.matchNumber).sort((a, b) => a - b)).toEqual(
        Array.from({ length: schedule.allMatches.length }, (_, i) => i + 1),
      );
    });

    it.each(FIELDS)('Gegenbeispiel: Reihenfolge, Felder, Zeiten und Nummern der Gruppenspiele hängen nicht von der Finalrunde ab (%i Feld(er))', (fields) => {
      const groupStage = (preset: FinalsConfig['preset']) =>
        generateFullSchedule(cupOf({ preset }, fields)).allMatches
          .filter((m) => m.phase === 'groupStage')
          .map((m) => [m.matchNumber, m.homeTeam, m.awayTeam, m.field, m.startTime.getTime()]);

      const withoutFinals = groupStage('none');
      expect(withoutFinals.map(([n]) => n)).toEqual(withoutFinals.map((_, i) => i + 1));
      expect(groupStage('top-4')).toEqual(withoutFinals);
      expect(groupStage('all-places')).toEqual(withoutFinals);
      expect(groupStage('final-only')).toEqual(withoutFinals);
    });
  });
});
