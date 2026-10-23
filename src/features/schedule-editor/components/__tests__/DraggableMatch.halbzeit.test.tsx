/**
 * @ZP-093 „Ein angepfiffenes Spiel lässt sich nicht verschieben, auch nicht in der Halbzeit“
 * (Befund C-HALBZEIT-NICHT-LAUFEND). Der Ziehgriff „⋮⋮“ erscheint nur, wenn das Spiel ziehbar ist.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Match, Team } from '../../../../types/tournament';
import { vs, testUuid } from '../../../../test/matchSlotFixtures';
import { DraggableMatch } from '../DraggableMatch';

const NORD = testUuid(1);
const UFER = testUuid(2);
const teams: Team[] = [{ id: NORD, name: 'FC Nord' }, { id: UFER, name: 'VfB Ufer' }];

const editor = (status: string) => {
  const match = { id: testUuid(5), round: 1, field: 1, matchStatus: status, ...vs(NORD, UFER) } as unknown as Match;
  return render(<DraggableMatch match={match} teams={teams} tournament={{ teams }} isEditing draggable />);
};

describe('DraggableMatch – kein Ziehen nach dem Anpfiff (@ZP-093, C-HALBZEIT-NICHT-LAUFEND)', () => {
  it('@ZP-093 ein Spiel in der Halbzeit (paused) lässt sich nicht ziehen', () => {
    editor('paused');
    expect(screen.queryByText('⋮⋮')).toBeNull();
  });

  it('@ZP-093 ein laufendes Spiel lässt sich nicht ziehen', () => {
    editor('running');
    expect(screen.queryByText('⋮⋮')).toBeNull();
  });

  it('@ZP-093 Gegenbeispiel: ein noch nicht angepfiffenes Spiel lässt sich ziehen', () => {
    editor('scheduled');
    expect(screen.getByText('⋮⋮')).toBeTruthy();
  });
});
