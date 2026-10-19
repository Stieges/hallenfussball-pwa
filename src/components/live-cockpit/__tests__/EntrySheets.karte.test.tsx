/**
 * EntrySheets – Karte, Zeitstrafe, Rückfrage zweite Gelbe (Aufgabe 3.5).
 * Szenarien: @SL-025, @SL-026 (nur eingeschaltete Kartenarten), @SL-088 (zweite Gelbe), @SL-029, @SL-084. Echte deutsche Texte.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { alsUebersetzer } from '../model/alsUebersetzer';
import type { OffenerEintrag } from '../model/cockpitTypes';
import { EntrySheets, type EntrySheetsProps } from '../areas/EntrySheets';
import { makeFlows } from './entryFlowsMock';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const TEAMS = { home: { id: 'fc-nord', name: 'FC Nord' }, away: { id: 'sv-sued', name: 'SV Süd' } };
const ALLE = { yellow: true, yellowRed: true, red: true };
const flows = makeFlows;
const props = (offen: OffenerEintrag | null, extra: Partial<EntrySheetsProps> = {}, rueckfrage: { nummer: number } | null = null): EntrySheetsProps => ({
  flows: flows(offen, rueckfrage), teams: TEAMS, ausloeserSeite: () => 'links', kartenArten: ALLE,
  t: alsUebersetzer(i18n.getFixedT('de', 'cockpit')), ...extra,
});
afterEach(() => { vi.unstubAllGlobals(); });
vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

describe('EntrySheets – Kartenart-Schritt', () => {
  it.each([
    ['alle Arten eingeschaltet', { yellow: true, yellowRed: true, red: true }, ['Gelb', 'Gelb-Rot', 'Rot']],
    ['@SL-025 Gelb-Rot ausgeschaltet', { yellow: true, yellowRed: false, red: true }, ['Gelb', 'Rot']],
    ['@SL-025 Gelb ausgeschaltet', { yellow: false, yellowRed: true, red: true }, ['Gelb-Rot', 'Rot']],
    ['@SL-025 Rot ausgeschaltet', { yellow: true, yellowRed: true, red: false }, ['Gelb', 'Gelb-Rot']],
  ])('Kartenart-Schritt: %s', (_n, kartenArten, erwartet) => {
    render(<EntrySheets {...props({ art: 'karte', seite: 'away' }, { kartenArten })} />);
    expect(within(screen.getByTestId('card-kind-step')).getAllByRole('button').map((b) => b.textContent)).toEqual(erwartet);
  });

  it('Karten ohne Farbe unterscheidbar: Form-Kennung und Text; „Gelb-Rot“ bricht nicht um', () => {
    render(<EntrySheets {...props({ art: 'karte', seite: 'away' })} />);
    const gelbRot = screen.getByRole('button', { name: 'Gelb-Rot' });
    expect(gelbRot.querySelector('[data-form="geteilt"]')).not.toBeNull();
    expect(gelbRot.style.whiteSpace).toBe('nowrap');
    expect(screen.getByRole('button', { name: 'Gelb' }).querySelector('[data-form="rechteck"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Rot' }).querySelector('[data-form="rechteck-voll"]')).not.toBeNull();
  });

  it('ein Tipp auf die Art wählt sie', async () => {
    const p = props({ art: 'karte', seite: 'away' });
    render(<EntrySheets {...p} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Gelb-Rot' }));
    expect(p.flows.waehleKartenArt).toHaveBeenCalledWith('YELLOW_RED');
  });

  it('Gegenbeispiel @SL-026: alle Arten aus → kein Kartenart-Schritt', () => {
    render(<EntrySheets {...props({ art: 'karte', seite: 'away' }, { kartenArten: { yellow: false, yellowRed: false, red: false } })} />);
    expect(screen.queryByTestId('card-kind-step')).toBeNull();
  });

  it('Schließen des Schritts (Esc) verwirft die Auswahl', async () => {
    const p = props({ art: 'karte', seite: 'away' });
    render(<EntrySheets {...p} />);
    await userEvent.setup().keyboard('{Escape}');
    expect(p.flows.schliesse).toHaveBeenCalled();
  });
});

describe('EntrySheets – Nummer für Karte und Zeitstrafe', () => {
  it('nach der Art folgt die Nummernauswahl mit Art und Team im Titel', () => {
    render(<EntrySheets {...props({ art: 'karte', seite: 'away', kartenArt: 'YELLOW' })} />);
    expect(screen.queryByTestId('card-kind-step')).toBeNull();
    expect(screen.getByTestId('number-picker')).toHaveAccessibleName('Rückennummer – Gelb SV Süd');
    expect(screen.queryByRole('button', { name: /Eigentor/ })).toBeNull();
  });

  it('@SL-029 Zeitstrafe: Nummernauswahl ohne Dauer-Auswahl, Titel nennt Team', () => {
    render(<EntrySheets {...props({ art: 'zeitstrafe', seite: 'away' })} />);
    expect(screen.getByTestId('number-picker')).toHaveAccessibleName('Rückennummer – Zeitstrafe SV Süd');
    expect(screen.queryByText(/Min\b/)).toBeNull();
  });

  it('Gegenbeispiel: „nummer“ aus der Liste (Bearbeiten) rendert hier nichts', () => {
    render(<EntrySheets {...props({ art: 'nummer', seite: null, eventId: 'e1' })} />);
    expect(screen.queryByTestId('number-picker')).toBeNull();
    expect(screen.queryByTestId('card-kind-step')).toBeNull();
  });
});

describe('EntrySheets – Rückfrage zweite Gelbe (@SL-088)', () => {
  const offenGelb: OffenerEintrag = { art: 'karte', seite: 'away', kartenArt: 'YELLOW' };

  it('weist darauf hin, dass Nr. 7 schon Gelb hat, und bietet Gelb-Rot mit einem Tipp an (erster Knopf)', async () => {
    const p = props(offenGelb, {}, { nummer: 7 });
    render(<EntrySheets {...p} />);
    const rueckfrage = screen.getByRole('alertdialog');
    expect(within(rueckfrage).getByText('Nr. 7 hat schon Gelb')).toBeInTheDocument();
    const knoepfe = within(rueckfrage).getAllByRole('button');
    expect(knoepfe.map((b) => b.textContent)).toEqual(['Gelb-Rot', 'Trotzdem Gelb']);
    await userEvent.setup().click(knoepfe[0]);
    expect(p.flows.antworteZweiteGelbe).toHaveBeenCalledWith('gelbRot');
  });

  it('„Trotzdem Gelb“ erfasst die zweite Gelbe', async () => {
    const p = props(offenGelb, {}, { nummer: 7 });
    render(<EntrySheets {...p} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Trotzdem Gelb' }));
    expect(p.flows.antworteZweiteGelbe).toHaveBeenCalledWith('trotzdemGelb');
  });

  it('Gegenbeispiel: ohne Rückfrage kein alertdialog; mit Rückfrage ruht die Nummernauswahl darunter (kein zweiter Zeitablauf)', () => {
    const { unmount } = render(<EntrySheets {...props(offenGelb)} />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    unmount();
    render(<EntrySheets {...props(offenGelb, {}, { nummer: 7 })} />);
    expect(screen.queryByTestId('number-picker')).toBeNull();
  });
});
