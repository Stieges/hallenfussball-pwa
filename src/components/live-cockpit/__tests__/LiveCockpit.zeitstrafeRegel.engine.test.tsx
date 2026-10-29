/**
 * R2 PR 4 (T7, Befund C-ZEITSTRAFE-BESCHRIFTUNG-FEST) – Zeitstrafe im Cockpit aus der Regel des Spiels, über die echte Engine.
 * Record `2026-09-27_wizard-regelinhalte`:
 * - @W2A-016: Gegeben die Turnierleitung stellt die Zeitstrafe auf 1 Minute / Wenn im Spiel eine Zeitstrafe erfasst wird /
 *   Dann dauert sie 1 Minute Spielzeit / Und eine andere Dauer bietet die Spielsteuerung nicht an.
 * - @W2A-029: Gegeben ein Spiel läuft mit Zeitstrafe 2 Minuten / Wenn die Turnierleitung die Zeitstrafe auf 1 Minute ändert /
 *   Dann gilt im laufenden Spiel weiter 2 Minuten / Und ab dem nächsten Anpfiff gilt 1 Minute.
 * Knopf-Beschriftung und Dauer kommen nach dem Anpfiff aus `rules.penaltySeconds` (Engine-Stand), vorher aus der Einstellung.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type Tournament } from '../../../types/tournament';
import { Harness } from './engineHarness';
import { HARNESS_MATCH_ID, anpfiff, eintraegeImLog, harnessContext, warteSperre } from './engineHarnessSupport';
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

type Nutzer = ReturnType<typeof userEvent.setup>;
const zu = (ms: number): void => { vi.setSystemTime(T0 + ms); };
const nummer = (n: string) => within(screen.getByTestId('number-picker')).getByRole('button', { name: n });

/** Turnier und Einstellungen mit der Zeitstrafe `sekunden` (stabil je Wert, die Harness verlangt stabile Objekte). */
const STAND = new Map<number, { turnier: Partial<Tournament>; einstellungen: { timePenaltyDurationSeconds: number } }>();
function regel(sekunden: number) {
  const vorhanden = STAND.get(sekunden);
  if (vorhanden) { return vorhanden; }
  const neu = {
    turnier: { groupPhaseGameDuration: 20, matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, timePenaltyDurationSeconds: sekunden } } as Partial<Tournament>,
    einstellungen: { timePenaltyDurationSeconds: sekunden },
  };
  STAND.set(sekunden, neu);
  return neu;
}

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

async function starte(user: Nutzer): Promise<void> {
  await anpfiff(user);
  await waitFor(() => expect(screen.getByTestId('scoreboard-state')).toHaveTextContent('Live'));
}

/** Zeitstrafe für SV Beta (Gast), Nummer 5; liefert die Dauer der Strafe im Engine-Stand in Sekunden. */
async function zeitstrafe(user: Nutzer): Promise<number | undefined> {
  await user.click(screen.getByTestId('penalty-button-away'));
  await warteSperre();
  await user.click(nummer('5'));
  await waitFor(() => expect(eintraegeImLog().filter((e) => e.type === 'TIME_PENALTY')).toHaveLength(1));
  const strafe = harnessContext().engine.view(HARNESS_MATCH_ID)?.result.state.penalties.at(-1);
  return strafe === undefined ? undefined : strafe.durationMs / 1000;
}

describe('@W2A-016 Zeitstrafendauer aus der Regel des Spiels', () => {
  it('@W2A-016 1 Minute eingestellt: der Knopf nennt 1 Min, die Strafe dauert 60 s, eine Dauer wird nicht abgefragt', async () => {
    const user = userEvent.setup();
    const { turnier, einstellungen } = regel(60);
    render(<Harness turnier={turnier} einstellungen={einstellungen} />);
    await starte(user);
    zu(60_000);
    expect(screen.getByTestId('penalty-button-away')).toHaveTextContent('Zeitstrafe 1 Min');
    expect(await zeitstrafe(user)).toBe(60);
    // Und eine andere Dauer bietet die Spielsteuerung nicht an: die App schickt keine Dauer mit
    expect(eintraegeImLog().find((e) => e.type === 'TIME_PENALTY')?.payload).not.toHaveProperty('durationSeconds');
  });

  it('Gegenbeispiel @W2A-016: ohne Einstellung gilt 2 Minuten (120 s)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await starte(user);
    zu(60_000);
    expect(screen.getByTestId('penalty-button-away')).toHaveTextContent('Zeitstrafe 2 Min');
    expect(await zeitstrafe(user)).toBe(120);
  });
});

describe('@W2A-029 Regeländerung wirkt ab dem nächsten Anpfiff – Beschriftung', () => {
  it('@W2A-029 laufendes Spiel mit 2 Min: nach der Änderung auf 1 Min nennt der Knopf weiter 2 Min, die Strafe dauert 120 s', async () => {
    const user = userEvent.setup();
    const zwei = regel(120);
    const eins = regel(60);
    const { rerender } = render(<Harness turnier={zwei.turnier} einstellungen={zwei.einstellungen} />);
    await starte(user);
    zu(60_000);
    // Turnierleitung ändert die Regel; das Cockpit bekommt den neuen Turnier-Stand und die neue Einstellung
    rerender(<Harness turnier={eins.turnier} einstellungen={eins.einstellungen} />);
    await waitFor(() => expect(screen.getByTestId('penalty-button-away')).toHaveTextContent('Zeitstrafe 2 Min'));
    expect(await zeitstrafe(user)).toBe(120);
  });
});
