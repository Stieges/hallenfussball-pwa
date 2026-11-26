/**
 * Task 7 „Tabellen sortieren“: Torschützenliste sortierbar.
 * Szenarien aus `docs/anforderungen/2026-11-25_tabellen-sortieren.md`: @TS-002, @TS-003, @TS-005, @TS-008, @TS-019, @TS-021.
 */
import { describe, expect, it, vi } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { TeamIdSchema } from '../../../core/models/schemas/MatchSlotSchema';
import { testUuid } from '../../../test/matchSlotFixtures';
import type { ScorerRow } from '../../../core/standings/finalStandings';
import type { SortPreferenceStore } from '../../../core/standings/tableSortPreference';
import { TableSortProvider } from '../../../hooks/TableSortProvider';
await initRealDeI18n();
const { ScorerList } = await import('../components/ScorerList');

const emptyStore: SortPreferenceStore = { read: () => undefined, write: () => undefined };
const id = (n: number) => TeamIdSchema.parse(testUuid(800 + n));
const player = (rank: number, teamName: string, number: number, goals: number, teamNo: number): ScorerRow => ({ kind: 'player', rank, teamId: id(teamNo), teamName, number, goals });
const SCORERS: ScorerRow[] = [
  player(1, 'FC Zell', 9, 6, 1),
  player(2, 'SV Oberau', 7, 5, 2),
  player(3, 'SV Ölberg', 7, 3, 3),
  player(3, 'SV Ofenbach', 9, 3, 4),
  player(5, 'sc Nord', 4, 2, 5),
  { kind: 'noNumber', rank: null, teamId: id(21), teamName: 'DJK Kammer', goals: 2 },
  { kind: 'ownGoals', rank: null, teamId: id(22), teamName: 'FC Nord', goals: 1 },
];

function zeige(scorers: ScorerRow[] = SCORERS, adresse = '/') {
  return render(
    <MemoryRouter initialEntries={[adresse]}>
      <TableSortProvider store={emptyStore}>
        <ScorerList scorers={scorers} provisional={false} />
      </TableSortProvider>
    </MemoryRouter>,
  );
}
const zeilen = () => screen.getAllByTestId('final-scorer-row').map((r) => r.textContent ?? '');
const kopf = (spalte: string) => screen.getByTestId(`sort-head-tor-${spalte}`);

describe('Torschützenliste sortierbar', () => {
  it('@TS-002 Vorgabe Rang nach Toren (nur Rang 1 bis 3 sichtbar), nach „Team“ sortiert stehen alle Zeilen da und jede behält ihren Rang', () => {
    zeige();
    expect(zeilen()).toHaveLength(4); // Rang 1, 2, 3, 3; „sc Nord“ (Rang 5) und die Sammelzeilen erst hinter der Taste
    fireEvent.click(kopf('team'));
    expect(zeilen()).toEqual([
      '1#9 FC Zell6 Tore',
      '5#4 sc Nord2 Tore',
      '2#7 SV Oberau5 Tore',
      '3#7 SV Ölberg3 Tore',
      '3#9 SV Ofenbach3 Tore',
      expect.stringContaining('DJK Kammer'),
      expect.stringContaining('FC Nord'),
    ]);
    expect(screen.queryByTestId('final-scorers-toggle')).toBeNull();
  });

  it('@TS-008 Torschützen: #7 SV Ölberg steht vor #9 SV Ofenbach (je 3 Tore), auch nach „Team“ (Ö wie Oe)', () => {
    zeige();
    fireEvent.click(kopf('team'));
    const texte = zeilen().join('|');
    expect(texte.indexOf('#7 SV Ölberg')).toBeGreaterThan(-1);
    expect(texte.indexOf('SV Ölberg')).toBeLessThan(texte.indexOf('SV Ofenbach'));
    // Gleiche Tore: auch nach „Tore“ sortiert bleibt #7 SV Ölberg vor #9 SV Ofenbach (die Reihenfolge der Liste)
    fireEvent.click(kopf('tore'));
    const nachTore = zeilen().join('|');
    expect(nachTore.indexOf('#7 SV Ölberg')).toBeLessThan(nachTore.indexOf('#9 SV Ofenbach'));
  });

  it('@TS-019 „Eigentore für FC Nord – 1 Tor“ und „ohne Nummer“ bleiben am Ende ohne Rang, auch bei umgekehrter „Team“-Sortierung', () => {
    zeige();
    fireEvent.click(kopf('team'));
    fireEvent.click(kopf('team'));
    const rows = screen.getAllByTestId('final-scorer-row');
    expect(rows).toHaveLength(7);
    expect(rows[5]).toHaveTextContent('ohne Nummer – DJK Kammer');
    expect(rows[6]).toHaveTextContent('Eigentore für FC Nord');
    expect(rows[6]).toHaveTextContent('1 Tor');
    expect(within(rows[6]).getAllByRole('cell')[0].textContent).toBe('');
    expect(rows[0]).toHaveTextContent('SV Ofenbach');
  });

  it('@TS-003 Kopf „Tore“: meiste zuerst (Vorgabe), wenigste zuerst, zurück zur Platzierung mit eingeklappter Liste', () => {
    zeige();
    fireEvent.click(kopf('tore'));
    expect(zeilen()).toHaveLength(7);
    expect(zeilen()[0]).toContain('FC Zell');
    fireEvent.click(kopf('tore'));
    expect(zeilen()[0]).toContain('sc Nord');
    expect(zeilen()[4]).toContain('FC Zell');
    expect(zeilen().slice(5).join('|')).toMatch(/DJK Kammer.*FC Nord/);
    fireEvent.click(kopf('tore'));
    expect(zeilen()).toHaveLength(4);
    expect(screen.getByTestId('final-scorers-toggle')).toBeInTheDocument();
  });

  it('@TS-005 „Nach Platzierung“ stellt Reihenfolge und eingeklappte Liste wieder her', () => {
    zeige();
    fireEvent.click(kopf('team'));
    fireEvent.click(screen.getByTestId('sort-reset-tor'));
    expect(zeilen()).toHaveLength(4);
    expect(zeilen()[0]).toContain('FC Zell');
    expect(screen.queryByTestId('sort-reset-tor')).toBeNull();
  });

  it('@TS-021 Tabellen-Semantik: Köpfe „Team“ und „Tore“ mit aria-sort, Kopf „Tore“ wird als „Tore, meiste zuerst sortiert“ vorgelesen', () => {
    zeige();
    const tabelle = screen.getByRole('table');
    expect(within(tabelle).getAllByRole('columnheader').map((k) => k.getAttribute('aria-sort'))).toEqual([null, 'none', 'none']);
    expect(within(tabelle).getAllByRole('row').length).toBeGreaterThan(1);
    expect(within(tabelle).getAllByRole('cell').length).toBeGreaterThan(0);
    fireEvent.click(kopf('tore'));
    expect(kopf('tore')).toHaveAccessibleName('Tore, meiste zuerst sortiert');
    expect(kopf('tore')).toHaveAttribute('data-touch-ok');
  });

  it('@TS-002 Sortierung aus der Adresse (?ts=tor.team) gilt beim Öffnen; unbekannte Spalte (tor.pkt) zählt nicht', () => {
    const erste = zeige(SCORERS, '/?ts=tor.team');
    expect(zeilen()).toHaveLength(7);
    expect(zeilen()[1]).toContain('sc Nord');
    erste.unmount();
    zeige(SCORERS, '/?ts=tor.pkt');
    expect(zeilen()).toHaveLength(4);
    expect(screen.queryByTestId('sort-reset-tor')).toBeNull();
  });

  it('@TS-012 am Handy: Auswahl „Sortieren nach …“ statt bedienbarer Köpfe', () => {
    const alt = window.innerWidth;
    window.innerWidth = 390;
    try {
      zeige();
      expect(screen.queryByTestId('sort-head-tor-team')).toBeNull();
      fireEvent.change(screen.getByTestId('sort-picker-tor'), { target: { value: 'team' } });
      expect(zeilen()[1]).toContain('sc Nord');
    } finally {
      window.innerWidth = alt;
    }
  });

  it('@TS-002 nur Sammelzeilen (keine Spielerzeile): kein Sortieren, die Sammelzeilen stehen da', () => {
    zeige([SCORERS[5], SCORERS[6]]);
    expect(zeilen()).toHaveLength(2);
    expect(screen.queryByTestId('sort-head-tor-team')).toBeNull();
  });
});
