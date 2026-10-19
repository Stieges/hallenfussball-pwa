/**
 * @FU-104 „Ändert ein anderes Gerät genau dieses Spiel, wird der angefangene Eintrag nicht still gespeichert“
 * (Befund C-SCHNELLEINGABE-FREMDAENDERUNG-STILL; Record plattform/2026-09-24_fundament-gemeinsamer-stand).
 *   Gegeben Olli hat im Spielplan im Feld für FC Nord von Spiel 9 „1“ getippt und noch nicht bestätigt
 *   Wenn Tom auf seinem Gerät für Spiel 9 das Ergebnis 3:1 einträgt
 *   Dann sieht Olli den Hinweis „Ergebnis wurde inzwischen von Tom geändert (jetzt 3:1)“
 *   Und Ollis angefangener Eintrag wird nicht gespeichert, solange er ihn nicht bewusst neu bestätigt
 * Zwei Ausgangslagen für „Tom trägt 3:1 ein“: Spiel 9 ist danach beendet (Felder weg) bzw. noch geplant mit Stand 3:1
 * (Befund: „0“ + Enter speicherte still 30:1). Ohne bekannten Namen: „von einem anderen Gerät“.
 * Gegenbeispiele: Änderung an Spiel 7 → kein Hinweis; Ollis eigenes Speichern → kein Hinweis.
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
import { FinalStageSchedule } from '../FinalStageSchedule';
import { matchOf, viewOf, type Cache } from './scheduleViewFixture';

vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

const NORD = testUuid(1);
const SUED = testUuid(2);
const MITTE = testUuid(3);
const BERG = testUuid(4);
const SPIEL_9 = testUuid(109);
const SPIEL_7 = testUuid(107);
const teams = [{ id: NORD, name: 'FC Nord' }, { id: SUED, name: 'SV Süd' }, { id: MITTE, name: 'SG Mitte' }, { id: BERG, name: 'DJK Berg' }];
const HINWEIS_TOM = 'Ergebnis wurde inzwischen von Tom geändert (jetzt 3:1)';
const HINWEIS_OHNE_NAME = 'Ergebnis wurde inzwischen von einem anderen Gerät geändert (jetzt 3:1)';

function spiele(spiel9: Partial<ScheduledMatch> = {}, spiel7: Partial<ScheduledMatch> = {}): ScheduledMatch[] {
  const start = new Date('2026-11-14T14:20:00');
  const base = { field: 1, startTime: start, endTime: start, duration: 10, phase: 'semifinal' as const, isFinal: true };
  return [
    { ...base, id: SPIEL_9, matchNumber: 9, time: '14:20', homeTeam: 'FC Nord', awayTeam: 'SV Süd', originalTeamA: NORD, originalTeamB: SUED, slotA: teamSlot(NORD), slotB: teamSlot(SUED), label: '1. Halbfinale', scoreB: 2, ...spiel9 },
    { ...base, id: SPIEL_7, matchNumber: 7, time: '14:05', homeTeam: 'SG Mitte', awayTeam: 'DJK Berg', originalTeamA: MITTE, originalTeamB: BERG, slotA: teamSlot(MITTE), slotB: teamSlot(BERG), label: '2. Halbfinale', ...spiel7 },
  ];
}

const ansicht = (matches: ScheduledMatch[], spiel9: Cache = {}, spiel7: Cache = {}) =>
  ({ teams, view: viewOf([matchOf(matches[0], spiel9), matchOf(matches[1], spiel7)], teams) });

/** Tom trägt 3:1 ein: Spiel 9 ist danach beendet, oder es steht (z. B. bei einer Teil-Zeile) noch geplant mit 3:1. */
const tomTraegtEin = {
  beendet: () => {
    const neu = spiele({ scoreA: 3, scoreB: 1 });
    return { matches: neu, tournament: ansicht(neu, { matchStatus: 'finished', scoreA: 3, scoreB: 1 }) };
  },
  geplant: () => {
    const neu = spiele({ scoreA: 3, scoreB: 1 });
    return { matches: neu, tournament: ansicht(neu) };
  },
};

describe.each([
  ['Finalrunden-Tabelle (Laptop)', 'match', 'score-changed'],
  ['Finalrunden-Karte (Handy)', 'final', 'final-score-changed'],
] as const)('@FU-104 C-SCHNELLEINGABE-FREMDAENDERUNG-STILL %s: Änderung genau dieses Spiels von außen', (_ansicht, prefix, hinweisId) => {
  const feld = (seite: 'home' | 'away') => screen.getByTestId<HTMLInputElement>(`${prefix}-score-input-${SPIEL_9}-${seite}`);
  const hinweis = () => screen.queryByTestId(`${hinweisId}-${SPIEL_9}`);

  async function olliTipptEins(changeAuthorOf: ((id: string) => Promise<string | null>) | undefined = async () => 'Tom') {
    const user = userEvent.setup();
    const onScoreChange = vi.fn();
    const erst = spiele();
    const utils = render(<FinalStageSchedule matches={erst} tournament={ansicht(erst)} editable onScoreChange={onScoreChange} changeAuthorOf={changeAuthorOf} />);
    await user.click(feld('home'));
    await user.keyboard('1');
    const neu = (stand: { matches: ScheduledMatch[]; tournament: ReturnType<typeof ansicht> }) =>
      utils.rerender(<FinalStageSchedule matches={stand.matches} tournament={stand.tournament} editable onScoreChange={onScoreChange} changeAuthorOf={changeAuthorOf} />);
    return { user, onScoreChange, neu };
  }

  it('@FU-104 Tom trägt 3:1 ein, Spiel 9 ist beendet: Olli sieht „… von Tom geändert (jetzt 3:1)“, nichts von Olli gespeichert', async () => {
    const { onScoreChange, neu } = await olliTipptEins();
    neu(tomTraegtEin.beendet());

    expect(await screen.findByText(HINWEIS_TOM)).toBeTruthy();
    expect(hinweis()?.textContent).toContain(HINWEIS_TOM);
    expect(onScoreChange).not.toHaveBeenCalled();
  });

  it('@FU-104 Spiel 9 steht noch geplant mit 3:1: Hinweis, „0“ + Enter speichert nichts (nicht still 30:1), Ollis „10“ bleibt sichtbar', async () => {
    const { user, onScoreChange, neu } = await olliTipptEins();
    neu(tomTraegtEin.geplant());

    expect(await screen.findByText(HINWEIS_TOM)).toBeTruthy();
    await user.keyboard('0{Enter}');
    await user.tab();
    expect(onScoreChange).not.toHaveBeenCalled();
    expect(feld('home').value).toBe('10');
  });

  it('@FU-104 bewusst neu bestätigt („Meine Eingabe behalten“, dann Enter): erst dann wird Ollis 10:2 gesendet', async () => {
    const { user, onScoreChange, neu } = await olliTipptEins();
    neu(tomTraegtEin.geplant());
    await user.keyboard('0');
    await user.click(await screen.findByTestId(`${hinweisId}-keep-${SPIEL_9}`));
    expect(onScoreChange).not.toHaveBeenCalled();
    expect(hinweis()).toBeNull();

    await user.click(feld('home'));
    await user.keyboard('{Enter}');
    expect(onScoreChange).toHaveBeenCalledTimes(1);
    expect(onScoreChange).toHaveBeenCalledWith(SPIEL_9, 10, 2);
  });

  it('@FU-104 ohne bekannten Namen: „… von einem anderen Gerät geändert (jetzt 3:1)“', async () => {
    const { neu } = await olliTipptEins(async () => null);
    neu(tomTraegtEin.beendet());
    expect(await screen.findByText(HINWEIS_OHNE_NAME)).toBeTruthy();
  });

  it('@FU-104 Gegenbeispiel: Spiel 7 bekommt 3:1 – kein Hinweis, Ollis „1“ bleibt', async () => {
    const { onScoreChange, neu } = await olliTipptEins();
    const anders = spiele({}, { scoreA: 3, scoreB: 1 });
    neu({ matches: anders, tournament: ansicht(anders, {}, { matchStatus: 'finished', scoreA: 3, scoreB: 1 }) });
    await Promise.resolve();

    expect(hinweis()).toBeNull();
    expect(screen.queryByText(HINWEIS_TOM)).toBeNull();
    expect(feld('home').value).toBe('1');
    expect(onScoreChange).not.toHaveBeenCalled();
  });

  it('@FU-104 Gegenbeispiel: Ollis eigenes Speichern (10:2 kommt zurück) zeigt keinen Hinweis', async () => {
    const { user, onScoreChange, neu } = await olliTipptEins();
    await user.keyboard('0{Enter}');
    expect(onScoreChange).toHaveBeenCalledWith(SPIEL_9, 10, 2);
    const eigen = spiele({ scoreA: 10, scoreB: 2 });
    neu({ matches: eigen, tournament: ansicht(eigen, { matchStatus: 'finished', scoreA: 10, scoreB: 2 }) });
    await Promise.resolve();

    expect(hinweis()).toBeNull();
    expect(screen.queryByText(/inzwischen/)).toBeNull();
  });
});
