/**
 * B-04 Fixrunde 1 – @W2A-029, @SL-029: Die Zeitstrafe im Cockpit folgt dem Spielstand (Schnitt beim Anpfiff), nicht einer festen
 * Dauer, und das Cockpit fragt keine Dauer ab.
 *
 * Gegeben ein Spiel läuft mit Zeitstrafe 2 Minuten
 * Wenn die Turnierleitung die Zeitstrafe auf 1 Minute ändert
 * Dann gilt im laufenden Spiel weiter 2 Minuten
 * Und ab dem nächsten Anpfiff gilt 1 Minute
 *
 * Seit Aufgabe 3.5 ohne Dialog: Der Zeitstrafen-Knopf der Spalte nennt die Dauer aus dem Spielstand („Zeitstrafe 2 Min“) und
 * die Nummernauswahl sendet nur Nummer und Spielzeit; die Dauer setzt die Engine aus der Regel (Test des Handlers in
 * `useEntryCommands.test.tsx`, Engine in `LiveCockpit.eintraege.engine.test.tsx`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveCockpit } from '../LiveCockpit';
import type { LiveCockpitProps } from '../types';
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../../types/tournament';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { warteSperre } from './engineHarnessSupport';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

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
    currentMatch: match as never, upcomingMatches: [], kannSteuern: true,
    cockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, timePenaltyDurationSeconds: cockpitTimePenaltySeconds },
    onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), onGoal: vi.fn(),
    onUndoLastEvent: vi.fn(), onManualEditResult: vi.fn(), onAdjustTime: vi.fn(),
    onLoadNextMatch: vi.fn(), onReopenLastMatch: vi.fn(), ...handlers,
  };
  return render(<LiveCockpit {...props} />);
}

async function zeitstrafeFuerAlpha(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('penalty-button-home'));
  await warteSperre();
  await user.click(screen.getByRole('button', { name: 'ohne Nummer' }));
}

describe('B-04 Fixrunde 1 @W2A-029 – Zeitstrafe im Cockpit folgt dem Spielstand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Pflichttest: laufendes Spiel mit Schnitt 120 s zeigt 2 Min, auch wenn die Turnierleitung 60 s einstellt; gesendet wird keine Dauer', async () => {
    const user = userEvent.setup();
    const onTimePenalty = vi.fn();
    renderCockpit(makeMatch({ timePenaltyDurationSeconds: 120 }), 60, { onTimePenalty });
    expect(screen.getByTestId('penalty-button-home')).toHaveTextContent('Zeitstrafe 2 Min');

    await zeitstrafeFuerAlpha(user);

    expect(onTimePenalty).toHaveBeenCalledWith('match-1', 'team-a', expect.not.objectContaining({ durationSeconds: expect.anything() }));
  });

  it('Gegenbeispiel: Spiel mit Schnitt 60 s bekommt 60 s, auch wenn die Einstellung 120 s sagt (Knopf nennt die Minuten des Spiels)', async () => {
    const user = userEvent.setup();
    const onTimePenalty = vi.fn();
    renderCockpit(makeMatch({ timePenaltyDurationSeconds: 60 }), 120, { onTimePenalty });
    expect(screen.getByTestId('penalty-button-home')).toHaveTextContent('Zeitstrafe 1 Min');

    await zeitstrafeFuerAlpha(user);

    expect(onTimePenalty).toHaveBeenCalledTimes(1);
  });
});
