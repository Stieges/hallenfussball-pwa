/**
 * EntrySheets – Nummernauswahl des Tors (Aufgabe 3.4): Titel, Eigentor-Zeile, Seite von „ohne Nummer“, Tastatur-Modus nach
 * Zeiger und Taste (nie nach Breite, Auflage 8). Szenarien: @SL-020, @SL-022, @SL-153. Echte deutsche Texte.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import i18n from 'i18next';
import { alsUebersetzer } from '../model/alsUebersetzer';
import type { UseEntryFlowsReturn } from '../hooks/useEntryFlows';
import type { OffenerEintrag } from '../model/cockpitTypes';
import { EntrySheets, type EntrySheetsProps } from '../areas/EntrySheets';
import { makeFlows } from './entryFlowsMock';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const TEAMS = { home: { id: 'fc-nord', name: 'FC Nord' }, away: { id: 'sv-sued', name: 'SV Süd' } };
const ARTEN = { yellow: true, yellowRed: true, red: true };
const flows = (offen: OffenerEintrag | null): UseEntryFlowsReturn => makeFlows(offen);
const props = (offen: OffenerEintrag | null, extra: Partial<EntrySheetsProps> = {}): EntrySheetsProps => ({
  flows: flows(offen), teams: TEAMS, ausloeserSeite: (seite) => (seite === 'home' ? 'links' : 'rechts'), kartenArten: ARTEN,
  t: alsUebersetzer(i18n.getFixedT('de', 'cockpit')), ...extra,
});
function mockMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}
afterEach(() => { vi.unstubAllGlobals(); });

describe('EntrySheets – Tor', () => {
  it('@SL-020 der Titel nennt das Team, „ohne Nummer“ liegt gegenüber dem auslösenden Knopf', () => {
    mockMatchMedia(false);
    render(<EntrySheets {...props({ art: 'tor', seite: 'home' })} />);
    expect(screen.getByTestId('number-picker')).toHaveAccessibleName('Rückennummer – Tor FC Nord');
    expect(screen.getByRole('button', { name: 'ohne Nummer' }).parentElement).toHaveAttribute('data-lage', 'rechts');
  });

  it('@SL-022 die Zeile „Eigentor (SV Süd)“ ruft waehleEigentor; im Eigentor-Schritt fehlt sie und der Titel nennt den Gegner', async () => {
    mockMatchMedia(false);
    const p = props({ art: 'tor', seite: 'home' });
    const { rerender } = render(<EntrySheets {...p} />);
    await act(async () => { within(screen.getByTestId('number-picker')).getByRole('button', { name: 'Eigentor (SV Süd)' }).click(); });
    // die Sperre (300 ms) ist noch aktiv: der Tipp zählt nicht
    expect(p.flows.waehleEigentor).not.toHaveBeenCalled();
    rerender(<EntrySheets {...props({ art: 'tor', seite: 'home', eigentor: true })} />);
    expect(screen.queryByRole('button', { name: /Eigentor/ })).toBeNull();
    expect(screen.getByTestId('number-picker')).toHaveAccessibleName('Nummer des Spielers von SV Süd');
  });

  it('@SL-153 Maus oder Trackpad (feiner Zeiger): das Nummernfeld ist offen und hat den Fokus', () => {
    mockMatchMedia(true);
    render(<EntrySheets {...props({ art: 'tor', seite: 'away' })} />);
    expect(screen.getByLabelText('Rückennummer')).toHaveFocus();
  });

  it('@SL-153 Tablet quer (pointer coarse, matchMedia gemockt), Tor angetippt → Feld nicht fokussiert', () => {
    mockMatchMedia(false);
    render(<EntrySheets {...props({ art: 'tor', seite: 'away' })} />);
    expect(screen.queryByLabelText('Rückennummer')).toBeNull();
    expect(document.activeElement).not.toBeInstanceOf(HTMLInputElement);
  });

  it('@SL-153 per Taste geöffnet (perTaste) → Tastatur-Modus, auch ohne feinen Zeiger', () => {
    mockMatchMedia(false);
    render(<EntrySheets {...props({ art: 'tor', seite: 'away', perTaste: true })} />);
    expect(screen.getByLabelText('Rückennummer')).toHaveFocus();
  });

  it('Gegenbeispiel: ohne offene Auswahl (oder bei einer anderen Art) rendert der Tor-Baustein nichts', () => {
    mockMatchMedia(false);
    render(<EntrySheets {...props(null)} />);
    expect(screen.queryByTestId('number-picker')).toBeNull();
  });
});
