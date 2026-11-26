/**
 * Task 6 „Tabellen sortieren“: Platzierung über alle Gruppen am Handy (@TS-002, @TS-005, @TS-012, @TS-014).
 * Die Köpfe sind nur Anzeige; bedient wird über „Sortieren nach …“. Daten wie in `TabellenTab.sort.test.tsx`.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { initRealDeI18n } from '../../../test/realDeI18n';
import type { SortPreferenceStore } from '../../../core/standings/tableSortPreference';
import { TableSortProvider } from '../../../hooks/TableSortProvider';
import { TabellenTab } from '../TabellenTab';
import { scheduleAndStandings, tournamentGroupOnly } from './openPlacementTestHelpers';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => true }));
await initRealDeI18n();

const emptyStore: SortPreferenceStore = { read: () => undefined, write: () => undefined };

function zeigePlatzierung(): void {
  const tournament = tournamentGroupOnly();
  const { schedule, standings } = scheduleAndStandings(tournament);
  render(
    <MemoryRouter>
      <TableSortProvider store={emptyStore}>
        <TabellenTab tournament={tournament} schedule={schedule} currentStandings={standings} />
      </TableSortProvider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Gesamtplatzierung' }));
}

const zeilen = () => Array.from(document.querySelectorAll('tbody tr')).filter((r) => r.querySelectorAll('td').length > 1 && r.getAttribute('data-testid') !== 'tie-marker-row');
const namen = () => zeilen().map((r) => r.querySelectorAll('td')[1]?.firstChild?.textContent ?? '');
const plaetze = () => zeilen().map((r) => r.querySelectorAll('td')[0]?.textContent ?? '');
const wahl = (label: string) => fireEvent.change(screen.getByTestId('sort-picker-gesamt'), { target: { value: label } });

describe('TabellenTab Handy: Platzierung über alle Gruppen sortierbar', () => {
  it('@TS-012 Köpfe sind nur Anzeige (kein Button, Pfeil bei „Platz“, aria-sort), Auswahl „Sortieren nach …“ ist da', () => {
    zeigePlatzierung();
    expect(document.querySelectorAll('thead button')).toHaveLength(0);
    expect(document.querySelector('thead th[data-sort-indicator="asc"]')).not.toBeNull();
    expect(screen.getByLabelText('Sortieren nach …')).toBe(screen.getByTestId('sort-picker-gesamt'));
    expect(screen.queryByTestId('sort-reset-gesamt')).toBeNull();
  });

  it('@TS-002 „Sortieren nach …“ → „Siege (umgekehrt)“ ordnet die Zeilen um, Ränge bleiben; Auswahl enthält „Gruppe“ und beide Tor-Richtungen', () => {
    zeigePlatzierung();
    const optionen = Array.from(screen.getByTestId('sort-picker-gesamt').querySelectorAll('option')).map((o) => o.textContent);
    expect(optionen).toEqual(expect.arrayContaining(['Nach Platzierung', 'Siege', 'Siege (umgekehrt)', 'Gruppe', 'Tore', 'Tore (umgekehrt)', 'Gegentore', 'Gegentore (umgekehrt)']));
    wahl('s.r');
    expect(namen()).toEqual(['SpVgg Unterhaching', 'SV Heimstetten', 'FC Deisenhofen', 'FC Bayern München II', 'TSV 1860 München II', 'TSV Grünwald', 'SC Fürstenfeldbruck']);
    expect(plaetze()).toEqual(['4', '5', '6', '7', '1', '2', '3']);
    expect(screen.getByTestId('sort-reset-gesamt')).toBeInTheDocument();
  });

  it('@TS-005 Auswahl „Nach Platzierung“ stellt die Vorgabe wieder her', () => {
    zeigePlatzierung();
    wahl('gruppe');
    expect(plaetze()).toEqual(['2', '4', '5', '7', '1', '3', '6']);
    wahl('platz');
    expect(plaetze()).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(screen.queryByTestId('sort-reset-gesamt')).toBeNull();
  });

  it('@TS-014 „Gegentore“ in der Auswahl: wenigste zuerst, gemeinte Zahl fett im aufgeklappten Bereich', () => {
    zeigePlatzierung();
    wahl('gegentore');
    expect(plaetze()).toEqual(['1', '4', '5', '2', '3', '7', '6']);
    fireEvent.click(zeilen()[0]);
    const fokus = document.querySelector('[data-goals-focus]');
    expect(fokus?.getAttribute('data-goals-focus')).toBe('against');
    expect(fokus?.textContent).toBe('0');
  });

  it('@TS-016 Medaille bleibt am Team (Platz 1) auch am Handy nach Sortierung nach „Team“', () => {
    zeigePlatzierung();
    wahl('team');
    const gold = document.querySelector('[data-medal="gold"]');
    expect(gold?.closest('tr')?.textContent).toContain('TSV 1860 München II');
    expect(gold?.closest('tr')).not.toBe(zeilen()[0]);
  });
});
