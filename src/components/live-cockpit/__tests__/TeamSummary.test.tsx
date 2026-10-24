/**
 * TeamSummary (B-10a2, @SL-048): die Zusammenfassung eines Teams nach dem Abpfiff – Tore, Karten, Zeitstrafen, Fouls.
 * Wortlaut aus dem Mockup „Laptop, abgepfiffen“ („Tore (2)“, „Karten (0): keine“, „Fouls: 3“). Echte deutsche Übersetzung.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { TeamSummary } from '../areas/TeamSummary';
import type { TeamSummaryModel } from '../model/toTeamSummaryModel';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const nord: TeamSummaryModel = {
  seite: 'home', name: 'FC Nord', kasten: { fill: { kind: 'solid', color: '#1565C0' }, bib: false },
  tore: [{ id: 'a', nummer: 9, zeit: '1:50', eigentor: false }, { id: 'b', nummer: null, zeit: '7:10', eigentor: false }],
  karten: [], zeitstrafen: [{ id: 'c', nummer: 4, zeit: '7:40' }], fouls: 3,
};
const sued: TeamSummaryModel = {
  seite: 'away', name: 'SV Süd', kasten: { fill: { kind: 'solid', color: '#C62828' }, bib: false }, tore: [{ id: 'd', nummer: 3, zeit: '6:35', eigentor: false }],
  karten: [{ id: 'e', art: 'YELLOW', nummer: 7, zeit: '1:15' }], zeitstrafen: [], fouls: 3,
};

describe('TeamSummary (@SL-048)', () => {
  it('FC Nord: Tore (2) mit Nummer und Zeit, „Karten (0): keine“, Zeitstrafen (1), Fouls: 3 – und keine Tasten', () => {
    render(<TeamSummary model={nord} />);
    const feld = screen.getByTestId('team-summary-home');
    expect(within(feld).getByText('FC Nord')).toBeInTheDocument();
    expect(screen.getByTestId('team-name-home')).toHaveTextContent('FC Nord'); // dieselbe Kennung wie die Spalte (E2E-Anker)
    expect(within(feld).getByText('Heim')).toBeInTheDocument();
    expect(within(feld).getByText('Tore (2)')).toBeInTheDocument();
    expect(within(feld).getByText('Nr. 9, 1:50')).toBeInTheDocument();
    expect(within(feld).getByText('ohne Nr., 7:10')).toBeInTheDocument();
    expect(within(feld).getByText('Karten (0): keine')).toBeInTheDocument();
    expect(within(feld).getByText('Zeitstrafen (1)')).toBeInTheDocument();
    expect(within(feld).getByText('Nr. 4, 7:40')).toBeInTheDocument();
    expect(within(feld).getByText('Fouls: 3')).toBeInTheDocument();
    expect(within(feld).queryAllByRole('button')).toHaveLength(0);
  });

  it('SV Süd: Karten (1) mit Kartensymbol und Nr. 7, „Zeitstrafen (0): keine“', () => {
    render(<TeamSummary model={sued} />);
    const feld = screen.getByTestId('team-summary-away');
    expect(within(feld).getByText('Gast')).toBeInTheDocument();
    expect(within(feld).getByText('Karten (1)')).toBeInTheDocument();
    expect(within(feld).getByText('Nr. 7, 1:15')).toBeInTheDocument();
    expect(within(feld).getByTestId('karten-symbol-YELLOW')).toBeInTheDocument();
    expect(within(feld).getByText('Zeitstrafen (0): keine')).toBeInTheDocument();
    expect(within(feld).getByText('Tore (1)')).toBeInTheDocument();
  });

  it('Gegenbeispiel: Gelb-Rot trägt sein eigenes Symbol, nicht das der Gelben Karte', () => {
    render(<TeamSummary model={{ ...sued, karten: [{ id: 'f', art: 'YELLOW_RED', nummer: 5, zeit: '2:00' }] }} />);
    expect(screen.getByTestId('karten-symbol-YELLOW_RED')).toBeInTheDocument();
    expect(screen.queryByTestId('karten-symbol-YELLOW')).toBeNull();
  });

  it('ein Eigentor steht als Eigentor in der Liste', () => {
    render(<TeamSummary model={{ ...nord, tore: [{ id: 'g', nummer: 12, zeit: '1:30', eigentor: true }] }} />);
    expect(screen.getByText('Eigentor Nr. 12, 1:30')).toBeInTheDocument();
  });

  it('ohne Einträge: „Tore (0): keine“ und „Fouls: 0“ (Gegenbeispiel zu „Tore (2)“)', () => {
    render(<TeamSummary model={{ ...nord, tore: [], zeitstrafen: [], fouls: 0 }} />);
    expect(screen.getByText('Tore (0): keine')).toBeInTheDocument();
    expect(screen.getByText('Fouls: 0')).toBeInTheDocument();
    expect(screen.queryByText('Tore (2)')).toBeNull();
  });

  it('@SL-176 der Kopf trägt die Farbe des Kastens und „Gast“ wie die Tastenspalte; die Fläche ist mit der Tastatur erreichbar (scrollbarer Bereich ohne Tasten)', () => {
    render(<TeamSummary model={sued} />);
    expect(screen.getByTestId('team-head-away')).toHaveAttribute('data-color', '#C62828');
    expect(screen.getByTestId('team-summary-away')).toHaveAttribute('tabindex', '0');
  });
});
