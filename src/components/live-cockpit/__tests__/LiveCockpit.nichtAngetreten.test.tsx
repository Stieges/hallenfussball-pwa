/**
 * B-12 – Cockpit, Blatt „Mehr“ → „Nicht angetreten“ (Szenarien @SL-174, @SL-175, @FU-119, @SL-118).
 * @SL-174: Vor dem Anpfiff bietet „Mehr“ der Turnierleitung „Nicht angetreten“ an; der Eintrag öffnet den Dialog der Verwaltung
 * (hier: der Rückruf mit der Spiel-ID). @SL-175 Gegenbeispiele: nach dem Anpfiff und für Helfer steht dort kein „Nicht angetreten“.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { Harness } from './engineHarness';
import { anpfiff } from './engineHarnessSupport';
import { T0 } from './enginePhaseFixture';

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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('@SL-174 Mehr → Nicht angetreten (Turnierleitung, vor dem Anpfiff)', () => {
  it('@SL-174 Olli sieht den Eintrag, er ruft den Dialog der Verwaltung mit der Spiel-ID auf', async () => {
    const user = userEvent.setup();
    const onNichtAngetreten = vi.fn();
    render(<Harness istLeitung onNichtAngetreten={onNichtAngetreten} />);
    await user.click(await screen.findByTestId('cockpit-more-button'));
    await user.click(screen.getByTestId('mehr-nicht-angetreten'));
    expect(onNichtAngetreten).toHaveBeenCalledTimes(1);
    expect(typeof onNichtAngetreten.mock.calls[0][0]).toBe('string');
  });
});

describe('@SL-175 Gegenbeispiele: kein „Nicht angetreten“ unter „Mehr“', () => {
  it('@SL-175 Helfer (nicht Turnierleitung) vor dem Anpfiff → kein Eintrag', async () => {
    const user = userEvent.setup();
    render(<Harness istLeitung={false} onNichtAngetreten={vi.fn()} />);
    await user.click(await screen.findByTestId('cockpit-more-button'));
    expect(screen.queryByTestId('mehr-nicht-angetreten')).toBeNull();
    expect(screen.getByTestId('mehr-einstellungen')).toBeTruthy(); // das Blatt ist offen, nur der Punkt fehlt
  });

  it('@SL-175 Olli nach dem Anpfiff → kein Eintrag (@FU-119)', async () => {
    const user = userEvent.setup();
    render(<Harness istLeitung onNichtAngetreten={vi.fn()} />);
    await anpfiff(user);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
    await user.click(screen.getByTestId('cockpit-more-button'));
    expect(screen.queryByTestId('mehr-nicht-angetreten')).toBeNull();
    expect(screen.getByTestId('mehr-einstellungen')).toBeTruthy();
  });

  it('ohne Dialog-Rückruf der Verwaltung (A-08c: ohne Handler kein Knopf) → kein Eintrag', async () => {
    const user = userEvent.setup();
    render(<Harness istLeitung />);
    await user.click(await screen.findByTestId('cockpit-more-button'));
    expect(screen.queryByTestId('mehr-nicht-angetreten')).toBeNull();
  });
});
