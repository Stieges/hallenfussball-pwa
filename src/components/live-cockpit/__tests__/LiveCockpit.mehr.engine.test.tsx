/**
 * LiveCockpit – „Mehr“ → „Uhr korrigieren“ über die echte Engine (Plan LT-1, Auflage K10): der Punkt öffnet den Zeit-Dialog
 * unabhängig von `onAdjustTime` (das ManagementTab nicht übergibt); die Korrektur geht als CLOCK_ADJUST über die Engine.
 * Szenarien: @SL-011 (Zeit korrigieren), @SL-079 (nicht in der Halbzeitpause, nicht nach dem Abpfiff).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { Harness } from './engineHarness';
import { anpfiff, eintraegeImLog } from './engineHarnessSupport';
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
const zustand = (): HTMLElement => screen.getByTestId('scoreboard-state');
const korrekturen = () => eintraegeImLog().filter((e) => e.type === 'CLOCK_ADJUST');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Mehr → Uhr korrigieren (K10)', () => {
  it('K10 @SL-011 Mehr → „Uhr korrigieren“ öffnet den Dialog ohne onAdjustTime; +10 Sekunden → genau ein CLOCK_ADJUST', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} />); // zeitKorrektur nicht gesetzt: kein onAdjustTime am Cockpit
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    zu(60_000);
    await waitFor(() => expect(screen.getByTestId('scoreboard-clock-sub')).toHaveTextContent('Spielzeit 1:00'));

    await user.click(screen.getByTestId('cockpit-more-button'));
    await user.click(screen.getByTestId('mehr-uhr-korrigieren'));
    const dialog = await screen.findByRole('dialog', { name: /Spielzeit|Zeit/i });
    await user.click(within(dialog).getByRole('button', { name: '10 Sekunden mehr' }));
    await user.click(within(dialog).getByRole('button', { name: 'Übernehmen' }));

    await waitFor(() => expect(screen.getByTestId('scoreboard-clock-sub')).toHaveTextContent('Spielzeit 1:10'));
    expect(korrekturen()).toHaveLength(1);
    expect(korrekturen()[0]?.clockMs).toBe(70_000);
  });

  it('K10 Gegenbeispiel: ohne Änderung im Dialog („Abbrechen“) entsteht kein CLOCK_ADJUST', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    await user.click(screen.getByTestId('cockpit-more-button'));
    await user.click(screen.getByTestId('mehr-uhr-korrigieren'));
    await user.click(within(await screen.findByRole('dialog', { name: /Spielzeit|Zeit/i })).getByRole('button', { name: 'Abbrechen' }));
    expect(korrekturen()).toHaveLength(0);
  });

  it('@SL-079 Gegenbeispiel: in der Halbzeitpause fehlt der Punkt „Uhr korrigieren“, „Seiten tauschen“ bleibt', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={ZWEI_ABSCHNITTE} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    zu(360_000);
    await waitFor(() => expect(zustand()).toHaveTextContent('Halbzeit'));
    await user.click(screen.getByTestId('cockpit-more-button'));
    expect(screen.queryByTestId('mehr-uhr-korrigieren')).toBeNull();
    expect(screen.getByTestId('mehr-seiten-tauschen')).toBeInTheDocument();
  });
});

describe('S3 Steuer-Verlust bei offenem Uhr-Dialog und Blatt „Mehr“ (@SL-018)', () => {
  async function laufend(user: ReturnType<typeof userEvent.setup>) {
    const ansicht = render(<Harness turnier={ZWEI_ABSCHNITTE} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    zu(60_000);
    await waitFor(() => expect(screen.getByTestId('scoreboard-clock-sub')).toHaveTextContent('Spielzeit 1:00'));
    return ansicht;
  }

  it('@SL-018 verliert das Gerät die Steuer bei offenem Uhr-Dialog, schließt er, und es entsteht kein CLOCK_ADJUST', async () => {
    const user = userEvent.setup();
    const { rerender } = await laufend(user);
    await user.click(screen.getByTestId('cockpit-more-button'));
    await user.click(screen.getByTestId('mehr-uhr-korrigieren'));
    expect(await screen.findByRole('dialog', { name: /Spielzeit|Zeit/i })).toBeInTheDocument();
    rerender(<Harness turnier={ZWEI_ABSCHNITTE} kannSteuern={false} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Spielzeit|Zeit/i })).toBeNull());
    expect(korrekturen()).toHaveLength(0);
  });

  it('@SL-018 verliert das Gerät die Steuer bei offenem Blatt „Mehr“, schließt es', async () => {
    const user = userEvent.setup();
    const { rerender } = await laufend(user);
    await user.click(screen.getByTestId('cockpit-more-button'));
    expect(screen.getByTestId('more-sheet')).toBeInTheDocument();
    rerender(<Harness turnier={ZWEI_ABSCHNITTE} kannSteuern={false} />);
    await waitFor(() => expect(screen.queryByTestId('more-sheet')).toBeNull());
  });

  it('@SL-018 Gegenbeispiel: mit weiter bestehender Steuer bleiben Uhr-Dialog und Blatt „Mehr“ offen', async () => {
    const user = userEvent.setup();
    const { rerender } = await laufend(user);
    await user.click(screen.getByTestId('cockpit-more-button'));
    expect(screen.getByTestId('more-sheet')).toBeInTheDocument();
    rerender(<Harness turnier={ZWEI_ABSCHNITTE} kannSteuern />);
    expect(screen.getByTestId('more-sheet')).toBeInTheDocument();
    await user.click(screen.getByTestId('mehr-uhr-korrigieren'));
    rerender(<Harness turnier={ZWEI_ABSCHNITTE} kannSteuern />);
    expect(screen.getByRole('dialog', { name: /Spielzeit|Zeit/i })).toBeInTheDocument();
  });
});
