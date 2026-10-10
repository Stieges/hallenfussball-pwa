/**
 * Offene Spielseiten bekommen kein Team-Abzeichen (@TM-015): keine Initialen aus „Erster Gruppe A“ oder „noch offen“.
 * Gegenbeispiel: besetzte Seite zeigt Initialen wie bisher.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TeamAvatar } from '../TeamAvatar';
import { sideDisplay } from '../../schedule/matchSides';
import { pendingSlot, teamSlot } from '../../../core/models/matchSlot';
import { testUuid } from '../../../test/testIds';

describe('TeamAvatar – offene Seite zeigt kein Abzeichen mit Initialen', () => {
  it('offene Seite mit Herkunft „Erster Gruppe A“: keine Initialen „EG“', () => {
    const { container } = render(<TeamAvatar team={{ name: 'Erster Gruppe A', pending: true }} />);
    expect(container.textContent).toBe('');
    expect(container.textContent).not.toContain('EG');
  });

  it('offene Seite im Kindermodus „noch offen“: keine Initialen „NO“', () => {
    const { container } = render(<TeamAvatar team={{ name: 'noch offen', pending: true }} />);
    expect(container.textContent).toBe('');
  });

  it('Kette Spielplan → Abzeichen: sideDisplay einer offenen Seite liefert pending, Avatar bleibt leer', () => {
    const match = {
      id: testUuid(201),
      slotA: pendingSlot({ kind: 'groupRank', group: 'A', rank: 1 }),
      slotB: pendingSlot({ kind: 'groupRank', group: 'B', rank: 2 }),
    };
    const side = sideDisplay(match, 'A', { teams: [], matches: [], groups: [] });
    expect(side.pending).toBe(true);
    const { container } = render(<TeamAvatar team={side} />);
    expect(container.textContent).toBe('');
  });

  it('Gegenbeispiel: besetzte Seite zeigt Initialen des Teamnamens', () => {
    const teamId = testUuid(202);
    const match = { id: testUuid(203), slotA: teamSlot(teamId), slotB: teamSlot(testUuid(204)) };
    const side = sideDisplay(match, 'A', { teams: [{ id: teamId, name: 'FC Nord' }], matches: [], groups: [] });
    expect(side.pending).toBe(false);
    const { container } = render(<TeamAvatar team={side} />);
    expect(container.textContent).toBe('FN');
  });
});
