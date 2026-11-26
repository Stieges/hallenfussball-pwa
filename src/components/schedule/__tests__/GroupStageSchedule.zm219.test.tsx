/**
 * @ZM-219 Zuschauer-Seite: Ein zweiter Tipp auf dasselbe Spiel klappt die Ereignisse wieder zu – über den Stand
 * wie über die Zeile, bei beendeten und bei laufenden Spielen. Die Turnierleitung (editable) behält ihr Verhalten:
 * dort öffnet der Tipp auf den Stand weiter, ohne zu schließen.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import type { ScheduledMatch } from '../../../core/generators';
import { teamSlot } from '../../../core/models/matchSlot';
import { testUuid } from '../../../test/testIds';
import { GroupStageSchedule } from '../GroupStageSchedule';
import { matchOf, viewOf } from './scheduleViewFixture';

vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

const NORD = testUuid(1);
const SUED = testUuid(2);
const SPIEL_9 = testUuid(109);
const teams = [{ id: NORD, name: 'FC Nord' }, { id: SUED, name: 'SV Süd' }];

function zeige(status: 'finished' | 'running', editable: boolean) {
  const start = new Date('2026-11-14T14:20:00');
  const spiel: ScheduledMatch = {
    id: SPIEL_9, matchNumber: 9, field: 1, phase: 'groupStage', group: 'A', isFinal: false, startTime: start, endTime: start,
    duration: 10, time: '14:20', homeTeam: 'FC Nord', awayTeam: 'SV Süd', originalTeamA: NORD, originalTeamB: SUED,
    slotA: teamSlot(NORD), slotB: teamSlot(SUED), label: 'Spiel 9',
  };
  const view = viewOf([matchOf(spiel, { matchStatus: status, scoreA: 3, scoreB: 1 })], teams);
  return render(<GroupStageSchedule matches={[spiel]} hasGroups tournament={{ teams, view }} editable={editable} />);
}
const offen = (c: HTMLElement) => c.querySelectorAll('[data-expand-content]').length;

describe('@ZM-219 Ereignisse der Zuschauer-Seite klappen mit dem zweiten Tipp wieder zu', () => {
  for (const status of ['finished', 'running'] as const) {
    it(`@ZM-219 ${status}: Tipp auf den Stand öffnet, der zweite Tipp schließt`, async () => {
      const user = userEvent.setup();
      const { container } = zeige(status, false);
      expect(offen(container)).toBe(0);
      await user.click(screen.getAllByTestId(`match-circle-${SPIEL_9}`)[0]);
      expect(offen(container)).toBeGreaterThan(0);
      await user.click(screen.getAllByTestId(`match-circle-${SPIEL_9}`)[0]);
      expect(offen(container)).toBe(0);
    });

    it(`@ZM-219 ${status}: Tipp auf die Zeile öffnet, der zweite Tipp schließt`, async () => {
      const user = userEvent.setup();
      const { container } = zeige(status, false);
      await user.click(screen.getAllByTestId(`match-name-${SPIEL_9}-home`)[0]);
      expect(offen(container)).toBeGreaterThan(0);
      await user.click(screen.getAllByTestId(`match-name-${SPIEL_9}-home`)[0]);
      expect(offen(container)).toBe(0);
    });
  }

  it('@ZM-219 Gegenbeispiel: in der Turnierleitung (editable) schließt der zweite Tipp auf den Stand eines laufenden Spiels nicht', async () => {
    const user = userEvent.setup();
    const { container } = zeige('running', true);
    await user.click(screen.getAllByTestId(`match-circle-${SPIEL_9}`)[0]);
    const nachErstem = offen(container);
    expect(nachErstem).toBeGreaterThan(0);
    await user.click(screen.getAllByTestId(`match-circle-${SPIEL_9}`)[0]);
    expect(offen(container)).toBe(nachErstem);
  });

  it('@ZM-219 live aufgeklappt, das Spiel endet in der Zwischenzeit: der nächste Tipp schließt, statt zur Zusammenfassung zu wechseln', async () => {
    const user = userEvent.setup();
    const start = new Date('2026-11-14T14:20:00');
    const spiel: ScheduledMatch = {
      id: SPIEL_9, matchNumber: 9, field: 1, phase: 'groupStage', group: 'A', isFinal: false, startTime: start, endTime: start,
      duration: 10, time: '14:20', homeTeam: 'FC Nord', awayTeam: 'SV Süd', originalTeamA: NORD, originalTeamB: SUED,
      slotA: teamSlot(NORD), slotB: teamSlot(SUED), label: 'Spiel 9',
    };
    const ansicht = (status: 'running' | 'finished') => (
      <GroupStageSchedule matches={[spiel]} hasGroups tournament={{ teams, view: viewOf([matchOf(spiel, { matchStatus: status, scoreA: 3, scoreB: 1 })], teams) }} editable={false} />
    );
    const { container, rerender } = render(ansicht('running'));
    await user.click(screen.getAllByTestId(`match-circle-${SPIEL_9}`)[0]);
    expect(offen(container)).toBeGreaterThan(0);
    rerender(ansicht('finished'));
    await user.click(screen.getAllByTestId(`match-circle-${SPIEL_9}`)[0]);
    expect(offen(container)).toBe(0);
  });
});
