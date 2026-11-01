/**
 * Karten im Bearbeitungsmodus (G1a):
 * - @ZP-093 ein angepfiffenes Spiel behält auch seinen Schiedsrichter: Auswahl gesperrt (Desktop, Handy-Plakette)
 * - @ZP-100 der Ziehgriff am Handy hat `touch-action: none` (sonst bricht der Browser den Zug mit pointercancel ab)
 * - @ZP-100 „Tauschen mit …“ an geplanten Spielen, nicht an angepfiffenen
 * - @W3-011 die Auswahl „Teams pfeifen“ nennt die Teams mit Namen
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import type { ScheduledMatch } from '../../../core/generators';
import { testUuid } from '../../../test/testIds';
import { vs } from '../../../test/matchSlotFixtures';
import { SortableDesktopCard } from '../SortableDesktopCard';
import { SortableMobileCard } from '../SortableMobileCard';
import { SwapWithContext } from '../swapWithContext';
import { refereeChoices } from '../refereeChoices';

const match = { id: 'm5', round: 5, field: 1, group: 'A', scheduledTime: new Date('2026-10-23T10:00:00'), ...vs(testUuid(1), testUuid(2)) } as unknown as ScheduledMatch;
const refs = [{ value: 1, label: 'SR 1' }, { value: 2, label: 'SR 2 (Tom)' }];
const common = {
  match, displayedRef: 1, displayedField: 1, hasUnsavedChanges: false, hasPendingRef: false, hasPendingField: false,
  conflicts: [], editingSchedule: true, canSwap: true, tournament: { teams: [] }, showReferees: true, refereeOptions: refs,
  showFields: false, fieldOptions: [], onRefereeChange: vi.fn(),
};
const mobile = { ...common, refereeOptions: [{ value: null, label: 'Kein SR' }, ...refs], isExpanded: false, onCardClick: vi.fn(), onCircleClick: vi.fn(), renderExpandContent: () => null };
const request = vi.fn();
const inDnd = (node: React.ReactNode) => render(
  <SwapWithContext.Provider value={{ request }}>
    <DndContext><SortableContext items={['m5']}>{node}</SortableContext></DndContext>
  </SwapWithContext.Provider>,
);

describe('@ZP-093 Schiedsrichter eines angepfiffenen Spiels ist gesperrt', () => {
  it.each(['running', 'finished'] as const)('@ZP-093 Desktop-Karte (%s): Schiedsrichter-Auswahl gesperrt', (status) => {
    inDnd(<SortableDesktopCard {...common} status={status} />);
    const auswahl = screen.getByRole('combobox', { name: 'tournament:sortable.referee' });
    expect(auswahl).toHaveProperty('disabled', true);
    expect(auswahl.style.cursor).toBe('not-allowed');
  });

  it('@ZP-093 Gegenbeispiel: Desktop-Karte eines geplanten Spiels – Auswahl bedienbar, Einträge ohne doppeltes „SR“', () => {
    inDnd(<SortableDesktopCard {...common} status="scheduled" />);
    const auswahl = screen.getByRole('combobox', { name: 'tournament:sortable.referee' });
    expect(auswahl).toHaveProperty('disabled', false);
    expect(within(auswahl).getByRole('option', { name: 'SR 2 (Tom)' })).toBeTruthy();
  });

  it('@ZP-093 Handy-Karte: die Schiedsrichter-Plakette eines laufenden Spiels öffnet keine Auswahl', () => {
    inDnd(<SortableMobileCard {...mobile} status="running" />);
    const plakette = screen.getByRole('button', { name: 'tournament:matchCard.changeReferee' });
    expect(plakette).toHaveProperty('disabled', true);
    fireEvent.click(plakette);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('@ZP-093 Gegenbeispiel: Handy-Karte eines geplanten Spiels – die Plakette ist bedienbar und nennt den Schiedsrichter', () => {
    inDnd(<SortableMobileCard {...mobile} status="scheduled" displayedRef={2} />);
    const plakette = screen.getByRole('button', { name: 'tournament:matchCard.changeReferee' });
    expect(plakette).toHaveProperty('disabled', false);
    expect(plakette.textContent).toContain('SR 2 (Tom)');
  });
});

describe('@ZP-100 Tauschen am Handy', () => {
  it('@ZP-100 der Ziehgriff der Handy-Karte hat touch-action: none', () => {
    inDnd(<SortableMobileCard {...mobile} status="scheduled" />);
    expect(screen.getByLabelText('tournament:matchCard.dragToMove').style.touchAction).toBe('none');
  });

  it('@ZP-100 „Tauschen mit …“ an einem geplanten Spiel öffnet die Auswahl für dieses Spiel', () => {
    request.mockClear();
    inDnd(<SortableMobileCard {...mobile} status="scheduled" />);
    fireEvent.click(screen.getByTestId('swap-with-m5'));
    expect(request).toHaveBeenCalledWith('m5');
  });

  it.each(['running', 'finished'] as const)('@ZP-093 Gegenbeispiel: ein angepfiffenes Spiel (%s) hat kein „Tauschen mit …“', (status) => {
    inDnd(<><SortableMobileCard {...mobile} status={status} /><SortableDesktopCard {...common} status={status} /></>);
    expect(screen.queryByTestId('swap-with-m5')).toBeNull();
  });

  it('@ZP-100 Gegenbeispiel: ohne Bearbeiten-Modus (kein Anbieter) gibt es keine Taste', () => {
    render(<DndContext><SortableContext items={['m5']}><SortableDesktopCard {...common} status="scheduled" /></SortableContext></DndContext>);
    expect(screen.queryByTestId('swap-with-m5')).toBeNull();
  });
});

describe('@W3-011 eine Quelle der Schiedsrichter-Auswahl', () => {
  const labels = { numbered: (n: number) => `SR ${n}`, named: (n: number, name: string) => `SR ${n} (${name})` };
  const teams = ['FC Nord', 'SV Süd', 'TSV West', 'SC Ost', 'DJK Berg', 'TuS Tal'].map((name) => ({ name }));

  it('@W3-011 Teams pfeifen: so viele Einträge wie Teams, mit Teamnamen (nicht je Spiel eine Nummer)', () => {
    const choices = refereeChoices({ mode: 'teams' }, teams, labels);
    expect(choices).toEqual(teams.map((team, i) => ({ value: i + 1, label: team.name })));
  });

  it('@W3-011 Teams pfeifen: ein zurückgezogenes Team ist nicht wählbar, die Nummern der anderen bleiben', () => {
    const choices = refereeChoices({ mode: 'teams' }, [teams[0], { name: 'weg', isRemoved: true }, teams[2]], labels);
    expect(choices).toEqual([{ value: 1, label: 'FC Nord' }, { value: 3, label: 'TSV West' }]);
  });

  it('@W3-011 Veranstalter stellt Schiedsrichter: Nummern, mit Namen, wo eingetragen', () => {
    expect(refereeChoices({ mode: 'organizer', numberOfReferees: 2, refereeNames: { 2: 'Tom' } }, teams, labels))
      .toEqual([{ value: 1, label: 'SR 1' }, { value: 2, label: 'SR 2 (Tom)' }]);
  });
});
