/**
 * Befund C-SCHNELLEINGABE-ENTWURF-VERLOREN, wiederhergestellt wird @FU-101 „Ein zweistelliges Ergebnis lässt sich im
 * Spielplan eintragen“: Gegeben das Feld für SV Süd zeigt schon 2, Olli tippt im Feld für FC Nord „1“ und „0“ → 10:2.
 * Am Turniertag kommt dazwischen laufend etwas von außen: das Turnier wird nachgeladen, ein anderes Spiel bekommt per
 * Realtime ein Ergebnis, die Uhr eines laufenden Spiels tickt. Die schon getippte 2 darf dabei nicht still verschwinden
 * (sonst speichert Enter nichts oder ein halbes Ergebnis).
 *  (a) Nachladen, DIESES Spiel unverändert → Entwurf und Fokus bleiben.
 *  (b) ein ANDERES Spiel bekommt ein Ergebnis → Entwurf und Fokus bleiben.
 *  (c) ein anderes Gerät ändert genau DIESES Spiel: kein Szenario vorhanden → offen (Report, Vorschlag an den Controller).
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
const SPIEL_10 = testUuid(110);
const teams = [{ id: NORD, name: 'FC Nord' }, { id: SUED, name: 'SV Süd' }, { id: MITTE, name: 'SG Mitte' }, { id: BERG, name: 'DJK Berg' }];

/** Spiel 9 FC Nord – SV Süd, Spiel 10 SG Mitte – DJK Berg; jeder Aufruf liefert neue Objekte wie ein Nachladen. */
function spiele(phase: ScheduledMatch['phase'], spiel10: Partial<ScheduledMatch> = {}): ScheduledMatch[] {
  const start = new Date('2026-11-14T14:20:00');
  const base = { field: 1, startTime: start, endTime: start, duration: 10, phase, isFinal: phase !== 'groupStage' };
  return [
    { ...base, id: SPIEL_9, matchNumber: 9, time: '14:20', homeTeam: 'FC Nord', awayTeam: 'SV Süd', originalTeamA: NORD, originalTeamB: SUED, slotA: teamSlot(NORD), slotB: teamSlot(SUED), label: '1. Halbfinale', ...(phase === 'groupStage' ? { group: 'A' } : {}) },
    { ...base, id: SPIEL_10, matchNumber: 10, time: '14:35', homeTeam: 'SG Mitte', awayTeam: 'DJK Berg', originalTeamA: MITTE, originalTeamB: BERG, slotA: teamSlot(MITTE), slotB: teamSlot(BERG), label: '2. Halbfinale', ...(phase === 'groupStage' ? { group: 'A' } : {}), ...spiel10 },
  ];
}

/** Die gemeinsame Ansicht (Status, Stand) wie nach einem Abruf: neues Objekt je Aufruf. */
function ansicht(matches: ScheduledMatch[], spiel10: Cache = {}) {
  return { teams, view: viewOf([matchOf(matches[0]), matchOf(matches[1], spiel10)], teams) };
}

const ERGEBNIS_SPIEL_10: Cache = { matchStatus: 'finished', scoreA: 3, scoreB: 1 };
const LAEUFT_SPIEL_10: Cache = { matchStatus: 'running', scoreA: 1, scoreB: 0 };
const uhr = (sekunden: number): SpectatorClock => spectatorClockOf({ totalElapsedSec: sekunden, sectionSec: 600, sections: 1, stopped: false });

describe('C-SCHNELLEINGABE-ENTWURF-VERLOREN – Finalrunden-Tabelle (Laptop): der Entwurf übersteht Änderungen von außen (@FU-101)', () => {
  const feld = (seite: 'home' | 'away') => screen.getByTestId<HTMLInputElement>(`match-score-input-${SPIEL_9}-${seite}`);

  function tabelle(onScoreChange = vi.fn()) {
    const erst = spiele('semifinal');
    const utils = render(<FinalStageSchedule matches={erst} tournament={ansicht(erst)} editable onScoreChange={onScoreChange} />);
    const neu = (matches: ScheduledMatch[], spiel10: Cache = {}, clockOf?: (id: string) => SpectatorClock | null) =>
      utils.rerender(<FinalStageSchedule matches={matches} tournament={ansicht(matches, spiel10)} editable onScoreChange={onScoreChange} clockOf={clockOf} />);
    return { onScoreChange, neu };
  }

  it('(a) @FU-101 das Turnier wird nachgeladen, Spiel 9 unverändert: die 2 für SV Süd bleibt, danach speichert „10“ + Enter 10:2', async () => {
    const user = userEvent.setup();
    const { onScoreChange, neu } = tabelle();
    await user.click(feld('away'));
    await user.keyboard('2');

    neu(spiele('semifinal'));

    expect(feld('away').value).toBe('2');
    expect(document.activeElement).toBe(feld('away')); // Olli kann weitertippen
    await user.click(feld('home'));
    await user.keyboard('10{Enter}');
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    expect(onScoreChange).toHaveBeenCalledWith(SPIEL_9, 10, 2);
  });

  it('(b) @FU-101 Spiel 10 bekommt per Realtime ein Ergebnis: der Entwurf in Spiel 9 bleibt mitten im Tippen stehen', async () => {
    const user = userEvent.setup();
    const { onScoreChange, neu } = tabelle();
    await user.click(feld('away'));
    await user.keyboard('2');
    await user.click(feld('home'));
    await user.keyboard('1');

    neu(spiele('semifinal', { scoreA: 3, scoreB: 1 }), ERGEBNIS_SPIEL_10);

    expect([feld('home').value, feld('away').value]).toEqual(['1', '2']);
    expect(document.activeElement).toBe(feld('home'));
    await user.keyboard('0{Enter}');
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    expect(onScoreChange).toHaveBeenCalledWith(SPIEL_9, 10, 2);
  });

  it('(b) @FU-101 Spiel 10 läuft und seine Uhr tickt jede Sekunde: der Entwurf in Spiel 9 bleibt', async () => {
    const user = userEvent.setup();
    const { neu } = tabelle();
    await user.click(feld('away'));
    await user.keyboard('2');

    for (const sekunden of [5, 6, 7]) {
      neu(spiele('semifinal', { scoreA: 1, scoreB: 0 }), LAEUFT_SPIEL_10, (id) => (id === SPIEL_10 ? uhr(sekunden) : null));
    }

    expect(feld('away').value).toBe('2');
    expect(document.activeElement).toBe(feld('away'));
  });

  it.todo('(c) ein anderes Gerät trägt für Spiel 9 ein Ergebnis ein, während Olli tippt – kein Szenario (Vorschlag im Report task-entwurf)');
});

describe('C-SCHNELLEINGABE-ENTWURF-VERLOREN – Finalrunden-Karte (Handy): der Entwurf übersteht Änderungen von außen (@FU-101)', () => {
  const feld = (seite: 'home' | 'away') => screen.getByTestId<HTMLInputElement>(`final-score-input-${SPIEL_9}-${seite}`);

  it('(a) und (b) @FU-101 Nachladen und Ergebnis in Spiel 10: die 2 für SV Süd bleibt, „10“ + Enter speichert 10:2', async () => {
    const user = userEvent.setup();
    const onScoreChange = vi.fn();
    const erst = spiele('semifinal');
    const { rerender } = render(<FinalStageSchedule matches={erst} tournament={ansicht(erst)} editable onScoreChange={onScoreChange} />);
    await user.click(feld('away'));
    await user.keyboard('2');

    const nachgeladen = spiele('semifinal');
    rerender(<FinalStageSchedule matches={nachgeladen} tournament={ansicht(nachgeladen)} editable onScoreChange={onScoreChange} />);
    const mitErgebnis = spiele('semifinal', { scoreA: 3, scoreB: 1 });
    rerender(<FinalStageSchedule matches={mitErgebnis} tournament={ansicht(mitErgebnis, ERGEBNIS_SPIEL_10)} editable onScoreChange={onScoreChange} />);

    expect(feld('away').value).toBe('2');
    await user.click(feld('home'));
    await user.keyboard('10{Enter}');
    expect(onScoreChange).toHaveBeenCalledWith(SPIEL_9, 10, 2);
  });
});

describe('C-SCHNELLEINGABE-ENTWURF-VERLOREN – Gruppenspiel (Schnelleingabe aufgeklappt): Änderungen von außen (@FU-080)', () => {
  it('(a) und (b) Nachladen und Ergebnis in Spiel 10: der angefangene Stand in Spiel 9 bleibt im aufgeklappten Feld', async () => {
    const user = userEvent.setup();
    const erst = spiele('groupStage');
    const { rerender } = render(<GroupStageSchedule matches={erst} hasGroups tournament={ansicht(erst)} editable onScoreChange={vi.fn()} />);
    await user.click(screen.getByTestId(`match-row-time-${SPIEL_9}`));
    await user.click(screen.getByRole('button', { name: 'FC Nord Tor hinzufügen' }));
    const stand = () => screen.getByRole('button', { name: 'FC Nord Tor hinzufügen' }).previousElementSibling?.textContent;
    expect(stand()).toBe('1');

    const nachgeladen = spiele('groupStage');
    rerender(<GroupStageSchedule matches={nachgeladen} hasGroups tournament={ansicht(nachgeladen)} editable onScoreChange={vi.fn()} />);
    const mitErgebnis = spiele('groupStage', { scoreA: 3, scoreB: 1 });
    rerender(<GroupStageSchedule matches={mitErgebnis} hasGroups tournament={ansicht(mitErgebnis, ERGEBNIS_SPIEL_10)} editable onScoreChange={vi.fn()} />);

    expect(screen.getAllByTestId('quick-score-expand').length).toBeGreaterThan(0);
    expect(stand()).toBe('1');
  });
});
