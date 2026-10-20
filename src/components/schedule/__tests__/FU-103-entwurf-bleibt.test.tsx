/**
 * @FU-103 (Grundriss) „Ein angefangener Eintrag bleibt stehen, solange sich das Spiel selbst nicht ändert“
 * (Befund C-SCHNELLEINGABE-ENTWURF-VERLOREN; Record plattform/2026-09-24_fundament-gemeinsamer-stand).
 *   Gegeben Olli hat im Spielplan im Feld für FC Nord von Spiel 9 „1“ getippt und noch nicht bestätigt
 *   Wenn <Ereignis>
 *   Dann steht im Feld für FC Nord weiter „1“ und der Cursor bleibt im Feld
 *   Und Olli kann mit „0“ weitertippen und 10:2 bestätigen
 * Beispiele: das Turnier im Hintergrund neu geladen · Spiel 7 auf Feld 1 bekommt per Live-Abgleich 3:1 · die Uhr eines
 * laufenden Spiels auf einem anderen Feld läuft weiter. SV Süd zeigt schon 2 (wie @FU-101), daher 10:2.
 * Geprüft in der Finalrunden-Tabelle (Laptop) und auf der Finalrunden-Karte (Handy); die Gruppen-Schnelleingabe
 * (aufgeklappt, Stepper) als Absicherung.
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
import { spectatorClockOf, type SpectatorClock } from '../../../core/view';
import { testUuid } from '../../../test/testIds';
import { FinalStageSchedule } from '../FinalStageSchedule';
import { GroupStageSchedule } from '../GroupStageSchedule';
import { matchOf, viewOf, type Cache } from './scheduleViewFixture';

vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

const NORD = testUuid(1);
const SUED = testUuid(2);
const MITTE = testUuid(3);
const BERG = testUuid(4);
const SPIEL_9 = testUuid(109);
const SPIEL_7 = testUuid(107);
const teams = [{ id: NORD, name: 'FC Nord' }, { id: SUED, name: 'SV Süd' }, { id: MITTE, name: 'SG Mitte' }, { id: BERG, name: 'DJK Berg' }];

/** Spiel 9 FC Nord – SV Süd (SV Süd zeigt 2), Spiel 7 SG Mitte – DJK Berg; jeder Aufruf liefert neue Objekte wie ein Abruf. */
function spiele(phase: ScheduledMatch['phase'], spiel7: Partial<ScheduledMatch> = {}): ScheduledMatch[] {
  const start = new Date('2026-11-14T14:20:00');
  const base = { field: 1, startTime: start, endTime: start, duration: 10, phase, isFinal: phase !== 'groupStage', ...(phase === 'groupStage' ? { group: 'A' } : {}) };
  return [
    { ...base, id: SPIEL_9, matchNumber: 9, time: '14:20', homeTeam: 'FC Nord', awayTeam: 'SV Süd', originalTeamA: NORD, originalTeamB: SUED, slotA: teamSlot(NORD), slotB: teamSlot(SUED), label: '1. Halbfinale', scoreB: 2 },
    { ...base, id: SPIEL_7, matchNumber: 7, time: '14:05', homeTeam: 'SG Mitte', awayTeam: 'DJK Berg', originalTeamA: MITTE, originalTeamB: BERG, slotA: teamSlot(MITTE), slotB: teamSlot(BERG), label: '2. Halbfinale', ...spiel7 },
  ];
}

/** Die gemeinsame Ansicht (Status, Stand) wie nach einem Abruf: neues Objekt je Aufruf. */
function ansicht(matches: ScheduledMatch[], spiel7: Cache = {}) {
  return { teams, view: viewOf([matchOf(matches[0]), matchOf(matches[1], spiel7)], teams) };
}

const uhr = (sekunden: number): SpectatorClock => spectatorClockOf({ totalElapsedSec: sekunden, sectionSec: 600, sections: 1, stopped: false });

interface Stand {
  matches: ScheduledMatch[];
  tournament: ReturnType<typeof ansicht>;
  clockOf?: (id: string) => SpectatorClock | null;
}

/** Die drei Ereignisse des Grundrisses; jedes liefert die Folge der Stände, die der Spielplan danach bekommt. */
const ereignisse: Array<[string, (phase: ScheduledMatch['phase']) => Stand[]]> = [
  ['das Turnier im Hintergrund neu geladen wird', (phase) => {
    const neu = spiele(phase);
    return [{ matches: neu, tournament: ansicht(neu) }];
  }],
  ['Spiel 7 auf Feld 1 per Live-Abgleich ein Ergebnis 3:1 bekommt', (phase) => {
    const neu = spiele(phase, { field: 1, scoreA: 3, scoreB: 1 });
    return [{ matches: neu, tournament: ansicht(neu, { matchStatus: 'finished', scoreA: 3, scoreB: 1 }) }];
  }],
  ['die Uhr eines laufenden Spiels auf einem anderen Feld weiterläuft', (phase) => [5, 6, 7].map((sekunden) => {
    const neu = spiele(phase, { field: 2, scoreA: 1, scoreB: 0 });
    return { matches: neu, tournament: ansicht(neu, { matchStatus: 'running', scoreA: 1, scoreB: 0 }), clockOf: (id: string) => (id === SPIEL_7 ? uhr(sekunden) : null) };
  })],
];

describe.each([
  ['Finalrunden-Tabelle (Laptop)', 'match'],
  ['Finalrunden-Karte (Handy)', 'final'],
] as const)('@FU-103 %s: ein angefangener Eintrag bleibt stehen', (_ansicht, prefix) => {
  const feldFcNord = () => screen.getByTestId<HTMLInputElement>(`${prefix}-score-input-${SPIEL_9}-home`);

  it.each(ereignisse)('@FU-103 Wenn %s: „1“ bleibt im Feld für FC Nord, der Cursor bleibt, „0“ + Bestätigen ergibt 10:2', async (_name, ereignis) => {
    const user = userEvent.setup();
    const onScoreChange = vi.fn();
    const erst = spiele('semifinal');
    const { rerender } = render(<FinalStageSchedule matches={erst} tournament={ansicht(erst)} editable onScoreChange={onScoreChange} />);
    await user.click(feldFcNord());
    await user.keyboard('1');

    for (const stand of ereignis('semifinal')) {
      rerender(<FinalStageSchedule matches={stand.matches} tournament={stand.tournament} editable onScoreChange={onScoreChange} clockOf={stand.clockOf} />);
    }

    expect(feldFcNord().value).toBe('1');
    expect(document.activeElement).toBe(feldFcNord());
    expect(onScoreChange).not.toHaveBeenCalled();
    await user.keyboard('0{Enter}');
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    expect(onScoreChange).toHaveBeenCalledWith(SPIEL_9, 10, 2);
  });
});

describe('@FU-103 Gruppen-Schnelleingabe (aufgeklappt, Stepper): der angefangene Stand bleibt (Absicherung)', () => {
  it.each(ereignisse)('@FU-103 Wenn %s: der Stand 1 für FC Nord bleibt im aufgeklappten Feld', async (_name, ereignis) => {
    const user = userEvent.setup();
    const erst = spiele('groupStage');
    const { rerender } = render(<GroupStageSchedule matches={erst} hasGroups tournament={ansicht(erst)} editable onScoreChange={vi.fn()} />);
    await user.click(screen.getByTestId(`match-row-time-${SPIEL_9}`));
    await user.click(screen.getByRole('button', { name: 'FC Nord Tor hinzufügen' }));
    const stand = () => screen.getByRole('button', { name: 'FC Nord Tor hinzufügen' }).previousElementSibling?.textContent;
    expect(stand()).toBe('1');

    for (const neu of ereignis('groupStage')) {
      rerender(<GroupStageSchedule matches={neu.matches} hasGroups tournament={neu.tournament} editable onScoreChange={vi.fn()} clockOf={neu.clockOf} />);
    }

    expect(screen.getAllByTestId('quick-score-expand').length).toBeGreaterThan(0);
    expect(stand()).toBe('1');
  });
});
