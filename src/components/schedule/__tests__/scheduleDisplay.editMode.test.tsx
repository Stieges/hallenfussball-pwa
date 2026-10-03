/**
 * A-04b Fixrunde 1 (W1) – die Vorrunden-Ansicht im Bearbeitungsmodus markiert keine Konflikte.
 *
 * `ScheduleDisplay` kennt weder Spieldauer noch Pause des Turniers; mit Standardwerten (10/2 min) entstanden bei
 * kurzen Hallenspielen (7 min, 1 min Pause) Fehlalarme („Feld hat zwei überlappende Spiele“). Es gibt dafür kein
 * Szenario – die Ansicht bleibt wie vor A-04b ohne Konflikt-Markierung. Echte Konflikte meldet der Schedule-Editor
 * (Gegenbeispiel in `scheduleConflicts.slots.test.ts`, hier zusätzlich gegen die Konflikterkennung selbst).
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { generateFullSchedule } from '../../../core/generators';
import type { Team, Tournament } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { vs } from '../../../test/matchSlotFixtures';
import { detectTeamConflicts } from '../../../features/schedule-editor/utils/scheduleConflicts';
import { ScheduleDisplay } from '../../ScheduleDisplay';

vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

const teams: Team[] = ['A', 'B'].flatMap((group, g) =>
  [1, 2, 3, 4].map((n) => ({ id: testUuid(g * 10 + n), name: `Team ${group}${n}`, group })),
);

const shortHallTournament = (): Tournament =>
  createMockTournament({
    teams, numberOfTeams: 8, numberOfGroups: 2, numberOfFields: 2,
    groupSystem: 'groupsAndFinals', finalsConfig: { preset: 'none' },
    groupPhaseGameDuration: 7, groupPhaseBreakDuration: 1,
  });

describe('A-04b ScheduleDisplay im Bearbeitungsmodus (W1)', () => {
  it('A-04b 7 min Spielzeit, 1 min Pause, 2 Felder: keine Konflikt-Markierung an den Karten', () => {
    const schedule = generateFullSchedule(shortHallTournament());
    expect(schedule.allMatches.length).toBeGreaterThan(8);

    const { container } = render(<ScheduleDisplay schedule={schedule} editable editingSchedule />);

    const markers = Array.from(container.querySelectorAll('[title]'))
      .filter((el) => /überlappende Spiele|gleichzeitig|Pause \(min/.test(el.getAttribute('title') ?? ''));
    expect(markers).toEqual([]);
  });

  it('A-04b Gegenbeispiel: ein echter Doppelbelegungs-Konflikt wird von der Konflikterkennung weiterhin gemeldet', () => {
    const [a, b] = [testUuid(1), testUuid(2)];
    const at = new Date('2026-10-03T10:00:00');
    const double = [
      { id: 'm1', round: 1, field: 1, scheduledTime: at, ...vs(a, b) },
      { id: 'm2', round: 1, field: 2, scheduledTime: at, ...vs(a, testUuid(3)) },
    ];

    expect(detectTeamConflicts(double, 7, teams)).toHaveLength(1);
  });
});
