/**
 * LiveCockpit — Knöpfe ohne Engine-Weg ausblenden (A-08c, @FU-071 „nur erlaubte Schritte“).
 * Ein Knopf erscheint nur, wenn sein Handler übergeben ist. Die Prop wird NICHT entfernt;
 * B-08/B-09 schalten die Knöpfe später wieder ein.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveCockpit } from '../LiveCockpit';
import type { LiveCockpitProps } from '../types';

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));

vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(),
    isCloudSyncAvailable: false,
  }),
}));

vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

function runningMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1', number: 7, phaseLabel: 'Gruppe', fieldId: 'field-1',
    scheduledKickoff: new Date().toISOString(), durationSeconds: 600,
    homeTeam: { id: 'team-a', name: 'FC Alpha' }, awayTeam: { id: 'team-b', name: 'SV Beta' },
    homeScore: 0, awayScore: 0, status: 'RUNNING', elapsedSeconds: 60, events: [],
    tournamentPhase: 'groupStage', playPhase: 'regular', awaitingTiebreakerChoice: false,
    ...overrides,
  };
}

function baseProps(match: unknown, handlers: Partial<LiveCockpitProps> = {}): LiveCockpitProps {
  return {
    fieldName: 'Feld 1', tournamentName: 'Test-Turnier', tournamentId: 'tour-1',
    currentMatch: match as never, upcomingMatches: [], kannSteuern: true,
    onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), onGoal: vi.fn(),
    onLoadNextMatch: vi.fn(), ...handlers,
  };
}

describe('LiveCockpit — Knöpfe ohne Engine-Weg ausblenden (A-08c, @FU-071)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('@FU-071 Pflicht: ohne onAdjustTime kein Uhr-Knopf, Klick auf die Spielzeit öffnet keinen Dialog', async () => {
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(runningMatch())} />);

    await user.click(screen.getByTestId('cockpit-more-button'));
    expect(screen.getByTestId('more-sheet')).toBeInTheDocument();
    expect(screen.queryByTestId('mehr-uhr-korrigieren')).toBeNull();
    await user.click(screen.getByTestId('mehr-schliessen'));

    await user.click(screen.getByTestId('scoreboard-clock'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('@FU-071 Pflicht: K.-o.-Entscheidung ohne Tiebreaker-Handler -> Banner sichtbar, darin keine Knöpfe, kein Strafstoß-Dialog', () => {
    const match = runningMatch({
      tournamentPhase: 'finalRound', tiebreakerMode: 'shootout', awaitingTiebreakerChoice: true,
      homeScore: 1, awayScore: 1, status: 'PAUSED',
    });
    render(<LiveCockpit {...baseProps(match)} />);

    const banner = screen.getByTestId('tiebreaker-banner');
    expect(within(banner).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByTestId('penalty-shootout-dialog')).toBeNull();
  });

  it('@FU-071 Gegenbeispiel: mit onAdjustTime -> „Uhr korrigieren“ in „Mehr“ da; mit onStartPenaltyShootout -> Strafstoß-Knopf im Banner da', async () => {
    const user = userEvent.setup();
    const laufend = render(<LiveCockpit {...baseProps(runningMatch(), { onAdjustTime: vi.fn() })} />);
    await user.click(screen.getByTestId('cockpit-more-button'));
    expect(screen.getByTestId('mehr-uhr-korrigieren')).toBeInTheDocument();
    laufend.unmount();

    const match = runningMatch({
      tournamentPhase: 'finalRound', tiebreakerMode: 'shootout', awaitingTiebreakerChoice: true,
      homeScore: 1, awayScore: 1, status: 'PAUSED',
    });
    render(<LiveCockpit {...baseProps(match, { onStartPenaltyShootout: vi.fn() })} />);
    expect(within(screen.getByTestId('tiebreaker-banner')).getByRole('button', { name: /starten/i })).toBeInTheDocument();
  });
});
