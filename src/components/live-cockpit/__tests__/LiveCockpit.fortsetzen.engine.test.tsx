/**
 * LiveCockpit – „Spiel fortsetzen“ nach dem Abpfiff mit echter Engine (LT-6, Befund C-FORTSETZEN-NICHT-GEBUNDEN).
 * Testwerte aus dem Gherkin (docs/anforderungen/2026-10-02_spiel-leiten.md): Spiel 11, zwei Abschnitte zu 6 Minuten, 1 Minute
 * Pause; Tom hat in der letzten Minute vergessen anzuhalten, Spiel 11 ist mit Ablauf bei 2:1 von selbst beendet (@SL-074).
 * Echte Engine (fake-indexeddb), gemockt nur Ton, Sync-Anzeige, Rolle, Toast; Datum über `vi.setSystemTime`.
 * Szenarien: @SL-074, @SL-075 (alle drei Zeilen), @SL-152 Z. 4 („Weiter“ und „Spiel fortsetzen“, keine Taste zum Bestätigen),
 * @SL-146 Z. 1 (nach Abpfiff von Hand nie), @SL-147 (Client-Teil: angeboten nur in der Frist).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { looseVs } from '../../../test/matchSlotFixtures';
import { Harness } from './engineHarness';
import { HARNESS_MATCH_ID, anpfiff, eintraegeImLog, halte, warteSperre } from './engineHarnessSupport';
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
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));
vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showWarning: vi.fn(), showError: vi.fn(), showInfo: vi.fn() }),
}));

/** Spiel 11, zwei Abschnitte zu je 6 Minuten, 1 Minute Pause (stabile Referenz für das Gerüst). */
const SPIEL_11 = {
  groupPhaseGameDuration: 12, gamePeriods: 2, halftimeBreak: 1,
  matches: [{ id: HARNESS_MATCH_ID, ...looseVs('teama', 'teamb'), round: 1, field: 1, matchNumber: 11 }],
};
/** Wanduhr: Anpfiff bei 0, Halbzeit bei 6:00, Wiederanpfiff bei 7:00, Ablauf bei 13:00 (Spielzeit 12:00). */
const ABPFIFF = 780_000;
const zu = (ms: number): void => { vi.setSystemTime(T0 + ms); };
const zustand = (): HTMLElement => screen.getByTestId('scoreboard-state');
const spielzeit = (): HTMLElement => screen.queryByTestId('scoreboard-kopf-text') ?? screen.getByTestId('scoreboard-clock-sub');
const fortsetzenTaste = (): HTMLElement | null => screen.queryByTestId('match-continue-button');
const reopens = () => eintraegeImLog().filter((e) => e.type === 'REOPEN');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

async function tor(user: ReturnType<typeof userEvent.setup>, seite: 'home' | 'away', stand: string): Promise<void> {
  await user.click(await screen.findByTestId(`goal-button-${seite}`));
  await warteSperre();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.getByTestId('scoreboard-score')).toHaveTextContent(stand));
}

/** Spiel 11 bis zum Abpfiff von selbst mit 2:1 (Tom hält in der letzten Minute nicht an). */
async function vonSelbstBeendetBei21(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await anpfiff(user);
  await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
  zu(60_000); await tor(user, 'home', '1:0');
  zu(120_000); await tor(user, 'away', '1:1');
  zu(360_000);
  await waitFor(() => expect(zustand()).toHaveTextContent('Halbzeit'));
  zu(420_000);
  await user.click(screen.getByTestId('match-wiederanpfiff-button'));
  await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
  zu(480_000); await tor(user, 'home', '2:1');
  zu(ABPFIFF);
  await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
}

async function setzeFortMitRestzeit040(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByTestId('match-continue-button'));
  const dialog = await screen.findByTestId('resume-finished-dialog');
  expect(within(dialog).getByTestId('resume-rest-stepper')).toHaveTextContent('1:00'); // Vorbelegung eine Minute
  await user.click(within(dialog).getByTestId('resume-rest-stepper-minus'));
  await user.click(within(dialog).getByTestId('resume-rest-stepper-minus'));
  expect(within(dialog).getByTestId('resume-rest-stepper')).toHaveTextContent('0:40');
  await user.click(within(dialog).getByTestId('resume-apply'));
}

describe('@SL-074 Ein zu früh von selbst beendetes Spiel setzt Tom einmal fort', () => {
  it('@SL-074 20 Sekunden nach dem Abpfiff „Spiel fortsetzen“, Restzeit 0:40 → Spiel 11 läuft im zweiten Abschnitt bei Spielzeit 5:20 weiter, Stand 2:1', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={SPIEL_11} />);
    await vonSelbstBeendetBei21(user);
    zu(ABPFIFF + 20_000);
    await setzeFortMitRestzeit040(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('2:1');
    expect(spielzeit()).toHaveTextContent('5:20');
    expect(reopens()).toHaveLength(1);
    expect(reopens()[0].clockMs).toBe(360_000 + 320_000); // zweiter Abschnitt, 5:20
    expect(reopens()[0].section).toBe(2);
    expect(screen.queryByTestId('resume-finished-dialog')).toBeNull();
  });

  it('Gegenbeispiel: „Abbrechen“ im Blatt sendet nichts, der Endstand 2:1 steht weiter', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={SPIEL_11} />);
    await vonSelbstBeendetBei21(user);
    zu(ABPFIFF + 20_000);
    await user.click(screen.getByTestId('match-continue-button'));
    await user.click(within(await screen.findByTestId('resume-finished-dialog')).getByTestId('resume-cancel'));
    expect(reopens()).toHaveLength(0);
    expect(zustand()).toHaveTextContent('Ende');
    expect(fortsetzenTaste()).not.toBeNull();
  });
});

describe('@SL-152 Z. 4 im Endstand: „Weiter“ und „Spiel fortsetzen“, keine Taste zum Bestätigen', () => {
  it('@SL-152 nach dem Abpfiff von selbst stehen „Weiter“ und „Spiel fortsetzen“, aber kein „Bestätigen“', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={SPIEL_11} />);
    await vonSelbstBeendetBei21(user);
    expect(screen.getByTestId('match-next-button')).toHaveTextContent('Weiter');
    expect(fortsetzenTaste()).toHaveTextContent('Spiel fortsetzen');
    expect(screen.queryByRole('button', { name: /Bestätigen/ })).toBeNull();
  });
});

describe('@SL-075 Nach „Weiter“, nach 30 Sekunden oder ein zweites Mal setzt Toms Gerät das Spiel nicht fort', () => {
  it('@SL-075 Z. 1 Tom hat schon „Weiter“ getippt (Endstand quittiert) → kein „Spiel fortsetzen“', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness turnier={SPIEL_11} />);
    await vonSelbstBeendetBei21(user);
    expect(fortsetzenTaste()).not.toBeNull();
    rerender(<Harness turnier={SPIEL_11} endstandSteht={false} />);
    await waitFor(() => expect(fortsetzenTaste()).toBeNull());
  });

  it('@SL-075 Z. 2 seit dem Abpfiff sind mehr als 30 Sekunden vergangen → kein „Spiel fortsetzen“ (Gegenbeispiel 29 s: angeboten)', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={SPIEL_11} />);
    await vonSelbstBeendetBei21(user);
    zu(ABPFIFF + 29_000);
    await waitFor(() => expect(fortsetzenTaste()).not.toBeNull());
    zu(ABPFIFF + 31_000);
    await waitFor(() => expect(fortsetzenTaste()).toBeNull());
  });

  it('@SL-075 Z. 2 das offene Blatt schließt nach 30 Sekunden ohne Befehl, nichts wird gesendet', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={SPIEL_11} />);
    await vonSelbstBeendetBei21(user);
    zu(ABPFIFF + 25_000);
    await user.click(screen.getByTestId('match-continue-button'));
    expect(await screen.findByTestId('resume-finished-dialog')).toBeInTheDocument();
    zu(ABPFIFF + 31_000);
    await waitFor(() => expect(screen.queryByTestId('resume-finished-dialog')).toBeNull());
    expect(reopens()).toHaveLength(0);
  });

  it('Steuer innerhalb der 30 Sekunden weg und wieder da: das offene Blatt bleibt zu, nichts wird gesendet (Review #422 🟢 a)', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness turnier={SPIEL_11} />);
    await vonSelbstBeendetBei21(user);
    zu(ABPFIFF + 10_000);
    await user.click(screen.getByTestId('match-continue-button'));
    expect(await screen.findByTestId('resume-finished-dialog')).toBeInTheDocument();
    rerender(<Harness turnier={SPIEL_11} kannSteuern={false} />);
    await waitFor(() => expect(screen.queryByTestId('resume-finished-dialog')).toBeNull());
    rerender(<Harness turnier={SPIEL_11} kannSteuern />);
    await waitFor(() => expect(fortsetzenTaste()).not.toBeNull());
    expect(screen.queryByTestId('resume-finished-dialog')).toBeNull();
    expect(reopens()).toHaveLength(0);
  });

  it('@SL-075 Z. 3 Tom hat Spiel 11 schon einmal fortgesetzt, und es ist wieder von selbst beendet → kein „Spiel fortsetzen“', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={SPIEL_11} />);
    await vonSelbstBeendetBei21(user);
    zu(ABPFIFF + 20_000);
    await setzeFortMitRestzeit040(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    zu(ABPFIFF + 20_000 + 40_000); // die 0:40 sind abgelaufen
    await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
    expect(fortsetzenTaste()).toBeNull();
    expect(screen.getByTestId('match-next-button')).toBeInTheDocument();
  });
});

describe('Gegenbeispiele: kein Fortsetzen ohne Ende durch Ablauf und ohne Steuer', () => {
  it('@SL-146 Z. 1 Tom hat Spiel 11 bei Spielzeit 3:00 von Hand abgepfiffen → „Spiel fortsetzen“ wird nie angeboten', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={SPIEL_11} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    zu(180_000);
    await halte(screen.getByTestId('match-finish-button'));
    await user.click(await screen.findByRole('button', { name: 'Beenden' }));
    await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
    zu(185_000);
    expect(fortsetzenTaste()).toBeNull();
    expect(screen.getByTestId('match-next-button')).toBeInTheDocument();
  });

  it('ohne Steuerrecht (anderes Gerät leitet) steht kein „Spiel fortsetzen“', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness turnier={SPIEL_11} />);
    await vonSelbstBeendetBei21(user);
    rerender(<Harness turnier={SPIEL_11} kannSteuern={false} />);
    await waitFor(() => expect(fortsetzenTaste()).toBeNull());
  });
});
