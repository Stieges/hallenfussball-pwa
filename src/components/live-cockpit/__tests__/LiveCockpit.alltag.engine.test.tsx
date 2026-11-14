/**
 * LiveCockpit – Cockpit-Alltag über die echte Engine (Paket „Testlücken A“): @SL-042 (falsches Team zurücknehmen und neu
 * erfassen) und @SL-050 (das bereitstehende Spiel pfeift ein Tipp an, auch vor seiner Uhrzeit). Echte Engine (fake-indexeddb),
 * echte Verdrahtung; gemockt nur Ton, Sync-Anzeige, Rolle, Toast-Kontext. Datum über `vi.setSystemTime`, Zeitgeber bleiben echt.
 * Spiel: FC Alpha (Heim, „FC Nord“ im Gherkin) gegen SV Beta („SV Süd“).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import type { Tournament } from '../../../types/tournament';
import { Harness } from './engineHarness';
import { anpfiff, eintraegeImLog, harnessTournament, toreImLog, warteSperre } from './engineHarnessSupport';
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
const stand = (): HTMLElement => screen.getByTestId('scoreboard-score');
const retractCount = (): number => eintraegeImLog().filter((e) => e.type === 'RETRACT').length;

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

describe('@SL-042 Ein Tor für das falsche Team wird zurückgenommen und neu erfasst', () => {
  async function starteMitFalschemTor(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await anpfiff(user);
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
    zu(192_000);
    await user.click(screen.getByTestId('goal-button-away')); // SV Süd eingetragen, FC Nord hat es erzielt
    await waitFor(() => expect(stand()).toHaveTextContent('0:1'));
    await warteSperre(); await user.keyboard('{Escape}'); // ohne Nummer weiter
    zu(200_000);
  }

  it('@SL-042 Tor für SV Süd eingetragen (0:1), zurückgenommen, Tor für FC Nord erfasst → 1:0', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starteMitFalschemTor(user);

    fireEvent.click(screen.getByTestId('match-undo-button'));
    await waitFor(() => expect(stand()).toHaveTextContent('0:0'));
    zu(203_000);
    await user.click(screen.getByTestId('goal-button-home'));
    await waitFor(() => expect(stand()).toHaveTextContent('1:0'));

    // im Log: das falsche Tor ist zurückgenommen, wirksam ist nur das Tor für FC Nord
    expect(retractCount()).toBe(1);
    expect(toreImLog().map((e) => e.teamId)).toEqual(['teama']);
  });

  it('@SL-042 Gegenbeispiel: ohne Zurücknehmen bleibt das falsche Tor stehen, das Tor für FC Nord macht daraus 1:1', async () => {
    const user = userEvent.setup();
    render(<Harness />); await starteMitFalschemTor(user);
    await user.click(screen.getByTestId('goal-button-home'));
    await waitFor(() => expect(stand()).toHaveTextContent('1:1'));
    expect(retractCount()).toBe(0);
  });
});

describe('@SL-050 Das bereitstehende Spiel pfeift ein Tipp an, auch vor seiner Uhrzeit', () => {
  // Spiel 13 steht um 15:30 an, es ist 15:14 (Ortszeit des Turniers, Europe/Berlin; November = MEZ = UTC+1).
  // Beide Zeitpunkte sind feste UTC-Zeitpunkte, damit der Test in jeder Zeitzone des Rechners dasselbe prüft.
  const VIERZEHN_UHR_VIERZEHN_UTC = Date.UTC(2026, 10, 14, 14, 14);
  const ANSTOSS_UTC = new Date(Date.UTC(2026, 10, 14, 14, 30));
  const TURNIER: Partial<Tournament> = {
    startDate: '2026-11-14',
    date: '2026-11-14',
    matches: [{ ...harnessTournament.matches[0], scheduledTime: ANSTOSS_UTC }],
  };

  it('@SL-050 Lage: der Anstoß liegt nach „jetzt“ (Spiel steht vor seiner Uhrzeit bereit)', () => {
    expect(ANSTOSS_UTC.getTime()).toBeGreaterThan(VIERZEHN_UHR_VIERZEHN_UTC);
  });

  it('@SL-050 es ist 15:14, Anstoß wäre 15:30: ein Tipp auf Anpfiff → das Spiel läuft, der Anpfiff steht bei 15:14', async () => {
    vi.setSystemTime(VIERZEHN_UHR_VIERZEHN_UTC);
    const user = userEvent.setup();
    render(<Harness turnier={TURNIER} />);

    const knopf = await screen.findByTestId('match-start-button');
    expect(knopf).toBeEnabled();
    // das Spiel steht noch vor seiner Uhrzeit bereit; das Cockpit zeigt sie in der Ortszeit des Geräts (in Berlin: 15:30)
    expect(screen.getByTestId('scoreboard-clock')).toHaveTextContent(ANSTOSS_UTC.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    await user.click(knopf);

    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
    const anpfiffEintrag = eintraegeImLog().find((e) => e.type === 'MATCH_START');
    expect(anpfiffEintrag).toBeDefined();
    expect(anpfiffEintrag?.at).toBe(VIERZEHN_UHR_VIERZEHN_UTC);
    expect(screen.getByTestId('scoreboard-clock')).toHaveAttribute('data-steht', 'false');
  });

  it('@SL-050 gleiche Lage, aber wer den Anpfiff nicht tippt, hat kein laufendes Spiel (Gegenbeispiel: die Uhrzeit pfeift nicht von allein an)', async () => {
    // Der 30-Sekunden-Takt der Tafel läuft hier über die gefälschte Uhr: so tickt er sicher NACH dem Anstoß (kein festes Warten, @TA-021)
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(VIERZEHN_UHR_VIERZEHN_UTC);
    render(<Harness turnier={TURNIER} />);
    await screen.findByTestId('match-start-button');
    vi.setSystemTime(Date.UTC(2026, 10, 14, 14, 31));
    act(() => { vi.advanceTimersByTime(30_000); });
    // @OB-068: eine Minute nach dem Anstoß meldet die Tafel „überfällig“ – der Takt hat also wirklich nach dem Anstoß getickt …
    await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('überfällig 1 Minute'));
    // … und trotzdem läuft kein Spiel: kein Anpfiff im Protokoll, kein „Live“, die Anpfiff-Taste wartet weiter auf den Tipp
    expect(eintraegeImLog().some((e) => e.type === 'MATCH_START')).toBe(false);
    expect(screen.getByTestId('scoreboard-state')).not.toHaveTextContent('Live');
    expect(screen.getByTestId('match-start-button')).toBeEnabled();
  });
});
