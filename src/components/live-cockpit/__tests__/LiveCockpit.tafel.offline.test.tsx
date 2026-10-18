/**
 * LiveCockpit: Tafel ohne Netz (Aufgabe 2.4, RF4, C-OFFUI, C-OUTBOX-ZAEHLER-NACH-PUSH Anzeige).
 * Echte Engine (fake-indexeddb), echte Verdrahtung, echter `useRejectedOutboxDialog`/`useEngineOutboxSummary`; der Sender ist
 * ein Store-gestützter Fake, der nie sendet und bei jedem `kick()` die wirklich wartenden Einträge aus dem Store meldet.
 * Szenarien: @SL-001 (Anpfiff startet die Uhr im ersten Abschnitt), @SL-064 (Uhr und Stand sichtbar), @HE-051 (Abzeichen).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { Harness } from './engineHarness';
import { anpfiff } from './engineHarnessSupport';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false,
  }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));
vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showWarning: vi.fn(), showError: vi.fn(), showInfo: vi.fn() }),
}));

// Der Timer-Hook (RUNNING) läuft über requestAnimationFrame; in `act` füllt jeder Frame die Queue neu. Kein Frame = kein Tick.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => { vi.unstubAllGlobals(); });

/** Ein Tor für FC Alpha im Bestandsablauf (Tor-Taste, „Ohne Nr.“). */
async function toreHeim(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(await screen.findByTestId('goal-button-home'));
  await user.click(await screen.findByTestId('dialog-skip-button'));
}

describe('LiveCockpit: Tafel und Abzeichen ohne Netz', () => {
  it('@SL-001 nach dem Anpfiff steht „Live“ in der Tafel, die Uhr im ersten Abschnitt bei Spielzeit 0:00, der Eintrag wartet im Ausgang', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await anpfiff(user);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
    expect(screen.getByTestId('scoreboard-clock-sub')).toHaveTextContent('Spielzeit 0:00');
    await waitFor(() => expect(screen.getByText('1 Eintrag wartet')).toBeInTheDocument()); // MATCH_START
  });

  it('RF4/C-OFFUI: ohne Netz zeigt die Tafel das eben erfasste Tor sofort, das Abzeichen zählt die wartenden Einträge aus dem Store', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await anpfiff(user);
    await toreHeim(user);
    await waitFor(() => expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('1:0'));
    await waitFor(() => expect(screen.getByText('2 Einträge warten')).toBeInTheDocument()); // MATCH_START + GOAL
  });

  it('Gegenbeispiel: ist der Ausgang leer (Gast, alles bestätigt), gibt es kein Abzeichen', async () => {
    const user = userEvent.setup();
    render(<Harness gastKonto />);
    await anpfiff(user);
    await toreHeim(user);
    await waitFor(() => expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('1:0'));
    expect(screen.queryByText(/Eintr(ag|äge) wart/)).toBeNull();
  });
});
