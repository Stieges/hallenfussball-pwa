/**
 * LiveCockpit — Effektiver Spielstand (getEffectiveScore) und kein Minus-Knopf (@SL-037).
 *
 * Bis Aufgabe 3.3 stand hier der Minus-Button-Guard der Verlängerung (M2-Cockpit-Abschluss, 2026-09-17): „−1“ durfte in der
 * Verlängerung nicht auf `homeScore` wirken. Seit der Team-Spalte gibt es den Knopf nicht mehr (Spec § 4.2); Tor
 * zurücknehmen läuft nur über „Rückgängig“ (RETRACT). Der Guard wird deshalb durch den Fall „kein Minus-Knopf“ ersetzt.
 * Der Spielstand steht in der Tafel (`scoreboard-score`, „links:rechts“ in Anzeige-Reihenfolge) und kommt aus `getEffectiveScore`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveCockpit } from '../LiveCockpit';
import type { LiveCockpitProps } from '../types';

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));

// A4 (C-SYNC): SyncStatusIndicator (neu im Match-Header) braucht RepositoryContext via
// useSyncStatus/useRepositories -- diese Tests rendern LiveCockpit ohne Provider. isCloudSyncAvailable
// false spiegelt exakt den Gast/lokal-Fall wider (kein Provider = keine Cloud), Indicator rendert nichts.
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(),
    isCloudSyncAvailable: false,
  }),
}));

// C3b-1: LiveCockpit bindet useEngineEventEditing ein -> useActorRole (braucht AuthProvider); hier nicht Gegenstand.
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1', number: 7, phaseLabel: 'Finale', fieldId: 'field-1',
    scheduledKickoff: new Date().toISOString(), durationSeconds: 600,
    homeTeam: { id: 'team-a', name: 'FC Alpha' }, awayTeam: { id: 'team-b', name: 'SV Beta' },
    homeScore: 1, awayScore: 0, status: 'RUNNING', elapsedSeconds: 650, events: [],
    playPhase: 'regular',
    ...overrides,
  };
}

function baseProps(match: unknown, handlers: Partial<LiveCockpitProps> = {}): LiveCockpitProps {
  return {
    fieldName: 'Feld 1', tournamentName: 'Test-Turnier', tournamentId: 'tour-1',
    currentMatch: match as never, upcomingMatches: [], kannSteuern: true,
    onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), onGoal: vi.fn(),
    onUndoLastEvent: vi.fn(), onManualEditResult: vi.fn(), onAdjustTime: vi.fn(),
    onLoadNextMatch: vi.fn(), onReopenLastMatch: vi.fn(), ...handlers,
  };
}

describe('LiveCockpit — kein Minus-Knopf (@SL-037)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('@SL-037 in der Verlängerung (homeScore 1 / overtimeScoreA 0) gibt es keinen Minus-Knopf und keinen Wechsel; ein Tipp auf die Spalte ruft onGoal nicht mit −1', async () => {
    const onGoal = vi.fn();
    render(<LiveCockpit {...baseProps(makeMatch({ playPhase: 'overtime', homeScore: 1, overtimeScoreA: 0 }), { onGoal })} />);

    expect(screen.queryByTestId('goal-minus-button-home')).toBeNull();
    expect(screen.queryByRole('button', { name: /−|Minus|Tor zurück|Wechsel/ })).toBeNull();
    expect(onGoal).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), -1, expect.anything());
  });

  it('@SL-037 Gegenbeispiel: in der regulären Phase ebenfalls kein Minus-Knopf, der Tor-Knopf der Spalte bleibt', () => {
    render(<LiveCockpit {...baseProps(makeMatch({ playPhase: 'regular', homeScore: 0 }))} />);

    expect(screen.queryByTestId('goal-minus-button-home')).toBeNull();
    expect(screen.getByTestId('goal-button-home')).toBeInTheDocument();
  });
});

describe('LiveCockpit — Effektiver Spielstand (getEffectiveScore)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Golden Goal: homeScore 1 + overtimeScoreA 1, awayScore 1 → Tafel zeigt 2:1', () => {
    render(
      <LiveCockpit
        {...baseProps(makeMatch({ playPhase: 'goldenGoal', homeScore: 1, awayScore: 1, overtimeScoreA: 1, overtimeScoreB: 0 }))}
      />
    );

    expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('2:1');
  });

  it('Verlängerung beide Seiten: 1 + 1 : 1 + 2 → Tafel zeigt 2:3', () => {
    render(
      <LiveCockpit
        {...baseProps(makeMatch({ playPhase: 'overtime', homeScore: 1, awayScore: 1, overtimeScoreA: 1, overtimeScoreB: 2 }))}
      />
    );

    expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('2:3');
  });

  it('Regression: reguläre Phase — homeScore 2, awayScore 1 → Tafel zeigt 2:1 (keine overtime)', () => {
    render(
      <LiveCockpit
        {...baseProps(makeMatch({ playPhase: 'regular', homeScore: 2, awayScore: 1 }))}
      />
    );

    expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('2:1');
  });

  it('Regression: nach „Seiten tauschen" bleibt Spielstand korrekt (Effektivstand)', async () => {
    const user = userEvent.setup();
    render(
      <LiveCockpit
        {...baseProps(makeMatch({ playPhase: 'goldenGoal', homeScore: 1, awayScore: 0, overtimeScoreA: 2, overtimeScoreB: 0 }))}
      />
    );

    // Vor dem Tausch: links der Heim-Effektivstand 1+2=3, rechts der Gast-Effektivstand 0
    expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('3:0');

    await user.click(screen.getByTestId('cockpit-more-button'));
    await user.click(screen.getByTestId('mehr-seiten-tauschen'));

    // Nach dem Tausch stehen die Effektivstände auf den getauschten Seiten: 0:3
    expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('0:3');
  });
});
