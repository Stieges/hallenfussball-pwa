/**
 * Task 6 „Tabellen sortieren“: Platzierung über alle Gruppen (breite Ansicht) im Reiter „Tabellen“.
 * Szenarien aus `docs/anforderungen/2026-11-25_tabellen-sortieren.md`: @TS-002, @TS-005, @TS-014, @TS-016.
 * Daten: Mock-Turnier ohne Finalrunde, zwei Gruppen; Gesamtplatz 1 TSV 1860, 2 Grünwald, 3 Fürstenfeldbruck, 4 Unterhaching,
 * 5 Heimstetten, 6 Deisenhofen, 7 Bayern II (Tore 4:0, 3:2, 3:2, 1:1, 1:1, 2:7, 2:3).
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { initRealDeI18n } from '../../../test/realDeI18n';
import type { SortPreferenceStore } from '../../../core/standings/tableSortPreference';
import { TableSortProvider } from '../../../hooks/TableSortProvider';
import { TabellenTab } from '../TabellenTab';
import { scheduleAndStandings, tournamentGroupOnly } from './openPlacementTestHelpers';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const emptyStore: SortPreferenceStore = { read: () => undefined, write: () => undefined };

const TSV1860 = 'TSV 1860 München II';
const GRUENWALD = 'TSV Grünwald';
const FUERSTEN = 'SC Fürstenfeldbruck';
const UNTERHACHING = 'SpVgg Unterhaching';
const HEIMSTETTEN = 'SV Heimstetten';
const DEISENHOFEN = 'FC Deisenhofen';
const BAYERN = 'FC Bayern München II';
const VORGABE = [TSV1860, GRUENWALD, FUERSTEN, UNTERHACHING, HEIMSTETTEN, DEISENHOFEN, BAYERN];

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

const zeilen = () => Array.from(document.querySelectorAll('tbody tr')).filter((r) => r.getAttribute('data-testid') !== 'tie-marker-row');
const namen = () => zeilen().map((r) => r.querySelectorAll('td')[1]?.textContent ?? '');
const plaetze = () => zeilen().map((r) => r.querySelectorAll('td')[0]?.textContent ?? '');
const kopf = (spalte: string) => screen.getByTestId(`sort-head-gesamt-${spalte}`);
const fokus = () => Array.from(document.querySelectorAll<HTMLElement>('[data-goals-focus]'));

describe('TabellenTab: Platzierung über alle Gruppen sortierbar', () => {
  it('@TS-002 Platzierung über alle Gruppen: Vorgabe Gesamtplatz, nach „Gruppe“ sortiert, jede Zeile behält ihren Rang', () => {
    zeigePlatzierung();
    expect(namen()).toEqual(VORGABE);
    expect(plaetze()).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    fireEvent.click(kopf('gruppe'));
    // Gruppe A zuerst (in Reihenfolge der Platzierung), dann Gruppe B; der Rang bleibt am Team
    expect(namen()).toEqual([GRUENWALD, UNTERHACHING, HEIMSTETTEN, BAYERN, TSV1860, FUERSTEN, DEISENHOFEN]);
    expect(plaetze()).toEqual(['2', '4', '5', '7', '1', '3', '6']);
    expect(screen.getByTestId('sort-reset-gesamt')).toBeInTheDocument();
  });

  it('@TS-016 Medaille bleibt beim Team auf Platz 1, nicht bei der obersten Zeile, nach Sortierung nach „Team“', () => {
    zeigePlatzierung();
    fireEvent.click(kopf('team'));
    expect(namen()).toEqual([BAYERN, DEISENHOFEN, FUERSTEN, UNTERHACHING, HEIMSTETTEN, TSV1860, GRUENWALD]);
    const medaillen = Array.from(document.querySelectorAll('[data-testid="place-medal"]')).map((m) => m.getAttribute('data-medal'));
    expect(medaillen).toEqual(['none', 'none', 'bronze', 'none', 'none', 'gold', 'silver']);
    expect(zeilen()[5].textContent).toContain(TSV1860);
  });

  it('@TS-005 „Nach Platzierung“ stellt die Vorgabe wieder her und verschwindet', () => {
    zeigePlatzierung();
    fireEvent.click(kopf('team'));
    expect(namen()).not.toEqual(VORGABE);
    fireEvent.click(screen.getByTestId('sort-reset-gesamt'));
    expect(namen()).toEqual(VORGABE);
    expect(screen.queryByTestId('sort-reset-gesamt')).toBeNull();
  });

  it('@TS-005 Tipp auf den Spaltenkopf „Platz“ stellt die Vorgabe wieder her und die Taste verschwindet', () => {
    zeigePlatzierung();
    fireEvent.click(kopf('pkt'));
    fireEvent.click(kopf('sp'));
    expect(kopf('platz')).toHaveAttribute('data-sorted', 'false');
    fireEvent.click(kopf('platz'));
    expect(namen()).toEqual(VORGABE);
    expect(kopf('platz')).toHaveAttribute('data-sorted', 'true');
    expect(screen.queryByTestId('sort-reset-gesamt')).toBeNull();
  });

  it('@TS-014 Torspalte der Platzierung in fünf Stufen: Tore meiste, Tore wenigste, Gegentore wenigste, Gegentore meiste, zurück', () => {
    zeigePlatzierung();
    const stufe = (name: RegExp | string, reihenfolge: string[], seite: 'for' | 'against' | null) => {
      expect(kopf('tore')).toHaveAccessibleName(name);
      expect(namen()).toEqual(reihenfolge);
      expect(fokus()).toHaveLength(seite === null ? 0 : 7);
      expect(fokus().every((e) => e.getAttribute('data-goals-focus') === seite)).toBe(true);
    };
    fireEvent.click(kopf('tore'));
    stufe(/^Tore, meiste zuerst/, [TSV1860, GRUENWALD, FUERSTEN, DEISENHOFEN, BAYERN, UNTERHACHING, HEIMSTETTEN], 'for');
    expect(fokus()[0].textContent).toBe('4');
    fireEvent.click(kopf('tore'));
    stufe(/^Tore, wenigste zuerst/, [UNTERHACHING, HEIMSTETTEN, DEISENHOFEN, BAYERN, GRUENWALD, FUERSTEN, TSV1860], 'for');
    fireEvent.click(kopf('tore'));
    stufe(/^Gegentore, wenigste zuerst/, [TSV1860, UNTERHACHING, HEIMSTETTEN, GRUENWALD, FUERSTEN, BAYERN, DEISENHOFEN], 'against');
    expect(fokus()[0].textContent).toBe('0');
    fireEvent.click(kopf('tore'));
    stufe(/^Gegentore, meiste zuerst/, [DEISENHOFEN, BAYERN, GRUENWALD, FUERSTEN, UNTERHACHING, HEIMSTETTEN, TSV1860], 'against');
    fireEvent.click(kopf('tore'));
    stufe('Tore', VORGABE, null);
  });

  it('@TS-002 Köpfe der Platzierung: „Gruppe“ ist eine Sortiertaste, eine Spalte „Entschieden durch“ gibt es ohne Finalrunde nicht', () => {
    zeigePlatzierung();
    const kopfzeile = within(document.querySelector('thead') as HTMLElement);
    expect(kopfzeile.queryByRole('button', { name: /Entschieden durch/ })).toBeNull();
    expect(kopfzeile.getAllByRole('button').map((b) => b.getAttribute('data-testid'))).toEqual([
      'sort-head-gesamt-platz', 'sort-head-gesamt-team', 'sort-head-gesamt-gruppe', 'sort-head-gesamt-sp', 'sort-head-gesamt-s',
      'sort-head-gesamt-u', 'sort-head-gesamt-n', 'sort-head-gesamt-tore', 'sort-head-gesamt-diff', 'sort-head-gesamt-pkt',
    ]);
  });
});
