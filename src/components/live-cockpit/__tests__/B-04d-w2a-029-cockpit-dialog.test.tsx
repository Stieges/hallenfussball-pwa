/**
 * B-04 Fixrunde 1 – @W2A-029: Die Zeitstrafe im Cockpit nimmt die Dauer aus dem Spielstand
 * (Schnitt beim Anpfiff), nicht aus einer festen 120 Sekunden.
 *
 * Gegeben ein Spiel läuft mit Zeitstrafe 2 Minuten
 * Wenn die Turnierleitung die Zeitstrafe auf 1 Minute ändert
 * Dann gilt im laufenden Spiel weiter 2 Minuten
 * Und ab dem nächsten Anpfiff gilt 1 Minute
 *
 * Pflichttest über den echten Dialog: Klick auf „Zeitstrafe für FC Alpha“ und
 * Speichern im TimePenaltyDialog. Die Dauer kommt aus dem Spielstand des Spiels.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveCockpit } from '../LiveCockpit';
import type { LiveCockpitProps } from '../types';
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../../types/tournament';

// Merge Spur A/B: LiveCockpit bindet seit C3b-1 useEngineEventEditing ein -> useActorRole (braucht
// AuthProvider); hier nicht Gegenstand (Muster wie LiveCockpit.fouls.test.tsx).
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

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

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1', number: 7, phaseLabel: 'Gruppenphase', fieldId: 'field-1',
    scheduledKickoff: new Date().toISOString(), durationSeconds: 600,
    homeTeam: { id: 'team-a', name: 'FC Alpha' }, awayTeam: { id: 'team-b', name: 'SV Beta' },
    homeScore: 1, awayScore: 0, status: 'RUNNING', elapsedSeconds: 30, playPhase: 'regular',
    events: [],
    ...overrides,
  };
}

function renderCockpit(match: unknown, cockpitTimePenaltySeconds: number, handlers: Partial<LiveCockpitProps> = {}) {
  const props: LiveCockpitProps = {
    fieldName: 'Feld 1', tournamentName: 'Test-Turnier', tournamentId: 'tour-1',
    currentMatch: match as never, upcomingMatches: [],
    cockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, timePenaltyDurationSeconds: cockpitTimePenaltySeconds },
    onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), onGoal: vi.fn(),
    onUndoLastEvent: vi.fn(), onManualEditResult: vi.fn(), onAdjustTime: vi.fn(),
    onLoadNextMatch: vi.fn(), onReopenLastMatch: vi.fn(), ...handlers,
  };
  return render(<LiveCockpit {...props} />);
}

async function confirmTimePenaltyForAlpha(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole('button', { name: /Zeitstrafe für FC Alpha/ })[0]);
  await user.click(screen.getByRole('button', { name: 'cockpit:timePenalty.save' }));
}

describe('B-04 Fixrunde 1 @W2A-029 – Zeitstrafe im Cockpit folgt dem Spielstand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Pflichttest: laufendes Spiel mit Schnitt 120 s bleibt bei 120 s, auch wenn die Turnierleitung 60 s einstellt', async () => {
    const user = userEvent.setup();
    const onTimePenalty = vi.fn();
    renderCockpit(makeMatch({ timePenaltyDurationSeconds: 120 }), 60, { onTimePenalty });

    await confirmTimePenaltyForAlpha(user);

    expect(onTimePenalty).toHaveBeenCalledWith(
      'match-1',
      'team-a',
      expect.objectContaining({ durationSeconds: 120 }),
    );
  });

  it('Gegenbeispiel: Spiel mit Schnitt 60 s bekommt 60 s, auch wenn die Einstellung 120 s sagt', async () => {
    const user = userEvent.setup();
    const onTimePenalty = vi.fn();
    renderCockpit(makeMatch({ timePenaltyDurationSeconds: 60 }), 120, { onTimePenalty });

    await confirmTimePenaltyForAlpha(user);

    expect(onTimePenalty).toHaveBeenCalledWith(
      'match-1',
      'team-a',
      expect.objectContaining({ durationSeconds: 60 }),
    );
  });
});
