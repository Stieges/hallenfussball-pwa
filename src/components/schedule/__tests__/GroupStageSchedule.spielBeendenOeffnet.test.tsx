/**
 * @FU-112 „Die Turnierleitung wählt im Spielplan bei Spiel 9 „Spiel beenden und Ergebnis eintragen“ und trägt 3:1 ein“:
 * Nach der Wahl muss die Ergebnis-Eingabe offen bleiben. Das „Klick außerhalb schließt“ darf den Klick auf den Knopf
 * nicht als „außerhalb“ werten, obwohl React den Knopf beim Umschalten schon aus der Seite genommen hat. Der Fehler
 * zeigte sich nur, wenn der Knopf später als 100 ms nach dem Aufklappen gedrückt wird (so tippt ein Mensch).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('@FU-112 Spiel beenden und Ergebnis eintragen öffnet die Eingabe', () => {
  it('@FU-112 nach „Spiel beenden und Ergebnis eintragen“ (später als 100 ms nach dem Aufklappen) steht die Eingabe offen', async () => {
    const user = userEvent.setup();
    const start = new Date('2026-11-14T14:20:00');
    const spiel: ScheduledMatch = {
      id: SPIEL_9, matchNumber: 9, field: 1, phase: 'groupStage', group: 'A', isFinal: false, startTime: start, endTime: start,
      duration: 10, time: '14:20', homeTeam: 'FC Nord', awayTeam: 'SV Süd', originalTeamA: NORD, originalTeamB: SUED,
      slotA: teamSlot(NORD), slotB: teamSlot(SUED), label: 'Spiel 9',
    };
    const view = viewOf([matchOf(spiel, { matchStatus: 'running', scoreA: 0, scoreB: 0 })], teams);
    render(<GroupStageSchedule matches={[spiel]} hasGroups tournament={{ teams, view }} editable canEndRunning onScoreChange={vi.fn()} />);

    await user.click(screen.getByRole('row', { name: /^Spiel 9:/ }));
    await new Promise((r) => setTimeout(r, 200)); // der Schließen-Hörer ist erst nach 100 ms scharf
    const knopf = (await screen.findAllByTestId('end-and-enter-btn'))[0];
    // Wie im Browser: Beim Umschalten nimmt React den angeklickten Knopf aus der Seite, bevor der Klick am document ankommt.
    knopf.addEventListener('click', () => { knopf.remove(); });
    await user.click(knopf);

    expect((await screen.findAllByTestId('quick-score-expand')).length).toBeGreaterThan(0);
  });

  it('@FU-112 Gegenbeispiel: ein Klick außerhalb jeder Karte (später als 100 ms) klappt die Karte wieder zu', async () => {
    const user = userEvent.setup();
    const start = new Date('2026-11-14T14:20:00');
    const spiel: ScheduledMatch = {
      id: SPIEL_9, matchNumber: 9, field: 1, phase: 'groupStage', group: 'A', isFinal: false, startTime: start, endTime: start,
      duration: 10, time: '14:20', homeTeam: 'FC Nord', awayTeam: 'SV Süd', originalTeamA: NORD, originalTeamB: SUED,
      slotA: teamSlot(NORD), slotB: teamSlot(SUED), label: 'Spiel 9',
    };
    const view = viewOf([matchOf(spiel, { matchStatus: 'running', scoreA: 0, scoreB: 0 })], teams);
    render(
      <div>
        <p data-testid="ausserhalb">Außerhalb jeder Karte</p>
        <GroupStageSchedule matches={[spiel]} hasGroups tournament={{ teams, view }} editable canEndRunning onScoreChange={vi.fn()} />
      </div>,
    );

    await user.click(screen.getByRole('row', { name: /^Spiel 9:/ }));
    expect((await screen.findAllByTestId('end-and-enter-btn')).length).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 200)); // der Schließen-Hörer ist erst nach 100 ms scharf
    await user.click(screen.getByTestId('ausserhalb'));

    await waitFor(() => { expect(screen.queryAllByTestId('end-and-enter-btn')).toHaveLength(0); });
  });
});
