/** LiveCockpit — Ereignis-Löschung (L9). Vorher: handleEventDelete rief bei GOAL-Events zusätzlich
 *  onGoal(matchId, teamId, -1) auf, um den Score "im Vorschau-Modus" zu korrigieren. Jetzt übernimmt
 *  MatchExecutionService.deleteEvent die Score-Korrektur serverseitig — bliebe der onGoal(-1)-Aufruf
 *  hier stehen, würde der Score doppelt dekrementiert. Dieser Test beweist: onDeleteEvent wird gerufen,
 *  onGoal NICHT. */
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

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1', number: 7, phaseLabel: 'Gruppenphase', fieldId: 'field-1',
    scheduledKickoff: new Date().toISOString(), durationSeconds: 600,
    homeTeam: { id: 'team-a', name: 'FC Alpha' }, awayTeam: { id: 'team-b', name: 'SV Beta' },
    homeScore: 1, awayScore: 0, status: 'PAUSED', elapsedSeconds: 30, playPhase: 'regular',
    events: [
      // Fixwave-Fix (Minor): reales Payload-Format (MatchExecutionService.recordGoal/deleteEvent
      // schreiben `{ team: 'home'|'away', delta }`, nicht `{ teamId }` — siehe Service-Kommentar
      // bei deleteEvent). Die Fixture simulierte vorher ein Format, das der Service nie erzeugt.
      { id: 'e1', matchId: 'match-1', type: 'GOAL', timestampSeconds: 30, payload: { team: 'home', delta: 1 }, scoreAfter: { home: 1, away: 0 } },
    ],
    ...overrides,
  };
}

function baseProps(match: unknown, handlers: Partial<LiveCockpitProps> = {}): LiveCockpitProps {
  return {
    fieldName: 'Feld 1', tournamentName: 'Test-Turnier', tournamentId: 'tour-1',
    currentMatch: match as never, upcomingMatches: [],
    onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), onGoal: vi.fn(),
    onUndoLastEvent: vi.fn(), onManualEditResult: vi.fn(), onAdjustTime: vi.fn(),
    onLoadNextMatch: vi.fn(), onReopenLastMatch: vi.fn(), ...handlers,
  };
}

// Öffnet das EventEditDialog über den Bearbeiten-Button im Sidebar-Event-Log und bestätigt die Löschung.
// Selektor: Sidebar/index.tsx setzt `title={t('sidebar.edit')}` — unter dem Test-i18n-Mock (Passthrough,
// src/test/setup.ts) liefert das den Key selbst als Text ("cockpit:sidebar.edit"), nicht "Bearbeiten".
async function deleteFirstEventViaDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTitle('cockpit:sidebar.edit'));
  await user.click(screen.getByRole('button', { name: 'Löschen' }));
  await user.click(screen.getByRole('button', { name: 'Ja, löschen' }));
}

describe('LiveCockpit — Ereignis-Löschung (L9)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('L9: ruft onDeleteEvent mit matchId + eventId auf, NICHT onGoal (keine doppelte Dekrementierung)', async () => {
    const onDeleteEvent = vi.fn();
    const onGoal = vi.fn();
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch(), { onDeleteEvent, onGoal })} />);

    await deleteFirstEventViaDialog(user);

    expect(onDeleteEvent).toHaveBeenCalledWith('match-1', 'e1');
    expect(onGoal).not.toHaveBeenCalled();
  });

  it('Regression: ohne onDeleteEvent-Prop (Vorschau-Modus) wird onGoal trotzdem nicht aufgerufen', async () => {
    const onGoal = vi.fn();
    const user = userEvent.setup();
    render(<LiveCockpit {...baseProps(makeMatch(), { onGoal })} />);

    await deleteFirstEventViaDialog(user);

    expect(onGoal).not.toHaveBeenCalled();
  });
});
