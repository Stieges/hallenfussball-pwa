/**
 * @ZP-093 Spielplan-Editor (Befund C-ANGEPFIFFEN-TAUSCHZIEL): ein angepfiffenes Spiel (läuft, Halbzeit, beendet) ist
 * weder Quelle noch Tauschziel. Das Ablegen wird abgelehnt (mit Rückmeldung), nichts wird gespeichert.
 * Gegenbeispiel: ein geplantes Spiel lässt sich verschieben und tauschen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));

import type { Match } from '../../../types/tournament';
import type { TimeSlot } from '../types';
import { createMockMatch, createMockTournament } from '../../../test/factories';

const captured = vi.hoisted(() => ({ opts: undefined as undefined | { onMoveMatch: (id: string, s: unknown) => void; validateDrop: (id: string, s: unknown) => boolean } }));
vi.mock('../hooks/useDragDrop', async (importOriginal) => {
  const original = await importOriginal<typeof import('../hooks/useDragDrop')>();
  return {
    ...original,
    useDragDrop: (opts: NonNullable<typeof captured.opts>) => {
      captured.opts = opts;
      return { sensors: [], activeId: null, overId: null, isDragging: false, handleDragStart: vi.fn(), handleDragEnd: vi.fn(), handleDragCancel: vi.fn() };
    },
  };
});

import { ScheduleEditor } from '../ScheduleEditor';

const T10 = new Date('2026-10-23T10:00:00');
const slot = (startTime: string, fieldId: number): TimeSlot => ({ id: `slot-${startTime}-${fieldId}`, startTime, fieldId, matchId: null, isDropTarget: true });
const spiel = (id: string, status: string, extra: Partial<Match> = {}) =>
  createMockMatch({ id, field: 1, scheduledTime: T10, matchStatus: status as Match['matchStatus'], ...extra });

function setup(matches: Match[]) {
  const onTournamentUpdate = vi.fn();
  const onRejectStarted = vi.fn();
  render(<ScheduleEditor tournament={createMockTournament({ matches, numberOfFields: 2 })} onTournamentUpdate={onTournamentUpdate}
    externalEditMode onBeforeChange={vi.fn()} hideToolbar onRejectStarted={onRejectStarted} />);
  return { onTournamentUpdate, onRejectStarted };
}

describe('@ZP-093 Spielplan-Editor: angepfiffene Spiele bleiben stehen (C-ANGEPFIFFEN-TAUSCHZIEL)', () => {
  beforeEach(() => { captured.opts = undefined; });

  it.each(['running', 'paused', 'finished'])('@ZP-093 Ablegen auf den Platz eines Spiels mit Status %s wird abgelehnt', (status) => {
    const { onTournamentUpdate, onRejectStarted } = setup([
      spiel('s5', status),
      spiel('s6', 'scheduled', { field: 2 }),
    ]);
    const target = slot('10:00', 1);
    expect(captured.opts?.validateDrop('s6', target)).toBe(false);
    expect(onRejectStarted).toHaveBeenCalledTimes(1);
    captured.opts?.onMoveMatch('s6', target); // auch direkt aufgerufen verschiebt nichts
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('@ZP-093 ein angepfiffenes Spiel als Quelle wird abgelehnt', () => {
    const { onTournamentUpdate } = setup([spiel('s5', 'paused'), spiel('s6', 'scheduled', { field: 2 })]);
    expect(captured.opts?.validateDrop('s5', slot('10:00', 2))).toBe(false);
    captured.opts?.onMoveMatch('s5', slot('10:00', 2));
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('@ZP-093 Gegenbeispiel: ein geplantes Spiel lässt sich auf einen freien Platz und gegen ein geplantes Spiel tauschen', () => {
    const { onTournamentUpdate, onRejectStarted } = setup([spiel('s5', 'scheduled'), spiel('s6', 'scheduled', { field: 2 })]);
    expect(captured.opts?.validateDrop('s5', slot('10:00', 2))).toBe(true);
    captured.opts?.onMoveMatch('s5', slot('10:00', 2));
    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);
    const updated = onTournamentUpdate.mock.calls[0][0].matches as Match[];
    expect(updated.find((m) => m.id === 's5')?.field).toBe(2);
    expect(updated.find((m) => m.id === 's6')?.field).toBe(1);
    expect(onRejectStarted).not.toHaveBeenCalled();
  });
});
