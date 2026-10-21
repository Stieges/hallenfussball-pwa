/**
 * @FU-004 (C-COCKPIT-LAEDT-NACH-ABPFIFF), Anzeige-Teil: Nach dem letzten Abpfiff bleibt die
 * Übertragungsanzeige im Cockpit sichtbar – ein Eintrag, der nicht übertragen werden kann,
 * verschwindet nicht mit dem Spielende.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RejectedEntry } from '../../../core/match/client';
import { LiveCockpit } from '../LiveCockpit';
import { makeLiveMatch, makeProps } from './cockpitFixtures';

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({ status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [], syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: true }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

const abgelehnt: RejectedEntry[] = [
  { event: { id: 'e1', type: 'GOAL', actor: 'helper', at: 0, section: 1, clockMs: 0, payload: {} }, code: 'MATCH_FULL', rejectedAt: 0 },
];
let rejectedCount = 1;
vi.mock('../../../features/match-engine/useEngineOutboxSummary', () => ({
  useEngineOutboxSummary: () => ({ pendingCount: 0, rejectedCount, reviewCount: 0, entries: rejectedCount > 0 ? abgelehnt : [], dismiss: vi.fn() }),
}));

describe('LiveCockpit – @FU-004 Übertragungsanzeige nach dem letzten Abpfiff', () => {
  it('@FU-004: ein abgelehnter Eintrag bleibt nach dem Abpfiff (Spiel beendet) sichtbar', () => {
    rejectedCount = 1;
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'FINISHED' }))} />);
    expect(screen.getByTestId('scoreboard-abzeichen')).toHaveAttribute('data-state', 'ended'); // Abzeichen „Ende“ (dieser Test hat keine echten Texte)
    expect(screen.getByTestId('sync-status-rejected')).toBeInTheDocument();
  });

  it('Gegenbeispiel: ohne abgelehnte Einträge zeigt das beendete Spiel keine Störungsanzeige', () => {
    rejectedCount = 0;
    render(<LiveCockpit {...makeProps(makeLiveMatch({ status: 'FINISHED' }))} />);
    expect(screen.queryByTestId('sync-status-rejected')).toBeNull();
  });
});
