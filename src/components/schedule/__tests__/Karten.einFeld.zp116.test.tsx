/**
 * @ZP-116 Bei einem Feld nennen die Spielkarten kein Feld: auch nicht in der Handy-Karte im Bearbeitungsmodus und nicht im aufgeklappten
 * „Spiel starten“. Aber bei zwei Feldern steht das Feld dort wie bisher.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import type { ScheduledMatch } from '../../../core/generators';
import { teamSlot } from '../../../core/models/matchSlot';
import { testUuid } from '../../../test/testIds';
import { vs } from '../../../test/matchSlotFixtures';
import { GroupStageSchedule } from '../GroupStageSchedule';
import { SortableMobileCard } from '../SortableMobileCard';
import { matchOf, viewOf } from './scheduleViewFixture';

vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

const NORD = testUuid(1);
const SUED = testUuid(2);
const teams = [{ id: NORD, name: 'FC Nord' }, { id: SUED, name: 'SV Süd' }];

describe('@ZP-116 Handy-Karte im Bearbeitungsmodus (SortableMobileCard)', () => {
  const match = { id: 'm5', matchNumber: 5, round: 5, field: 1, group: 'A', scheduledTime: new Date('2026-10-23T10:00:00'), ...vs(testUuid(1), testUuid(2)) } as unknown as ScheduledMatch;
  const common = {
    match, displayedRef: undefined, displayedField: 1, hasUnsavedChanges: false, hasPendingRef: false, hasPendingField: false,
    conflicts: [], editingSchedule: true, canSwap: true, tournament: { teams: [] }, showReferees: false, refereeOptions: [],
    showFields: true, fieldOptions: [{ value: 1, label: '1' }, { value: 2, label: '2' }], onFieldChange: vi.fn(),
    isExpanded: false, onCardClick: vi.fn(), onCircleClick: vi.fn(), renderExpandContent: () => null, status: 'scheduled' as const,
  };
  const inDnd = (node: React.ReactNode) => render(<DndContext><SortableContext items={['m5']}>{node}</SortableContext></DndContext>);

  it('ein Feld (showFieldLabel aus): im Kopf der Karte steht kein „Feld 1“', () => {
    const { container } = inDnd(<SortableMobileCard {...common} showFieldLabel={false} />);
    expect(container.textContent ?? '').not.toMatch(/Feld \d/);
  });

  it('Gegenbeispiel zwei Felder und ohne Angabe: im Kopf der Karte steht „Feld 1“ wie bisher', () => {
    const { container, unmount } = inDnd(<SortableMobileCard {...common} showFieldLabel />);
    expect(container.textContent ?? '').toMatch(/Feld 1/);
    unmount();
    const ohne = inDnd(<SortableMobileCard {...common} />);
    expect(ohne.container.textContent ?? '').toMatch(/Feld 1/);
  });
});

describe('@ZP-116 aufgeklapptes „Spiel starten“ (StartMatchExpand in GroupStageSchedule)', () => {
  const start = new Date('2026-11-14T14:20:00');
  const spiel: ScheduledMatch = {
    id: testUuid(109), matchNumber: 9, field: 1, phase: 'groupStage', group: 'A', isFinal: false, startTime: start, endTime: start,
    duration: 10, time: '14:20', homeTeam: 'FC Nord', awayTeam: 'SV Süd', originalTeamA: NORD, originalTeamB: SUED,
    slotA: teamSlot(NORD), slotB: teamSlot(SUED), label: 'Spiel 9',
  };
  const view = viewOf([matchOf(spiel, { matchStatus: 'scheduled' })], teams);

  async function aufgeklappt(showFieldLabel: boolean): Promise<string> {
    const user = userEvent.setup();
    const { container } = render(<GroupStageSchedule matches={[spiel]} hasGroups={false} tournament={{ teams, view }} editable showFieldLabel={showFieldLabel} onNavigateToCockpit={vi.fn()} />);
    await user.click(screen.getAllByTestId(`match-circle-${spiel.id}`)[0]);
    await screen.findAllByTestId('start-match-expand');
    return container.textContent ?? '';
  }

  it('ein Feld: das aufgeklappte „Spiel starten“ nennt kein „Feld 1“', async () => {
    expect(await aufgeklappt(false)).not.toMatch(/Feld \d/);
  });

  it('Gegenbeispiel zwei Felder: es nennt „Feld 1“ wie bisher', async () => {
    expect(await aufgeklappt(true)).toMatch(/Feld 1/);
  });
});
