/**
 * Task 7 „Tabellen sortieren“: Endstand sortierbar (App und Zuschauer-Variante).
 * Szenarien aus `docs/anforderungen/2026-11-25_tabellen-sortieren.md`: @TS-002, @TS-003, @TS-005, @TS-008, @TS-012, @TS-021, @TS-016.
 * Daten: Endstand mit acht Plätzen (Platz 1 FC Zell, 2 SV Oberau, 3 SV Österberg, 4 sc Nord, geteilter Platz 5 SV Ölberg und SV Ofenbach …).
 */
import { describe, expect, it, vi } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { TeamIdSchema } from '../../../core/models/schemas/MatchSlotSchema';
import { testUuid } from '../../../test/matchSlotFixtures';
import type { FinalStandingRow, TableValues } from '../../../core/standings/finalStandings';
import type { SortPreferenceStore } from '../../../core/standings/tableSortPreference';
import { TableSortProvider } from '../../../hooks/TableSortProvider';
await initRealDeI18n();
import { nikolausFertig } from '../../../core/services/__tests__/finishKit';
const { FinalStandingsView } = await import('../components/FinalStandingsView');
const turnier = await nikolausFertig();

const emptyStore: SortPreferenceStore = { read: () => undefined, write: () => undefined };
const tv = (games: number, goalDiff: number, points: number): TableValues => ({ games, goalsFor: 10, goalsAgainst: 10 - goalDiff, goalDiff, points });
const row = (n: number, place: number, teamName: string, values?: TableValues): FinalStandingRow => ({
  place, teamId: TeamIdSchema.parse(testUuid(700 + n)), teamName, origin: { kind: 'groupPlace', group: 'A', place: n },
  ...(values === undefined ? {} : { tableValues: values }),
});
const RANKING: FinalStandingRow[] = [
  row(1, 1, 'FC Zell', tv(3, 5, 9)),
  row(2, 2, 'SV Oberau', tv(3, 2, 6)),
  row(3, 3, 'SV Österberg', tv(4, 0, 4)),
  row(4, 4, 'sc Nord', tv(3, -1, 3)),
  row(5, 5, 'SV Ölberg', tv(3, -3, 1)),
  row(6, 5, 'SV Ofenbach', tv(3, -3, 1)),
];
/** Nach „Team“: Ö wie Oe (DIN 5007-2), Groß/Klein egal: Oberau, Ölberg (Oel…), Österberg (Oes…), Ofenbach. */
const NACH_TEAM = ['FC Zell', 'sc Nord', 'SV Oberau', 'SV Ölberg', 'SV Österberg', 'SV Ofenbach'];
const VORGABE = ['FC Zell', 'SV Oberau', 'SV Österberg', 'sc Nord', 'SV Ölberg', 'SV Ofenbach'];

function zeige(ranking: FinalStandingRow[] = RANKING, extra: Partial<Parameters<typeof FinalStandingsView>[0]> = {}, adresse = '/') {
  return render(
    <MemoryRouter initialEntries={[adresse]}>
      <TableSortProvider store={emptyStore}>
        <FinalStandingsView tournament={turnier} ranking={ranking} provisional={false} {...extra} />
      </TableSortProvider>
    </MemoryRouter>,
  );
}
const namen = () => screen.getAllByTestId('final-standing-row').map((r) => within(r).getByTestId('final-standing-team').textContent?.trim() ?? '');
const plaetze = () => screen.getAllByTestId('final-standing-row').map((r) => r.getAttribute('data-place'));
const kopf = (spalte: string) => screen.getByTestId(`sort-head-end-${spalte}`);

describe('Endstand sortierbar', () => {
  it('@TS-002 Endstand: Vorgabe Endplatz, nach „Team“ sortiert, jede Zeile behält ihren Platz', () => {
    zeige();
    expect(namen()).toEqual(VORGABE);
    fireEvent.click(kopf('team'));
    // „SV Ölberg“ steht vor „SV Ofenbach“ (@TS-008), „sc Nord“ steht bei „S“
    expect(namen()).toEqual(NACH_TEAM);
    expect(plaetze()).toEqual(['1', '4', '2', '5', '3', '5']);
  });

  it('@TS-003 Kopf „Pkt.“: 1. Tipp meiste zuerst, 2. Tipp wenigste zuerst, 3. Tipp zurück zur Platzierung; Pfeil am aktiven Kopf', () => {
    zeige();
    fireEvent.click(kopf('pkt'));
    expect(namen()).toEqual(VORGABE);
    expect(kopf('pkt')).toHaveAttribute('data-sorted', 'true');
    fireEvent.click(kopf('pkt'));
    expect(namen()).toEqual(['SV Ölberg', 'SV Ofenbach', 'sc Nord', 'SV Österberg', 'SV Oberau', 'FC Zell']);
    expect(kopf('pkt').closest('[role="columnheader"]')).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(kopf('pkt'));
    expect(namen()).toEqual(VORGABE);
    expect(screen.queryByTestId('sort-reset-end')).toBeNull();
  });

  it('@TS-003 Kopf „Sp.“: meiste Spiele zuerst, Gleichstand bleibt in der Reihenfolge des Endstands', () => {
    zeige();
    fireEvent.click(kopf('sp'));
    expect(namen()).toEqual(['SV Österberg', 'FC Zell', 'SV Oberau', 'sc Nord', 'SV Ölberg', 'SV Ofenbach']);
  });

  it('@TS-008 Gleichstand nach dem Namen („SV Röthenbach“, „SV Roethenbach“): der Endplatz entscheidet', () => {
    zeige([row(1, 1, 'SV Röthenbach', tv(3, 0, 3)), row(2, 2, 'SV Roethenbach', tv(3, 0, 3)), row(3, 3, 'AC Alt', tv(3, 0, 3))]);
    fireEvent.click(kopf('team'));
    expect(namen()).toEqual(['AC Alt', 'SV Röthenbach', 'SV Roethenbach']);
  });

  it('@TS-002 Zeilen ohne Tabellenwerte (Platzierungsspiele) stehen beim Sortieren nach Sp./Diff./Pkt. in beiden Richtungen am Ende, in Reihenfolge des Endstands', () => {
    const gemischt = [row(1, 1, 'FC Zell'), row(2, 2, 'SV Oberau'), row(3, 3, 'sc Nord', tv(3, 0, 3)), row(4, 4, 'SV Ölberg', tv(3, 2, 7)), row(5, 5, 'AC Alt', tv(4, -2, 1))];
    zeige(gemischt);
    for (const spalte of ['pkt', 'diff', 'sp']) {
      fireEvent.click(kopf(spalte));
      expect(namen().slice(3), `${spalte} meiste zuerst`).toEqual(['FC Zell', 'SV Oberau']);
      expect(namen().slice(0, 3)).not.toContain('FC Zell');
      fireEvent.click(kopf(spalte));
      expect(namen().slice(3), `${spalte} wenigste zuerst`).toEqual(['FC Zell', 'SV Oberau']);
      fireEvent.click(kopf(spalte));
    }
    fireEvent.click(kopf('pkt'));
    expect(namen()).toEqual(['SV Ölberg', 'sc Nord', 'AC Alt', 'FC Zell', 'SV Oberau']);
    fireEvent.click(kopf('team'));
    expect(namen()).toEqual(['AC Alt', 'FC Zell', 'sc Nord', 'SV Oberau', 'SV Ölberg']);
  });

  it('@TS-005 „Nach Platzierung“ und Tipp auf „Platz“ stellen die Vorgabe wieder her; Gespeichertes wird in der Vorgabe nie umgeordnet', () => {
    zeige();
    fireEvent.click(kopf('diff'));
    fireEvent.click(kopf('diff'));
    expect(namen()).not.toEqual(VORGABE);
    fireEvent.click(screen.getByTestId('sort-reset-end'));
    expect(namen()).toEqual(VORGABE);
    fireEvent.click(kopf('team'));
    fireEvent.click(kopf('platz'));
    expect(namen()).toEqual(VORGABE);
    expect(kopf('platz')).toHaveAttribute('data-sorted', 'true');
  });

  it('@TS-016 Gold-Zeile der Zuschauer-Seite bleibt beim Team auf Platz 1, nicht bei der obersten Zeile', () => {
    zeige(RANKING, { variant: 'public' });
    fireEvent.click(kopf('team'));
    const zeilen = screen.getAllByTestId('final-standing-row');
    const gold = zeilen.filter((z) => z.style.boxShadow !== '');
    expect(gold).toHaveLength(1);
    expect(gold[0]).toHaveAttribute('data-place', '1');
    expect(zeilen[0]).toHaveAttribute('data-place', '1');
  });

  it('@TS-021 Tabellen-Semantik: Tabelle mit Kopfzeile, Köpfen mit aria-sort und Zellen', () => {
    zeige();
    const tabelle = screen.getByRole('table');
    const koepfe = within(tabelle).getAllByRole('columnheader');
    expect(koepfe).toHaveLength(5);
    expect(koepfe.map((k) => k.getAttribute('aria-sort'))).toEqual(['ascending', 'none', 'none', 'none', 'none']);
    expect(within(tabelle).getAllByRole('row')).toHaveLength(1 + RANKING.length);
    expect(screen.getByTestId('final-standings-header').hasAttribute('aria-hidden')).toBe(false);
  });

  it('@TS-021 Kopf „Pkt.“ ist per Tastatur bedienbar und wird als „Punkte, meiste zuerst sortiert“ vorgelesen', () => {
    zeige();
    const taste = kopf('pkt');
    expect(taste.tagName).toBe('BUTTON');
    expect(taste).toHaveAttribute('data-touch-ok');
    taste.focus();
    expect(taste).toHaveFocus();
    fireEvent.click(taste); // Enter/Leertaste lösen bei einer Taste den Klick aus
    expect(kopf('pkt')).toHaveAccessibleName('Punkte, meiste zuerst sortiert');
  });

  it('@TS-002 ohne Tabellenwerte: nur die Köpfe „Platz“ und „Team“; Spalte aus der Adresse (end.pkt) zählt nicht', () => {
    zeige(RANKING.map(({ tableValues: _werte, ...rest }) => rest), {}, '/?ts=end.pkt');
    expect(within(screen.getByTestId('final-standings-header')).getAllByRole('columnheader').map((k) => k.textContent)).toEqual(['Platz', 'Team']);
    expect(namen()).toEqual(VORGABE);
    expect(screen.queryByTestId('sort-reset-end')).toBeNull();
    fireEvent.click(kopf('team'));
    expect(namen()[0]).toBe('FC Zell');
  });

  it('@TS-002 Sortierung aus der Adresse (?ts=end.team) gilt beim Öffnen', () => {
    zeige(RANKING, {}, '/?ts=end.team');
    expect(namen()).toEqual(NACH_TEAM);
    expect(screen.getByTestId('sort-reset-end')).toBeInTheDocument();
  });

  it('@TS-012 am Handy sind die Köpfe nur Anzeige, sortiert wird über „Sortieren nach …“ und „Nach Platzierung“', () => {
    const alt = window.innerWidth;
    window.innerWidth = 390;
    try {
      zeige();
      expect(screen.queryByTestId('sort-head-end-team')).toBeNull();
      const auswahl = screen.getByTestId('sort-picker-end');
      expect(auswahl).toBeInTheDocument();
      // genau die Spalten der Handy-Kopfzeile (Team, Sp., Diff., Pkt.) plus „Nach Platzierung“
      expect(Array.from(auswahl.querySelectorAll('option')).map((o) => o.getAttribute('value'))).toEqual(['platz', 'team', 'team.r', 'sp', 'sp.r', 'diff', 'diff.r', 'pkt', 'pkt.r']);
      fireEvent.change(auswahl, { target: { value: 'team' } });
      expect(namen()).toEqual(NACH_TEAM);
      const teamKopf = screen.getAllByRole('columnheader').find((k) => k.textContent === 'Team');
      expect(teamKopf).toHaveAttribute('aria-sort', 'ascending');
      expect(teamKopf?.querySelector('button')).toBeNull();
      fireEvent.click(screen.getByTestId('sort-reset-end'));
      expect(namen()).toEqual(VORGABE);
    } finally {
      window.innerWidth = alt;
    }
  });

  it('@TS-001 ohne Provider bleiben die Köpfe einfacher Text, die Zeilen in der Reihenfolge des Endstands', () => {
    render(<FinalStandingsView tournament={turnier} ranking={RANKING} provisional={false} />);
    expect(screen.queryByTestId('sort-head-end-team')).toBeNull();
    expect(namen()).toEqual(VORGABE);
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
  });
});
