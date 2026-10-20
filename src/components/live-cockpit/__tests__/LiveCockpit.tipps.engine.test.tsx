/**
 * LiveCockpit – Zahl der Tipps je Eintrag und Rückgängig über die echte Engine (Aufgabe 3.6; Szenarien @SL-124, @SL-066, @SL-038, @SL-109).
 * Jeder Tipp läuft über `tippe`; gezählt wird, was wirklich geklickt wurde. Erwartet wird außerdem genau das Ereignis im Log.
 * Beispiel „Hallencup Süd“: FC Nord = Heim (`FC Alpha` im Gerüst), SV Süd = Gast (`SV Beta`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { Harness } from './engineHarness';
import { anpfiff, eintraegeImLog, warteSperre } from './engineHarnessSupport';
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

const zu = (ms: number): void => { vi.setSystemTime(T0 + ms); };
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

type Tippen = (el: HTMLElement) => Promise<void>;
const picker = (n: string) => within(screen.getByTestId('number-picker')).getByRole('button', { name: n });
type Log = ReturnType<typeof eintraegeImLog>;
const wirksam = (log: Log, art: string) => log.filter((e) => e.type === art);

describe('@SL-124 Ein Eintrag braucht nur wenige Tipps', () => {
  it.each<[string, (tippe: Tippen) => Promise<void>, number, (log: Log) => boolean]>([
    ['ein Tor für FC Nord mit der Rückennummer 7', async (tippe) => { await tippe(screen.getByTestId('goal-button-home')); await warteSperre(); await tippe(picker('7')); }, 2,
      (log) => wirksam(log, 'GOAL').length === 1 && log.some((e) => e.type === 'AMEND')],
    ['ein Foul für SV Süd', async (tippe) => { await tippe(screen.getByTestId('foul-button-away')); }, 2,
      (log) => wirksam(log, 'FOUL').length === 1],
    ['eine Gelbe Karte für die Nummer 5 von SV Süd', async (tippe) => { await tippe(screen.getByTestId('card-button-away')); await tippe(screen.getByRole('button', { name: /Gelb$/ })); await warteSperre(); await tippe(picker('5')); }, 3,
      (log) => wirksam(log, 'YELLOW_CARD').length === 1],
    ['eine Zeitstrafe für die Nummer 5 von SV Süd', async (tippe) => { await tippe(screen.getByTestId('penalty-button-away')); await warteSperre(); await tippe(picker('5')); }, 3,
      (log) => wirksam(log, 'TIME_PENALTY').length === 1],
    ['das Zurücknehmen des jüngsten Eintrags', async (tippe) => { await tippe(screen.getByTestId('match-undo-button')); }, 1,
      (log) => log.some((e) => e.type === 'RETRACT')],
  ])('@SL-124 %s braucht höchstens die Tipps der Tabelle', async (name, ablauf, hoechstens, imLog) => {
    const u = userEvent.setup();
    render(<Harness />); await anpfiff(u);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
    if (name.startsWith('das Zurücknehmen')) {
      await u.click(screen.getByTestId('foul-button-away')); zu(2_000); // Vorbereitung, zählt nicht
    }
    let tipps = 0;
    await ablauf(async (el) => { tipps += 1; await u.click(el); });
    expect(tipps).toBeLessThanOrEqual(hoechstens);
    await waitFor(() => expect(imLog(eintraegeImLog())).toBe(true));
  });
});

describe('Rückgängig über die Leiste (@SL-066, @SL-038, @SL-109)', () => {
  // Befund C-COCKPIT-UNDO-ANPFIFF-FEHLT: die Engine nimmt MATCH_START zurück (core/match/handlers/retract.ts, Fixtures 60a–60e),
  // aber `undoTarget` (core/match/client/retractTargets.ts, KIND_BY_TYPE) bietet den Anpfiff dem Cockpit nicht als Ziel an.
  // `src/core/**` gehört Spur A (Ruling R-LT2); der Test steht deshalb als it.fails, bis dort MATCH_START aufgenommen ist.
  it.fails('@SL-066 Rückgängig direkt nach dem Anpfiff nimmt den Anpfiff zurück (Befund C-COCKPIT-UNDO-ANPFIFF-FEHLT, Ziel Spur A)', async () => {
    const u = userEvent.setup();
    render(<Harness />); await anpfiff(u);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
    await u.click(screen.getByTestId('match-undo-button'));
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Vor Anpfiff'), { timeout: 500 });
  });

  it('@SL-038 @SL-109 Rückgängig nach Tor und Pause nimmt das Tor zurück, nicht die Pause', async () => {
    const u = userEvent.setup();
    render(<Harness />); await anpfiff(u);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
    await u.click(screen.getByTestId('goal-button-home')); await warteSperre(); await u.keyboard('{Escape}');
    await u.click(screen.getByTestId('match-pause-button'));
    zu(2_000);
    await u.click(screen.getByTestId('match-undo-button'));
    await waitFor(() => expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('0:0'));
    expect(screen.getByTestId('match-resume-button')).toBeInTheDocument();
  });

  it('@SL-038 Gegenbeispiel: ohne Eintrag im Spiel gibt es kein zweites Rückgängig nach dem Tor-Rückgängig', async () => {
    const u = userEvent.setup();
    render(<Harness />); await anpfiff(u);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
    await u.click(screen.getByTestId('goal-button-home')); await warteSperre(); await u.keyboard('{Escape}');
    zu(2_000);
    await u.click(screen.getByTestId('match-undo-button'));
    await waitFor(() => expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('0:0'));
    expect(wirksam(eintraegeImLog(), 'RETRACT')).toHaveLength(1);
  });
});
