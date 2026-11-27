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

const GRUENWALD = 'TSV Grünwald';
const FUERSTEN = 'SC Fürstenfeldbruck';
const UNTERHACHING = 'SpVgg Unterhaching';
const HEIMSTETTEN = 'SV Heimstetten';
const DEISENHOFEN = 'FC Deisenhofen';
const BAYERN = 'FC Bayern München II';
const TSV1860 = 'TSV 1860 München II';

function zeigePlatzierung(url = '/'): void {
  const tournament = tournamentGroupOnly();
  const { schedule, standings } = scheduleAndStandings(tournament);
  render(
    <MemoryRouter initialEntries={[url]}>
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
  it('@TS-012 Köpfe sind nur Anzeige (kein Button, kein Pfeil unsortiert, aria-sort bei „Platz“), Auswahl „Sortieren nach …“ ist da', () => {
    zeigePlatzierung();
    expect(document.querySelectorAll('thead button')).toHaveLength(0);
    expect(document.querySelector('thead th[data-sort-indicator]')).toBeNull();
    expect(document.querySelectorAll('thead svg')).toHaveLength(0);
    expect(document.querySelector('thead th')?.getAttribute('aria-sort')).toBe('ascending');
    expect(screen.getByLabelText('Sortieren nach …')).toBe(screen.getByTestId('sort-picker-gesamt'));
    expect(screen.queryByTestId('sort-reset-gesamt')).toBeNull();
  });

  it('@TS-002 @TS-012 „Sortieren nach …“ bietet genau die am Handy sichtbaren Spalten (Team, Punkte, Tordifferenz) plus „Gruppe“ und „Nach Platzierung“', () => {
    zeigePlatzierung();
    const optionen = Array.from(screen.getByTestId('sort-picker-gesamt').querySelectorAll('option')).map((o) => o.textContent);
    expect(optionen).toEqual([
      'Nach Platzierung', 'Team', 'Team (umgekehrt)', 'Gruppe', 'Gruppe (umgekehrt)', 'Punkte', 'Punkte (umgekehrt)', 'Tordifferenz', 'Tordifferenz (umgekehrt)',
    ]);
  });

  it('@TS-002 „Sortieren nach …“ → „Tordifferenz (umgekehrt)“ ordnet die Zeilen um, Ränge bleiben, „Nach Platzierung“ erscheint', () => {
    zeigePlatzierung();
    // Tordifferenz: TSV 1860 +4, Grünwald +1, Fürstenfeldbruck +1, Unterhaching 0, Heimstetten 0, Bayern II −1, Deisenhofen −5; Gleichstand: Reihenfolge der Platzierung
    wahl('diff.r');
    expect(namen()).toEqual([DEISENHOFEN, BAYERN, UNTERHACHING, HEIMSTETTEN, GRUENWALD, FUERSTEN, TSV1860]);
    expect(plaetze()).toEqual(['6', '7', '4', '5', '2', '3', '1']);
    expect(screen.getByTestId('sort-reset-gesamt')).toBeInTheDocument();
  });

  it.skip('@TS-012 geparkt (Daniel 27.11.): Auswahl enthält auch Siege, Tore und Gegentore (am Handy nicht sichtbare Spalten)', () => {
    zeigePlatzierung();
    const optionen = Array.from(screen.getByTestId('sort-picker-gesamt').querySelectorAll('option')).map((o) => o.textContent);
    expect(optionen).toEqual(expect.arrayContaining(['Siege', 'Siege (umgekehrt)', 'Tore', 'Tore (umgekehrt)', 'Gegentore', 'Gegentore (umgekehrt)']));
  });

  it('@TS-005 Auswahl „Nach Platzierung“ stellt die Vorgabe wieder her', () => {
    zeigePlatzierung();
    wahl('gruppe');
    expect(plaetze()).toEqual(['2', '4', '5', '7', '1', '3', '6']);
    wahl('platz');
    expect(plaetze()).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(screen.queryByTestId('sort-reset-gesamt')).toBeNull();
  });

  it('@TS-014 „Gegentore“ (Zustand aus der Adresse, Spalte am Handy nicht sichtbar): wenigste zuerst, gemeinte Zahl fett im aufgeklappten Bereich; die Auswahl zeigt den Zustand', () => {
    zeigePlatzierung('/?ts=gesamt.gegentore');
    expect(plaetze()).toEqual(['1', '4', '5', '2', '3', '7', '6']);
    expect(screen.getByTestId('sort-picker-gesamt')).toHaveValue('gegentore');
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
