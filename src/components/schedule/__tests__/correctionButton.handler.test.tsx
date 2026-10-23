/**
 * A-08e (Ruling Controller 2026-10-15, "kein stummer Knopf"): der Korrigieren-Knopf im Spielplan
 * erscheint nur, wenn ein Handler uebergeben ist. Bis B-24 gibt es keinen Korrektur-Weg -- ohne
 * Handler (ScheduleTab uebergibt keinen mehr) darf kein wirkungsloser Knopf stehen.
 * Pflichttest: echte Schedule-Kette (Generator -> ScheduleDisplay -> Gruppen-/K.-o.-Plan), alle Spiele beendet.
 * Gegenbeispiel (B-24): mit Handler ist der Knopf da und ruft den Handler mit der Spielkennung.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
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

describe('A-08e Korrigieren-Knopf nur mit Handler', () => {
  it('Spielplan mit Gruppen- und K.-o.-Phase, alle Spiele beendet, OHNE Handler: kein Korrigieren-Knopf', () => {
    expect(finalIds.length).toBeGreaterThan(0);
    const { container } = render(<ScheduleDisplay schedule={schedule} editable view={view} currentMatches={allFinished} />);
    expect(buttons(container)).toHaveLength(0);
  });

  it('Gegenbeispiel (B-24): MIT Handler zeigt der K.-o.-Plan den Knopf je beendetem Spiel und ruft den Handler', () => {
    const onStartCorrection = vi.fn();
    const { container, getByTestId } = render(
      <ScheduleDisplay schedule={schedule} editable view={view} currentMatches={allFinished} onStartCorrection={onStartCorrection} />,
    );
    expect(buttons(container).length).toBeGreaterThanOrEqual(finalIds.length);
    fireEvent.click(getByTestId(`correction-button-${finalIds[0]}`));
    expect(onStartCorrection).toHaveBeenCalledWith(finalIds[0]);
  });

  it('MatchScoreCell beendet ohne Handler: Ergebnis sichtbar, kein Knopf; mit Handler: Knopf', () => {
    const props = { matchId: 'm1', scoreA: 2, scoreB: 1, editable: true, isFinished: true, inCorrectionMode: false, onScoreChange: vi.fn() };
    const without = render(<MatchScoreCell {...props} />);
    expect(without.container.textContent).toContain('2 : 1');
    expect(without.queryByTestId('correction-button-m1')).toBeNull();
    without.unmount();
    const withHandler = render(<MatchScoreCell {...props} onStartCorrection={vi.fn()} />);
    expect(withHandler.getByTestId('correction-button-m1')).toBeInTheDocument();
  });
});
