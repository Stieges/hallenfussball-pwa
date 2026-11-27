/**
 * Task 5 „Tabellen sortieren“: Gruppentabellen sortierbar (Turnierleitung und Zuschauer-Seite teilen `GroupTables`).
 * Szenarien aus `docs/anforderungen/2026-11-25_tabellen-sortieren.md`: @TS-001, @TS-004, @TS-012, @TS-014, @TS-016, @TS-020.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { createMockTeam } from '../../../test/factories';
import type { ScheduleSource } from '../scheduleSource';
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
    expect(screen.getByTestId('sort-head-g-platz')).toBeInTheDocument();
    // Handy: Kopf ist kein Bedienelement, nur Anzeige; unsortiert steht kein Pfeil (Entscheidung 27.11.), „Platz“ trägt aria-sort
    expect(container.querySelectorAll('.mobile-view thead button')).toHaveLength(0);
    expect(container.querySelector('.mobile-view thead th[data-sort-indicator]')).toBeNull();
    expect(container.querySelectorAll('.mobile-view thead svg')).toHaveLength(0);
    expect(container.querySelector('.mobile-view thead th')?.getAttribute('aria-sort')).toBe('ascending');
    expect(screen.queryByTestId('sort-reset-g')).toBeNull();
    expect(screen.queryByText('Nach Platzierung', { selector: 'button' })).toBeNull();
  });

  it('@TS-004 nach Tore: FC Nordstern oben mit Platz 3, SV Ahorn zweite Zeile mit Platz 1', () => {
    const { container } = wrap(<GroupTables standings={standings} teams={standings.map((s) => s.team)} />);
    fireEvent.click(within(container.querySelector('.desktop-view')!).getByTestId('sort-head-g-tore'));
    expect(names('.desktop-view', container).slice(0, 2)).toEqual(['FC Nordstern', 'SV Ahorn']);
    expect(platz('.desktop-view', container).slice(0, 2)).toEqual(['3', '1']);
    // Handy-Tabelle zeigt dieselbe Zeilenliste und dieselben Plätze
    expect(names('.mobile-view', container).slice(0, 2)).toEqual(['FC Nordstern', 'SV Ahorn']);
    expect(platz('.mobile-view', container).slice(0, 2)).toEqual(['3', '1']);
    expect(screen.getByTestId('sort-reset-g')).toBeInTheDocument();
  });

  it('@TS-014 Torspalte in fünf Stufen: Kopf Tore/Gegentore mit Pfeil, gemeinte Zahl fett', () => {
    const { container } = wrap(<GroupTables standings={standings} teams={standings.map((s) => s.team)} />);
    const head = () => within(container.querySelector('.desktop-view')!).getByTestId('sort-head-g-tore');
    const focused = () => Array.from(container.querySelectorAll<HTMLElement>('.desktop-view [data-goals-focus]'));
    const pfeile = () => head().querySelectorAll('svg').length;
    const stufe = (name: RegExp | string, reihenfolge: string[], fokus: 'for' | 'against' | null, erste: string | null) => {
      expect(head()).toHaveAccessibleName(name);
      expect(pfeile()).toBe(fokus === null ? 0 : 1);
      expect(names('.desktop-view', container)).toEqual(reihenfolge);
      expect(focused().length).toBe(fokus === null ? 0 : 4);
      if (fokus !== null) {
        expect(focused().every((e) => e.getAttribute('data-goals-focus') === fokus)).toBe(true);
        expect(focused()[0].textContent).toBe(erste);
        expect(focused()[0].style.fontWeight).not.toBe('');
        expect(focused()[0].style.textDecoration).toBe(''); // fett, nicht unterstrichen
      }
    };
    stufe('Tore', ['SV Ahorn', 'TSV Mitte', 'FC Nordstern', 'Zeta Ost'], null, null);
    fireEvent.click(head());
    stufe('Tore, meiste zuerst sortiert', ['FC Nordstern', 'SV Ahorn', 'TSV Mitte', 'Zeta Ost'], 'for', '11');
    fireEvent.click(head());
    stufe('Tore, wenigste zuerst sortiert', ['Zeta Ost', 'TSV Mitte', 'SV Ahorn', 'FC Nordstern'], 'for', '3');
    fireEvent.click(head());
    stufe('Gegentore, wenigste zuerst sortiert', ['TSV Mitte', 'SV Ahorn', 'Zeta Ost', 'FC Nordstern'], 'against', '2');
    fireEvent.click(head());
    stufe('Gegentore, meiste zuerst sortiert', ['FC Nordstern', 'Zeta Ost', 'SV Ahorn', 'TSV Mitte'], 'against', '12');
    fireEvent.click(head());
    stufe('Tore', ['SV Ahorn', 'TSV Mitte', 'FC Nordstern', 'Zeta Ost'], null, null);
  });

  it('@TS-014 „Tore“ in der Platzierungsregel: ohne Sortierung Wertungsfläche; bei Sortierung nach Gegentore nur die zweite Zahl fett, keine Fläche (Desktop und Handy)', () => {
    const tournament = { placementLogic: [{ id: 'goalsFor', enabled: true }] } as unknown as ScheduleSource;
    const { container } = wrap(<GroupTables standings={standings} teams={standings.map((s) => s.team)} tournament={tournament} />);
    const zelle = () => container.querySelector<HTMLElement>('.desktop-view tbody tr td:nth-child(7) > span')!;
    expect(zelle().style.background).not.toBe('transparent'); // wie bisher: Wertungsfläche
    expect(zelle().style.background).not.toBe('');
    expect(container.querySelector('[data-goals-focus]')).toBeNull();
    const kopf = () => within(container.querySelector('.desktop-view')!).getByTestId('sort-head-g-tore');
    fireEvent.click(kopf()); fireEvent.click(kopf()); fireEvent.click(kopf()); // Gegentore, wenigste zuerst
    expect(zelle().style.background).toBe('transparent');
    expect(zelle().style.fontWeight).not.toBe('700');
    const fokus = Array.from(container.querySelectorAll<HTMLElement>('.desktop-view [data-goals-focus]'));
    expect(fokus.every((e) => e.getAttribute('data-goals-focus') === 'against')).toBe(true);
    expect(fokus).toHaveLength(4);
    fireEvent.click(screen.getByTestId('standing-toggle-mitte'));
    const mobil = container.querySelectorAll<HTMLElement>('.mobile-view [data-goals-focus]');
    expect(mobil).toHaveLength(1);
    expect(mobil[0].getAttribute('data-goals-focus')).toBe('against');
    expect(mobil[0].style.background).toBe('transparent');
    // zurück zur Platzierung: Wertungsfläche wieder da
    fireEvent.click(kopf()); fireEvent.click(kopf());
    expect(zelle().style.background).not.toBe('transparent');
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

  it.skip('@TS-012 geparkt (Daniel 27.11.): Handy: „Gegentore“ ist über die Auswahl wählbar und sortiert beide Tabellen', () => {
    const { container } = wrap(<GroupTables standings={standings} teams={standings.map((s) => s.team)} />);
    const picker = screen.getByTestId('sort-picker-g');
    fireEvent.change(picker, { target: { value: 'gegentore' } });
    expect(names('.desktop-view', container)[0]).toBe('TSV Mitte');
    expect(platz('.mobile-view', container)[0]).toBe('2');
    expect(screen.getByTestId('where').textContent).toContain('ts=g.gegentore');
  });

  it('@TS-004 @TS-012 Handy: „Sortieren nach …“ bietet genau die Spalten der Handy-Tabelle (Team, Spiele, Tordifferenz, Punkte) und „Nach Platzierung“', () => {
    wrap(<GroupTables standings={standings} teams={standings.map((s) => s.team)} />);
    const optionen = Array.from(screen.getByTestId('sort-picker-g').querySelectorAll('option')).map((o) => o.textContent);
    expect(optionen).toEqual([
      'Nach Platzierung', 'Team', 'Team (umgekehrt)', 'Spiele', 'Spiele (umgekehrt)', 'Tordifferenz', 'Tordifferenz (umgekehrt)', 'Punkte', 'Punkte (umgekehrt)',
    ]);
  });

  it('@TS-010 @TS-012 Handy: steht die Sortierung (Adresse) auf einer dort unsichtbaren Spalte, zeigt die Auswahl sie weiter an', () => {
    wrap(<GroupTables standings={standings} teams={standings.map((s) => s.team)} />, '/?ts=g.gegentore');
    expect(screen.getByTestId('sort-picker-g')).toHaveValue('gegentore');
  });

  it('@TS-010 @TS-012 Handy: Adresse auf „Gruppe“ (dort keine Spalte) zeigt in der Auswahl den Namen „Gruppe“', () => {
    wrap(<GroupTables standings={standings} teams={standings.map((s) => s.team)} />, '/?ts=g.gruppe');
    const gewaehlt = screen.getByTestId('sort-picker-g').querySelector('option:checked');
    expect(gewaehlt?.textContent).toBe('Gruppe');
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

  it('@ZM-198 vor dem ersten Spiel bleibt „–“ auch bei Sortierung nach Team', () => {
    const leer = standings.map((s) => ({ ...s, played: 0, won: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, place: undefined }));
    const { container } = wrap(<GroupTables standings={leer} teams={leer.map((s) => s.team)} />);
    fireEvent.click(within(container.querySelector('.desktop-view')!).getByTestId('sort-head-g-team'));
    expect(names('.desktop-view', container)[0]).toBe('FC Nordstern');
    expect(platz('.desktop-view', container)).toEqual(['–', '–', '–', '–']);
    expect(platz('.mobile-view', container)).toEqual(['–', '–', '–', '–']);
  });

  it('@TS-005 Tipp auf „Platz“ setzt die Sortierung zurück', () => {
    const { container } = wrap(<GroupTables standings={standings} teams={standings.map((s) => s.team)} />);
    const desktop = () => within(container.querySelector('.desktop-view')!);
    fireEvent.click(desktop().getByTestId('sort-head-g-tore'));
    expect(screen.getByTestId('sort-reset-g')).toBeInTheDocument();
    fireEvent.click(desktop().getByTestId('sort-head-g-platz'));
    expect(names('.desktop-view', container)[0]).toBe('SV Ahorn');
    expect(screen.queryByTestId('sort-reset-g')).toBeNull();
  });

  it('Handy-Köpfe sind keine Tasten; der Pfeil wandert mit der Sortierung (Picker), aria-sort bleibt am th', () => {
    const { container } = wrap(<GroupTables standings={standings} teams={standings.map((s) => s.team)} />);
    const mobilKoepfe = () => container.querySelectorAll('.mobile-view thead th');
    fireEvent.change(screen.getByTestId('sort-picker-g'), { target: { value: 'pkt' } });
    expect(container.querySelectorAll('.mobile-view thead button')).toHaveLength(0);
    const pkt = container.querySelector('.mobile-view thead th[data-sort-indicator]')!;
    expect(pkt.getAttribute('aria-sort')).toBe('descending');
    expect(pkt.textContent).toContain('Pkt');
    expect(container.querySelectorAll('.mobile-view thead th[data-sort-indicator]')).toHaveLength(1);
    fireEvent.change(screen.getByTestId('sort-picker-g'), { target: { value: 'team.r' } });
    expect(container.querySelector('.mobile-view thead th[data-sort-indicator]')!.getAttribute('aria-sort')).toBe('descending');
    expect(mobilKoepfe()[1].getAttribute('data-sort-indicator')).toBe('desc');
  });

  it('@TS-021 Desktop-Kopf per Tastatur: Enter sortiert, Name nennt Richtung', async () => {
    const user = userEvent.setup();
    const { container } = wrap(<GroupTables standings={standings} teams={standings.map((s) => s.team)} />);
    const kopf = within(container.querySelector('.desktop-view')!).getByTestId('sort-head-g-tore');
    kopf.focus();
    await user.keyboard('{Enter}');
    expect(kopf).toHaveAccessibleName('Tore, meiste zuerst sortiert');
    expect(names('.desktop-view', container)[0]).toBe('FC Nordstern');
  });

  it('ohne Router/Provider (Spielplan, Vorschau): keine Sortierköpfe, Köpfe wie bisher', () => {
    const { container } = render(<GroupTables standings={standings} teams={standings.map((s) => s.team)} />);
    expect(container.querySelector('[data-testid^="sort-"]')).toBeNull();
    expect(container.querySelectorAll('.desktop-view thead th')).toHaveLength(9);
  });
});
