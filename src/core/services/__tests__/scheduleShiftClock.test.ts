/**
 * B-26 Zeitbasis (Review PR #376 A4): Anpfiff = Turnierdatum + Uhrzeit, „jetzt“ = Serverzeit als Wanduhr in Europe/Berlin.
 * Gherkin @ZP-089: Spiel 1 um 10:00 (hier Mockup-Uhrzeit), es ist 09:40, noch kein Anpfiff, ab Spiel 1 um 15 Minuten vorziehen →
 * Spiel 1 um 09:45, Warnung „beginnt in 5 Minuten“, keine Sperre, „ursprünglich 10:00“ (@ZP-090).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Match } from '../../../types/tournament';
import { teamSlot } from '../../models/matchSlot';
import { testUuid } from '../../../test/testIds';
import { originalStartToShow, planShift, type ShiftTimingRules } from '../scheduleShift';
import { actualKickoffWallClock, onTournamentDay, tournamentWallClock } from '../scheduleShiftClock';

const RULES: ShiftTimingRules = { groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2 };
const TOURNAMENT_DAY = '2026-11-28';
/** Serverzeit 09:40 in Berlin (28.11. = MEZ, UTC+1) als echter Zeitpunkt */
const SERVER_NOW = new Date('2026-11-28T09:40:00+01:00');
const hhmm = (d: Date | undefined) => (d === undefined ? undefined : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);

function nikolaus(day: string): Match[] {
  return [0, 1, 2].map((i): Match => ({
    id: `n${i + 1}`, round: i + 1, field: 1, matchNumber: i + 1, phase: 'groupStage', matchStatus: 'scheduled',
    slotA: teamSlot(testUuid(2 * i + 1)), slotB: teamSlot(testUuid(2 * i + 2)),
    scheduledTime: new Date(`${day}T10:${String(i * 12).padStart(2, '0')}:00`),
  }));
}

function vorziehen(matches: Match[]) {
  return planShift(onTournamentDay(matches, TOURNAMENT_DAY), { from: { kind: 'match', matchId: 'n1' }, minutes: -15 }, RULES, { now: tournamentWallClock(SERVER_NOW) });
}

function expectZp089(plan: ReturnType<typeof vorziehen>): void {
  expect(plan.error).toBeUndefined();
  expect(hhmm(plan.matches[0].scheduledTime)).toBe('09:45');
  expect(plan.warnings.find((w) => w.kind === 'shortNotice')).toMatchObject({ matchNumbers: [1], inMinutes: 5 });
  expect(hhmm(originalStartToShow(plan.matches[0]))).toBe('10:00');
}

describe('Zeitbasis „Zeiten verschieben“ (A4)', () => {
  it('@ZP-089 Kopie mit neuem Datum: die Spiele tragen lokal noch das alte Datum, Vorziehen und Warnung stimmen trotzdem', () => {
    expectZp089(vorziehen(nikolaus('2026-03-14')));
  });

  describe('Gerät in einer anderen Zeitzone (New York)', () => {
    let before: string | undefined;
    beforeAll(() => { before = process.env.TZ; process.env.TZ = 'America/New_York'; });
    afterAll(() => { if (before === undefined) { delete process.env.TZ; } else { process.env.TZ = before; } });

    it('@ZP-089 „jetzt“ ist die Serverzeit als Berliner Wanduhr, nicht die Uhr des Geräts', () => {
      expectZp089(vorziehen(nikolaus(TOURNAMENT_DAY)));
    });

    it('der tatsächliche Anpfiff (Uhrstand) wird ebenso als Berliner Wanduhr gelesen', () => {
      const match = { ...nikolaus(TOURNAMENT_DAY)[0], timerStartTime: '2026-11-28T09:05:00.000Z', timerElapsedSeconds: 60 };
      expect(hhmm(actualKickoffWallClock(match))).toBe('10:04');
    });
  });
});
