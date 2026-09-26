/**
 * Task C2b, Aufgabe 4a: Ablehnungsliste (D-C1).
 * Je Eintrag „was es war“ + Grund in Klartext, „Verstanden“ entfernt ihn.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { RejectedEntry } from '../../../../core/match/client/matchCopy';
import type { EngineEvent, MatchContext } from '../../../../core/match/types';
import { touchTargets } from '../../../../design-tokens';
import { RejectedEntriesPanel } from '../RejectedEntriesPanel';

const TEAMS: MatchContext = { matchId: 'm1', teamAId: 'team-a', teamBId: 'team-b' };

function makeEvent(overrides: Partial<EngineEvent> = {}): EngineEvent {
  return {
    id: 'e1',
    type: 'GOAL',
    actor: 'helper',
    at: 1727000000000,
    section: 1,
    clockMs: 11 * 60_000 + 30_000,
    teamId: 'team-a',
    payload: {},
    ...overrides,
  };
}

function makeEntry(event: Partial<EngineEvent>, code = 'STALE_BASE'): RejectedEntry {
  return { event: makeEvent(event), code, rejectedAt: 1727000001000 };
}

describe('RejectedEntriesPanel (D-C1)', () => {
  it('zeigt Kopfzeile, je Eintrag Beschreibung und Grund', () => {
    const entries = [
      makeEntry({ id: 'e1' }),
      makeEntry({ id: 'e2', type: 'YELLOW_CARD', teamId: null, clockMs: null }, 'MATCH_FINISHED'),
    ];
    render(<RejectedEntriesPanel entries={entries} onDismiss={vi.fn()} teams={TEAMS} />);

    expect(screen.getByTestId('outbox-rejected-panel')).toBeInTheDocument();
    expect(screen.getByText('common:outbox.rejected.header')).toBeInTheDocument();
    const items = screen.getAllByTestId('outbox-rejected-item');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('common:outbox.eventLine.teamAndMinute');
    expect(items[0]).toHaveTextContent('common:outbox.rejection.STALE_BASE');
    expect(items[1]).toHaveTextContent('common:outbox.eventLine.plain');
    expect(items[1]).toHaveTextContent('common:outbox.rejection.MATCH_FINISHED');
  });

  it('„Verstanden“ meldet genau den Eintrag ab', () => {
    const onDismiss = vi.fn();
    const entries = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2', type: 'FOUL' })];
    render(<RejectedEntriesPanel entries={entries} onDismiss={onDismiss} teams={TEAMS} />);

    fireEvent.click(screen.getAllByTestId('outbox-rejected-dismiss')[1]);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(['e2']);
  });

  it('„Alle verstanden“ meldet alle Eintraege auf einmal ab', () => {
    const onDismiss = vi.fn();
    const entries = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2', type: 'FOUL' })];
    render(<RejectedEntriesPanel entries={entries} onDismiss={onDismiss} teams={TEAMS} />);

    fireEvent.click(screen.getByTestId('outbox-rejected-dismiss-all'));
    expect(onDismiss).toHaveBeenCalledWith(['e1', 'e2']);
  });

  it('zeigt bei unbekanntem Grund zusaetzlich den Code', () => {
    render(
      <RejectedEntriesPanel
        entries={[makeEntry({ id: 'e1' }, '55000_SONSTIGES')]}
        onDismiss={vi.fn()}
        teams={TEAMS}
      />,
    );
    expect(screen.getByTestId('outbox-rejected-item')).toHaveTextContent('common:outbox.rejection.unknown');
    expect(screen.getByTestId('outbox-rejected-item')).toHaveTextContent('common:outbox.rejected.unknownCodeHint');
  });

  it('ist als Hinweis markiert (role=alert) und hat Touch-Ziele', () => {
    render(<RejectedEntriesPanel entries={[makeEntry({ id: 'e1' })]} onDismiss={vi.fn()} teams={TEAMS} />);
    expect(screen.getByTestId('outbox-rejected-panel')).toHaveAttribute('role', 'alert');

    for (const button of [
      ...screen.getAllByTestId('outbox-rejected-dismiss'),
      screen.getByTestId('outbox-rejected-dismiss-all'),
    ]) {
      expect(button).toHaveStyle({ minHeight: touchTargets.minimum });
    }
  });

  it('leere Liste rendert nichts', () => {
    const { container } = render(<RejectedEntriesPanel entries={[]} onDismiss={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('outbox-rejected-panel')).toBeNull();
  });
});
