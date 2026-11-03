/**
 * @EK-063 (G2 Spur A): Die Korrektur beginnt in der Aktionsauswahl des Spiels („Ergebnis korrigieren“, im selben Dialog wie im
 * Cockpit). Der alte Korrigieren-Knopf an Zeile und Karte der Finalrunde ist entfernt (A-08e „kein stummer Knopf“ bleibt):
 * Auch mit Rechten und Korrektur-Handler steht an beendeten Spielen kein eigener Knopf, nur der Ergebnis-Text.
 * Pflichttest echter Weg: ScheduleDisplay -> Gruppen-/K.-o.-Plan, alle Spiele beendet.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { generateFullSchedule } from '../../../core/generators';
import type { Team } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { ScheduleDisplay } from '../../ScheduleDisplay';
import { MatchScoreCell } from '../MatchScoreCell';
import { matchOf, viewOf } from './scheduleViewFixture';

vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

const teams: Team[] = ['A', 'B'].flatMap((group, g) =>
  [1, 2, 3, 4].map((n) => ({ id: testUuid(g * 10 + n), name: `Team ${group}${n}`, group })),
);

const schedule = generateFullSchedule(createMockTournament({
  teams, numberOfTeams: 8, numberOfGroups: 2, numberOfFields: 1, groupSystem: 'groupsAndFinals',
  finalsConfig: { preset: 'top-4', tiebreakerByRound: { final: 'overtime-then-shootout', placement: 'shootout' } },
}));
// alle Spiele beendet: Status und Stand stehen im Zwischenspeicher der Ansicht
const allFinished = schedule.allMatches.map((m) => matchOf(m, { matchStatus: 'finished', scoreA: 1, scoreB: 0 }));
const view = viewOf(allFinished, teams);
const finalIds = schedule.phases.filter((p) => p.name !== 'groupStage').flatMap((p) => p.matches.map((m) => m.id));

const buttons = (container: HTMLElement): Element[] =>
  Array.from(container.querySelectorAll('[data-testid^="correction-button-"], .correction-btn-mobile'));

describe('@EK-063 kein eigener Korrigieren-Knopf an der Spielkarte', () => {
  it('Spielplan mit Gruppen- und K.-o.-Phase, alle Spiele beendet, ohne Rechte: kein Korrigieren-Knopf', () => {
    expect(finalIds.length).toBeGreaterThan(0);
    const { container } = render(<ScheduleDisplay schedule={schedule} editable view={view} currentMatches={allFinished} />);
    expect(buttons(container)).toHaveLength(0);
  });

  it('Gegenbeispiel: auch mit Rechten der Turnierleitung und Korrektur-Handler steht kein Knopf an Zeile oder Karte, die Korrektur liegt in der Auswahl', () => {
    const { container } = render(
      <ScheduleDisplay schedule={schedule} editable view={view} currentMatches={allFinished} actionRights={{ lead: true, play: true, schedule: true }} onCorrect={vi.fn()} />,
    );
    expect(buttons(container)).toHaveLength(0);
  });

  it('MatchScoreCell beendet: Ergebnis sichtbar, kein Knopf', () => {
    const props = { matchId: 'm1', scoreA: 2, scoreB: 1, editable: true, isFinished: true, onScoreChange: vi.fn() };
    const cell = render(<MatchScoreCell {...props} />);
    expect(cell.container.textContent).toContain('2 : 1');
    expect(cell.queryByTestId('correction-button-m1')).toBeNull();
  });
});
