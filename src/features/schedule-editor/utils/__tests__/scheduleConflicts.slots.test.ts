/**
 * A-04b (MVP-Bauplan, Spur A) – der Schedule-Editor liest die Spielseiten aus den Slots.
 *
 * Vorher las die Konflikterkennung `Match.teamA/teamB`: Jede offene Seite trug dort den Text „TBD“, zwei
 * Halbfinals zur selben Zeit galten als „Team TBD spielt doppelt“ (A-04a-Review K8). Offene Seiten zählen
 * für kein Team; besetzte (auch aufgelöste) Seiten zählen.
 * Kennung: A-04b (offene Seiten haben ihre Herkunft, sind aber kein Team).
 */
import { describe, it, expect } from 'vitest';
import type { Match, Team } from '../../../../types/tournament';
import { resolveSlot } from '../../../../core/models/matchSlot';
import { vs, slots, groupRank, testUuid } from '../../../../test/matchSlotFixtures';
import { detectTeamConflicts, detectBreakViolations, detectAllConflicts } from '../scheduleConflicts';

const NORD = testUuid(1);
const UFER = testUuid(2);
const teams: Team[] = [
  { id: NORD, name: 'FC Nord' },
  { id: UFER, name: 'VfB Ufer' },
];

const at = (time: string) => new Date(`2026-10-03T${time}:00`);
const match = (id: string, sides: Pick<Match, 'slotA' | 'slotB'>, time: string, field = 1): Match => ({
  id, round: 1, field, scheduledTime: at(time), matchStatus: 'scheduled', ...sides,
});

describe('Schedule-Editor – Konflikte aus Slots (A-04b)', () => {
  it('A-04b zwei Halbfinals mit offenen Seiten zur selben Zeit sind keine Doppelbelegung (K8)', () => {
    const semis = [
      match('s1', slots(groupRank('A', 1), groupRank('B', 2)), '10:00', 1),
      match('s2', slots(groupRank('B', 1), groupRank('A', 2)), '10:00', 2),
    ];

    expect(detectTeamConflicts(semis, 10, teams)).toEqual([]);
    expect(detectAllConflicts(semis, teams, { matchDurationMinutes: 10, minBreakMinutes: 2, checkRefereeConflicts: false, checkFieldConflicts: false })
      .filter((c) => c.type === 'team_double_booking')).toEqual([]);
  });

  it('A-04b Gegenbeispiel: dasselbe besetzte Team in zwei gleichzeitigen Spielen bleibt eine Doppelbelegung', () => {
    const double = [
      match('g1', vs(NORD, UFER), '10:00', 1),
      match('g2', slots(resolveSlot({ kind: 'groupRank', group: 'A', rank: 1 }, NORD), groupRank('B', 1)), '10:00', 2),
    ];

    const conflicts = detectTeamConflicts(double, 10, teams);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].context).toMatchObject({ teamId: NORD, teamName: 'FC Nord' });
  });

  it('A-04b offene Seiten zählen auch bei der Pause zwischen Spielen nicht als Team', () => {
    const matches = [
      match('s1', slots(groupRank('A', 1), groupRank('B', 2)), '10:00', 1),
      match('s2', slots(groupRank('B', 1), groupRank('A', 2)), '10:12', 1),
    ];

    expect(detectBreakViolations(matches, teams, 10, 5)).toEqual([]);
  });

  it('A-04b Gegenbeispiel: dasselbe Team ohne Pause zwischen zwei Spielen wird gemeldet', () => {
    const matches = [
      match('g1', vs(NORD, UFER), '10:00', 1),
      match('g2', vs(NORD, UFER), '10:12', 1),
    ];

    expect(detectBreakViolations(matches, teams, 10, 5).length).toBeGreaterThan(0);
  });

  it('A-04b Spiele ohne Anstoßzeit werden bei Doppelbelegung und Pause übersprungen (kein Absturz, keine Meldung)', () => {
    const unscheduled: Match = { id: 'u1', round: 1, field: 1, matchStatus: 'scheduled', ...vs(NORD, UFER) };
    const timed = match('t1', vs(NORD, UFER), '10:00');

    expect(detectTeamConflicts([timed, unscheduled], 10, teams)).toEqual([]);
    expect(detectTeamConflicts([unscheduled, timed], 10, teams)).toEqual([]);
    expect(detectBreakViolations([timed, unscheduled], teams, 10, 5)).toEqual([]);
  });
});
