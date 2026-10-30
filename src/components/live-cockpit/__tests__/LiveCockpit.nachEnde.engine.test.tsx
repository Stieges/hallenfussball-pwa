/**
 * LiveCockpit nach dem Ende mit echter Engine (B-10a2): die Tafel zeigt, wie lange gespielt wurde (@SL-169), die Zusammenfassung
 * statt der Tastenblöcke (@SL-048) und die Leiste „Korrigieren“ nur für die Turnierleitung (@SL-159, @HE-043). Wie
 * `LiveCockpit.quittung`: echte Engine (fake-indexeddb), gemockt nur Ton, Sync-Anzeige, Rolle, Toast. Spiel 2 × 5 Minuten, Gherkin-Werte.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { Harness } from './engineHarness';
import { anpfiff, halte, warteSperre } from './engineHarnessSupport';
import { HOLD_MS } from '../../ui/atoms/HoldButton';
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

// Ein Abschnitt zu 10 Minuten: vorzeitig bei 4:00 abgepfiffen = „Gespielt 4:00 von 10:00“
const EIN_ABSCHNITT = { groupPhaseGameDuration: 10, gamePeriods: 1 };
const zu = (ms: number): void => { vi.setSystemTime(T0 + ms); };
const zustand = (): HTMLElement => screen.getByTestId('scoreboard-state');

/**
 * Zeitgrenze je Test (@TA-021, Befund C-PUBLICFINALSTANDINGS-SCREEN-FLAKE, Teil Cockpit) – Begründung: Jeder Test bis zum
 * Ende wartet ECHTE Zeit, weil die Produktregeln sie verlangen und nur `Date` gefälscht ist (fake-indexeddb braucht echte
 * Zeitgeber): Abpfiff halten `HOLD_MS` (@SL-157) plus Sperre des Nummern-Bausteins 300 ms. Dazu kommt die echte Engine mit
 * IndexedDB-Nachbau. Gemessen 30.10.: allein 1,6–2,1 s, bei Last ~17 (drei Läufe parallel neben zwei Vollläufen) bis
 * 2,5 s; im Commit-Hook bei Last ~40 über der 5-s-Vorgabe. Gewartet wird überall auf den Zustand (waitFor/findBy), nie auf
 * eine Zeit außer den beiden Produktfristen; die Grenze ist deshalb echte Wartezeit plus 10 s Rechenzeit.
 */
const ENGINE_TEST_MS = HOLD_MS + 60 + 310 + 10_000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  zu(0);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true, writable: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'vibrate');
});

async function pfeifeVonHandAb(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await halte(screen.getByTestId('match-finish-button'));
  await user.click(await screen.findByRole('button', { name: 'Beenden' }));
}

async function einTor(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(await screen.findByTestId('goal-button-home'));
  await warteSperre();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('1:0'));
}

async function bisZumVorzeitigenEnde(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await anpfiff(user);
  await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
  await einTor(user);
  zu(240_000);
  await pfeifeVonHandAb(user);
  await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
}

describe('@SL-169 Tafel nach dem Ende mit echter Engine', { timeout: ENGINE_TEST_MS }, () => {
  it('vorzeitig bei 4:00 abgepfiffen: „Ende“, kein Abschnitt, „Gespielt 4:00“ und „von 10:00“', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={EIN_ABSCHNITT} />);
    await bisZumVorzeitigenEnde(user);
    const uhr = screen.getByTestId('scoreboard-clock');
    expect(uhr).toHaveTextContent('Gespielt');
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('4:00');
    expect(screen.getByTestId('scoreboard-clock-sub')).toHaveTextContent('von 10:00');
    expect(screen.getByTestId('scoreboard')).not.toHaveTextContent('Halbzeit');
    expect(screen.getByTestId('scoreboard')).not.toHaveTextContent('Spielzeit');
  });

  it('Gegenbeispiel: im laufenden Spiel steht „Restzeit“ und kein „Gespielt“', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={EIN_ABSCHNITT} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    expect(screen.getByTestId('scoreboard-clock')).toHaveTextContent('Restzeit');
    expect(screen.getByTestId('scoreboard-clock')).not.toHaveTextContent('Gespielt');
  });

  it('regulär zu Ende gespielt (10:00 von selbst): „Gespielt 10:00“ ohne „von“', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={EIN_ABSCHNITT} />);
    await anpfiff(user);
    await waitFor(() => expect(zustand()).toHaveTextContent('Live'));
    zu(600_000);
    await waitFor(() => expect(zustand()).toHaveTextContent('Ende'));
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('10:00');
    expect(screen.getByTestId('scoreboard-clock-sub')).not.toHaveTextContent('von');
  });
});

describe('@SL-048 / @SL-159 / @HE-043 nach dem Ende mit echter Engine', { timeout: ENGINE_TEST_MS }, () => {
  it('Turnierleitung: Zusammenfassung mit dem Tor, „Korrigieren“ da, kein Hinweis „Korrektur folgt“ und kein Helfer-Hinweis', async () => {
    const user = userEvent.setup();
    const onKorrigieren = vi.fn();
    render(<Harness turnier={EIN_ABSCHNITT} istLeitung onKorrigieren={onKorrigieren} />);
    await bisZumVorzeitigenEnde(user);
    const nord = screen.getByTestId('team-summary-home');
    expect(within(nord).getByText('Tore (1)')).toBeInTheDocument();
    expect(screen.queryByTestId('goal-button-home')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Korrigieren' }));
    expect(onKorrigieren).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Korrektur folgt/)).toBeNull();
    expect(screen.queryByTestId('match-undo-hint')).toBeNull();
    expect(screen.queryByTestId('bar-finished')).toBeNull();
  });

  it('Helfer: kein „Korrigieren“, dafür „Spiel ist beendet – Korrektur über die Turnierleitung“', async () => {
    const user = userEvent.setup();
    render(<Harness turnier={EIN_ABSCHNITT} istLeitung={false} onKorrigieren={vi.fn()} />);
    await bisZumVorzeitigenEnde(user);
    expect(screen.queryByRole('button', { name: 'Korrigieren' })).toBeNull();
    expect(screen.getByTestId('bar-finished')).toHaveTextContent('Spiel ist beendet – Korrektur über die Turnierleitung');
  });
});
