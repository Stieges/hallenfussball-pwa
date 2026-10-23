/**
 * @ZP-093 Kartenansicht (Befund C-ANGEPFIFFEN-TAUSCHZIEL): Lehnt `onMatchSwap` das Ablegen ab (liefert `false`, weil ein
 * angepfiffenes Spiel beteiligt ist), ordnet sich die Anzeige nicht um. Gegenbeispiel: bei `true` ordnet sie um.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import type { DragEndEvent } from '@dnd-kit/core';
import type { ScheduledMatch } from '../../../core/generators';
import { teamSlot } from '../../../core/models/matchSlot';
import { testUuid } from '../../../test/testIds';
import { GroupStageSchedule } from '../GroupStageSchedule';
import { FinalStageSchedule } from '../FinalStageSchedule';

vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

const dnd = vi.hoisted(() => ({ ends: [] as ((e: DragEndEvent) => void)[] }));
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...original,
    DndContext: (props: { onDragEnd?: (e: DragEndEvent) => void; children?: React.ReactNode }) => {
      if (props.onDragEnd) { dnd.ends.push(props.onDragEnd); }
      return <>{props.children}</>;
    },
  };
});

const teams = [
  { id: testUuid(1), name: 'FC Nord' }, { id: testUuid(2), name: 'SG Mitte' },
  { id: testUuid(3), name: 'VfB Ufer' }, { id: testUuid(4), name: 'TSV Dorf' },
];

function spiel(id: string, nummer: number, a: number, b: number, phase: 'groupStage' | 'semifinal'): ScheduledMatch {
  const start = new Date('2026-11-14T14:20:00');
  return {
    id, matchNumber: nummer, time: '14:20', field: 1, homeTeam: 'ALT', awayTeam: 'ALT',
    originalTeamA: testUuid(a), originalTeamB: testUuid(b), slotA: teamSlot(testUuid(a)), slotB: teamSlot(testUuid(b)),
    group: 'A', label: `Spiel ${nummer}`, phase, isFinal: phase !== 'groupStage', startTime: start, endTime: start, duration: 10,
  };
}

/** Reihenfolge der beiden Paarungen im Tabellen-/Desktop-Teil, an den Namen der Heimteams abgelesen. */
const reihenfolge = (container: HTMLElement) => {
  const desktop = container.querySelector<HTMLElement>('.desktop-view') ?? container;
  const text = desktop.textContent ?? '';
  return text.indexOf('FC Nord') < text.indexOf('VfB Ufer') ? 'Nord-zuerst' : 'Ufer-zuerst';
};
const ziehe = () => {
  const event = { active: { id: 'm1' }, over: { id: 'm2' } } as unknown as DragEndEvent;
  act(() => { dnd.ends[dnd.ends.length - 1](event); });
};

describe.each([
  ['GroupStageSchedule', 'groupStage' as const, (swap: () => boolean, ms: ScheduledMatch[]) =>
    <GroupStageSchedule matches={ms} hasGroups editable editingSchedule tournament={{ teams }} onMatchSwap={swap} />],
  ['FinalStageSchedule', 'semifinal' as const, (swap: () => boolean, ms: ScheduledMatch[]) =>
    <FinalStageSchedule matches={ms} editable editingSchedule tournament={{ teams }} onMatchSwap={swap} />],
])('@ZP-093 %s: abgelehntes Ablegen ordnet nicht um (C-ANGEPFIFFEN-TAUSCHZIEL)', (_name, phase, build) => {
  const matches = () => [spiel('m1', 1, 1, 2, phase), spiel('m2', 2, 3, 4, phase)];
  beforeEach(() => { dnd.ends.length = 0; });

  it('@ZP-093 onMatchSwap liefert false: die Reihenfolge bleibt', () => {
    const swap = vi.fn(() => false);
    const { container } = render(build(swap, matches()));
    expect(reihenfolge(container)).toBe('Nord-zuerst');
    ziehe();
    expect(swap).toHaveBeenCalledWith('m1', 'm2');
    expect(reihenfolge(container)).toBe('Nord-zuerst');
  });

  it('@ZP-093 Gegenbeispiel: onMatchSwap liefert true, die Anzeige ordnet um', () => {
    const swap = vi.fn(() => true);
    const { container } = render(build(swap, matches()));
    ziehe();
    expect(reihenfolge(container)).toBe('Ufer-zuerst');
  });
});
