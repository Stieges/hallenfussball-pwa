/**
 * Task 5 „Tabellen sortieren“: Gruppentabellen sortierbar (Turnierleitung und Zuschauer-Seite teilen `GroupTables`).
 * Szenarien aus `docs/anforderungen/2026-11-25_tabellen-sortieren.md`: @TS-001, @TS-004, @TS-012, @TS-014, @TS-016, @TS-020.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { createMockTeam } from '../../../test/factories';
import type { Standing, Team } from '../../../types/tournament';
import type { SortPreferenceStore } from '../../../core/standings/tableSortPreference';
import { TableSortProvider } from '../../../hooks/TableSortProvider';
import { GroupTables } from '../GroupTables';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();
vi.mock('../../ui/TeamAvatar', () => ({ TeamAvatar: () => null }));

const emptyStore: SortPreferenceStore = { read: () => undefined, write: () => undefined };

function row(team: Team, place: number, gf: number, ga: number, pts: number, won: number): Standing {
  return {
    team, place, played: 3, won, drawn: 0, lost: 3 - won, goalsFor: gf, goalsAgainst: ga, goalDifference: gf - ga, points: pts,
  };
}

const ahorn = createMockTeam({ id: 'ahorn', name: 'SV Ahorn', group: '' });
const mitte = createMockTeam({ id: 'mitte', name: 'TSV Mitte', group: '' });
const nordstern = createMockTeam({ id: 'nordstern', name: 'FC Nordstern', group: '' });
const zeta = createMockTeam({ id: 'zeta', name: 'Zeta Ost', group: '' });
// Reihenfolge der Platzierung; Ahorn 9 Tore, Nordstern 11 Tore (@TS-004)
const standings: Standing[] = [
  row(ahorn, 1, 9, 4, 9, 3),
  row(mitte, 2, 5, 2, 6, 2),
  row(nordstern, 3, 11, 12, 3, 1),
  row(zeta, 4, 3, 8, 0, 0),
];

function Where() { return <span data-testid="where">{useLocation().search}</span>; }
function wrap(ui: ReactNode, url = '/') {
  return render(<MemoryRouter initialEntries={[url]}><TableSortProvider store={emptyStore}>{ui}<Where /></TableSortProvider></MemoryRouter>);
}

const names = (scope: string, container: HTMLElement) =>
  Array.from(container.querySelectorAll(`${scope} tbody tr`)).map((r) => r.querySelectorAll('td')[1]?.textContent ?? '');
const platz = (scope: string, container: HTMLElement) =>
  Array.from(container.querySelectorAll(`${scope} tbody tr`)).map((r) => r.querySelectorAll('td')[0]?.textContent ?? '');

describe('GroupTables sortierbar', () => {
  it('@TS-001 ohne Wahl: Reihenfolge der Platzierung, nur „Platz“ trägt einen Pfeil, keine Taste „Nach Platzierung“', () => {
    const { container } = wrap(<GroupTables standings={standings} teams={standings.map((s) => s.team)} />);
    expect(names('.desktop-view', container)).toEqual(['SV Ahorn', 'TSV Mitte', 'FC Nordstern', 'Zeta Ost']);
    const heads = Array.from(container.querySelectorAll('.desktop-view [data-testid^="sort-head-g-"]'));
    expect(heads.map((h) => h.getAttribute('data-sorted'))).toEqual(['true', ...Array<string>(8).fill('false')]);
    expect(screen.getAllByTestId('sort-head-g-platz').length).toBe(2);
    expect(screen.queryByTestId('sort-reset-g')).toBeNull();
    expect(screen.queryByText('Nach Platzierung', { selector: 'button' })).toBeNull();
  });

  it('@TS-004 nach Tore: FC Nordstern oben mit Platz 3, SV Ahorn zweite Zeile mit Platz 1', () => {
    const { container } = wrap(<GroupTables standings={standings} teams={standings.map((s) => s.team)} />);
    fireEvent.click(within(container.querySelector('.desktop-view')!).getByTestId('sort-head-g-tore'));
    expect(names('.desktop-view', container).slice(0, 2)).toEqual(['FC Nordstern', 'SV Ahorn']);
    expect(platz('.desktop-view', container).slice(0, 2)).toEqual(['3', '1']);
    // Handy-Tabelle zeigt dieselbe Zeilenliste und dieselben Plätze
    expect(names('.mobile-view', container).filter((n) => n !== '').slice(0, 2).join('|')).toContain('Nordstern');
    expect(platz('.mobile-view', container).slice(0, 2)).toEqual(['3', '1']);
    expect(screen.getByTestId('sort-reset-g')).toBeInTheDocument();
  });

  it('@TS-014 Tore: erste Zahl hervorgehoben; zweiter Tipp „Gegentore“ mit zweiter Zahl; dritter zurück', () => {
    const { container } = wrap(<GroupTables standings={standings} teams={standings.map((s) => s.team)} />);
    const head = () => within(container.querySelector('.desktop-view')!).getByTestId('sort-head-g-tore');
    fireEvent.click(head());
    const focused = () => Array.from(container.querySelectorAll('.desktop-view [data-goals-focus]'));
    expect(focused()).toHaveLength(4);
    expect(focused().every((e) => e.getAttribute('data-goals-focus') === 'for')).toBe(true);
    expect(focused()[0].textContent).toBe('11');
    fireEvent.click(head());
    expect(head()).toHaveAccessibleName(/Gegentore/);
    expect(names('.desktop-view', container)).toEqual(['TSV Mitte', 'SV Ahorn', 'Zeta Ost', 'FC Nordstern']);
    expect(focused().every((e) => e.getAttribute('data-goals-focus') === 'against')).toBe(true);
    expect(focused()[0].textContent).toBe('2');
    fireEvent.click(head());
    expect(head()).toHaveAccessibleName(/^Tore/);
    expect(focused()).toHaveLength(0);
    expect(names('.desktop-view', container)[0]).toBe('SV Ahorn');
  });

  it('@TS-016 Gleichstand-Marke bleibt am Team, wenn nach Team sortiert ist', () => {
    const marker = (teamId: string) => (teamId === 'mitte' ? <i data-testid="marke">Strafstoßschießen eintragen</i> : null);
    const { container } = wrap(
      <GroupTables standings={standings} teams={standings.map((s) => s.team)} tieDisplay="app" renderTieMarker={marker} />,
    );
    fireEvent.click(within(container.querySelector('.desktop-view')!).getByTestId('sort-head-g-team'));
    expect(names('.desktop-view', container)[0]).toContain('FC Nordstern');
    const markeRow = within(container.querySelector('.desktop-view')!).getByTestId('marke').closest('tr')!;
    expect(markeRow.textContent).toContain('TSV Mitte');
    expect(markeRow.querySelectorAll('td')[0].textContent).toBe('2');
  });

  it('@TS-012 Handy: „Gegentore“ ist über die Auswahl wählbar und sortiert beide Tabellen', () => {
    const { container } = wrap(<GroupTables standings={standings} teams={standings.map((s) => s.team)} />);
    const picker = screen.getByTestId('sort-picker-g');
    fireEvent.change(picker, { target: { value: 'gegentore' } });
    expect(names('.desktop-view', container)[0]).toBe('TSV Mitte');
    expect(platz('.mobile-view', container)[0]).toBe('2');
    expect(screen.getByTestId('where').textContent).toContain('ts=g.gegentore');
  });

  it('@TS-020 zwei Gruppen werden getrennt sortiert, die Adresse trägt nur Gruppe A', () => {
    const a1 = createMockTeam({ id: 'a1', name: 'A Eins', group: 'A' });
    const a2 = createMockTeam({ id: 'a2', name: 'A Zwei', group: 'A' });
    const b1 = createMockTeam({ id: 'b1', name: 'B Eins', group: 'B' });
    const b2 = createMockTeam({ id: 'b2', name: 'B Zwei', group: 'B' });
    const zwei = [row(a1, 1, 2, 0, 9, 3), row(a2, 2, 5, 1, 6, 2), row(b1, 1, 2, 0, 9, 3), row(b2, 2, 5, 1, 6, 2)];
    const { container } = wrap(<GroupTables standings={zwei} teams={[a1, a2, b1, b2]} />);
    fireEvent.click(within(container.querySelector('.desktop-view')!).getByTestId('sort-head-gA-tore'));
    const cards = Array.from(container.querySelectorAll('.standings-table'));
    const order = (card: Element) => Array.from(card.querySelectorAll('.desktop-view tbody tr')).map((r) => r.querySelectorAll('td')[1].textContent);
    expect(order(cards[0])).toEqual(['A Zwei', 'A Eins']);
    expect(order(cards[1])).toEqual(['B Eins', 'B Zwei']);
    expect(screen.getByTestId('sort-reset-gA')).toBeInTheDocument();
    expect(screen.queryByTestId('sort-reset-gB')).toBeNull();
    expect(screen.getByTestId('where').textContent).toBe('?ts=gA.tore');
    fireEvent.click(screen.getByTestId('sort-reset-gA'));
    expect(order(cards[0])).toEqual(['A Eins', 'A Zwei']);
  });

  it('ohne Router/Provider (Spielplan, Vorschau): keine Sortierköpfe, Köpfe wie bisher', () => {
    const { container } = render(<GroupTables standings={standings} teams={standings.map((s) => s.team)} />);
    expect(container.querySelector('[data-testid^="sort-"]')).toBeNull();
    expect(container.querySelectorAll('.desktop-view thead th')).toHaveLength(9);
  });
});
