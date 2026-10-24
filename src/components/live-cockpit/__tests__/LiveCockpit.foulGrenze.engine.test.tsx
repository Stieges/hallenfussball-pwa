/**
 * LiveCockpit -- Foul-Zähler je Halbzeit über die echte Engine (Aufgabe 3.3, Auflage 19).
 * Szenario @SL-099: SV Süd (hier SV Beta) hat im ersten Abschnitt 4 Fouls und im zweiten 2; ein weiteres Foul -> „Foul 3/5“.
 * Der Zähler gegen die Grenze zählt je Halbzeit, die Gesamtzahl steht erst in der Zusammenfassung (@SL-099, @SL-036, @SL-100).
 * Befund C-COCKPIT-FOULS-NICHT-JE-HALBZEIT (vorher `it.fails`, Plan Cockpit v2 A5) ist damit behoben.
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

const ZWEI_ABSCHNITTE = { groupPhaseGameDuration: 12, gamePeriods: 2, halftimeBreak: 1 };
const zu = (ms: number): void => { vi.setSystemTime(T0 + ms); };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function fouls(user: ReturnType<typeof userEvent.setup>, n: number, erwartet: number): Promise<void> {
  for (let i = 0; i < n; i += 1) { await user.click(screen.getByTestId('foul-button-away')); }
  await waitFor(() => expect(screen.getByTestId('team-fouls-away')).toHaveTextContent(`Foul ${erwartet}/5`));
}

describe('LiveCockpit – Foul-Zähler je Halbzeit (Engine)', () => {
  it('@SL-099 SV Süd 4 Fouls im ersten, 2 im zweiten Abschnitt, ein weiteres Foul → „Foul 3/5“, nach dem Abpfiff 7 Fouls im ganzen Spiel', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} />);
    await anpfiff(user);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
    await fouls(user, 4, 4);
    zu(360_000);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Halbzeit'));
    zu(420_000);
    await user.click(screen.getByTestId('match-wiederanpfiff-button'));
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
    // Nach Gherkin je Halbzeit gezählt: im zweiten Abschnitt beginnt der Zähler bei 0 (@SL-036)
    expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 0/5');
    await user.click(screen.getByTestId('foul-button-away'));
    await user.click(screen.getByTestId('foul-button-away'));
    await waitFor(() => expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 2/5'));
    await user.click(screen.getByTestId('foul-button-away'));
    await waitFor(() => expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 3/5'));
    // nach dem Abpfiff zeigt die Zusammenfassung die Gesamtzahl im ganzen Spiel (4 + 3)
    zu(420_000 + 360_000);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Ende'));
    expect(screen.getByTestId('team-summary-fouls-away')).toHaveTextContent('Fouls: 7');
  });

  it('@SL-036 Gegenbeispiel: die 4 Fouls des ersten Abschnitts stehen nach dem Anpfiff des zweiten weiter in der Liste und zählen im Spiel', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} />);
    await anpfiff(user);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
    await fouls(user, 4, 4);
    zu(360_000);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Halbzeit'));
    zu(420_000);
    await user.click(screen.getByTestId('match-wiederanpfiff-button'));
    await waitFor(() => expect(screen.getByTestId('team-fouls-away')).toHaveTextContent('Foul 0/5'));
    zu(420_000 + 360_000);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Ende'));
    expect(screen.getByTestId('team-summary-fouls-away')).toHaveTextContent('Fouls: 4');
  });

  it('@SL-099 Gegenbeispiel: im ersten Abschnitt zählt jedes Foul sofort mit (4 Fouls → „Foul 4/5“)', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} />);
    await anpfiff(user);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
    await fouls(user, 4, 4);
    expect(screen.getByTestId('team-fouls-home')).toHaveTextContent('Foul 0/5');
  });
});
