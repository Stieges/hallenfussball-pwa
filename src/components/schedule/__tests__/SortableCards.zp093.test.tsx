/**
 * @ZP-093 Feld-Auswahl im Bearbeitungsmodus (Befund C-ANGEPFIFFEN-TAUSCHZIEL): bei einem angepfiffenen Spiel
 * (läuft, Halbzeit, beendet) ist die Feld-Auswahl gesperrt; bei einem geplanten Spiel bleibt sie bedienbar.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import type { ScheduledMatch } from '../../../core/generators';
import { testUuid } from '../../../test/testIds';
import { vs } from '../../../test/matchSlotFixtures';
import { SortableDesktopCard } from '../SortableDesktopCard';
import { SortableMobileCard } from '../SortableMobileCard';

const match = { id: 'm5', round: 5, field: 1, group: 'A', scheduledTime: new Date('2026-10-23T10:00:00'), ...vs(testUuid(1), testUuid(2)) } as unknown as ScheduledMatch;
const common = {
  match, displayedRef: undefined, displayedField: 1, hasUnsavedChanges: false, hasPendingRef: false, hasPendingField: false,
  conflicts: [], editingSchedule: true, canSwap: true, tournament: { teams: [] }, showReferees: false, refereeOptions: [],
  showFields: true, fieldOptions: [{ value: 1, label: '1' }, { value: 2, label: '2' }], onFieldChange: vi.fn(),
};
const inDnd = (node: React.ReactNode) => render(<DndContext><SortableContext items={['m5']}>{node}</SortableContext></DndContext>);

describe('@ZP-093 Feld-Auswahl der Karten im Bearbeitungsmodus (C-ANGEPFIFFEN-TAUSCHZIEL)', () => {
  it.each(['running', 'finished'] as const)('@ZP-093 Desktop-Karte: bei einem angepfiffenen Spiel (%s) ist die Feld-Auswahl gesperrt', (status) => {
    inDnd(<SortableDesktopCard {...common} status={status} />);
    expect(screen.getByRole('combobox')).toHaveProperty('disabled', true);
  });

  it('@ZP-093 Desktop-Karte Gegenbeispiel: bei einem geplanten Spiel bleibt die Feld-Auswahl bedienbar', () => {
    inDnd(<SortableDesktopCard {...common} status="scheduled" />);
    expect(screen.getByRole('combobox')).toHaveProperty('disabled', false);
  });

  it('@ZP-093 Mobil-Karte: bei einem angepfiffenen Spiel ist die Feld-Auswahl gesperrt, bei einem geplanten nicht', () => {
    const { unmount } = inDnd(<SortableMobileCard {...common} isExpanded={false} onCardClick={vi.fn()} onCircleClick={vi.fn()} renderExpandContent={() => null} status="running" />);
    expect(screen.getByRole('combobox')).toHaveProperty('disabled', true);
    unmount();
    inDnd(<SortableMobileCard {...common} isExpanded={false} onCardClick={vi.fn()} onCircleClick={vi.fn()} renderExpandContent={() => null} status="scheduled" />);
    expect(screen.getByRole('combobox')).toHaveProperty('disabled', false);
  });
});
